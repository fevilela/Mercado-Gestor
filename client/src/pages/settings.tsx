import Layout from "@/components/layout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  CreditCard,
  Smartphone,
  Loader2,
  CheckCircle2,
  Printer,
  ScanBarcode,
  Users,
  ArrowRight,
  Monitor,
  Plus,
  Trash2,
  Edit2,
} from "lucide-react";
import { Link } from "wouter";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { getSefazDefaults } from "@shared/sefaz-defaults";

const UFS = [
  "AC",
  "AL",
  "AM",
  "AP",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MG",
  "MS",
  "MT",
  "PA",
  "PB",
  "PE",
  "PI",
  "PR",
  "RJ",
  "RN",
  "RO",
  "RR",
  "RS",
  "SC",
  "SE",
  "SP",
  "TO",
];

import { useAuth } from "@/lib/auth";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface CompanySettings {
  id?: number;
  cnpj?: string;
  ie?: string;
  razaoSocial?: string;
  nomeFantasia?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  regimeTributario?: string;
  cnae?: string;
  im?: string;
  crt?: string;
  fiscalEnvironment?: string;
  fiscalEnabled?: boolean;
  cscToken?: string;
  cscId?: string;
  stoneCode?: string;
  stoneEnabled?: boolean;
  stoneClientId?: string;
  stoneClientSecret?: string;
  stoneTerminalId?: string;
  stoneEnvironment?: string;
  mpAccessToken?: string;
  mpTerminalId?: string;
  mpEnabled?: boolean;
  paymentTimeoutSeconds?: number;
  printerEnabled?: boolean;
  printerModel?: string;
  printerPort?: string;
  printerBaudRate?: number;
  printerColumns?: number;
  printerCutCommand?: boolean;
  printerBeepOnSale?: boolean;
  barcodeScannerEnabled?: boolean;
  barcodeScannerAutoAdd?: boolean;
  barcodeScannerBeep?: boolean;
  cashRegisterRequired?: boolean;
  nfeEnabled?: boolean;
  nfceEnabled?: boolean;
  nfseEnabled?: boolean;
  cteEnabled?: boolean;
  mdfeEnabled?: boolean;
  sefazUrlHomologacao?: string;
  sefazUrlProducao?: string;
  sefazUf?: string;
  sefazMunicipioCodigo?: string;
  sefazQrCodeUrlHomologacao?: string;
  sefazQrCodeUrlProducao?: string;
}

interface PosTerminal {
  id?: number;
  name: string;
  code: string;
  assignedUserId?: string | null;
  paymentProvider?: "company_default" | "mercadopago" | "stone" | "";
  mpTerminalId?: string;
  stoneTerminalId?: string;
  isAutonomous: boolean;
  requiresSangria: boolean;
  requiresSuprimento: boolean;
  isActive: boolean;
}

interface SimplesAliquot {
  id?: number;
  annex: string;
  rangeStart: string;
  rangeEnd: string;
  nominalAliquot: string;
  effectiveAliquot: string;
}
interface CompanyUserOption {
  id: string;
  name: string;
  email: string;
  roleName?: string | null;
  isActive?: boolean;
}

interface FiscalReadinessCheck {
  key: string;
  label: string;
  ok: boolean;
  details?: string;
}

interface FiscalReadiness {
  ready: boolean;
  environment: "homologacao" | "producao";
  checks: FiscalReadinessCheck[];
  missing: string[];
  messages: string[];
}

export default function Settings() {
  const { toast } = useToast();
  const { company } = useAuth();
  const [stoneStatus, setStoneStatus] = useState<
    "idle" | "connecting" | "connected"
  >("idle");
  const [mpStatus, setMpStatus] = useState<"idle" | "connecting" | "connected">(
    "idle"
  );
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadingCnpj, setLoadingCnpj] = useState(false);
  const [settings, setSettings] = useState<CompanySettings>({
    cnpj: company?.cnpj || "",
    ie: "",
    razaoSocial: company?.razaoSocial || "",
    nomeFantasia: company?.nomeFantasia || "",
    email: company?.email || "",
    phone: company?.phone || "",
    regimeTributario: "Simples Nacional",
    cnae: "",
    im: "",
    address: "",
    city: "",
    state: "",
    zipCode: "",
    crt: "1",
    fiscalEnvironment: "homologacao",
    fiscalEnabled: false,
    cscToken: "",
    cscId: "",
    stoneCode: "",
    stoneEnabled: false,
    stoneClientId: "",
    stoneClientSecret: "",
    stoneTerminalId: "",
    stoneEnvironment: "producao",
    mpAccessToken: "",
    mpTerminalId: "",
    mpEnabled: false,
    paymentTimeoutSeconds: 30,
    printerEnabled: false,
    printerModel: "",
    printerPort: "",
    printerBaudRate: 9600,
    printerColumns: 48,
    printerCutCommand: true,
    printerBeepOnSale: true,
    nfeEnabled: false,
    nfceEnabled: true,
    nfseEnabled: false,
    cteEnabled: false,
    mdfeEnabled: false,
    sefazUrlHomologacao: "",
    sefazUrlProducao: "",
    sefazUf: "SP",
    sefazMunicipioCodigo: "",
    sefazQrCodeUrlHomologacao: "",
    sefazQrCodeUrlProducao: "",
    barcodeScannerEnabled: true,
    barcodeScannerAutoAdd: true,
    barcodeScannerBeep: true,
  });
  const [printerStatus, setPrinterStatus] = useState<
    "idle" | "testing" | "connected"
  >("idle");
  const [terminals, setTerminals] = useState<PosTerminal[]>([]);
  const [companyUsers, setCompanyUsers] = useState<CompanyUserOption[]>([]);
  const [editingTerminal, setEditingTerminal] = useState<PosTerminal | null>(
    null
  );
  const [simplesAliquots, setSimplesAliquots] = useState<SimplesAliquot[]>([]);
  const [newSimplesAliquot, setNewSimplesAliquot] =
    useState<SimplesAliquot>({
      annex: "I",
      rangeStart: "0",
      rangeEnd: "0",
      nominalAliquot: "0",
      effectiveAliquot: "0",
    });
  const [savingSimplesAliquot, setSavingSimplesAliquot] = useState(false);
  const [newTerminal, setNewTerminal] = useState<PosTerminal>({
    name: "",
    code: "",
    assignedUserId: "",
    paymentProvider: "company_default",
    mpTerminalId: "",
    stoneTerminalId: "",
    isAutonomous: false,
    requiresSangria: true,
    requiresSuprimento: true,
    isActive: true,
  });
  const [showNewTerminalForm, setShowNewTerminalForm] = useState(false);
  const [savingTerminal, setSavingTerminal] = useState(false);
  const [fiscalReadiness, setFiscalReadiness] =
    useState<FiscalReadiness | null>(null);
  const [loadingFiscalReadiness, setLoadingFiscalReadiness] = useState(false);
  const [isManagerSession, setIsManagerSession] = useState(false);

  const mpTerminalSuggestions = Array.from(
    new Set(
      [settings.mpTerminalId, ...terminals.map((t) => t.mpTerminalId)]
        .map((v) => String(v || "").trim())
        .filter(Boolean)
    )
  );

  const stoneTerminalSuggestions = Array.from(
    new Set(
      [settings.stoneTerminalId, ...terminals.map((t) => t.stoneTerminalId)]
        .map((v) => String(v || "").trim())
        .filter(Boolean)
    )
  );

  useEffect(() => {
    fetchSettings();
    fetchTerminals();
    fetchCompanyUsers();
    fetchSimplesAliquots();
    fetchFiscalReadiness();
    fetchManagerSession();
  }, []);

  const fetchCompanyUsers = async () => {
    try {
      const response = await fetch("/api/auth/users");
      if (!response.ok) return;
      const data = await response.json();
      setCompanyUsers(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Failed to fetch users for terminal assignment:", error);
    }
  };

  const fetchManagerSession = async () => {
    try {
      const response = await fetch("/api/auth/manager/session", {
        credentials: "include",
      });
      if (!response.ok) return;
      const data = await response.json();
      setIsManagerSession(Boolean(data?.authenticated));
    } catch (error) {
      console.error("Failed to fetch manager session:", error);
    }
  };

  useEffect(() => {
    if (stoneStatus === "connected") {
      setStoneStatus("idle");
    }
  }, [
    settings.stoneClientId,
    settings.stoneClientSecret,
    settings.stoneTerminalId,
    settings.stoneEnvironment,
    settings.stoneEnabled,
  ]);

  useEffect(() => {
    if (mpStatus === "connected") {
      setMpStatus("idle");
    }
  }, [settings.mpAccessToken, settings.mpTerminalId, settings.mpEnabled]);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/settings");
      if (response.ok) {
        const data = await response.json();
                        if (data && Object.keys(data).length > 0) {
          setSettings((prev) =>
            applySefazDefaults(data.sefazUf || prev.sefazUf || "SP", {
              ...prev,
              ...data,
            })
          );
        }
      }
    } catch (error) {
      console.error("Failed to fetch settings:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTerminals = async () => {
    try {
      const response = await fetch("/api/pos-terminals");
      if (response.ok) {
        const data = await response.json();
        setTerminals(data);
      }
    } catch (error) {
      console.error("Failed to fetch terminals:", error);
    }
  };

  const fetchSimplesAliquots = async () => {
    try {
      const response = await fetch("/api/simples-aliquots");
      if (response.ok) {
        const data = await response.json();
        setSimplesAliquots(data);
      }
    } catch (error) {
      console.error("Failed to fetch Simples Nacional aliquots:", error);
    }
  };

  const fetchFiscalReadiness = async () => {
    setLoadingFiscalReadiness(true);
    try {
      const response = await fetch("/api/fiscal/readiness");
      if (response.ok) {
        const data = await response.json();
        setFiscalReadiness(data);
      }
    } catch (error) {
      console.error("Failed to fetch fiscal readiness:", error);
    } finally {
      setLoadingFiscalReadiness(false);
    }
  };

  const handleCreateTerminal = async () => {
    setSavingTerminal(true);
    try {
      const response = await fetch("/api/pos-terminals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newTerminal),
      });

      if (response.ok) {
        const terminal = await response.json();
        setTerminals([...terminals, terminal]);
        setNewTerminal({
          name: "",
          code: "",
          assignedUserId: "",
          paymentProvider: "company_default",
          mpTerminalId: "",
          stoneTerminalId: "",
          isAutonomous: false,
          requiresSangria: true,
          requiresSuprimento: true,
          isActive: true,
        });
        setShowNewTerminalForm(false);
        toast({
          title: "Sucesso!",
          description: "Terminal cadastrado com sucesso.",
        });
      } else {
        const error = await response.json();
        throw new Error(error.error || "Erro ao criar terminal");
      }
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Não foi possível criar o terminal.",
        variant: "destructive",
      });
    } finally {
      setSavingTerminal(false);
    }
  };

  const handleUpdateTerminal = async (terminal: PosTerminal) => {
    if (!terminal.id) return;
    setSavingTerminal(true);
    try {
      const response = await fetch(`/api/pos-terminals/${terminal.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(terminal),
      });

      if (response.ok) {
        const updated = await response.json();
        setTerminals(terminals.map((t) => (t.id === updated.id ? updated : t)));
        setEditingTerminal(null);
        toast({
          title: "Sucesso!",
          description: "Terminal atualizado com sucesso.",
        });
      } else {
        throw new Error("Erro ao atualizar terminal");
      }
    } catch (error) {
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o terminal.",
        variant: "destructive",
      });
    } finally {
      setSavingTerminal(false);
    }
  };

  const handleDeleteTerminal = async (id: number) => {
    if (!confirm("Deseja realmente excluir este terminal?")) return;
    try {
      const response = await fetch(`/api/pos-terminals/${id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setTerminals(terminals.filter((t) => t.id !== id));
        toast({
          title: "Sucesso!",
          description: "Terminal excluído com sucesso.",
        });
      } else {
        throw new Error("Erro ao excluir terminal");
      }
    } catch (error) {
      toast({
        title: "Erro",
        description: "Não foi possível excluir o terminal.",
        variant: "destructive",
      });
    }
  };

  const handleCreateSimplesAliquot = async () => {
    setSavingSimplesAliquot(true);
    try {
      const response = await fetch("/api/simples-aliquots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newSimplesAliquot),
      });

      if (response.ok) {
        const created = await response.json();
        setSimplesAliquots([created, ...simplesAliquots]);
        setNewSimplesAliquot({
          annex: "I",
          rangeStart: "0",
          rangeEnd: "0",
          nominalAliquot: "0",
          effectiveAliquot: "0",
        });
        toast({
          title: "Sucesso!",
          description: "Alíquota de Simples Nacional cadastrada.",
        });
      } else {
        const error = await response.json();
        throw new Error(error.error || "Erro ao cadastrar alíquota");
      }
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Não foi possível salvar a alíquota.",
        variant: "destructive",
      });
    } finally {
      setSavingSimplesAliquot(false);
    }
  };

  const handleDeleteSimplesAliquot = async (id?: number) => {
    if (!id) return;
    if (!confirm("Deseja realmente excluir esta alíquota?")) return;
    try {
      const response = await fetch(`/api/simples-aliquots/${id}`, {
        method: "DELETE",
      });
      if (response.ok) {
        setSimplesAliquots(simplesAliquots.filter((item) => item.id !== id));
        toast({
          title: "Sucesso!",
          description: "Alíquota removida com sucesso.",
        });
      } else {
        throw new Error("Erro ao excluir alíquota");
      }
    } catch (error) {
      toast({
        title: "Erro",
        description: "Não foi possível excluir a alíquota.",
        variant: "destructive",
      });
    }
  };

  const handleSaveSettings = async () => {
    const mpTerminalRaw = String(settings.mpTerminalId || "").trim();
    const mpTerminalRef = splitMpTerminalRef(mpTerminalRaw);
    const mpStorePosValid = !!mpTerminalRef.storeId && !!mpTerminalRef.posId;
    const mpHasDirectTerminalId = !!mpTerminalRaw && !mpStorePosValid;
    const mpTerminalValid = mpStorePosValid || mpHasDirectTerminalId;

    if (
      settings.mpEnabled &&
      (!settings.mpAccessToken || !mpTerminalValid)
    ) {
      toast({
        title: "Credenciais incompletas",
        description:
          "Para Mercado Pago ativo, informe access token e (Store ID + POS ID) ou Terminal ID.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/settings", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(settings),
      });

      if (response.ok) {
        const updatedSettings = await response.json();
        setSettings(updatedSettings);
        fetchFiscalReadiness();
        toast({
          title: "Sucesso!",
          description: "Configurações salvas com sucesso.",
        });
      } else {
        throw new Error("Failed to save settings");
      }
    } catch (error) {
      console.error("Failed to save settings:", error);
      toast({
        title: "Erro",
        description: "Não foi possível salvar as configurações.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleConnectStone = () => {
    if (!settings.stoneEnabled) {
      toast({
        title: "Ative a integracao",
        description: "Habilite a Stone antes de conectar o terminal.",
        variant: "destructive",
      });
      return;
    }

    if (
      !settings.stoneClientId ||
      !settings.stoneClientSecret ||
      !settings.stoneTerminalId
    ) {
      toast({
        title: "Credenciais incompletas",
        description: "Informe client id, client secret e o terminal.",
        variant: "destructive",
      });
      return;
    }

    setStoneStatus("connecting");
    fetch("/api/payments/stone/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId: settings.stoneClientId,
        clientSecret: settings.stoneClientSecret,
        terminalId: settings.stoneTerminalId,
        environment: settings.stoneEnvironment || "producao",
      }),
    })
      .then(async (response) => {
        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          throw new Error(error.error || "Falha ao validar Stone");
        }
        setStoneStatus("connected");
        toast({
          title: "Stone conectada",
          description: "Credenciais validadas com sucesso.",
        });
      })
      .catch((error) => {
        setStoneStatus("idle");
        toast({
          title: "Nao foi possivel conectar",
          description:
            error instanceof Error
              ? error.message
              : "Falha ao validar credenciais.",
          variant: "destructive",
        });
      });
  };

  const handleConnectMP = () => {
    if (!settings.mpEnabled) {
      toast({
        title: "Ative a integracao",
        description: "Habilite o Mercado Pago antes de vincular a maquininha.",
        variant: "destructive",
      });
      return;
    }

    if (!settings.mpAccessToken || !mpTerminalValid) {
      toast({
        title: "Credenciais incompletas",
        description:
          "Informe access token e (Store ID + POS ID) ou Terminal ID.",
        variant: "destructive",
      });
      return;
    }

    setMpStatus("connecting");
    fetch("/api/payments/mercadopago/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        accessToken: settings.mpAccessToken,
        terminalId: settings.mpTerminalId,
      }),
    })
      .then(async (response) => {
        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          throw new Error(error.error || "Falha ao validar Mercado Pago");
        }
        setMpStatus("connected");
        toast({
          title: "Maquininha vinculada",
          description: "Credenciais validadas com sucesso.",
        });
      })
      .catch((error) => {
        setMpStatus("idle");
        toast({
          title: "Nao foi possivel vincular",
          description:
            error instanceof Error
              ? error.message
              : "Falha ao validar credenciais.",
          variant: "destructive",
        });
      });
  };

  const handleTestPrinter = () => {
    setPrinterStatus("testing");
    setTimeout(() => {
      setPrinterStatus("connected");
      toast({
        title: "Impressora Conectada",
        description: "Teste de impressão enviado com sucesso.",
      });
    }, 2000);
  };

  const updateSetting = (
    key: keyof CompanySettings,
    value: string | boolean | number
  ) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const splitMpTerminalRef = (ref?: string) => {
    const raw = String(ref || "").trim();
    const separators = ["|", ":", "/", ";", ","];
    const separator = separators.find((item) => raw.includes(item));
    if (!separator) {
      return { storeId: "", posId: "" };
    }
    const [storeId, posId] = raw.split(separator);
    return {
      storeId: String(storeId || "").trim(),
      posId: String(posId || "").trim(),
    };
  };

  const updateMpTerminalRef = (partial: { storeId?: string; posId?: string }) => {
    const current = splitMpTerminalRef(settings.mpTerminalId);
    const storeId = String(partial.storeId ?? current.storeId).trim();
    const posId = String(partial.posId ?? current.posId).trim();
    const next = storeId && posId ? `${storeId}|${posId}` : `${storeId}${posId ? `|${posId}` : ""}`;
    updateSetting("mpTerminalId", next);
  };

  const mpTerminalRaw = String(settings.mpTerminalId || "").trim();
  const mpTerminalRef = splitMpTerminalRef(mpTerminalRaw);
  const mpStorePosValid = !!mpTerminalRef.storeId && !!mpTerminalRef.posId;
  const mpDirectTerminalId = !mpStorePosValid ? mpTerminalRaw : "";
  const mpTerminalValid = mpStorePosValid || !!mpDirectTerminalId;

  const updateMpTerminalDirect = (value: string) => {
    updateSetting("mpTerminalId", String(value || "").trim());
  };

  const getChecklistTargetId = (checkKey: string) => {
    if (checkKey === "fiscalEnabled") return "fiscal-enabled-switch";
    if (checkKey === "sefazUf") return "sefaz-uf-select";
    if (checkKey === "sefazMunicipioCodigo") return "sefaz-municipio-codigo";
    if (checkKey === "cscId") return "csc-id-input";
    if (checkKey === "cscToken") return "csc-token-input";
    if (checkKey === "sefazUrl") {
      return settings.fiscalEnvironment === "producao"
        ? "sefaz-url-producao"
        : "sefaz-url-homologacao";
    }
    if (checkKey === "qrCodeUrl") {
      return settings.fiscalEnvironment === "producao"
        ? "sefaz-qr-url-producao"
        : "sefaz-qr-url-homologacao";
    }
    return null;
  };

  const focusChecklistField = (checkKey: string) => {
    const targetId = getChecklistTargetId(checkKey);
    if (!targetId) return;
    const element = document.getElementById(targetId);
    if (!element) return;
    element.scrollIntoView({ behavior: "smooth", block: "center" });
    setTimeout(() => {
      if ("focus" in element) {
        (element as HTMLElement).focus();
      }
    }, 180);
  };

  const fetchCnpjData = async () => {
    const cnpj = String(settings.cnpj || "").replace(/\D/g, "");
    if (cnpj.length !== 14 || loadingCnpj) {
      return;
    }

    setLoadingCnpj(true);
    try {
      const response = await fetch(`/api/lookup-cnpj?cnpj=${cnpj}`);
      if (response.ok) {
        const data = await response.json();
        setSettings((prev) => ({
          ...prev,
          razaoSocial: data.razaoSocial || prev.razaoSocial,
          nomeFantasia: data.nomeFantasia || prev.nomeFantasia,
          email: data.email || prev.email,
          phone: data.phone || prev.phone,
          address: data.address || prev.address,
          city: data.city || prev.city,
          state: data.state || prev.state,
          zipCode: data.zipCode || prev.zipCode,
        }));
        toast({
          title: "CNPJ encontrado",
          description: "Dados da Receita preenchidos.",
        });
      }
    } catch (error) {
      console.error("Erro ao buscar CNPJ:", error);
      toast({
        title: "Aviso",
        description: "Não foi possível buscar os dados do CNPJ.",
        variant: "destructive",
      });
    }

    try {
      const response = await fetch("/api/fiscal/sefaz/consulta-cadastro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ cnpj }),
      });
      if (response.ok) {
        const data = await response.json();
        if (data?.success) {
          const endereco =
            data.logradouro
              ? `${data.logradouro}${data.numero ? `, ${data.numero}` : ""}${
                  data.bairro ? ` - ${data.bairro}` : ""
                }`
              : "";
          setSettings((prev) => ({
            ...prev,
            ie: data.ie || prev.ie,
            cnae: data.cnae || prev.cnae,
            razaoSocial: data.nome || prev.razaoSocial,
            address: endereco || prev.address,
            city: data.municipio || prev.city,
            state: data.uf || prev.state,
          }));
          toast({
            title: "Cadastro SEFAZ",
            description: "IE e CNAE preenchidos.",
          });
        }
      }
    } catch (error) {
      console.warn("Erro ao consultar cadastro SEFAZ:", error);
    } finally {
      setLoadingCnpj(false);
    }
  };

  const applySefazDefaults = (
    ufValue: string,
    current: CompanySettings
  ): CompanySettings => {
    const defaults = getSefazDefaults(ufValue);
    return {
      ...current,
      sefazUf: ufValue,
      sefazUrlHomologacao:
        current.sefazUrlHomologacao || defaults.sefazUrlHomologacao,
      sefazUrlProducao:
        current.sefazUrlProducao || defaults.sefazUrlProducao,
      sefazQrCodeUrlHomologacao:
        current.sefazQrCodeUrlHomologacao ||
        defaults.sefazQrCodeUrlHomologacao,
      sefazQrCodeUrlProducao:
        current.sefazQrCodeUrlProducao || defaults.sefazQrCodeUrlProducao,
    };
  };

  const handleSefazUfChange = (value: string) => {
    setSettings((prev) => applySefazDefaults(value, prev));
  };

  const isIntegratedMiniPdvPrinter =
    settings.printerModel === "minipdv-m10-integrated";

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-3xl font-heading font-bold tracking-tight text-foreground">
            Configurações
          </h1>
          <p className="text-muted-foreground">
            Gerencie dados da empresa, fiscal e usuários.
          </p>
        </div>

        <Tabs defaultValue="company" className="space-y-4">
          <TabsList className="flex-wrap h-auto gap-1">
            <TabsTrigger value="company">Dados da Empresa</TabsTrigger>
            <TabsTrigger value="fiscal">Fiscal & Tributário</TabsTrigger>
            {isManagerSession && (
              <TabsTrigger value="payments">Pagamentos & TEF</TabsTrigger>
            )}
            {isManagerSession && (
              <TabsTrigger value="equipment">Equipamentos</TabsTrigger>
            )}
            <TabsTrigger value="terminals">Terminais PDV</TabsTrigger>
            <TabsTrigger value="users">Usuários</TabsTrigger>
          </TabsList>

          <TabsContent value="company">
            <Card>
              <CardHeader>
                <CardTitle>Informações do Estabelecimento</CardTitle>
                <CardDescription>
                  Dados que aparecerão nos relatórios e cupons.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="cnpj">CNPJ</Label>
                    <Input
                      id="cnpj"
                      placeholder="00.000.000/0000-00"
                      value={settings.cnpj || ""}
                      onChange={(e) => updateSetting("cnpj", e.target.value)}
                      onBlur={fetchCnpjData}
                    />
                    {loadingCnpj && (
                      <p className="text-xs text-muted-foreground flex items-center gap-2">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Buscando dados do CNPJ...
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ie">Inscrição Estadual</Label>
                    <Input
                      id="ie"
                      placeholder="000.000.000.000"
                      value={settings.ie || ""}
                      onChange={(e) => updateSetting("ie", e.target.value)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="im">Inscrição Municipal</Label>
                    <Input
                      id="im"
                      placeholder="Ex: 123456789"
                      value={settings.im || ""}
                      onChange={(e) => updateSetting("im", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cnae">CNAE</Label>
                    <Input
                      id="cnae"
                      placeholder="Ex: 4711302"
                      value={settings.cnae || ""}
                      onChange={(e) => updateSetting("cnae", e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="name">Razão Social</Label>
                  <Input
                    id="name"
                    placeholder="Minha Empresa LTDA"
                    value={settings.razaoSocial || ""}
                    onChange={(e) =>
                      updateSetting("razaoSocial", e.target.value)
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fantasy">Nome Fantasia</Label>
                  <Input
                    id="fantasy"
                    placeholder="Mercado Modelo"
                    value={settings.nomeFantasia || ""}
                    onChange={(e) =>
                      updateSetting("nomeFantasia", e.target.value)
                    }
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">E-mail</Label>
                    <Input
                      id="email"
                      placeholder="contato@empresa.com"
                      value={settings.email || ""}
                      onChange={(e) => updateSetting("email", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Telefone</Label>
                    <Input
                      id="phone"
                      placeholder="31999999999"
                      value={settings.phone || ""}
                      onChange={(e) => updateSetting("phone", e.target.value)}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="address">Endereço</Label>
                    <Input
                      id="address"
                      placeholder="Rua, número, bairro"
                      value={settings.address || ""}
                      onChange={(e) => updateSetting("address", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="zipCode">CEP</Label>
                    <Input
                      id="zipCode"
                      placeholder="00000-000"
                      value={settings.zipCode || ""}
                      onChange={(e) => updateSetting("zipCode", e.target.value)}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="city">Cidade</Label>
                    <Input
                      id="city"
                      placeholder="Cidade"
                      value={settings.city || ""}
                      onChange={(e) => updateSetting("city", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="state">UF</Label>
                    <Input
                      id="state"
                      placeholder="UF"
                      value={settings.state || ""}
                      onChange={(e) => updateSetting("state", e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="regime">Regime Tributário</Label>
                  <Select
                    value={settings.regimeTributario || "Simples Nacional"}
                    onValueChange={(value) =>
                      updateSetting("regimeTributario", value)
                    }
                  >
                    <SelectTrigger id="regime" data-testid="select-regime">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Simples Nacional">
                        Simples Nacional
                      </SelectItem>
                      <SelectItem value="Lucro Real">Lucro Real</SelectItem>
                      <SelectItem value="Lucro Presumido">
                        Lucro Presumido
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">
                    {settings.regimeTributario === "Simples Nacional"
                      ? "Será usado CSOSN para ICMS e PIS/COFINS integrados"
                      : "Será usado CST para ICMS com PIS/COFINS separados"}
                  </p>
                </div>
                <Button onClick={handleSaveSettings} disabled={saving}>
                  {saving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    "Salvar Alterações"
                  )}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="fiscal">
            <Card>
              <CardHeader>
                <CardTitle>Configuração Fiscal (NFC-e / SAT)</CardTitle>
                <CardDescription>
                  Parâmetros para emissão de documentos fiscais.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div
                  className={`rounded-lg border p-4 space-y-3 ${
                    fiscalReadiness?.ready
                      ? "border-green-200 bg-green-50"
                      : "border-amber-200 bg-amber-50"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="font-medium">Checklist Fiscal</p>
                      <p className="text-sm text-muted-foreground">
                        Prontidao para emissao NFC-e em{" "}
                        {fiscalReadiness?.environment === "producao"
                          ? "producao"
                          : "homologacao"}
                      </p>
                    </div>
                    <Badge
                      variant={fiscalReadiness?.ready ? "default" : "secondary"}
                    >
                      {fiscalReadiness?.ready
                        ? "Pronto para emitir"
                        : "Pendencias fiscais"}
                    </Badge>
                  </div>

                  {loadingFiscalReadiness ? (
                    <div className="text-sm text-muted-foreground flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Carregando checklist fiscal...
                    </div>
                  ) : fiscalReadiness ? (
                    <div className="space-y-2">
                      {fiscalReadiness.checks.map((check) => (
                        <div
                          key={check.key}
                          className="rounded-md border bg-background p-3 flex items-start justify-between gap-3"
                        >
                          <div>
                            <p className="text-sm font-medium">{check.label}</p>
                            {!check.ok && check.details ? (
                              <p className="text-xs text-muted-foreground">
                                {check.details}
                              </p>
                            ) : null}
                          </div>
                          <div className="flex flex-col items-end gap-2">
                            <Badge variant={check.ok ? "default" : "destructive"}>
                              {check.ok ? "OK" : "Falta"}
                            </Badge>
                            {!check.ok && getChecklistTargetId(check.key) ? (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => focusChecklistField(check.key)}
                                data-testid={`button-fix-${check.key}`}
                              >
                                Corrigir
                              </Button>
                            ) : null}
                            {!check.ok && check.key === "certificate" ? (
                              <Link href="/certificate-config">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  data-testid="button-fix-certificate"
                                >
                                  Abrir certificado
                                </Button>
                              </Link>
                            ) : null}
                            {!check.ok && check.key.startsWith("respTec") ? (
                              <Link href="/fiscal-config">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  data-testid="button-fix-resp-tec"
                                >
                                  Abrir resp. tecnico
                                </Button>
                              </Link>
                            ) : null}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Nao foi possivel carregar o checklist fiscal.
                    </p>
                  )}

                  <Button
                    variant="outline"
                    onClick={fetchFiscalReadiness}
                    disabled={loadingFiscalReadiness}
                    data-testid="button-refresh-fiscal-readiness-settings"
                  >
                    Atualizar checklist
                  </Button>
                </div>

                <div className="flex items-center justify-between space-x-2">
                  <div className="space-y-0.5">
                    <Label className="text-base">Ambiente de Produção</Label>
                    <p className="text-sm text-muted-foreground">
                      Ativar emissão real de notas (com valor fiscal).
                    </p>
                  </div>
                  <Switch
                    id="fiscal-enabled-switch"
                    checked={settings.fiscalEnabled || false}
                    onCheckedChange={(checked) =>
                      updateSetting("fiscalEnabled", checked)
                    }
                  />
                </div>
                <Separator />
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">
                    Documentos Fiscais Eletrônicos
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="space-y-0.5">
                        <Label>NF-e (Modelo 55)</Label>
                        <p className="text-xs text-muted-foreground">
                          Vendas e Operações Interestaduais
                        </p>
                      </div>
                      <Switch
                        checked={settings.nfeEnabled}
                        onCheckedChange={(checked) =>
                          updateSetting("nfeEnabled", checked)
                        }
                      />
                    </div>
                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="space-y-0.5">
                        <Label>NFC-e (Modelo 65)</Label>
                        <p className="text-xs text-muted-foreground">
                          Venda ao Consumidor Final
                        </p>
                      </div>
                      <Switch
                        checked={settings.nfceEnabled}
                        onCheckedChange={(checked) =>
                          updateSetting("nfceEnabled", checked)
                        }
                      />
                    </div>
                  </div>
                </div>
                <Separator />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Ambiente SEFAZ</Label>
                    <Select
                      value={settings.fiscalEnvironment || "homologacao"}
                      onValueChange={(value) =>
                        updateSetting("fiscalEnvironment", value)
                      }
                    >
                      <SelectTrigger id="fiscal-environment-select">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="homologacao">Homologacao</SelectItem>
                        <SelectItem value="producao">Producao</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>CRT</Label>
                    <Select
                      value={settings.crt || "1"}
                      onValueChange={(value) => updateSetting("crt", value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">1 - Simples Nacional</SelectItem>
                        <SelectItem value="2">
                          2 - Simples Nacional - Excesso de Sublimite
                        </SelectItem>
                        <SelectItem value="3">3 - Regime Normal</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>UF padrao</Label>
                    <Select
                      value={settings.sefazUf || "SP"}
                      onValueChange={handleSefazUfChange}
                    >
                      <SelectTrigger id="sefaz-uf-select">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {UFS.map((state) => (
                          <SelectItem key={state} value={state}>
                            {state}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>SEFAZ URL Homologacao</Label>
                    <Input
                      id="sefaz-url-homologacao"
                      placeholder="https://..."
                      value={settings.sefazUrlHomologacao || ""}
                      onChange={(e) =>
                        updateSetting("sefazUrlHomologacao", e.target.value)
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>SEFAZ URL Producao</Label>
                    <Input
                      id="sefaz-url-producao"
                      placeholder="https://..."
                      value={settings.sefazUrlProducao || ""}
                      onChange={(e) =>
                        updateSetting("sefazUrlProducao", e.target.value)
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Codigo municipio (IBGE)</Label>
                    <Input
                      id="sefaz-municipio-codigo"
                      placeholder="Ex: 3138203"
                      value={settings.sefazMunicipioCodigo || ""}
                      onChange={(e) =>
                        updateSetting("sefazMunicipioCodigo", e.target.value)
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>URL QR Code Homologacao</Label>
                    <Input
                      id="sefaz-qr-url-homologacao"
                      placeholder="https://.../qrcode.xhtml"
                      value={settings.sefazQrCodeUrlHomologacao || ""}
                      onChange={(e) =>
                        updateSetting("sefazQrCodeUrlHomologacao", e.target.value)
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>URL QR Code Producao</Label>
                    <Input
                      id="sefaz-qr-url-producao"
                      placeholder="https://.../qrcode.xhtml"
                      value={settings.sefazQrCodeUrlProducao || ""}
                      onChange={(e) =>
                        updateSetting("sefazQrCodeUrlProducao", e.target.value)
                      }
                    />
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>
                      Token CSC (Código de Segurança do Contribuinte)
                    </Label>
                    <Input
                      id="csc-token-input"
                      value={settings.cscToken || ""}
                      onChange={(e) =>
                        updateSetting("cscToken", e.target.value)
                      }
                      placeholder="Digite o token CSC"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>ID do Token</Label>
                    <Input
                      id="csc-id-input"
                      value={settings.cscId || ""}
                      className="w-24"
                      onChange={(e) => updateSetting("cscId", e.target.value)}
                      placeholder="000001"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Certificado Digital (A1)</Label>
                  <p className="text-sm text-muted-foreground">
                    Instale e valide o certificado na tela dedicada.
                  </p>
                  <Link href="/certificate-config">
                    <Button variant="outline">
                      Abrir configuracao de certificado
                    </Button>
                  </Link>
                </div>
                <div className="space-y-4 pt-4 border-t">
                  <h3 className="text-lg font-medium">Simples Nacional</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                    <div className="space-y-2">
                      <Label>Anexo</Label>
                      <Select
                        value={newSimplesAliquot.annex}
                        onValueChange={(value) =>
                          setNewSimplesAliquot({
                            ...newSimplesAliquot,
                            annex: value,
                          })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="I">Anexo I</SelectItem>
                          <SelectItem value="II">Anexo II</SelectItem>
                          <SelectItem value="III">Anexo III</SelectItem>
                          <SelectItem value="IV">Anexo IV</SelectItem>
                          <SelectItem value="V">Anexo V</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Faixa Inicial (R$)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={newSimplesAliquot.rangeStart}
                        onChange={(e) =>
                          setNewSimplesAliquot({
                            ...newSimplesAliquot,
                            rangeStart: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Faixa Final (R$)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={newSimplesAliquot.rangeEnd}
                        onChange={(e) =>
                          setNewSimplesAliquot({
                            ...newSimplesAliquot,
                            rangeEnd: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Aliquota Nominal (%)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={newSimplesAliquot.nominalAliquot}
                        onChange={(e) =>
                          setNewSimplesAliquot({
                            ...newSimplesAliquot,
                            nominalAliquot: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Aliquota Efetiva (%)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={newSimplesAliquot.effectiveAliquot}
                        onChange={(e) =>
                          setNewSimplesAliquot({
                            ...newSimplesAliquot,
                            effectiveAliquot: e.target.value,
                          })
                        }
                      />
                    </div>
                  </div>
                  <div className="flex gap-2 justify-end">
                    <Button
                      onClick={handleCreateSimplesAliquot}
                      disabled={savingSimplesAliquot}
                    >
                      {savingSimplesAliquot ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Salvando...
                        </>
                      ) : (
                        "Adicionar Aliquota"
                      )}
                    </Button>
                  </div>
                  {simplesAliquots.length > 0 ? (
                    <div className="border rounded-lg">
                      <table className="w-full text-sm">
                        <thead className="border-b">
                          <tr>
                            <th className="text-left py-2 px-3">Anexo</th>
                            <th className="text-left py-2 px-3">Faixa</th>
                            <th className="text-left py-2 px-3">Nominal</th>
                            <th className="text-left py-2 px-3">Efetiva</th>
                            <th className="py-2 px-3" />
                          </tr>
                        </thead>
                        <tbody>
                          {simplesAliquots.map((item) => (
                            <tr
                              key={item.id}
                              className="border-b last:border-b-0"
                            >
                              <td className="py-2 px-3">{item.annex}</td>
                              <td className="py-2 px-3">
                                R$ {item.rangeStart} - R$ {item.rangeEnd}
                              </td>
                              <td className="py-2 px-3">
                                {item.nominalAliquot}%
                              </td>
                              <td className="py-2 px-3">
                                {item.effectiveAliquot}%
                              </td>
                              <td className="py-2 px-3 text-right">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() =>
                                    handleDeleteSimplesAliquot(item.id)
                                  }
                                  className="text-destructive hover:text-destructive"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground">
                      Nenhuma al??quota de Simples Nacional cadastrada.
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button variant="outline">Testar Comunicação SEFAZ</Button>
                  <Button onClick={handleSaveSettings} disabled={saving}>
                    {saving ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Salvando...
                      </>
                    ) : (
                      "Salvar Alterações"
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {isManagerSession && (
            <TabsContent value="payments">
              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader className="flex flex-row items-center gap-4 space-y-0">
                    <div className="h-10 w-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
                      <CreditCard className="h-5 w-5" />
                    </div>
                    <div>
                      <CardTitle>Integração Stone</CardTitle>
                      <CardDescription>
                        Configuração de Maquininha (TEF/POS)
                      </CardDescription>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between space-x-2">
                      <Label>Ativar Integração</Label>
                      <Switch
                        checked={settings.stoneEnabled || false}
                        onCheckedChange={(checked) =>
                          updateSetting("stoneEnabled", checked)
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Client ID</Label>
                      <Input
                        placeholder="client_id"
                        value={settings.stoneClientId || ""}
                        onChange={(e) =>
                          updateSetting("stoneClientId", e.target.value)
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Client Secret</Label>
                      <Input
                        type="password"
                        placeholder="client_secret"
                        value={settings.stoneClientSecret || ""}
                        onChange={(e) =>
                          updateSetting("stoneClientSecret", e.target.value)
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>ID do Terminal (POS)</Label>
                      <Input
                        placeholder="terminal_id"
                        value={settings.stoneTerminalId || ""}
                        onChange={(e) =>
                          updateSetting("stoneTerminalId", e.target.value)
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Ambiente</Label>
                      <Select
                        value={settings.stoneEnvironment || "producao"}
                        onValueChange={(value) =>
                          updateSetting("stoneEnvironment", value)
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="homologacao">
                            Homologacao
                          </SelectItem>
                          <SelectItem value="producao">Producao</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {stoneStatus === "connected" ? (
                      <div className="rounded-md bg-emerald-100 p-3 flex items-center gap-3 text-emerald-700">
                        <CheckCircle2 className="h-5 w-5" />
                        <div className="text-sm font-medium">
                          Conectado: Stone
                        </div>
                      </div>
                    ) : (
                      <Button
                        className="w-full bg-emerald-600 hover:bg-emerald-700"
                        onClick={handleConnectStone}
                        disabled={stoneStatus === "connecting"}
                      >
                        {stoneStatus === "connecting" ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Conectando...
                          </>
                        ) : (
                          "Testar Conexão Stone"
                        )}
                      </Button>
                    )}
                    <Button
                      onClick={handleSaveSettings}
                      disabled={saving}
                      className="w-full"
                    >
                      {saving ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Salvando...
                        </>
                      ) : (
                        "Salvar Alterações"
                      )}
                    </Button>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center gap-4 space-y-0">
                    <div className="h-10 w-10 rounded-full bg-sky-100 flex items-center justify-center text-sky-600">
                      <Smartphone className="h-5 w-5" />
                    </div>
                    <div>
                      <CardTitle>Mercado Pago</CardTitle>
                      <CardDescription>Point Smart & QR Code</CardDescription>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between space-x-2">
                      <Label>Ativar Integração</Label>
                      <Switch
                        checked={settings.mpEnabled || false}
                        onCheckedChange={(checked) =>
                          updateSetting("mpEnabled", checked)
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Access Token (Integração)</Label>
                      <Input
                        type="password"
                        placeholder="APP_USR-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                        value={settings.mpAccessToken || ""}
                        onChange={(e) =>
                          updateSetting("mpAccessToken", e.target.value)
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Identificador Point</Label>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">
                            Store ID
                          </Label>
                          <Input
                            placeholder="STORE123"
                            value={mpTerminalRef.storeId}
                            className={
                              settings.mpEnabled &&
                              !mpDirectTerminalId &&
                              !mpTerminalRef.storeId
                                ? "border-red-500 focus-visible:ring-red-500"
                                : ""
                            }
                            onChange={(e) =>
                              updateMpTerminalRef({ storeId: e.target.value })
                            }
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">
                            POS ID
                          </Label>
                          <Input
                            placeholder="POS456"
                            value={mpTerminalRef.posId}
                            className={
                              settings.mpEnabled &&
                              !mpDirectTerminalId &&
                              !mpTerminalRef.posId
                                ? "border-red-500 focus-visible:ring-red-500"
                                : ""
                            }
                            onChange={(e) =>
                              updateMpTerminalRef({ posId: e.target.value })
                            }
                          />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">
                          Terminal ID (opcional)
                        </Label>
                        <Input
                          placeholder="GERTEC_MP35P__8701012146360616"
                          value={mpDirectTerminalId}
                          className={
                            settings.mpEnabled &&
                            !mpStorePosValid &&
                            !mpDirectTerminalId
                              ? "border-red-500 focus-visible:ring-red-500"
                              : ""
                          }
                          onChange={(e) =>
                            updateMpTerminalDirect(e.target.value)
                          }
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Preencha <span className="font-mono">store_id|pos_id</span>{" "}
                        ou informe o <span className="font-mono">terminal_id</span>{" "}
                        diretamente.
                      </p>
                      {settings.mpEnabled && !mpTerminalValid && (
                        <p className="text-xs text-red-600">
                          Informe Store ID + POS ID ou Terminal ID para salvar.
                        </p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label>Timeout de pagamento (segundos)</Label>
                      <Input
                        type="number"
                        min={10}
                        max={300}
                        step={1}
                        value={Number(settings.paymentTimeoutSeconds || 30)}
                        onChange={(e) => {
                          const raw = Number(e.target.value);
                          const normalized = Number.isFinite(raw)
                            ? Math.min(300, Math.max(10, Math.round(raw)))
                            : 30;
                          updateSetting("paymentTimeoutSeconds", normalized);
                        }}
                      />
                      <p className="text-xs text-muted-foreground">
                        Tempo maximo para aprovar o pagamento no terminal antes de cancelar automaticamente.
                      </p>
                    </div>

                    {mpStatus === "connected" ? (
                      <div className="rounded-md bg-sky-100 p-3 flex items-center gap-3 text-sky-700">
                        <CheckCircle2 className="h-5 w-5" />
                        <div className="text-sm font-medium">
                          Vinculado: Point Smart
                        </div>
                      </div>
                    ) : (
                      <Button
                        className="w-full bg-sky-500 hover:bg-sky-600"
                        onClick={handleConnectMP}
                        disabled={mpStatus === "connecting"}
                      >
                        {mpStatus === "connecting" ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Verificando...
                          </>
                        ) : (
                          "Vincular Maquininha"
                        )}
                      </Button>
                    )}
                    <Button
                      onClick={handleSaveSettings}
                      disabled={saving || (settings.mpEnabled && !mpTerminalValid)}
                      className="w-full"
                    >
                      {saving ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Salvando...
                        </>
                      ) : (
                        "Salvar Alterações"
                      )}
                    </Button>
                  </CardContent>
                </Card>

                <Card className="col-span-2 bg-muted/30 border-dashed">
                  <CardHeader>
                    <CardTitle className="text-sm">
                      Agente Local (Bridge)
                    </CardTitle>
                    <CardDescription>
                      Para comunicação USB/Serial com maquininhas via navegador.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="text-sm font-medium">
                        Status do Integrador:{" "}
                        <span className="text-emerald-600">
                          Simulado / Online
                        </span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Versão: v2.4.0 (Mock)
                      </p>
                    </div>
                    <Button variant="outline" size="sm">
                      Baixar Instalador (.exe)
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          )}

          {isManagerSession && (
            <TabsContent value="equipment">
              <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader className="flex flex-row items-center gap-4 space-y-0">
                  <div className="h-10 w-10 rounded-full bg-orange-100 flex items-center justify-center text-orange-600">
                    <Printer className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle>Impressora Fiscal / Térmica</CardTitle>
                    <CardDescription>
                      Configuração para impressão de cupons e NFC-e
                    </CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between space-x-2">
                    <Label>Ativar Impressora</Label>
                    <Switch
                      checked={settings.printerEnabled || false}
                      onCheckedChange={(checked) =>
                        updateSetting("printerEnabled", checked)
                      }
                      data-testid="switch-printer-enabled"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Modelo da Impressora</Label>
                    <Select
                      value={settings.printerModel || ""}
                      onValueChange={(value) => {
                        updateSetting("printerModel", value);
                        if (value === "minipdv-m10-integrated") {
                          updateSetting("printerPort", "");
                          updateSetting("printerColumns", 32);
                        }
                      }}
                    >
                      <SelectTrigger data-testid="select-printer-model">
                        <SelectValue placeholder="Selecione o modelo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="epson-tm-t20">
                          Epson TM-T20
                        </SelectItem>
                        <SelectItem value="epson-tm-t88">
                          Epson TM-T88
                        </SelectItem>
                        <SelectItem value="bematech-mp4200">
                          Bematech MP-4200 TH
                        </SelectItem>
                        <SelectItem value="elgin-i9">Elgin i9</SelectItem>
                        <SelectItem value="daruma-dr800">
                          Daruma DR800
                        </SelectItem>
                        <SelectItem value="sweda-si-300">
                          Sweda SI-300
                        </SelectItem>
                        <SelectItem value="generic-escpos">
                          Genérica ESC/POS
                        </SelectItem>
                        <SelectItem value="minipdv-m10-integrated">
                          MiniPDV M10 (integrada)
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Porta de Comunicação</Label>
                    <Select
                      value={settings.printerPort || ""}
                      disabled={isIntegratedMiniPdvPrinter}
                      onValueChange={(value) =>
                        updateSetting("printerPort", value)
                      }
                    >
                      <SelectTrigger data-testid="select-printer-port">
                        <SelectValue placeholder="Selecione a porta" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="USB001">USB001</SelectItem>
                        <SelectItem value="USB002">USB002</SelectItem>
                        <SelectItem value="COM1">COM1 (Serial)</SelectItem>
                        <SelectItem value="COM2">COM2 (Serial)</SelectItem>
                        <SelectItem value="COM3">COM3 (Serial)</SelectItem>
                        <SelectItem value="LPT1">LPT1 (Paralela)</SelectItem>
                        <SelectItem value="network">Rede (IP)</SelectItem>
                      </SelectContent>
                    </Select>
                    {isIntegratedMiniPdvPrinter && (
                      <p className="text-xs text-muted-foreground">
                        Impressora integrada: porta fisica nao se aplica.
                      </p>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Velocidade (Baud Rate)</Label>
                      <Select
                        value={String(settings.printerBaudRate || 9600)}
                        onValueChange={(value) =>
                          updateSetting("printerBaudRate", value)
                        }
                      >
                        <SelectTrigger data-testid="select-printer-baud">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="9600">9600</SelectItem>
                          <SelectItem value="19200">19200</SelectItem>
                          <SelectItem value="38400">38400</SelectItem>
                          <SelectItem value="57600">57600</SelectItem>
                          <SelectItem value="115200">115200</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Colunas</Label>
                      <Select
                        value={String(settings.printerColumns || 48)}
                        onValueChange={(value) =>
                          updateSetting("printerColumns", value)
                        }
                      >
                        <SelectTrigger data-testid="select-printer-columns">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="32">32 (58mm)</SelectItem>
                          <SelectItem value="42">42 (76mm)</SelectItem>
                          <SelectItem value="48">48 (80mm)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <Separator />
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>Guilhotina Automática</Label>
                        <p className="text-xs text-muted-foreground">
                          Cortar papel após impressão
                        </p>
                      </div>
                      <Switch
                        checked={settings.printerCutCommand || false}
                        onCheckedChange={(checked) =>
                          updateSetting("printerCutCommand", checked)
                        }
                        data-testid="switch-printer-cut"
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>Bip ao Finalizar Venda</Label>
                        <p className="text-xs text-muted-foreground">
                          Som de alerta na impressora
                        </p>
                      </div>
                      <Switch
                        checked={settings.printerBeepOnSale || false}
                        onCheckedChange={(checked) =>
                          updateSetting("printerBeepOnSale", checked)
                        }
                        data-testid="switch-printer-beep"
                      />
                    </div>
                  </div>

                  {printerStatus === "connected" ? (
                    <div className="rounded-md bg-emerald-100 p-3 flex items-center gap-3 text-emerald-700">
                      <CheckCircle2 className="h-5 w-5" />
                      <div className="text-sm font-medium">
                        Impressora Conectada:{" "}
                        {settings.printerModel || "Genérica"}
                      </div>
                    </div>
                  ) : (
                    <Button
                      className="w-full bg-orange-600 hover:bg-orange-700"
                      onClick={handleTestPrinter}
                      disabled={
                        printerStatus === "testing" || !settings.printerEnabled
                      }
                      data-testid="button-test-printer"
                    >
                      {printerStatus === "testing" ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Testando...
                        </>
                      ) : (
                        "Testar Impressora"
                      )}
                    </Button>
                  )}
                  <Button
                    onClick={handleSaveSettings}
                    disabled={saving}
                    className="w-full"
                    data-testid="button-save-printer"
                  >
                    {saving ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Salvando...
                      </>
                    ) : (
                      "Salvar Alterações"
                    )}
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center gap-4 space-y-0">
                  <div className="h-10 w-10 rounded-full bg-violet-100 flex items-center justify-center text-violet-600">
                    <ScanBarcode className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle>Leitor de Código de Barras</CardTitle>
                    <CardDescription>
                      Configuração do scanner para PDV
                    </CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between space-x-2">
                    <Label>Ativar Leitor</Label>
                    <Switch
                      checked={settings.barcodeScannerEnabled || false}
                      onCheckedChange={(checked) =>
                        updateSetting("barcodeScannerEnabled", checked)
                      }
                      data-testid="switch-scanner-enabled"
                    />
                  </div>
                  <Separator />
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>Adicionar Automaticamente</Label>
                        <p className="text-xs text-muted-foreground">
                          Produto vai direto ao carrinho
                        </p>
                      </div>
                      <Switch
                        checked={settings.barcodeScannerAutoAdd || false}
                        onCheckedChange={(checked) =>
                          updateSetting("barcodeScannerAutoAdd", checked)
                        }
                        data-testid="switch-scanner-auto-add"
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>Som ao Ler Código</Label>
                        <p className="text-xs text-muted-foreground">
                          Feedback sonoro de leitura
                        </p>
                      </div>
                      <Switch
                        checked={settings.barcodeScannerBeep || false}
                        onCheckedChange={(checked) =>
                          updateSetting("barcodeScannerBeep", checked)
                        }
                        data-testid="switch-scanner-beep"
                      />
                    </div>
                  </div>
                  <Separator />
                  <div className="rounded-md bg-violet-50 p-4 space-y-2">
                    <h4 className="text-sm font-medium text-violet-900">
                      Como funciona?
                    </h4>
                    <ul className="text-xs text-violet-700 space-y-1 list-disc list-inside">
                      <li>Conecte o leitor via USB (funciona como teclado)</li>
                      <li>
                        No PDV, o campo de busca detecta automaticamente a
                        leitura
                      </li>
                      <li>
                        O produto é encontrado pelo código EAN e adicionado ao
                        carrinho
                      </li>
                      <li>
                        Compatível com leitores: Honeywell, Elgin, Bematech,
                        etc.
                      </li>
                    </ul>
                  </div>
                  <div className="rounded-md bg-emerald-100 p-3 flex items-center gap-3 text-emerald-700">
                    <CheckCircle2 className="h-5 w-5" />
                    <div className="text-sm font-medium">
                      Pronto para uso - Conecte o leitor USB
                    </div>
                  </div>
                  <Button
                    onClick={handleSaveSettings}
                    disabled={saving}
                    className="w-full"
                    data-testid="button-save-scanner"
                  >
                    {saving ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Salvando...
                      </>
                    ) : (
                      "Salvar Alterações"
                    )}
                  </Button>
                </CardContent>
              </Card>
              </div>
            </TabsContent>
          )}

          <TabsContent value="terminals">
            <Card>
              <CardHeader className="flex flex-row items-center gap-4 space-y-0">
                <div className="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600">
                  <Monitor className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <CardTitle>Terminais PDV</CardTitle>
                  <CardDescription>
                    Configure os terminais de ponto de venda
                  </CardDescription>
                </div>
                <Button
                  onClick={() => setShowNewTerminalForm(true)}
                  disabled={showNewTerminalForm}
                  data-testid="button-add-terminal"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Novo Terminal
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                <datalist id="mp-terminal-suggestions">
                  {mpTerminalSuggestions.map((value) => (
                    <option key={value} value={value} />
                  ))}
                </datalist>
                <datalist id="stone-terminal-suggestions">
                  {stoneTerminalSuggestions.map((value) => (
                    <option key={value} value={value} />
                  ))}
                </datalist>
                {showNewTerminalForm && (
                  <div className="border rounded-lg p-4 space-y-4 bg-muted/50">
                    <h4 className="font-medium">Novo Terminal</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="terminal-name">Nome</Label>
                        <Input
                          id="terminal-name"
                          placeholder="Ex: Caixa 01"
                          value={newTerminal.name}
                          onChange={(e) =>
                            setNewTerminal({
                              ...newTerminal,
                              name: e.target.value,
                            })
                          }
                          data-testid="input-terminal-name"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="terminal-code">Código</Label>
                        <Input
                          id="terminal-code"
                          placeholder="Ex: CX01"
                          value={newTerminal.code}
                          onChange={(e) =>
                            setNewTerminal({
                              ...newTerminal,
                              code: e.target.value,
                            })
                          }
                          data-testid="input-terminal-code"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="terminal-assigned-user">
                        Usuário autorizado (opcional)
                      </Label>
                      <select
                        id="terminal-assigned-user"
                        className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                        value={String(newTerminal.assignedUserId || "")}
                        onChange={(e) =>
                          setNewTerminal({
                            ...newTerminal,
                            assignedUserId: e.target.value || "",
                          })
                        }
                      >
                        <option value="">Todos os usuários (com permissão)</option>
                        {companyUsers
                          .filter((u) => u.isActive !== false)
                          .map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.name} ({u.roleName || "Sem perfil"})
                            </option>
                          ))}
                      </select>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="terminal-provider">Maquininha (provedor)</Label>
                        <select
                          id="terminal-provider"
                          className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                          value={newTerminal.paymentProvider || "company_default"}
                          onChange={(e) =>
                            setNewTerminal({
                              ...newTerminal,
                              paymentProvider: e.target.value as any,
                            })
                          }
                        >
                          <option value="company_default">Padrao da empresa</option>
                          <option value="mercadopago">Mercado Pago</option>
                          <option value="stone">Stone</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="terminal-mp-id">MP Terminal</Label>
                        <Input
                          id="terminal-mp-id"
                          placeholder="STORE123|POS456 ou terminal_id"
                          list="mp-terminal-suggestions"
                          value={newTerminal.mpTerminalId || ""}
                          onChange={(e) =>
                            setNewTerminal({
                              ...newTerminal,
                              mpTerminalId: e.target.value,
                            })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="terminal-stone-id">Stone Terminal ID</Label>
                        <Input
                          id="terminal-stone-id"
                          placeholder="Terminal Stone"
                          list="stone-terminal-suggestions"
                          value={newTerminal.stoneTerminalId || ""}
                          onChange={(e) =>
                            setNewTerminal({
                              ...newTerminal,
                              stoneTerminalId: e.target.value,
                            })
                          }
                        />
                      </div>
                    </div>
                    <Separator />
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label>Caixa Autônomo</Label>
                          <p className="text-xs text-muted-foreground">
                            Não requer abertura/fechamento diário
                          </p>
                        </div>
                        <Switch
                          checked={newTerminal.isAutonomous}
                          onCheckedChange={(checked) =>
                            setNewTerminal({
                              ...newTerminal,
                              isAutonomous: checked,
                            })
                          }
                          data-testid="switch-terminal-autonomous"
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label>Exigir Sangria</Label>
                          <p className="text-xs text-muted-foreground">
                            Requer permissão pos:sangria
                          </p>
                        </div>
                        <Switch
                          checked={newTerminal.requiresSangria}
                          onCheckedChange={(checked) =>
                            setNewTerminal({
                              ...newTerminal,
                              requiresSangria: checked,
                            })
                          }
                          data-testid="switch-terminal-sangria"
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label>Exigir Suprimento</Label>
                          <p className="text-xs text-muted-foreground">
                            Requer permissão pos:suprimento
                          </p>
                        </div>
                        <Switch
                          checked={newTerminal.requiresSuprimento}
                          onCheckedChange={(checked) =>
                            setNewTerminal({
                              ...newTerminal,
                              requiresSuprimento: checked,
                            })
                          }
                          data-testid="switch-terminal-suprimento"
                        />
                      </div>
                    </div>
                    <div className="flex gap-2 justify-end">
                      <Button
                        variant="outline"
                        onClick={() => setShowNewTerminalForm(false)}
                        data-testid="button-cancel-terminal"
                      >
                        Cancelar
                      </Button>
                      <Button
                        onClick={handleCreateTerminal}
                        disabled={
                          savingTerminal ||
                          !newTerminal.name ||
                          !newTerminal.code
                        }
                        data-testid="button-save-terminal"
                      >
                        {savingTerminal ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Salvando...
                          </>
                        ) : (
                          "Salvar Terminal"
                        )}
                      </Button>
                    </div>
                  </div>
                )}

                {terminals.length === 0 && !showNewTerminalForm ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Monitor className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Nenhum terminal cadastrado</p>
                    <p className="text-sm">
                      Clique em "Novo Terminal" para adicionar
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {terminals.map((terminal) => (
                      <div
                        key={terminal.id}
                        className="border rounded-lg p-4 flex items-center justify-between"
                        data-testid={`terminal-item-${terminal.id}`}
                      >
                        {editingTerminal?.id === terminal.id &&
                        editingTerminal ? (
                          <div className="flex-1 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label>Nome</Label>
                                <Input
                                  value={editingTerminal.name}
                                  onChange={(e) =>
                                    setEditingTerminal({
                                      ...editingTerminal,
                                      name: e.target.value,
                                    })
                                  }
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Código</Label>
                                <Input
                                  value={editingTerminal.code || ""}
                                  onChange={(e) =>
                                    setEditingTerminal({
                                      ...editingTerminal,
                                      code: e.target.value,
                                    })
                                  }
                                />
                              </div>
                            </div>
                            <div className="space-y-2">
                              <Label>Usuário autorizado (opcional)</Label>
                              <select
                                className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                                value={String(editingTerminal.assignedUserId || "")}
                                onChange={(e) =>
                                  setEditingTerminal({
                                    ...editingTerminal,
                                    assignedUserId: e.target.value || "",
                                  })
                                }
                              >
                                <option value="">
                                  Todos os usuários (com permissão)
                                </option>
                                {companyUsers
                                  .filter((u) => u.isActive !== false)
                                  .map((u) => (
                                    <option key={u.id} value={u.id}>
                                      {u.name} ({u.roleName || "Sem perfil"})
                                    </option>
                                  ))}
                              </select>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              <div className="space-y-2">
                                <Label>Maquininha (provedor)</Label>
                                <select
                                  className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                                  value={
                                    editingTerminal.paymentProvider ||
                                    "company_default"
                                  }
                                  onChange={(e) =>
                                    setEditingTerminal({
                                      ...editingTerminal,
                                      paymentProvider: e.target.value as any,
                                    })
                                  }
                                >
                                  <option value="company_default">
                                    Padrao da empresa
                                  </option>
                                  <option value="mercadopago">Mercado Pago</option>
                                  <option value="stone">Stone</option>
                                </select>
                              </div>
                              <div className="space-y-2">
                                <Label>MP Terminal</Label>
                                <Input
                                  list="mp-terminal-suggestions"
                                  value={editingTerminal.mpTerminalId || ""}
                                  onChange={(e) =>
                                    setEditingTerminal({
                                      ...editingTerminal,
                                      mpTerminalId: e.target.value,
                                    })
                                  }
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Stone Terminal ID</Label>
                                <Input
                                  list="stone-terminal-suggestions"
                                  value={editingTerminal.stoneTerminalId || ""}
                                  onChange={(e) =>
                                    setEditingTerminal({
                                      ...editingTerminal,
                                      stoneTerminalId: e.target.value,
                                    })
                                  }
                                />
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-4">
                              <div className="flex items-center gap-2">
                                <Switch
                                  checked={
                                    editingTerminal.isAutonomous || false
                                  }
                                  onCheckedChange={(checked) =>
                                    setEditingTerminal({
                                      ...editingTerminal,
                                      isAutonomous: checked,
                                    })
                                  }
                                />
                                <Label className="text-sm">Autônomo</Label>
                              </div>
                              <div className="flex items-center gap-2">
                                <Switch
                                  checked={
                                    editingTerminal.requiresSangria || false
                                  }
                                  onCheckedChange={(checked) =>
                                    setEditingTerminal({
                                      ...editingTerminal,
                                      requiresSangria: checked,
                                    })
                                  }
                                />
                                <Label className="text-sm">Sangria</Label>
                              </div>
                              <div className="flex items-center gap-2">
                                <Switch
                                  checked={
                                    editingTerminal.requiresSuprimento || false
                                  }
                                  onCheckedChange={(checked) =>
                                    setEditingTerminal({
                                      ...editingTerminal,
                                      requiresSuprimento: checked,
                                    })
                                  }
                                />
                                <Label className="text-sm">Suprimento</Label>
                              </div>
                              <div className="flex items-center gap-2">
                                <Switch
                                  checked={editingTerminal.isActive || false}
                                  onCheckedChange={(checked) =>
                                    setEditingTerminal({
                                      ...editingTerminal,
                                      isActive: checked,
                                    })
                                  }
                                />
                                <Label className="text-sm">Ativo</Label>
                              </div>
                            </div>
                            <div className="flex gap-2 justify-end">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setEditingTerminal(null)}
                              >
                                Cancelar
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => {
                                  if (editingTerminal) {
                                    handleUpdateTerminal(editingTerminal);
                                  }
                                }}
                                disabled={savingTerminal}
                              >
                                {savingTerminal ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  "Salvar"
                                )}
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="flex items-center gap-4">
                              <div className="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-medium">
                                {String(terminal.code || terminal.name || "PDV")
                                  .substring(0, 2)
                                  .toUpperCase()}
                              </div>
                              <div>
                                <div className="font-medium flex items-center gap-2">
                                  {terminal.name}
                                  {!terminal.isActive && (
                                    <span className="text-xs bg-muted px-2 py-0.5 rounded text-muted-foreground">
                                      Inativo
                                    </span>
                                  )}
                                </div>
                                <div className="text-sm text-muted-foreground flex items-center gap-2">
                                  <span>
                                    Código: {terminal.code || "-"}
                                  </span>
                                  {terminal.assignedUserId && (
                                    <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded">
                                      Usuário vinculado
                                    </span>
                                  )}
                                  {terminal.paymentProvider &&
                                    terminal.paymentProvider !==
                                      "company_default" && (
                                      <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded">
                                        {terminal.paymentProvider === "mercadopago"
                                          ? "MP"
                                          : "Stone"}
                                      </span>
                                    )}
                                  {terminal.isAutonomous && (
                                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                                      Autônomo
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setEditingTerminal(terminal)}
                                data-testid={`button-edit-terminal-${terminal.id}`}
                              >
                                <Edit2 className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() =>
                                  terminal.id &&
                                  handleDeleteTerminal(terminal.id)
                                }
                                className="text-destructive hover:text-destructive"
                                data-testid={`button-delete-terminal-${terminal.id}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                <Separator />
                <div className="rounded-md bg-indigo-50 p-4 space-y-2">
                  <h4 className="text-sm font-medium text-indigo-900">
                    Sobre Terminais
                  </h4>
                  <ul className="text-xs text-indigo-700 space-y-1 list-disc list-inside">
                    <li>Cada terminal representa um ponto de venda físico</li>
                    <li>
                      Terminais autônomos não requerem abertura/fechamento de
                      caixa
                    </li>
                    <li>
                      Configure permissões de sangria e suprimento por terminal
                    </li>
                    <li>
                      Acesse o histórico de movimentações em Caixa &gt;
                      Histórico
                    </li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="users">
            <Card>
              <CardHeader className="flex flex-row items-center gap-4 space-y-0">
                <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                  <Users className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle>Gerenciamento de Usuários</CardTitle>
                  <CardDescription>
                    Gerencie usuários, perfis e permissões do sistema
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-muted-foreground">
                  Acesse a página de usuários para gerenciar todos os usuários
                  da sua empresa, definir perfis de acesso e configurar
                  permissões específicas para cada função.
                </p>
                <div className="flex flex-col gap-2">
                  <Link href="/users">
                    <Button className="w-full sm:w-auto">
                      <Users className="mr-2 h-4 w-4" />
                      Gerenciar Usuários
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}



