import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import {
  Building2,
  ChevronRight,
  Ellipsis,
  Filter,
  Loader2,
  Lock,
  Mail,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Store,
  Trash2,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  printerEnabled: boolean | null;
  printerModel: string | null;
  printerPort: string | null;
  printerBaudRate: number | null;
  printerColumns: number | null;
  printerCutCommand: boolean | null;
  printerBeepOnSale: boolean | null;
  receiptHeaderText: string | null;
  receiptFooterText: string | null;
  receiptShowSeller: boolean | null;
  nfcePrintLayout: {
    paperWidth?: "auto" | "58mm" | "80mm";
    fontSize?: "auto" | "small" | "normal";
    lineSpacing?: "compact" | "normal" | "comfortable";
    compactItems?: boolean;
    itemDescriptionLines?: number;
    showProtocol?: boolean;
    showAccessKey?: boolean;
    showPayments?: boolean;
    showQrCode?: boolean;
    showCustomer?: boolean;
    showCustomerDocument?: boolean;
    showTaxes?: boolean;
  } | null;
  nfeDanfeLayout: {
    fontSize?: "small" | "normal";
    lineSpacing?: "compact" | "normal" | "comfortable";
    itemDescriptionLines?: number;
    logoFit?: "contain" | "cover" | "pad";
    showAccessKey?: boolean;
    showCustomerDocument?: boolean;
    showTaxes?: boolean;
    headerText?: string;
    footerText?: string;
  } | null;
  danfeLogoUrl: string | null;
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
    password: "",
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
    adminPassword: "",
    stoneEnabled: false,
    stoneClientId: "",
    stoneClientSecret: "",
    stoneTerminalId: "",
    stoneEnvironment: "producao",
    mpEnabled: false,
    mpAccessToken: "",
    mpTerminalId: "",
    printerEnabled: false,
    printerModel: "",
    printerPort: "",
    printerBaudRate: "9600",
    printerColumns: "48",
    printerCutCommand: true,
    printerBeepOnSale: true,
    receiptHeaderText: "",
    receiptFooterText: "",
    receiptShowSeller: true,
    nfcePrintLayout: {
      paperWidth: "auto",
      fontSize: "auto",
      lineSpacing: "normal",
      compactItems: true,
      itemDescriptionLines: 2,
      showProtocol: true,
      showAccessKey: true,
      showPayments: true,
      showQrCode: true,
      showCustomer: true,
      showCustomerDocument: true,
      showTaxes: true,
    },
    nfeDanfeLayout: {
      fontSize: "normal",
      lineSpacing: "normal",
      itemDescriptionLines: 2,
      logoFit: "contain",
      showAccessKey: true,
      showCustomerDocument: true,
      showTaxes: true,
      headerText: "",
      footerText: "",
    },
    danfeLogoUrl: "",
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
          password: String((data as any).password || "").trim() || undefined,
        }),
      });

      const body = await res.json();
      if (!res.ok) {
        throw new Error(body.error || "Nao foi possivel cadastrar usuario");
      }
      return body;
    },
    onSuccess: async (result) => {
      const passwordDefined = Boolean(result?.passwordDefined);
      const emailSent = result?.onboarding?.emailSent;
      const code = result?.onboarding?.code;
      toast({
        title: passwordDefined
          ? "Usuario cadastrado com senha definida"
          : emailSent
            ? "Usuario cadastrado e convite enviado"
            : "Usuario cadastrado",
        description: passwordDefined
          ? "O usuario ja pode acessar com a senha informada"
          : emailSent
          ? "O usuario deve verificar o email para concluir o acesso"
          : code
            ? `Codigo gerado (dev): ${code}`
            : "Verifique configuracao SMTP no .env",
      });
      setCompanyUserForm({ name: "", email: "", roleName: "Caixa", password: "" });
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
        adminPassword: String(data.adminPassword || "").trim() || undefined,
        cnpj: data.cnpj.replace(/\D/g, ""),
        state: data.state.toUpperCase(),
        nfcePrintLayout: data.nfcePrintLayout,
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
      const passwordDefined = Boolean(result?.passwordDefined);
      const emailSent = result?.onboarding?.emailSent;
      const code = result?.onboarding?.code;

      toast({
        title: passwordDefined
          ? "Empresa cadastrada com senha definida"
          : emailSent
            ? "Empresa cadastrada e email enviado"
            : "Empresa cadastrada (sem envio de email)",
        description: passwordDefined
          ? "O responsavel ja pode acessar com a senha informada"
          : emailSent
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
          adminPassword: String(data.adminPassword || "").trim() || undefined,
          stoneEnabled: data.stoneEnabled,
          stoneClientId: data.stoneClientId,
          stoneClientSecret: data.stoneClientSecret,
          stoneTerminalId: data.stoneTerminalId,
          stoneEnvironment: data.stoneEnvironment,
          mpEnabled: data.mpEnabled,
          mpAccessToken: data.mpAccessToken,
          mpTerminalId: data.mpTerminalId,
          printerEnabled: data.printerEnabled,
          printerModel: data.printerModel,
          printerPort: data.printerPort,
          printerBaudRate: Number(data.printerBaudRate || 9600),
          printerColumns: Number(data.printerColumns || 48),
          printerCutCommand: data.printerCutCommand,
          printerBeepOnSale: data.printerBeepOnSale,
          receiptHeaderText: data.receiptHeaderText,
          receiptFooterText: data.receiptFooterText,
          receiptShowSeller: data.receiptShowSeller,
        nfcePrintLayout: data.nfcePrintLayout,
        nfeDanfeLayout: data.nfeDanfeLayout,
        danfeLogoUrl: data.danfeLogoUrl,
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
      adminPassword: "",
      stoneEnabled: false,
      stoneClientId: "",
      stoneClientSecret: "",
      stoneTerminalId: "",
      stoneEnvironment: "producao",
      mpEnabled: false,
      mpAccessToken: "",
      mpTerminalId: "",
      printerEnabled: false,
      printerModel: "",
      printerPort: "",
      printerBaudRate: "9600",
      printerColumns: "48",
      printerCutCommand: true,
      printerBeepOnSale: true,
      receiptHeaderText: "",
      receiptFooterText: "",
      receiptShowSeller: true,
      nfcePrintLayout: {
        paperWidth: "auto",
        fontSize: "auto",
        lineSpacing: "normal",
        compactItems: true,
        itemDescriptionLines: 2,
        showProtocol: true,
        showAccessKey: true,
        showPayments: true,
        showQrCode: true,
        showCustomer: true,
        showCustomerDocument: true,
        showTaxes: true,
      },
      nfeDanfeLayout: {
        fontSize: "normal",
        lineSpacing: "normal",
        itemDescriptionLines: 2,
        logoFit: "contain",
        showAccessKey: true,
        showCustomerDocument: true,
        showTaxes: true,
        headerText: "",
        footerText: "",
      },
      danfeLogoUrl: "",
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
    setCompanyUserForm({ name: "", email: "", roleName: "Caixa", password: "" });
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
      adminPassword: "",
      stoneEnabled: Boolean(row.stoneEnabled),
      stoneClientId: row.stoneClientId || "",
      stoneClientSecret: row.stoneClientSecret || "",
      stoneTerminalId: row.stoneTerminalId || "",
      stoneEnvironment: row.stoneEnvironment || "producao",
      mpEnabled: Boolean(row.mpEnabled),
      mpAccessToken: row.mpAccessToken || "",
      mpTerminalId: row.mpTerminalId || "",
      printerEnabled: Boolean(row.printerEnabled),
      printerModel: row.printerModel || "",
      printerPort: row.printerPort || "",
      printerBaudRate: String(row.printerBaudRate || 9600),
      printerColumns: String(row.printerColumns || 48),
      printerCutCommand:
        row.printerCutCommand === null ? true : Boolean(row.printerCutCommand),
      printerBeepOnSale:
        row.printerBeepOnSale === null ? true : Boolean(row.printerBeepOnSale),
      receiptHeaderText: row.receiptHeaderText || "",
      receiptFooterText: row.receiptFooterText || "",
      receiptShowSeller:
        row.receiptShowSeller === null ? true : Boolean(row.receiptShowSeller),
      nfcePrintLayout: {
        paperWidth: row.nfcePrintLayout?.paperWidth || "auto",
        fontSize: row.nfcePrintLayout?.fontSize || "auto",
        lineSpacing: row.nfcePrintLayout?.lineSpacing || "normal",
        compactItems:
          row.nfcePrintLayout?.compactItems === undefined
            ? true
            : Boolean(row.nfcePrintLayout.compactItems),
        itemDescriptionLines:
          Number(row.nfcePrintLayout?.itemDescriptionLines || 2) || 2,
        showProtocol:
          row.nfcePrintLayout?.showProtocol === undefined
            ? true
            : Boolean(row.nfcePrintLayout.showProtocol),
        showAccessKey:
          row.nfcePrintLayout?.showAccessKey === undefined
            ? true
            : Boolean(row.nfcePrintLayout.showAccessKey),
        showPayments:
          row.nfcePrintLayout?.showPayments === undefined
            ? true
            : Boolean(row.nfcePrintLayout.showPayments),
        showQrCode:
          row.nfcePrintLayout?.showQrCode === undefined
            ? true
            : Boolean(row.nfcePrintLayout.showQrCode),
        showCustomer:
          row.nfcePrintLayout?.showCustomer === undefined
            ? true
            : Boolean(row.nfcePrintLayout.showCustomer),
        showCustomerDocument:
          row.nfcePrintLayout?.showCustomerDocument === undefined
            ? true
            : Boolean(row.nfcePrintLayout.showCustomerDocument),
        showTaxes:
          row.nfcePrintLayout?.showTaxes === undefined
            ? true
            : Boolean(row.nfcePrintLayout.showTaxes),
      },
      nfeDanfeLayout: {
        fontSize: row.nfeDanfeLayout?.fontSize || "normal",
        lineSpacing: row.nfeDanfeLayout?.lineSpacing || "normal",
        itemDescriptionLines: Number(row.nfeDanfeLayout?.itemDescriptionLines || 2) || 2,
        logoFit:
          row.nfeDanfeLayout?.logoFit === "cover"
            ? "cover"
            : row.nfeDanfeLayout?.logoFit === "pad"
              ? "pad"
              : "contain",
        showAccessKey:
          row.nfeDanfeLayout?.showAccessKey === undefined ? true : Boolean(row.nfeDanfeLayout.showAccessKey),
        showCustomerDocument:
          row.nfeDanfeLayout?.showCustomerDocument === undefined
            ? true
            : Boolean(row.nfeDanfeLayout.showCustomerDocument),
        showTaxes:
          row.nfeDanfeLayout?.showTaxes === undefined ? true : Boolean(row.nfeDanfeLayout.showTaxes),
        headerText: String(row.nfeDanfeLayout?.headerText || ""),
        footerText: String(row.nfeDanfeLayout?.footerText || ""),
      },
      danfeLogoUrl: row.danfeLogoUrl || "",
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

  const handleDanfeLogoFileChange = (file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({
        title: "Arquivo invalido",
        description: "Selecione uma imagem (PNG, JPG, SVG, etc.)",
        variant: "destructive",
      });
      return;
    }

    const maxBytes = 2 * 1024 * 1024;
    if (file.size > maxBytes) {
      toast({
        title: "Imagem muito grande",
        description: "Use uma imagem de ate 2 MB para evitar PDF pesado.",
        variant: "destructive",
      });
      return;
    }

    const resizeLogoDataUrl = async (dataUrl: string) => {
      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("Falha ao processar imagem"));
        img.src = dataUrl;
      });

      const logoFitMode =
        companyForm.nfeDanfeLayout?.logoFit === "cover"
          ? "cover"
          : companyForm.nfeDanfeLayout?.logoFit === "pad"
            ? "pad"
            : "contain";
      const maxWidth = 600;
      const maxHeight = 220;
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas indisponivel");
      if (logoFitMode === "cover") {
        canvas.width = maxWidth;
        canvas.height = maxHeight;
        const targetRatio = maxWidth / maxHeight;
        const sourceRatio = img.width / img.height;
        let sx = 0;
        let sy = 0;
        let sw = img.width;
        let sh = img.height;

        if (sourceRatio > targetRatio) {
          sw = Math.max(1, Math.round(img.height * targetRatio));
          sx = Math.max(0, Math.floor((img.width - sw) / 2));
        } else if (sourceRatio < targetRatio) {
          sh = Math.max(1, Math.round(img.width / targetRatio));
          sy = Math.max(0, Math.floor((img.height - sh) / 2));
        }

        ctx.clearRect(0, 0, maxWidth, maxHeight);
        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, maxWidth, maxHeight);
      } else if (logoFitMode === "pad") {
        canvas.width = maxWidth;
        canvas.height = maxHeight;
        const scale = Math.min(maxWidth / img.width, maxHeight / img.height, 1);
        const width = Math.max(1, Math.round(img.width * scale));
        const height = Math.max(1, Math.round(img.height * scale));
        const dx = Math.floor((maxWidth - width) / 2);
        const dy = Math.floor((maxHeight - height) / 2);
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, maxWidth, maxHeight);
        ctx.drawImage(img, dx, dy, width, height);
      } else {
        const scale = Math.min(maxWidth / img.width, maxHeight / img.height, 1);
        const width = Math.max(1, Math.round(img.width * scale));
        const height = Math.max(1, Math.round(img.height * scale));
        canvas.width = width;
        canvas.height = height;
        ctx.clearRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
      }

      const preferredType =
        file.type === "image/jpeg" || file.type === "image/jpg"
          ? "image/jpeg"
          : "image/png";
      return canvas.toDataURL(preferredType, 0.92);
    };

    const reader = new FileReader();
    reader.onload = async () => {
      const result = String(reader.result || "");
      if (!result.startsWith("data:image/")) {
        toast({
          title: "Falha ao ler imagem",
          variant: "destructive",
        });
        return;
      }
      try {
        const resized = await resizeLogoDataUrl(result);
        setCompanyForm((prev) => ({ ...prev, danfeLogoUrl: resized }));
        toast({
          title: "Logo carregada",
          description: `${file.name} (redimensionada para caber no DANFE)`,
        });
      } catch {
        setCompanyForm((prev) => ({ ...prev, danfeLogoUrl: result }));
        toast({
          title: "Logo carregada",
          description: `${file.name} (sem redimensionamento)`,
        });
      }
    };
    reader.onerror = () =>
      toast({ title: "Falha ao ler imagem", variant: "destructive" });
    reader.readAsDataURL(file);
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

  const companyRows = useMemo(() => {
    const grouped = new Map<
      number,
      {
        companyId: number;
        companyName: string;
        cnpj: string;
        companyIsActive: boolean;
        adminRow: OnboardingUserRow;
        users: OnboardingUserRow[];
      }
    >();

    for (const row of usersRows) {
      const existing = grouped.get(row.companyId);
      if (!existing) {
        grouped.set(row.companyId, {
          companyId: row.companyId,
          companyName: row.nomeFantasia || row.razaoSocial || "Empresa",
          cnpj: row.cnpj || "",
          companyIsActive: Boolean(row.companyIsActive),
          adminRow: row,
          users: [row],
        });
        continue;
      }

      existing.users.push(row);
      if (String(row.roleName || "").toLowerCase().includes("admin")) {
        existing.adminRow = row;
      }
    }

    return Array.from(grouped.values()).sort((a, b) =>
      a.companyName.localeCompare(b.companyName, "pt-BR"),
    );
  }, [usersRows]);

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
    <div className="min-h-screen bg-[#eceffd] p-4 md:px-6 md:py-10">
      <div className="mx-auto w-full max-w-5xl space-y-4">
        <Card className="rounded-xl border-[#dbe1ff] bg-[#fcfcff] shadow-[0_6px_20px_rgba(50,74,136,0.08)]">
          <CardHeader className="space-y-4 pb-2 pt-5">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <CardTitle className="text-[16px] leading-tight text-[#2f3a57]">Empresas (Manager)</CardTitle>
                <CardDescription className="mt-1 text-[11px] text-[#77819c]">
                  Tela principal por empresa. Usuarios ficam como detalhe de cada empresa.
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  onClick={openCreateForm}
                  size="sm"
                  className="h-8 rounded-md bg-[#2f6fdb] px-3 text-[11px] font-medium hover:bg-[#265fc0]"
                >
                  <Plus className="mr-1 h-3.5 w-3.5" /> Nova Empresa
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 rounded-md border-[#d7dbec] bg-white"
                    >
                      <Ellipsis className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={() => {
                        setSearchQuery("");
                        loadUsers("");
                      }}
                    >
                      Limpar busca
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => logoutMutation.mutate()}
                      disabled={logoutMutation.isPending}
                    >
                      {logoutMutation.isPending
                        ? "Saindo..."
                        : "Sair do login do desenvolvedor"}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-3 pb-4">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por CNPJ, empresa, email ou usuario..."
                  className="h-9 rounded-md border-[#d7dbec] bg-[#f9faff] pl-9 text-sm placeholder:text-[#9aa3bc]"
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
              <div className="inline-flex items-center rounded-md border border-[#d7dbec] bg-white">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 rounded-none border-r border-[#d7dbec] text-[#6f7b99]"
                  onClick={() => loadUsers(searchQuery)}
                  disabled={loadingUsers}
                >
                  {loadingUsers ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <MoreHorizontal className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  className="h-9 rounded-none px-3 text-xs text-[#4f5a78]"
                  onClick={() => loadUsers(searchQuery)}
                  disabled={loadingUsers}
                >
                  <Filter className="mr-1.5 h-3.5 w-3.5" />
                  Filtros
                </Button>
              </div>
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9 rounded-md border-[#d7dbec]"
                aria-label="Mais opcoes"
                onClick={() => {
                  setSearchQuery("");
                  loadUsers("");
                }}
                disabled={loadingUsers}
              >
                <Ellipsis className="h-4 w-4" />
              </Button>
            </div>

            <div className="overflow-auto rounded-lg border border-[#d7dbec] bg-white">
              <table className="w-full min-w-[760px] text-sm">
                <thead className="bg-[#f4f6fd]">
                  <tr className="text-[#5b6785]">
                    <th className="px-3 py-2 text-left text-xs font-semibold">Empresa</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold">CNPJ</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold">Responsável</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold">Usuários</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold">Status</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold">Ações</th>
                  </tr>
                </thead>
                <tbody className="bg-white">
                  {companyRows.length === 0 ? (
                    <tr className="border-t">
                      <td className="px-3 py-4 text-sm text-muted-foreground" colSpan={6}>
                        Nenhuma empresa encontrada
                      </td>
                    </tr>
                  ) : (
                    companyRows.map((company) => (
                      <tr key={company.companyId} className="border-t border-[#edf0fb] align-top">
                        <td className="px-3 py-3">
                          <div className="flex items-start gap-2">
                            <span className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded bg-[#e9f1ff] text-[#2f6fdb]">
                              <Store className="h-3.5 w-3.5" />
                            </span>
                            <div>
                              <div className="font-medium text-[#2b3550]">{company.companyName}</div>
                              <div className="text-[11px] text-muted-foreground">
                                ID {company.companyId}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-[#3c4763]">
                          {formatCNPJ(company.cnpj || "")}
                        </td>
                        <td className="px-3 py-3">
                          <div className="text-[#2b3550]">{company.adminRow.name}</div>
                          <div className="text-[11px] text-muted-foreground">
                            {company.adminRow.email}
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <details>
                            <summary className="flex cursor-pointer items-center gap-1 text-[#2b3550]">
                              <ChevronRight className="h-3.5 w-3.5" />
                              <span className="inline-flex items-center gap-1 text-xs">
                                <Users className="h-3 w-3" />
                                {company.users.length} usuários
                              </span>
                            </summary>
                            <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                              {company.users.slice(0, 6).map((u) => (
                                <div key={u.id} className="rounded border border-dashed p-2">
                                  <div>
                                    {u.name} ({u.roleName || "Sem perfil"})
                                  </div>
                                  <div className="mt-1 flex items-center gap-2">
                                    <code className="break-all text-[10px]">{u.id}</code>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 px-2 text-[10px]"
                                      onClick={(e) => {
                                        e.preventDefault();
                                        navigator.clipboard
                                          .writeText(u.id)
                                          .then(() =>
                                            toast({
                                              title: "ID copiado",
                                              description: `Usuario: ${u.name}`,
                                            }),
                                          )
                                          .catch(() =>
                                            toast({
                                              title: "Falha ao copiar",
                                              variant: "destructive",
                                            }),
                                          );
                                      }}
                                    >
                                      Copiar ID
                                    </Button>
                                  </div>
                                </div>
                              ))}
                              {company.users.length > 6 ? (
                                <div>... e mais {company.users.length - 6}</div>
                              ) : null}
                            </div>
                          </details>
                        </td>
                        <td className="px-3 py-3">
                          <Badge
                            variant="secondary"
                            className={
                              company.companyIsActive
                                ? "border-0 bg-[#c8f4dd] text-[#137a45]"
                                : "border-0 bg-[#ffe1e1] text-[#9b2727]"
                            }
                          >
                            {company.companyIsActive ? "Ativa" : "Inativa"}
                          </Badge>
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-[#4a5675]"
                              onClick={() => openEditForm(company.adminRow)}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-[#d25555]"
                              onClick={() => {
                                if (
                                  !window.confirm(
                                    "Tem certeza que deseja excluir esta empresa? Essa acao pode falhar se houver dados vinculados.",
                                  )
                                ) {
                                  return;
                                }
                                deleteCompanyMutation.mutate(company.companyId);
                              }}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-7 w-7">
                                  <MoreHorizontal className="h-3.5 w-3.5" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuLabel>Acoes</DropdownMenuLabel>
                                <DropdownMenuItem
                                  onClick={() => openCreateUserForm(company.adminRow)}
                                >
                                  Adicionar usuario
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() =>
                                    resendInviteMutation.mutate({
                                      cnpj: company.adminRow.cnpj,
                                      adminEmail: company.adminRow.email,
                                    })
                                  }
                                >
                                  Reenviar codigo
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => {
                                    const nextActive = !company.companyIsActive;
                                    const label = nextActive ? "ativar" : "inativar";
                                    if (
                                      !window.confirm(
                                        `Deseja ${label} a empresa ${
                                          company.companyName
                                        }?`,
                                      )
                                    ) {
                                      return;
                                    }
                                    setCompanyActiveMutation.mutate({
                                      companyId: company.companyId,
                                      isActive: nextActive,
                                    });
                                  }}
                                >
                                  {company.companyIsActive ? "Inativar" : "Ativar"}
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
              <div className="flex items-center justify-end gap-1 border-t border-[#edf0fb] bg-white px-3 py-2 text-xs text-[#67738f]">
                <button className="rounded border px-2 py-1 leading-none" type="button">
                  ‹
                </button>
                <span className="px-1 font-medium">1</span>
                <button className="rounded border px-2 py-1 leading-none" type="button">
                  Próximo
                </button>
              </div>
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
              <p className="text-xs text-muted-foreground">
                O ID do novo usuario sera gerado automaticamente ao salvar.
              </p>
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
                <div className="space-y-2">
                  <Label htmlFor="newUserPassword">Senha inicial (opcional)</Label>
                  <Input
                    id="newUserPassword"
                    type="password"
                    minLength={6}
                    value={companyUserForm.password}
                    onChange={(e) =>
                      setCompanyUserForm((prev) => ({ ...prev, password: e.target.value }))
                    }
                    placeholder="Minimo 6 caracteres"
                  />
                  <p className="text-xs text-muted-foreground">
                    Se preencher, o usuario acessa direto sem precisar de codigo por email.
                  </p>
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
                    companyUserForm.password.trim().length >= 6
                      ? "Cadastrar usuario com senha"
                      : "Cadastrar usuario e enviar convite"
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
                <div className="space-y-2">
                  <Label htmlFor="adminPassword">
                    {editingTarget
                      ? "Nova senha do responsavel (opcional)"
                      : "Senha inicial do responsavel (opcional)"}
                  </Label>
                  <Input
                    id="adminPassword"
                    type="password"
                    minLength={6}
                    value={companyForm.adminPassword}
                    onChange={(e) =>
                      setCompanyForm((prev) => ({ ...prev, adminPassword: e.target.value }))
                    }
                    placeholder="Minimo 6 caracteres"
                  />
                  <p className="text-xs text-muted-foreground">
                    {editingTarget
                      ? "Se preencher, atualiza a senha do responsavel."
                      : "Se preencher, nao envia codigo por email e o responsavel acessa direto."}
                  </p>
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

                <div className="rounded-lg border p-4 space-y-4">
                  <div>
                    <h3 className="font-medium">Impressora termica</h3>
                    <p className="text-sm text-muted-foreground">
                      Configure a impressora no onboarding do manager.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      id="printerEnabled"
                      type="checkbox"
                      checked={companyForm.printerEnabled}
                      onChange={(e) =>
                        setCompanyForm((prev) => ({
                          ...prev,
                          printerEnabled: e.target.checked,
                        }))
                      }
                    />
                    <Label htmlFor="printerEnabled">Habilitar impressora</Label>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="printerModel">Modelo</Label>
                      <select
                        id="printerModel"
                        className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                        value={companyForm.printerModel}
                        onChange={(e) =>
                          setCompanyForm((prev) => ({
                            ...prev,
                            printerModel: e.target.value,
                            printerPort:
                              e.target.value === "minipdv-m10-integrated"
                                ? ""
                                : prev.printerPort,
                            printerColumns:
                              e.target.value === "minipdv-m10-integrated"
                                ? "32"
                                : prev.printerColumns,
                          }))
                        }
                      >
                        <option value="">Selecione o modelo</option>
                        <option value="epson-tm-t20">Epson TM-T20</option>
                        <option value="epson-tm-t88">Epson TM-T88</option>
                        <option value="bematech-mp4200">Bematech MP-4200 TH</option>
                        <option value="elgin-i9">Elgin i9</option>
                        <option value="daruma-dr800">Daruma DR800</option>
                        <option value="sweda-si-300">Sweda SI-300</option>
                        <option value="generic-escpos">Generica ESC/POS</option>
                        <option value="minipdv-m10-integrated">
                          MiniPDV M10 (integrada)
                        </option>
                      </select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="printerPort">Porta</Label>
                      <select
                        id="printerPort"
                        className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                        value={companyForm.printerPort}
                        disabled={companyForm.printerModel === "minipdv-m10-integrated"}
                        onChange={(e) =>
                          setCompanyForm((prev) => ({
                            ...prev,
                            printerPort: e.target.value,
                          }))
                        }
                      >
                        <option value="">Selecione a porta</option>
                        <option value="USB001">USB001</option>
                        <option value="USB002">USB002</option>
                        <option value="COM1">COM1 (Serial)</option>
                        <option value="COM2">COM2 (Serial)</option>
                        <option value="COM3">COM3 (Serial)</option>
                        <option value="LPT1">LPT1 (Paralela)</option>
                        <option value="network">Rede (IP)</option>
                      </select>
                      {companyForm.printerModel === "minipdv-m10-integrated" && (
                        <p className="text-xs text-muted-foreground">
                          Impressora integrada: porta nao se aplica.
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="printerBaudRate">Baud rate</Label>
                      <select
                        id="printerBaudRate"
                        className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                        value={companyForm.printerBaudRate}
                        onChange={(e) =>
                          setCompanyForm((prev) => ({
                            ...prev,
                            printerBaudRate: e.target.value,
                          }))
                        }
                      >
                        <option value="9600">9600</option>
                        <option value="19200">19200</option>
                        <option value="38400">38400</option>
                        <option value="57600">57600</option>
                        <option value="115200">115200</option>
                      </select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="printerColumns">Colunas</Label>
                      <select
                        id="printerColumns"
                        className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                        value={companyForm.printerColumns}
                        onChange={(e) =>
                          setCompanyForm((prev) => ({
                            ...prev,
                            printerColumns: e.target.value,
                          }))
                        }
                      >
                        <option value="32">32 (58mm)</option>
                        <option value="42">42 (76mm)</option>
                        <option value="48">48 (80mm)</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex items-center gap-2">
                      <input
                        id="printerCutCommand"
                        type="checkbox"
                        checked={companyForm.printerCutCommand}
                        onChange={(e) =>
                          setCompanyForm((prev) => ({
                            ...prev,
                            printerCutCommand: e.target.checked,
                          }))
                        }
                      />
                      <Label htmlFor="printerCutCommand">Guilhotina automatica</Label>
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        id="printerBeepOnSale"
                        type="checkbox"
                        checked={companyForm.printerBeepOnSale}
                        onChange={(e) =>
                          setCompanyForm((prev) => ({
                            ...prev,
                            printerBeepOnSale: e.target.checked,
                          }))
                        }
                      />
                      <Label htmlFor="printerBeepOnSale">Bip ao finalizar venda</Label>
                    </div>
                  </div>

                  <div className="rounded-md border p-4 space-y-4 bg-muted/20">
                    <div>
                      <h4 className="font-medium">Layout do cupom / DANFE NFC-e</h4>
                      <p className="text-xs text-muted-foreground">
                        Ajuste largura, fonte e blocos do DANFE NFC-e para evitar corte na impressao termica.
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        id="receiptShowSeller"
                        type="checkbox"
                        checked={companyForm.receiptShowSeller}
                        onChange={(e) =>
                          setCompanyForm((prev) => ({
                            ...prev,
                            receiptShowSeller: e.target.checked,
                          }))
                        }
                      />
                      <Label htmlFor="receiptShowSeller">Mostrar vendedor / operador no cupom</Label>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="nfcePaperWidth">Largura do papel (DANFE NFC-e)</Label>
                        <select
                          id="nfcePaperWidth"
                          className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                          value={companyForm.nfcePrintLayout?.paperWidth || "auto"}
                          onChange={(e) =>
                            setCompanyForm((prev) => ({
                              ...prev,
                              nfcePrintLayout: {
                                ...(prev.nfcePrintLayout || {}),
                                paperWidth: e.target.value as "auto" | "58mm" | "80mm",
                              },
                            }))
                          }
                        >
                          <option value="auto">Automatico (usa colunas da impressora)</option>
                          <option value="58mm">58mm</option>
                          <option value="80mm">80mm</option>
                        </select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="nfceFontSize">Tamanho da fonte (DANFE NFC-e)</Label>
                        <select
                          id="nfceFontSize"
                          className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                          value={companyForm.nfcePrintLayout?.fontSize || "auto"}
                          onChange={(e) =>
                            setCompanyForm((prev) => ({
                              ...prev,
                              nfcePrintLayout: {
                                ...(prev.nfcePrintLayout || {}),
                                fontSize: e.target.value as "auto" | "small" | "normal",
                              },
                            }))
                          }
                        >
                          <option value="auto">Automatico</option>
                          <option value="small">Pequena</option>
                          <option value="normal">Normal</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="nfceLineSpacing">Espacamento entre linhas</Label>
                        <select
                          id="nfceLineSpacing"
                          className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                          value={companyForm.nfcePrintLayout?.lineSpacing || "normal"}
                          onChange={(e) =>
                            setCompanyForm((prev) => ({
                              ...prev,
                              nfcePrintLayout: {
                                ...(prev.nfcePrintLayout || {}),
                                lineSpacing: e.target.value as
                                  | "compact"
                                  | "normal"
                                  | "comfortable",
                              },
                            }))
                          }
                        >
                          <option value="compact">Compacto</option>
                          <option value="normal">Normal</option>
                          <option value="comfortable">Confortavel</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="flex items-center gap-2">
                        <input
                          id="nfceCompactItems"
                          type="checkbox"
                          checked={companyForm.nfcePrintLayout?.compactItems !== false}
                          onChange={(e) =>
                            setCompanyForm((prev) => ({
                              ...prev,
                              nfcePrintLayout: {
                                ...(prev.nfcePrintLayout || {}),
                                compactItems: e.target.checked,
                              },
                            }))
                          }
                        />
                        <Label htmlFor="nfceCompactItems">Itens compactos (evita corte em 58mm)</Label>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="nfceItemDescLines">Linhas da descricao do item</Label>
                        <select
                          id="nfceItemDescLines"
                          className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                          value={String(companyForm.nfcePrintLayout?.itemDescriptionLines || 2)}
                          onChange={(e) =>
                            setCompanyForm((prev) => ({
                              ...prev,
                              nfcePrintLayout: {
                                ...(prev.nfcePrintLayout || {}),
                                itemDescriptionLines: Number(e.target.value),
                              },
                            }))
                          }
                        >
                          <option value="1">1 linha</option>
                          <option value="2">2 linhas</option>
                          <option value="3">3 linhas</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {[
                        ["showProtocol", "Mostrar protocolo"],
                        ["showAccessKey", "Mostrar chave de acesso"],
                        ["showCustomer", "Mostrar cliente"],
                        ["showCustomerDocument", "Mostrar documento do cliente"],
                        ["showPayments", "Mostrar pagamentos"],
                        ["showQrCode", "Mostrar QR Code e link"],
                        ["showTaxes", "Mostrar linhas de impostos"],
                      ].map(([key, label]) => (
                        <label key={key} className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={
                              (companyForm.nfcePrintLayout as any)?.[key] !== false
                            }
                            onChange={(e) =>
                              setCompanyForm((prev) => ({
                                ...prev,
                                nfcePrintLayout: {
                                  ...(prev.nfcePrintLayout || {}),
                                  [key]: e.target.checked,
                                },
                              }))
                            }
                          />
                          <span>{label}</span>
                        </label>
                      ))}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="receiptHeaderText">Cabecalho personalizado</Label>
                        <textarea
                          id="receiptHeaderText"
                          className="w-full min-h-[88px] rounded-md border border-input bg-background px-3 py-2 text-sm"
                          value={companyForm.receiptHeaderText}
                          onChange={(e) =>
                            setCompanyForm((prev) => ({
                              ...prev,
                              receiptHeaderText: e.target.value,
                            }))
                          }
                          placeholder={"Ex.: Obrigado pela preferencia\\nVolte sempre"}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="receiptFooterText">Rodape personalizado</Label>
                        <textarea
                          id="receiptFooterText"
                          className="w-full min-h-[88px] rounded-md border border-input bg-background px-3 py-2 text-sm"
                          value={companyForm.receiptFooterText}
                          onChange={(e) =>
                            setCompanyForm((prev) => ({
                              ...prev,
                              receiptFooterText: e.target.value,
                            }))
                          }
                          placeholder={"Ex.: Troca em ate 7 dias\\nWhatsApp: (00) 00000-0000"}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Preview rapido</Label>
                      <div
                        className="rounded-md border bg-white p-3 text-xs font-mono whitespace-pre-line"
                        style={{
                          lineHeight:
                            companyForm.nfcePrintLayout?.lineSpacing === "compact"
                              ? 1.15
                              : companyForm.nfcePrintLayout?.lineSpacing === "comfortable"
                                ? 1.5
                                : 1.3,
                        }}
                      >
                        {[
                          `PREVIEW NFC-e (${companyForm.nfcePrintLayout?.paperWidth || "auto"})`,
                          companyForm.receiptHeaderText?.trim() || "",
                          "------------------------------",
                          "VENDA #1234",
                          (companyForm.nfcePrintLayout?.showCustomer !== false)
                            ? "Cliente: Consumidor Final"
                            : "",
                          (companyForm.nfcePrintLayout?.showCustomerDocument !== false)
                            ? "Documento: 000.000.000-00"
                            : "",
                          companyForm.receiptShowSeller ? "Operador: 01" : "",
                          (companyForm.nfcePrintLayout?.showPayments !== false)
                            ? "Forma: PIX"
                            : "",
                          (companyForm.nfcePrintLayout?.showProtocol !== false)
                            ? "Protocolo: 123456789"
                            : "",
                          "Total: R$ 59,90",
                          (companyForm.nfcePrintLayout?.showQrCode !== false)
                            ? "[QR CODE]"
                            : "",
                          "------------------------------",
                          companyForm.receiptFooterText?.trim() || "",
                        ]
                          .filter(Boolean)
                          .join("\n")}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-md border p-4 space-y-4 bg-muted/10">
                    <div>
                      <h4 className="font-medium">Layout do DANFE NF-e (A4)</h4>
                      <p className="text-xs text-muted-foreground">
                        Configure visual do PDF da NF-e e envie a logo por arquivo.
                      </p>
                    </div>

                    <div className="space-y-3">
                      <div className="space-y-2">
                        <Label>Ajuste da logo</Label>
                        <select
                          className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                          value={companyForm.nfeDanfeLayout?.logoFit || "contain"}
                          onChange={(e) =>
                            setCompanyForm((prev) => ({
                              ...prev,
                              nfeDanfeLayout: {
                                ...(prev.nfeDanfeLayout || {}),
                                logoFit: e.target.value as "contain" | "cover" | "pad",
                              },
                            }))
                          }
                        >
                          <option value="contain">Ajustar (sem cortar)</option>
                          <option value="cover">Preencher (corta para caber)</option>
                          <option value="pad">Centralizar em fundo branco</option>
                        </select>
                        <p className="text-xs text-muted-foreground">
                          A logo enviada sera redimensionada conforme este ajuste.
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="danfeLogoFile">Logo (arquivo do computador)</Label>
                        <Input
                          id="danfeLogoFile"
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleDanfeLogoFileChange(e.target.files?.[0] || null)}
                        />
                        <p className="text-xs text-muted-foreground">
                          A imagem e salva em base64 nas configuracoes da empresa.
                        </p>
                      </div>
                      {companyForm.danfeLogoUrl ? (
                        <div className="rounded-md border p-3 space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs text-muted-foreground">
                              Logo carregada
                            </span>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                setCompanyForm((prev) => ({ ...prev, danfeLogoUrl: "" }))
                              }
                            >
                              Remover logo
                            </Button>
                          </div>
                          {String(companyForm.danfeLogoUrl).startsWith("data:image/") ? (
                            <img
                              src={String(companyForm.danfeLogoUrl)}
                              alt="Preview da logo DANFE"
                              className="max-h-20 object-contain border rounded bg-white p-2"
                            />
                          ) : (
                            <Input
                              value={companyForm.danfeLogoUrl || ""}
                              onChange={(e) =>
                                setCompanyForm((prev) => ({ ...prev, danfeLogoUrl: e.target.value }))
                              }
                              placeholder="URL opcional"
                            />
                          )}
                        </div>
                      ) : null}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label>Fonte</Label>
                        <select
                          className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                          value={companyForm.nfeDanfeLayout?.fontSize || "normal"}
                          onChange={(e) =>
                            setCompanyForm((prev) => ({
                              ...prev,
                              nfeDanfeLayout: {
                                ...(prev.nfeDanfeLayout || {}),
                                fontSize: e.target.value as "small" | "normal",
                              },
                            }))
                          }
                        >
                          <option value="small">Pequena</option>
                          <option value="normal">Normal</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <Label>Espacamento</Label>
                        <select
                          className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                          value={companyForm.nfeDanfeLayout?.lineSpacing || "normal"}
                          onChange={(e) =>
                            setCompanyForm((prev) => ({
                              ...prev,
                              nfeDanfeLayout: {
                                ...(prev.nfeDanfeLayout || {}),
                                lineSpacing: e.target.value as
                                  | "compact"
                                  | "normal"
                                  | "comfortable",
                              },
                            }))
                          }
                        >
                          <option value="compact">Compacto</option>
                          <option value="normal">Normal</option>
                          <option value="comfortable">Confortavel</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <Label>Linhas descricao item</Label>
                        <select
                          className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                          value={String(companyForm.nfeDanfeLayout?.itemDescriptionLines || 2)}
                          onChange={(e) =>
                            setCompanyForm((prev) => ({
                              ...prev,
                              nfeDanfeLayout: {
                                ...(prev.nfeDanfeLayout || {}),
                                itemDescriptionLines: Number(e.target.value),
                              },
                            }))
                          }
                        >
                          <option value="1">1</option>
                          <option value="2">2</option>
                          <option value="3">3</option>
                          <option value="4">4</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                      {[
                        ["showAccessKey", "Mostrar chave de acesso"],
                        ["showCustomerDocument", "Mostrar doc. destinatario"],
                        ["showTaxes", "Mostrar impostos nos totais"],
                      ].map(([key, label]) => (
                        <label key={key} className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={(companyForm.nfeDanfeLayout as any)?.[key] !== false}
                            onChange={(e) =>
                              setCompanyForm((prev) => ({
                                ...prev,
                                nfeDanfeLayout: {
                                  ...(prev.nfeDanfeLayout || {}),
                                  [key]: e.target.checked,
                                },
                              }))
                            }
                          />
                          <span>{label}</span>
                        </label>
                      ))}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Cabecalho personalizado (A4)</Label>
                        <textarea
                          className="w-full min-h-[70px] rounded-md border border-input bg-background px-3 py-2 text-sm"
                          value={companyForm.nfeDanfeLayout?.headerText || ""}
                          onChange={(e) =>
                            setCompanyForm((prev) => ({
                              ...prev,
                              nfeDanfeLayout: {
                                ...(prev.nfeDanfeLayout || {}),
                                headerText: e.target.value,
                              },
                            }))
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Rodape personalizado (A4)</Label>
                        <textarea
                          className="w-full min-h-[70px] rounded-md border border-input bg-background px-3 py-2 text-sm"
                          value={companyForm.nfeDanfeLayout?.footerText || ""}
                          onChange={(e) =>
                            setCompanyForm((prev) => ({
                              ...prev,
                              nfeDanfeLayout: {
                                ...(prev.nfeDanfeLayout || {}),
                                footerText: e.target.value,
                              },
                            }))
                          }
                        />
                      </div>
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
