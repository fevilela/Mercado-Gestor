import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import {
  Building2,
  Loader2,
  Lock,
  Mail,
  MoreHorizontal,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";

type OnboardingUserRow = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  isActive: boolean;
  createdAt: string | null;
  lastLogin: string | null;
  companyId: number;
  cnpj: string;
  razaoSocial: string;
  nomeFantasia: string | null;
  companyEmail: string | null;
  companyPhone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  companyIsActive: boolean;
  roleName: string | null;
  stoneEnabled: boolean | null;
  stoneClientId: string | null;
  stoneClientSecret: string | null;
  stoneTerminalId: string | null;
  stoneEnvironment: string | null;
  mpEnabled: boolean | null;
  mpAccessToken: string | null;
  mpTerminalId: string | null;
};

export default function ManagerOnboarding() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [isManagerAuthenticated, setIsManagerAuthenticated] = useState(false);
  const [loadingCNPJ, setLoadingCNPJ] = useState(false);
  const [stoneValidationStatus, setStoneValidationStatus] = useState<
    "idle" | "connecting" | "connected"
  >("idle");
  const [mpValidationStatus, setMpValidationStatus] = useState<
    "idle" | "connecting" | "connected"
  >("idle");

  const [searchQuery, setSearchQuery] = useState("");
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [usersRows, setUsersRows] = useState<OnboardingUserRow[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [userCreateTarget, setUserCreateTarget] = useState<{
    companyId: number;
    companyName: string;
    cnpj: string;
  } | null>(null);
  const [editingTarget, setEditingTarget] = useState<{
    companyId: number;
    userId: string;
  } | null>(null);
  const [companyUserForm, setCompanyUserForm] = useState({
    name: "",
    email: "",
    roleName: "Caixa",
  });

  const [managerLogin, setManagerLogin] = useState({
    email: "",
    password: "",
  });
  const [initialMachines, setInitialMachines] = useState<
    Array<{
      key: string;
      name: string;
      provider: "mercadopago" | "stone";
      mpTerminalId: string;
      stoneTerminalId: string;
      enabled: boolean;
    }>
  >([]);
  const [initialTerminals, setInitialTerminals] = useState([
    {
      enabled: true,
      name: "Caixa 1",
      code: "CX01",
      paymentProvider: "company_default",
      paymentMachineKey: "",
      mpTerminalId: "",
      stoneTerminalId: "",
    },
    {
      enabled: false,
      name: "Caixa 2",
      code: "CX02",
      paymentProvider: "company_default",
      paymentMachineKey: "",
      mpTerminalId: "",
      stoneTerminalId: "",
    },
  ]);

  const [companyForm, setCompanyForm] = useState({
    cnpj: "",
    ie: "",
    razaoSocial: "",
    nomeFantasia: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    state: "",
    zipCode: "",
    adminName: "",
    adminEmail: "",
    stoneEnabled: false,
    stoneClientId: "",
    stoneClientSecret: "",
    stoneTerminalId: "",
    stoneEnvironment: "producao",
    mpEnabled: false,
    mpAccessToken: "",
    mpTerminalId: "",
  });

  const loadUsers = async (query = "") => {
    setLoadingUsers(true);
    try {
      const res = await fetch(
        `/api/auth/manager/onboarding-users?q=${encodeURIComponent(query)}`,
      );
      const body = await res.json();
      if (!res.ok) {
        throw new Error(body.error || "Falha ao buscar usuarios");
      }
      setUsersRows(Array.isArray(body) ? body : []);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar usuarios",
        description: error.message || "Falha inesperada",
        variant: "destructive",
      });
    } finally {
      setLoadingUsers(false);
    }
  };

  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch("/api/auth/manager/session");
        const data = await res.json();
        const authenticated = Boolean(data?.authenticated);
        setIsManagerAuthenticated(authenticated);
        if (authenticated) {
          await loadUsers("");
        }
      } catch {
        setIsManagerAuthenticated(false);
      } finally {
        setIsCheckingSession(false);
      }
    };

    check();
  }, []);

  const loginMutation = useMutation({
    mutationFn: async (data: typeof managerLogin) => {
      const res = await fetch("/api/auth/manager/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const body = await res.json();
      if (!res.ok) {
        throw new Error(body.error || "Falha ao autenticar manager");
      }

      return body;
    },
    onSuccess: async () => {
      setIsManagerAuthenticated(true);
      await loadUsers("");
      toast({ title: "Manager autenticado" });
    },
    onError: (error: any) => {
      toast({
        title: "Erro no login de manager",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await fetch("/api/auth/manager/logout", { method: "POST" });
    },
    onSuccess: () => {
      setIsManagerAuthenticated(false);
      setManagerLogin({ email: "", password: "" });
      setUsersRows([]);
      setSearchQuery("");
      setShowCreateForm(false);
      setEditingTarget(null);
      setUserCreateTarget(null);
    },
  });

  const createCompanyUserMutation = useMutation({
    mutationFn: async (
      data: typeof companyUserForm & { companyId: number; cnpj: string },
    ) => {
      const res = await fetch("/api/auth/manager/company-users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId: data.companyId,
          name: data.name,
          email: data.email,
          roleName: data.roleName,
        }),
      });

      const body = await res.json();
      if (!res.ok) {
        throw new Error(body.error || "Nao foi possivel cadastrar usuario");
      }
      return body;
    },
    onSuccess: async (result) => {
      const emailSent = result?.onboarding?.emailSent;
      const code = result?.onboarding?.code;
      toast({
        title: emailSent ? "Usuario cadastrado e convite enviado" : "Usuario cadastrado",
        description: emailSent
          ? "O usuario deve verificar o email para concluir o acesso"
          : code
            ? `Codigo gerado (dev): ${code}`
            : "Verifique configuracao SMTP no .env",
      });
      setCompanyUserForm({ name: "", email: "", roleName: "Caixa" });
      setUserCreateTarget(null);
      await loadUsers(searchQuery);
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao cadastrar usuario",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const createCompanyMutation = useMutation({
    mutationFn: async (data: typeof companyForm) => {
      const payload = {
        ...data,
        cnpj: data.cnpj.replace(/\D/g, ""),
        state: data.state.toUpperCase(),
        initialMachines: initialMachines
          .filter((m) => m.enabled && String(m.name || "").trim())
          .map((m) => ({
            key: m.key,
            name: String(m.name || "").trim(),
            provider: m.provider,
            mpTerminalId: String(m.mpTerminalId || "").trim(),
            stoneTerminalId: String(m.stoneTerminalId || "").trim(),
          })),
        initialTerminals: initialTerminals
          .filter((t) => t.enabled && String(t.name || "").trim())
          .map((t) => ({
            name: String(t.name || "").trim(),
            code: String(t.code || "").trim().toUpperCase(),
            paymentProvider: t.paymentProvider,
            paymentMachineKey: String(t.paymentMachineKey || "").trim(),
            mpTerminalId: String(t.mpTerminalId || "").trim(),
            stoneTerminalId: String(t.stoneTerminalId || "").trim(),
          })),
      };

      const res = await fetch("/api/auth/manager/companies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const body = await res.json();
      if (!res.ok) {
        throw new Error(body.error || "Nao foi possivel cadastrar a empresa");
      }

      return body;
    },
    onSuccess: async (result) => {
      const emailSent = result?.onboarding?.emailSent;
      const code = result?.onboarding?.code;

      toast({
        title: emailSent
          ? "Empresa cadastrada e email enviado"
          : "Empresa cadastrada (sem envio de email)",
        description: emailSent
          ? "O responsavel deve usar o codigo recebido para criar a senha"
          : code
            ? `Codigo gerado (dev): ${code}`
            : "Verifique configuracao SMTP no .env",
      });

      resetForm();
      setShowCreateForm(false);
      await loadUsers(searchQuery);
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao cadastrar empresa",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateCompanyMutation = useMutation({
    mutationFn: async (data: typeof companyForm & { companyId: number; userId: string }) => {
      const res = await fetch("/api/auth/manager/company", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId: data.companyId,
          userId: data.userId,
          cnpj: data.cnpj.replace(/\D/g, ""),
          razaoSocial: data.razaoSocial,
          nomeFantasia: data.nomeFantasia,
          companyEmail: data.email,
          companyPhone: data.phone,
          address: data.address,
          city: data.city,
          state: data.state,
          zipCode: data.zipCode,
          adminName: data.adminName,
          adminEmail: data.adminEmail,
          stoneEnabled: data.stoneEnabled,
          stoneClientId: data.stoneClientId,
          stoneClientSecret: data.stoneClientSecret,
          stoneTerminalId: data.stoneTerminalId,
          stoneEnvironment: data.stoneEnvironment,
          mpEnabled: data.mpEnabled,
          mpAccessToken: data.mpAccessToken,
          mpTerminalId: data.mpTerminalId,
        }),
      });

      const body = await res.json();
      if (!res.ok) {
        throw new Error(body.error || "Nao foi possivel atualizar a empresa");
      }

      return body;
    },
    onSuccess: async () => {
      toast({ title: "Cadastro atualizado com sucesso" });
      resetForm();
      setEditingTarget(null);
      setShowCreateForm(false);
      await loadUsers(searchQuery);
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao atualizar",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const setCompanyActiveMutation = useMutation({
    mutationFn: async (data: { companyId: number; isActive: boolean }) => {
      const res = await fetch("/api/auth/manager/company/set-active", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const body = await res.json();
      if (!res.ok) {
        throw new Error(body.error || "Nao foi possivel atualizar o status");
      }

      return body;
    },
    onSuccess: async (result) => {
      toast({ title: result?.message || "Status atualizado" });
      await loadUsers(searchQuery);
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao alterar status",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteCompanyMutation = useMutation({
    mutationFn: async (companyId: number) => {
      const res = await fetch("/api/auth/manager/company", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId }),
      });

      const body = await res.json();
      if (!res.ok) {
        throw new Error(body.error || "Nao foi possivel excluir a empresa");
      }

      return body;
    },
    onSuccess: async (result) => {
      toast({ title: result?.message || "Empresa excluida" });
      await loadUsers(searchQuery);
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao excluir empresa",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const resendInviteMutation = useMutation({
    mutationFn: async (data: { cnpj: string; adminEmail: string }) => {
      const res = await fetch("/api/auth/manager/resend-invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cnpj: data.cnpj,
          adminEmail: data.adminEmail,
        }),
      });

      const body = await res.json();
      if (!res.ok) {
        throw new Error(body.error || "Nao foi possivel reenviar o codigo");
      }

      return body;
    },
    onSuccess: (result) => {
      const emailSent = result?.onboarding?.emailSent;
      const code = result?.onboarding?.code;

      toast({
        title: emailSent ? "Codigo reenviado por email" : "Codigo gerado sem envio de email",
        description: emailSent
          ? "Responsavel deve verificar a caixa de entrada"
          : code
            ? `Codigo gerado (dev): ${code}`
            : "Verifique configuracao SMTP no .env",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao reenviar codigo",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const formatCNPJ = (value: string) => {
    const numbers = value.replace(/\D/g, "");
    return numbers
      .replace(/^(\d{2})(\d)/, "$1.$2")
      .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/\.(\d{3})(\d)/, ".$1/$2")
      .replace(/(\d{4})(\d)/, "$1-$2")
      .slice(0, 18);
  };

  const fetchCNPJData = async (cnpjValue: string) => {
    const cnpj = cnpjValue.replace(/\D/g, "");
    if (cnpj.length !== 14) return;

    setLoadingCNPJ(true);
    try {
      const response = await fetch(`/api/lookup-cnpj?cnpj=${cnpj}`);
      if (!response.ok) {
        throw new Error("CNPJ nao encontrado");
      }

      const data = await response.json();
      setCompanyForm((prev) => ({
        ...prev,
        razaoSocial: data.razaoSocial || prev.razaoSocial,
        nomeFantasia: data.nomeFantasia || prev.nomeFantasia,
        email: data.email || prev.email,
        phone: data.phone || prev.phone,
        address: data.address || prev.address,
        city: data.city || prev.city,
        state: (data.state || prev.state || "").toUpperCase(),
        zipCode: data.zipCode || prev.zipCode,
      }));

      toast({
        title: "CNPJ localizado",
        description: "Dados da empresa preenchidos automaticamente",
      });
    } catch {
      toast({
        title: "Nao foi possivel buscar CNPJ",
        description: "Preencha os dados manualmente",
        variant: "destructive",
      });
    } finally {
      setLoadingCNPJ(false);
    }
  };

  const resetForm = () => {
    setStoneValidationStatus("idle");
    setMpValidationStatus("idle");
    setCompanyForm({
      cnpj: "",
      ie: "",
      razaoSocial: "",
      nomeFantasia: "",
      email: "",
      phone: "",
      address: "",
      city: "",
      state: "",
      zipCode: "",
      adminName: "",
      adminEmail: "",
      stoneEnabled: false,
      stoneClientId: "",
      stoneClientSecret: "",
      stoneTerminalId: "",
      stoneEnvironment: "producao",
      mpEnabled: false,
      mpAccessToken: "",
      mpTerminalId: "",
    });
    setInitialTerminals([
      {
        enabled: true,
        name: "Caixa 1",
        code: "CX01",
        paymentProvider: "company_default",
        paymentMachineKey: "",
        mpTerminalId: "",
        stoneTerminalId: "",
      },
      {
        enabled: false,
        name: "Caixa 2",
        code: "CX02",
        paymentProvider: "company_default",
        paymentMachineKey: "",
        mpTerminalId: "",
        stoneTerminalId: "",
      },
    ]);
    setInitialMachines([]);
  };

  const openCreateForm = () => {
    setEditingTarget(null);
    setUserCreateTarget(null);
    resetForm();
    setShowCreateForm(true);
  };

  const openCreateUserForm = (row: OnboardingUserRow) => {
    setShowCreateForm(false);
    setEditingTarget(null);
    setCompanyUserForm({ name: "", email: "", roleName: "Caixa" });
    setUserCreateTarget({
      companyId: row.companyId,
      companyName: row.nomeFantasia || row.razaoSocial || "Empresa",
      cnpj: row.cnpj,
    });
  };

  const openEditForm = (row: OnboardingUserRow) => {
    setUserCreateTarget(null);
    setStoneValidationStatus("idle");
    setMpValidationStatus("idle");
    setEditingTarget({ companyId: row.companyId, userId: row.id });
    setCompanyForm({
      cnpj: formatCNPJ(row.cnpj || ""),
      ie: "",
      razaoSocial: row.razaoSocial || "",
      nomeFantasia: row.nomeFantasia || "",
      email: row.companyEmail || "",
      phone: row.companyPhone || "",
      address: row.address || "",
      city: row.city || "",
      state: row.state || "",
      zipCode: row.zipCode || "",
      adminName: row.name || "",
      adminEmail: row.email || "",
      stoneEnabled: Boolean(row.stoneEnabled),
      stoneClientId: row.stoneClientId || "",
      stoneClientSecret: row.stoneClientSecret || "",
      stoneTerminalId: row.stoneTerminalId || "",
      stoneEnvironment: row.stoneEnvironment || "producao",
      mpEnabled: Boolean(row.mpEnabled),
      mpAccessToken: row.mpAccessToken || "",
      mpTerminalId: row.mpTerminalId || "",
    });
    setShowCreateForm(true);
  };

  const handleValidateStone = () => {
    if (!companyForm.stoneEnabled) {
      toast({
        title: "Ative a integracao",
        description: "Habilite a Stone antes de testar.",
        variant: "destructive",
      });
      return;
    }

    if (
      !companyForm.stoneClientId ||
      !companyForm.stoneClientSecret ||
      !companyForm.stoneTerminalId
    ) {
      toast({
        title: "Credenciais incompletas",
        description: "Informe client id, client secret e terminal.",
        variant: "destructive",
      });
      return;
    }

    setStoneValidationStatus("connecting");
    fetch("/api/auth/manager/payments/stone/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId: companyForm.stoneClientId,
        clientSecret: companyForm.stoneClientSecret,
        terminalId: companyForm.stoneTerminalId,
        environment: companyForm.stoneEnvironment || "producao",
      }),
    })
      .then(async (response) => {
        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          throw new Error(error.error || "Falha ao validar Stone");
        }
        setStoneValidationStatus("connected");
        toast({
          title: "Stone conectada",
          description: "Credenciais validadas com sucesso.",
        });
      })
      .catch((error) => {
        setStoneValidationStatus("idle");
        toast({
          title: "Nao foi possivel conectar",
          description:
            error instanceof Error ? error.message : "Falha ao validar Stone.",
          variant: "destructive",
        });
      });
  };

  const handleValidateMercadoPago = () => {
    if (!companyForm.mpEnabled) {
      toast({
        title: "Ative a integracao",
        description: "Habilite o Mercado Pago antes de testar.",
        variant: "destructive",
      });
      return;
    }

    if (!companyForm.mpAccessToken || !companyForm.mpTerminalId) {
      toast({
        title: "Credenciais incompletas",
        description: "Informe access token e terminal/store_id|pos_id.",
        variant: "destructive",
      });
      return;
    }

    setMpValidationStatus("connecting");
    fetch("/api/auth/manager/payments/mercadopago/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        accessToken: companyForm.mpAccessToken,
        terminalId: companyForm.mpTerminalId,
      }),
    })
      .then(async (response) => {
        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          throw new Error(error.error || "Falha ao validar Mercado Pago");
        }
        setMpValidationStatus("connected");
        toast({
          title: "Mercado Pago validado",
          description: "Credenciais validadas com sucesso.",
        });
      })
      .catch((error) => {
        setMpValidationStatus("idle");
        toast({
          title: "Nao foi possivel validar",
          description:
            error instanceof Error
              ? error.message
              : "Falha ao validar Mercado Pago.",
          variant: "destructive",
        });
      });
  };

  if (isCheckingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isManagerAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-primary flex items-center justify-center">
              <Building2 className="h-6 w-6 text-primary-foreground" />
            </div>
            <CardTitle className="text-2xl">Acesso do desenvolvedor</CardTitle>
            <CardDescription>
              Entre com email e senha do manager configurados no .env
            </CardDescription>
          </CardHeader>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              loginMutation.mutate(managerLogin);
            }}
          >
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="managerEmail">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="managerEmail"
                    type="email"
                    className="pl-10"
                    value={managerLogin.email}
                    onChange={(e) =>
                      setManagerLogin((prev) => ({ ...prev, email: e.target.value }))
                    }
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="managerPassword">Senha</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="managerPassword"
                    type="password"
                    className="pl-10"
                    value={managerLogin.password}
                    onChange={(e) =>
                      setManagerLogin((prev) => ({ ...prev, password: e.target.value }))
                    }
                    required
                  />
                </div>
              </div>
            </CardContent>

            <CardFooter className="flex flex-col gap-3">
              <Button type="submit" className="w-full" disabled={loginMutation.isPending}>
                {loginMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Entrando...
                  </>
                ) : (
                  "Entrar como manager"
                )}
              </Button>

              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => setLocation("/login")}
              >
                Voltar para login
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="mx-auto w-full max-w-6xl space-y-4">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <CardTitle>Usuarios para onboarding</CardTitle>
                <CardDescription>
                  Pesquise por CNPJ, email ou nome e gerencie cada cadastro
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button onClick={openCreateForm}>Criar nova empresa</Button>
                <Button
                  variant="outline"
                  onClick={() => logoutMutation.mutate()}
                  disabled={logoutMutation.isPending}
                >
                  {logoutMutation.isPending ? "Saindo..." : "Sair do login do desenvolvedor"}
                </Button>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por CNPJ, email ou nome"
                  className="pl-10"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      loadUsers(searchQuery);
                    }
                  }}
                />
              </div>
              <Button onClick={() => loadUsers(searchQuery)} disabled={loadingUsers}>
                {loadingUsers ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Buscando...
                  </>
                ) : (
                  "Buscar"
                )}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setSearchQuery("");
                  loadUsers("");
                }}
                disabled={loadingUsers}
              >
                Limpar
              </Button>
            </div>

            <div className="rounded-md border overflow-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-3">Nome</th>
                    <th className="text-left p-3">Email</th>
                    <th className="text-left p-3">Empresa</th>
                    <th className="text-left p-3">CNPJ</th>
                    <th className="text-left p-3">Status</th>
                    <th className="text-left p-3 w-[80px]">Acoes</th>
                  </tr>
                </thead>
                <tbody>
                  {usersRows.length === 0 ? (
                    <tr>
                      <td className="p-4 text-muted-foreground" colSpan={6}>
                        Nenhum usuario encontrado
                      </td>
                    </tr>
                  ) : (
                    usersRows.map((row) => (
                      <tr key={row.id} className="border-t">
                        <td className="p-3">{row.name}</td>
                        <td className="p-3">{row.email}</td>
                        <td className="p-3">{row.nomeFantasia || row.razaoSocial}</td>
                        <td className="p-3">{formatCNPJ(row.cnpj || "")}</td>
                        <td className="p-3">
                          {row.companyIsActive ? "Ativa" : "Inativa"}
                        </td>
                        <td className="p-3">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>Acoes</DropdownMenuLabel>
                              <DropdownMenuItem
                                onClick={() => openCreateUserForm(row)}
                              >
                                Adicionar usuario
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() =>
                                  resendInviteMutation.mutate({
                                    cnpj: row.cnpj,
                                    adminEmail: row.email,
                                  })
                                }
                              >
                                Reenviar codigo
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => openEditForm(row)}>
                                Editar cadastro
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => {
                                  const nextActive = !row.companyIsActive;
                                  const label = nextActive ? "ativar" : "inativar";
                                  if (
                                    !window.confirm(
                                      `Deseja ${label} a empresa ${
                                        row.nomeFantasia || row.razaoSocial
                                      }?`,
                                    )
                                  ) {
                                    return;
                                  }
                                  setCompanyActiveMutation.mutate({
                                    companyId: row.companyId,
                                    isActive: nextActive,
                                  });
                                }}
                              >
                                {row.companyIsActive ? "Inativar" : "Ativar"}
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-red-600"
                                onClick={() => {
                                  if (
                                    !window.confirm(
                                      "Tem certeza que deseja excluir esta empresa? Essa acao pode falhar se houver dados vinculados.",
                                    )
                                  ) {
                                    return;
                                  }
                                  deleteCompanyMutation.mutate(row.companyId);
                                }}
                              >
                                Excluir
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {userCreateTarget && (
          <Card>
            <CardHeader>
              <CardTitle>Adicionar usuario</CardTitle>
              <CardDescription>
                {userCreateTarget.companyName} ({formatCNPJ(userCreateTarget.cnpj)})
              </CardDescription>
            </CardHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                createCompanyUserMutation.mutate({
                  ...companyUserForm,
                  companyId: userCreateTarget.companyId,
                  cnpj: userCreateTarget.cnpj,
                });
              }}
            >
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="newUserName">Nome *</Label>
                    <Input
                      id="newUserName"
                      value={companyUserForm.name}
                      onChange={(e) =>
                        setCompanyUserForm((prev) => ({ ...prev, name: e.target.value }))
                      }
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="newUserEmail">Email *</Label>
                    <Input
                      id="newUserEmail"
                      type="email"
                      value={companyUserForm.email}
                      onChange={(e) =>
                        setCompanyUserForm((prev) => ({ ...prev, email: e.target.value }))
                      }
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="newUserRole">Perfil</Label>
                  <select
                    id="newUserRole"
                    className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={companyUserForm.roleName}
                    onChange={(e) =>
                      setCompanyUserForm((prev) => ({ ...prev, roleName: e.target.value }))
                    }
                  >
                    <option value="Caixa">Caixa</option>
                    <option value="Caixa Sênior">Caixa Sênior</option>
                    <option value="Gerente">Gerente</option>
                    <option value="Estoquista">Estoquista</option>
                    <option value="Financeiro">Financeiro</option>
                    <option value="Visualizador">Visualizador</option>
                    <option value="Administrador">Administrador</option>
                  </select>
                </div>
              </CardContent>
              <CardFooter className="flex flex-col gap-3">
                <Button
                  type="submit"
                  className="w-full"
                  disabled={createCompanyUserMutation.isPending}
                >
                  {createCompanyUserMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Cadastrando...
                    </>
                  ) : (
                    "Cadastrar usuario e enviar convite"
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => setUserCreateTarget(null)}
                >
                  Cancelar
                </Button>
              </CardFooter>
            </form>
          </Card>
        )}

        {showCreateForm && (
          <Card>
            <CardHeader>
              <CardTitle>
                {editingTarget ? "Editar empresa" : "Criar nova empresa"}
              </CardTitle>
              <CardDescription>
                {editingTarget
                  ? "Atualize os dados e salve as alteracoes"
                  : "Cadastra empresa e envia codigo para criacao de senha"}
              </CardDescription>
            </CardHeader>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (editingTarget) {
                  updateCompanyMutation.mutate({
                    ...companyForm,
                    companyId: editingTarget.companyId,
                    userId: editingTarget.userId,
                  });
                  return;
                }
                createCompanyMutation.mutate(companyForm);
              }}
            >
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="cnpj">CNPJ *</Label>
                    <div className="relative">
                      <Input
                        id="cnpj"
                        value={companyForm.cnpj}
                        onChange={(e) =>
                          setCompanyForm((prev) => ({
                            ...prev,
                            cnpj: formatCNPJ(e.target.value),
                          }))
                        }
                        onBlur={(e) => {
                          if (!editingTarget) {
                            fetchCNPJData(e.target.value);
                          }
                        }}
                        placeholder="00.000.000/0000-00"
                        required
                      />
                      {loadingCNPJ && (
                        <div className="absolute right-3 top-3">
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="ie">IE</Label>
                    <Input
                      id="ie"
                      value={companyForm.ie}
                      onChange={(e) =>
                        setCompanyForm((prev) => ({ ...prev, ie: e.target.value }))
                      }
                      placeholder="Inscricao Estadual"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="razaoSocial">Razao social *</Label>
                    <Input
                      id="razaoSocial"
                      value={companyForm.razaoSocial}
                      onChange={(e) =>
                        setCompanyForm((prev) => ({ ...prev, razaoSocial: e.target.value }))
                      }
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="nomeFantasia">Nome fantasia</Label>
                    <Input
                      id="nomeFantasia"
                      value={companyForm.nomeFantasia}
                      onChange={(e) =>
                        setCompanyForm((prev) => ({ ...prev, nomeFantasia: e.target.value }))
                      }
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="companyEmail">Email da empresa *</Label>
                    <Input
                      id="companyEmail"
                      type="email"
                      value={companyForm.email}
                      onChange={(e) =>
                        setCompanyForm((prev) => ({ ...prev, email: e.target.value }))
                      }
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone">Telefone</Label>
                    <Input
                      id="phone"
                      value={companyForm.phone}
                      onChange={(e) =>
                        setCompanyForm((prev) => ({ ...prev, phone: e.target.value }))
                      }
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="address">Endereco</Label>
                  <Input
                    id="address"
                    value={companyForm.address}
                    onChange={(e) =>
                      setCompanyForm((prev) => ({ ...prev, address: e.target.value }))
                    }
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2 md:col-span-1">
                    <Label htmlFor="city">Cidade</Label>
                    <Input
                      id="city"
                      value={companyForm.city}
                      onChange={(e) =>
                        setCompanyForm((prev) => ({ ...prev, city: e.target.value }))
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="state">UF</Label>
                    <Input
                      id="state"
                      maxLength={2}
                      value={companyForm.state}
                      onChange={(e) =>
                        setCompanyForm((prev) => ({
                          ...prev,
                          state: e.target.value.toUpperCase(),
                        }))
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="zipCode">CEP</Label>
                    <Input
                      id="zipCode"
                      value={companyForm.zipCode}
                      onChange={(e) =>
                        setCompanyForm((prev) => ({ ...prev, zipCode: e.target.value }))
                      }
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="adminName">Nome do responsavel *</Label>
                    <Input
                      id="adminName"
                      value={companyForm.adminName}
                      onChange={(e) =>
                        setCompanyForm((prev) => ({ ...prev, adminName: e.target.value }))
                      }
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="adminEmail">Email do responsavel *</Label>
                    <Input
                      id="adminEmail"
                      type="email"
                      value={companyForm.adminEmail}
                      onChange={(e) =>
                        setCompanyForm((prev) => ({ ...prev, adminEmail: e.target.value }))
                      }
                      required
                    />
                  </div>
                </div>

                <div className="rounded-lg border p-4 space-y-4">
                  <div>
                    <h3 className="font-medium">Integracoes de maquininha</h3>
                    <p className="text-sm text-muted-foreground">
                      Configure Stone e Mercado Pago para a empresa no onboarding manager.
                    </p>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <input
                        id="stoneEnabled"
                        type="checkbox"
                        checked={companyForm.stoneEnabled}
                        onChange={(e) =>
                          setCompanyForm((prev) => ({
                            ...prev,
                            stoneEnabled: e.target.checked,
                          }))
                        }
                      />
                      <Label htmlFor="stoneEnabled">Habilitar Stone</Label>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="stoneClientId">Stone Client ID</Label>
                        <Input
                          id="stoneClientId"
                          value={companyForm.stoneClientId}
                          onChange={(e) =>
                            setCompanyForm((prev) => ({
                              ...prev,
                              stoneClientId: e.target.value,
                            }))
                          }
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="stoneClientSecret">Stone Client Secret</Label>
                        <Input
                          id="stoneClientSecret"
                          type="password"
                          value={companyForm.stoneClientSecret}
                          onChange={(e) =>
                            setCompanyForm((prev) => ({
                              ...prev,
                              stoneClientSecret: e.target.value,
                            }))
                          }
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="stoneTerminalId">Stone Terminal ID</Label>
                        <Input
                          id="stoneTerminalId"
                          value={companyForm.stoneTerminalId}
                          onChange={(e) =>
                            setCompanyForm((prev) => ({
                              ...prev,
                              stoneTerminalId: e.target.value,
                            }))
                          }
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="stoneEnvironment">Ambiente Stone</Label>
                        <select
                          id="stoneEnvironment"
                          className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                          value={companyForm.stoneEnvironment}
                          onChange={(e) =>
                            setCompanyForm((prev) => ({
                              ...prev,
                              stoneEnvironment: e.target.value,
                            }))
                          }
                        >
                          <option value="producao">Producao</option>
                          <option value="homologacao">Homologacao</option>
                        </select>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleValidateStone}
                        disabled={stoneValidationStatus === "connecting"}
                      >
                        {stoneValidationStatus === "connecting" ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Testando Stone...
                          </>
                        ) : (
                          "Testar conexao Stone"
                        )}
                      </Button>
                      {stoneValidationStatus === "connected" && (
                        <span className="text-sm text-green-600">Stone validada</span>
                      )}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <input
                        id="mpEnabled"
                        type="checkbox"
                        checked={companyForm.mpEnabled}
                        onChange={(e) =>
                          setCompanyForm((prev) => ({
                            ...prev,
                            mpEnabled: e.target.checked,
                          }))
                        }
                      />
                      <Label htmlFor="mpEnabled">Habilitar Mercado Pago</Label>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="mpAccessToken">MP Access Token</Label>
                        <Input
                          id="mpAccessToken"
                          type="password"
                          value={companyForm.mpAccessToken}
                          onChange={(e) =>
                            setCompanyForm((prev) => ({
                              ...prev,
                              mpAccessToken: e.target.value,
                            }))
                          }
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="mpTerminalId">MP Terminal (store_id|pos_id ou terminal_id)</Label>
                        <Input
                          id="mpTerminalId"
                          value={companyForm.mpTerminalId}
                          onChange={(e) =>
                            setCompanyForm((prev) => ({
                              ...prev,
                              mpTerminalId: e.target.value,
                            }))
                          }
                          placeholder="STORE123|POS456"
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleValidateMercadoPago}
                        disabled={mpValidationStatus === "connecting"}
                      >
                        {mpValidationStatus === "connecting" ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Testando Mercado Pago...
                          </>
                        ) : (
                          "Testar conexao Mercado Pago"
                        )}
                      </Button>
                      {mpValidationStatus === "connected" && (
                        <span className="text-sm text-green-600">
                          Mercado Pago validado
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {!editingTarget && (
                  <div className="rounded-lg border p-4 space-y-4">
                    <div>
                      <h3 className="font-medium">Terminais iniciais (PDV)</h3>
                      <p className="text-sm text-muted-foreground">
                        Opcional: crie os caixas iniciais e vincule a maquininha de cada um.
                      </p>
                    </div>

                    <div className="rounded-md border p-3 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-medium">Maquininhas iniciais</h4>
                          <p className="text-xs text-muted-foreground">
                            Cadastre as maquininhas e depois selecione no caixa abaixo.
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setInitialMachines((prev) => [
                              ...prev,
                              {
                                key: `machine_${Date.now()}_${prev.length + 1}`,
                                name: `Maquininha ${prev.length + 1}`,
                                provider: "mercadopago",
                                mpTerminalId: "",
                                stoneTerminalId: "",
                                enabled: true,
                              },
                            ])
                          }
                        >
                          Adicionar maquininha
                        </Button>
                      </div>

                      {initialMachines.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          Nenhuma maquininha inicial cadastrada. Os caixas podem usar o padrao da empresa.
                        </p>
                      ) : (
                        <div className="space-y-3">
                          {initialMachines.map((machine, index) => (
                            <div key={machine.key} className="rounded border p-3 space-y-3">
                              <div className="flex items-center justify-between gap-2">
                                <div className="font-medium text-sm">
                                  Maquininha {index + 1}
                                </div>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() =>
                                    setInitialMachines((prev) =>
                                      prev.filter((m) => m.key !== machine.key),
                                    )
                                  }
                                >
                                  Remover
                                </Button>
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="space-y-2">
                                  <Label>Nome</Label>
                                  <Input
                                    value={machine.name}
                                    onChange={(e) =>
                                      setInitialMachines((prev) =>
                                        prev.map((m) =>
                                          m.key === machine.key
                                            ? { ...m, name: e.target.value }
                                            : m,
                                        ),
                                      )
                                    }
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label>Marca</Label>
                                  <select
                                    className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                                    value={machine.provider}
                                    onChange={(e) =>
                                      setInitialMachines((prev) =>
                                        prev.map((m) =>
                                          m.key === machine.key
                                            ? {
                                                ...m,
                                                provider: e.target.value as
                                                  | "mercadopago"
                                                  | "stone",
                                              }
                                            : m,
                                        ),
                                      )
                                    }
                                  >
                                    <option value="mercadopago">Mercado Pago</option>
                                    <option value="stone">Stone</option>
                                  </select>
                                </div>
                                <div className="space-y-2">
                                  <Label>
                                    {machine.provider === "mercadopago"
                                      ? "MP Terminal"
                                      : "Stone Terminal ID"}
                                  </Label>
                                  <Input
                                    value={
                                      machine.provider === "mercadopago"
                                        ? machine.mpTerminalId
                                        : machine.stoneTerminalId
                                    }
                                    placeholder={
                                      machine.provider === "mercadopago"
                                        ? "STORE123|POS456"
                                        : "Terminal Stone"
                                    }
                                    onChange={(e) =>
                                      setInitialMachines((prev) =>
                                        prev.map((m) =>
                                          m.key === machine.key
                                            ? m.provider === "mercadopago"
                                              ? { ...m, mpTerminalId: e.target.value }
                                              : { ...m, stoneTerminalId: e.target.value }
                                            : m,
                                        ),
                                      )
                                    }
                                  />
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {initialTerminals.map((terminal, index) => (
                      <div key={index} className="rounded-md border p-3 space-y-3">
                        <div className="flex items-center gap-2">
                          <input
                            id={`initial-terminal-enabled-${index}`}
                            type="checkbox"
                            checked={terminal.enabled}
                            onChange={(e) =>
                              setInitialTerminals((prev) =>
                                prev.map((t, i) =>
                                  i === index ? { ...t, enabled: e.target.checked } : t,
                                ),
                              )
                            }
                          />
                          <Label htmlFor={`initial-terminal-enabled-${index}`}>
                            Criar {terminal.name || `Caixa ${index + 1}`}
                          </Label>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Nome do terminal</Label>
                            <Input
                              value={terminal.name}
                              onChange={(e) =>
                                setInitialTerminals((prev) =>
                                  prev.map((t, i) =>
                                    i === index ? { ...t, name: e.target.value } : t,
                                  ),
                                )
                              }
                              disabled={!terminal.enabled}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Codigo</Label>
                            <Input
                              value={terminal.code}
                              onChange={(e) =>
                                setInitialTerminals((prev) =>
                                  prev.map((t, i) =>
                                    i === index
                                      ? { ...t, code: e.target.value.toUpperCase() }
                                      : t,
                                  ),
                                )
                              }
                              placeholder={`CX0${index + 1}`}
                              disabled={!terminal.enabled}
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="space-y-2">
                            <Label>Maquininha cadastrada</Label>
                            <select
                              className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                              value={terminal.paymentMachineKey}
                              disabled={!terminal.enabled}
                              onChange={(e) =>
                                setInitialTerminals((prev) =>
                                  prev.map((t, i) =>
                                    i === index
                                      ? {
                                          ...t,
                                          paymentMachineKey: e.target.value,
                                          paymentProvider: e.target.value
                                            ? "company_default"
                                            : t.paymentProvider,
                                        }
                                      : t,
                                  ),
                                )
                              }
                            >
                              <option value="">Sem vinculo (usar campos abaixo/padrao)</option>
                              {initialMachines
                                .filter((m) => m.enabled)
                                .map((m) => (
                                  <option key={m.key} value={m.key}>
                                    {m.name} ({m.provider === "mercadopago" ? "MP" : "Stone"})
                                  </option>
                                ))}
                            </select>
                          </div>
                          <div className="space-y-2">
                            <Label>Maquininha (provedor)</Label>
                            <select
                              className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                              value={terminal.paymentProvider}
                              disabled={!terminal.enabled || !!terminal.paymentMachineKey}
                              onChange={(e) =>
                                setInitialTerminals((prev) =>
                                  prev.map((t, i) =>
                                    i === index
                                      ? { ...t, paymentProvider: e.target.value }
                                      : t,
                                  ),
                                )
                              }
                            >
                              <option value="company_default">Padrao da empresa</option>
                              <option value="mercadopago">Mercado Pago</option>
                              <option value="stone">Stone</option>
                            </select>
                          </div>
                          <div className="space-y-2">
                            <Label>MP Terminal</Label>
                            <Input
                              value={terminal.mpTerminalId}
                              onChange={(e) =>
                                setInitialTerminals((prev) =>
                                  prev.map((t, i) =>
                                    i === index
                                      ? { ...t, mpTerminalId: e.target.value }
                                      : t,
                                  ),
                                )
                              }
                              placeholder="STORE123|POS456"
                              disabled={!terminal.enabled || !!terminal.paymentMachineKey}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Stone Terminal ID</Label>
                            <Input
                              value={terminal.stoneTerminalId}
                              onChange={(e) =>
                                setInitialTerminals((prev) =>
                                  prev.map((t, i) =>
                                    i === index
                                      ? { ...t, stoneTerminalId: e.target.value }
                                      : t,
                                  ),
                                )
                              }
                              placeholder="Terminal Stone"
                              disabled={!terminal.enabled || !!terminal.paymentMachineKey}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>

              <CardFooter className="flex flex-col gap-3">
                <Button
                  type="submit"
                  className="w-full"
                  disabled={
                    createCompanyMutation.isPending ||
                    updateCompanyMutation.isPending ||
                    loadingCNPJ
                  }
                >
                  {createCompanyMutation.isPending || updateCompanyMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Salvando...
                    </>
                  ) : editingTarget ? (
                    "Salvar alteracoes"
                  ) : (
                    "Cadastrar empresa e enviar codigo"
                  )}
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    setShowCreateForm(false);
                    setEditingTarget(null);
                    resetForm();
                  }}
                >
                  Cancelar
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => logoutMutation.mutate()}
                  disabled={logoutMutation.isPending}
                >
                  Sair do modo manager
                </Button>
              </CardFooter>
            </form>
          </Card>
        )}
      </div>
    </div>
  );
}
