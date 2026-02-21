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
};

export default function ManagerOnboarding() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [isManagerAuthenticated, setIsManagerAuthenticated] = useState(false);
  const [loadingCNPJ, setLoadingCNPJ] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [usersRows, setUsersRows] = useState<OnboardingUserRow[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingTarget, setEditingTarget] = useState<{
    companyId: number;
    userId: string;
  } | null>(null);

  const [managerLogin, setManagerLogin] = useState({
    email: "",
    password: "",
  });

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
    },
  });

  const createCompanyMutation = useMutation({
    mutationFn: async (data: typeof companyForm) => {
      const payload = {
        ...data,
        cnpj: data.cnpj.replace(/\D/g, ""),
        state: data.state.toUpperCase(),
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
    });
  };

  const openCreateForm = () => {
    setEditingTarget(null);
    resetForm();
    setShowCreateForm(true);
  };

  const openEditForm = (row: OnboardingUserRow) => {
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
    });
    setShowCreateForm(true);
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
