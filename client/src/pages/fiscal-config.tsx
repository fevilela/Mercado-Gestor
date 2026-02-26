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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useState, useEffect, useMemo } from "react";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2,
  FileText,
  DollarSign,
  Trash2,
  Pencil,
  Copy,
  Settings as SettingsIcon,
} from "lucide-react";

interface FiscalConfig {
  id?: number;
  companyId?: string;
  regimeTributario?: string;
  cnae?: string;
  im?: string;
  nfceCscId?: string;
  nfceCscToken?: string;
  nfeCertificate?: string;
  nfeCertificatePassword?: string;
  respTecCnpj?: string;
  respTecContato?: string;
  respTecEmail?: string;
  respTecFone?: string;
}

interface CFOPCode {
  id?: number;
  code: string;
  description: string;
  type: string;
  operationType: string;
  scope: string;
}

interface TaxAliquot {
  id?: number;
  companyId?: string;
  state: string;
  productId?: number | null;
  icmsAliquot?: string | null;
  icmsReduction?: string | null;
  ipiAliquot?: string | null;
  pisAliquot?: string | null;
  cofinsAliquot?: string | null;
  issAliquot?: string | null;
}

interface FiscalTaxRule {
  id: number;
  name: string;
  description?: string | null;
  operationType?: string | null;
  customerType?: string | null;
  regime?: string | null;
  scope?: string | null;
  originUf?: string | null;
  destinationUf?: string | null;
  ncm?: string | null;
  cest?: string | null;
  cfop?: string | null;
  cstIcms?: string | null;
  csosn?: string | null;
  cstPis?: string | null;
  cstCofins?: string | null;
  cstIpi?: string | null;
  icmsAliquot?: string | null;
  pisAliquot?: string | null;
  cofinsAliquot?: string | null;
  ipiAliquot?: string | null;
  issAliquot?: string | null;
  icmsStAliquot?: string | null;
  exceptionData?: Record<string, unknown> | null;
  priority?: number | null;
  isActive?: boolean | null;
}

type TaxRuleFormState = {
  name: string;
  description: string;
  operationType: string;
  customerType: string;
  regime: string;
  scope: string;
  originUf: string;
  destinationUf: string;
  ncm: string;
  cest: string;
  cfop: string;
  cstIcms: string;
  csosn: string;
  cstPis: string;
  cstCofins: string;
  cstIpi: string;
  icmsAliquot: string;
  icmsStAliquot: string;
  pisAliquot: string;
  cofinsAliquot: string;
  ipiAliquot: string;
  issAliquot: string;
  destinationIcmsAliquot: string;
  fcpAliquot: string;
  cBenef: string;
  motDesIcms: string;
  icmsDesonPercent: string;
  priority: number;
};

const createEmptyTaxRuleForm = (): TaxRuleFormState => ({
  name: "",
  description: "",
  operationType: "venda",
  customerType: "consumidor_final",
  regime: "Simples Nacional",
  scope: "interna",
  originUf: "",
  destinationUf: "",
  ncm: "",
  cest: "",
  cfop: "",
  cstIcms: "",
  csosn: "",
  cstPis: "",
  cstCofins: "",
  cstIpi: "",
  icmsAliquot: "",
  icmsStAliquot: "",
  pisAliquot: "",
  cofinsAliquot: "",
  ipiAliquot: "",
  issAliquot: "",
  destinationIcmsAliquot: "",
  fcpAliquot: "",
  cBenef: "",
  motDesIcms: "",
  icmsDesonPercent: "",
  priority: 0,
});

export default function FiscalConfig() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<FiscalConfig>({
    regimeTributario: "Simples Nacional",
    cnae: "",
    im: "",
    nfceCscId: "",
    nfceCscToken: "",
    nfeCertificate: "",
    nfeCertificatePassword: "",
    respTecCnpj: "",
    respTecContato: "",
    respTecEmail: "",
    respTecFone: "",
  });
  const [cfopCodes, setCfopCodes] = useState<CFOPCode[]>([]);
  const [taxAliquots, setTaxAliquots] = useState<TaxAliquot[]>([]);
  const [fiscalTaxRules, setFiscalTaxRules] = useState<FiscalTaxRule[]>([]);
  const [showNewCfop, setShowNewCfop] = useState(false);
  const [showNewAliquot, setShowNewAliquot] = useState(false);
  const [showNewTaxRule, setShowNewTaxRule] = useState(false);
  const [editingTaxRuleId, setEditingTaxRuleId] = useState<number | null>(null);
  const [taxRuleQuickFilter, setTaxRuleQuickFilter] = useState<
    "all" | "st" | "difal" | "fcp" | "benefit" | "desoneracao"
  >("all");
  const [taxRuleSearch, setTaxRuleSearch] = useState("");
  const [taxRuleSort, setTaxRuleSort] = useState<{
    key: "priority" | "name" | "cfop" | "ncm" | "uf";
    direction: "asc" | "desc";
  }>({ key: "priority", direction: "desc" });
  const [newCfop, setNewCfop] = useState({
    code: "",
    description: "",
    type: "entrada",
    operationType: "compra",
    scope: "interna",
  });
  const [newAliquot, setNewAliquot] = useState({
    state: "",
    productId: "",
    icmsAliquot: "0",
    icmsReduction: "0",
    ipiAliquot: "0",
    pisAliquot: "0",
    cofinsAliquot: "0",
    issAliquot: "0",
  });
  const [newTaxRule, setNewTaxRule] = useState<TaxRuleFormState>(createEmptyTaxRuleForm());
  const [editTaxRule, setEditTaxRule] = useState<TaxRuleFormState>(createEmptyTaxRuleForm());

  useEffect(() => {
    loadFiscalData();
  }, []);

  const loadFiscalData = async () => {
    setLoading(true);
    try {
      const [configRes, cfopRes, taxRes, rulesRes] = await Promise.all([
        fetch("/api/fiscal-config"),
        fetch("/api/cfop-codes"),
        fetch("/api/tax-aliquots"),
        fetch("/api/fiscal-tax-rules"),
      ]);

      if (configRes.ok) {
        const configData = await configRes.json();
        setConfig(configData);
      }

      if (cfopRes.ok) {
        const cfopData = await cfopRes.json();
        setCfopCodes(cfopData);
      }

      if (taxRes.ok) {
        const taxData = await taxRes.json();
        setTaxAliquots(taxData);
      }

      if (rulesRes.ok) {
        const rulesData = await rulesRes.json();
        setFiscalTaxRules(rulesData);
      }
    } catch (error) {
      console.error("Erro ao carregar dados fiscais:", error);
      toast({
        title: "Erro",
        description: "Falha ao carregar configuração fiscal",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveConfig = async () => {
    setSaving(true);
    try {
      const response = await fetch("/api/fiscal-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });

      if (!response.ok) throw new Error("Erro ao salvar");

      const updatedConfig = await response.json();
      setConfig(updatedConfig);
      toast({
        title: "Sucesso",
        description: "Configuração fiscal atualizada",
      });
    } catch (error) {
      console.error("Erro:", error);
      toast({
        title: "Erro",
        description: "Falha ao salvar configuração",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleAddCfop = async () => {
    try {
      if (!newCfop.code || !newCfop.description) {
        toast({
          title: "Erro",
          description: "Preencha código e descrição",
          variant: "destructive",
        });
        return;
      }
      const response = await fetch("/api/cfop-codes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newCfop),
      });
      if (!response.ok) throw new Error("Erro ao criar CFOP");
      const createdCfop = await response.json();
      setCfopCodes([...cfopCodes, createdCfop]);
      setNewCfop({
        code: "",
        description: "",
        type: "entrada",
        operationType: "compra",
        scope: "interna",
      });
      setShowNewCfop(false);
      toast({ title: "Sucesso", description: "CFOP criado com sucesso" });
    } catch (error) {
      toast({
        title: "Erro",
        description: "Falha ao criar CFOP",
        variant: "destructive",
      });
    }
  };

  const handleAddAliquot = async () => {
    try {
      if (!newAliquot.state) {
        toast({
          title: "Erro",
          description: "Preencha o estado (UF)",
          variant: "destructive",
        });
        return;
      }
      const payload = {
        state: newAliquot.state,
        productId: newAliquot.productId
          ? parseInt(newAliquot.productId, 10)
          : undefined,
        icmsAliquot: newAliquot.icmsAliquot || "0",
        icmsReduction: newAliquot.icmsReduction || "0",
        ipiAliquot: newAliquot.ipiAliquot || "0",
        pisAliquot: newAliquot.pisAliquot || "0",
        cofinsAliquot: newAliquot.cofinsAliquot || "0",
        issAliquot: newAliquot.issAliquot || "0",
      };
      const response = await fetch("/api/tax-aliquots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error("Erro ao criar alíquota");
      const createdAliquot = await response.json();
      setTaxAliquots([...taxAliquots, createdAliquot]);
      setNewAliquot({
        state: "",
        productId: "",
        icmsAliquot: "0",
        icmsReduction: "0",
        ipiAliquot: "0",
        pisAliquot: "0",
        cofinsAliquot: "0",
        issAliquot: "0",
      });
      setShowNewAliquot(false);
      toast({ title: "Sucesso", description: "Alíquota criada com sucesso" });
    } catch (error) {
      toast({
        title: "Erro",
        description: "Falha ao criar alíquota",
        variant: "destructive",
      });
    }
  };

  const normalizeOptional = (value: string) => {
    const normalized = value.trim();
    return normalized.length > 0 ? normalized : undefined;
  };

  const buildTaxRulePayload = (form: TaxRuleFormState) => ({
    name: form.name.trim(),
    description: normalizeOptional(form.description),
    priority: Number.isFinite(form.priority) ? form.priority : 0,
    isActive: true,
    operationType: normalizeOptional(form.operationType),
    customerType: normalizeOptional(form.customerType),
    regime: normalizeOptional(form.regime),
    scope: normalizeOptional(form.scope),
    originUf: normalizeOptional(form.originUf)?.toUpperCase(),
    destinationUf: normalizeOptional(form.destinationUf)?.toUpperCase(),
    ncm: normalizeOptional(form.ncm),
    cest: normalizeOptional(form.cest),
    cfop: normalizeOptional(form.cfop),
    cstIcms: normalizeOptional(form.cstIcms),
    csosn: normalizeOptional(form.csosn),
    cstPis: normalizeOptional(form.cstPis),
    cstCofins: normalizeOptional(form.cstCofins),
    cstIpi: normalizeOptional(form.cstIpi),
    icmsAliquot: normalizeOptional(form.icmsAliquot),
    icmsStAliquot: normalizeOptional(form.icmsStAliquot),
    pisAliquot: normalizeOptional(form.pisAliquot),
    cofinsAliquot: normalizeOptional(form.cofinsAliquot),
    ipiAliquot: normalizeOptional(form.ipiAliquot),
    issAliquot: normalizeOptional(form.issAliquot),
    exceptionData: {
      ...(normalizeOptional(form.destinationIcmsAliquot)
        ? { destinationIcmsAliquot: Number(form.destinationIcmsAliquot) }
        : {}),
      ...(normalizeOptional(form.fcpAliquot)
        ? { fcpAliquot: Number(form.fcpAliquot) }
        : {}),
      ...(normalizeOptional(form.cBenef) ? { cBenef: form.cBenef.trim() } : {}),
      ...(normalizeOptional(form.motDesIcms)
        ? { motDesIcms: form.motDesIcms.trim() }
        : {}),
      ...(normalizeOptional(form.icmsDesonPercent)
        ? { icmsDesonPercent: Number(form.icmsDesonPercent) }
        : {}),
    },
  });

  const mapRuleToTaxRuleForm = (rule: FiscalTaxRule): TaxRuleFormState => {
    const exceptionData = ((rule.exceptionData as Record<string, unknown>) || {});
    return {
      name: rule.name || "",
      description: String(rule.description || ""),
      operationType: String(rule.operationType || "venda"),
      customerType: String(rule.customerType || "consumidor_final"),
      regime: String(rule.regime || "Simples Nacional"),
      scope: String(rule.scope || "interna"),
      originUf: String(rule.originUf || ""),
      destinationUf: String(rule.destinationUf || ""),
      ncm: String(rule.ncm || ""),
      cest: String(rule.cest || ""),
      cfop: String(rule.cfop || ""),
      cstIcms: String(rule.cstIcms || ""),
      csosn: String(rule.csosn || ""),
      cstPis: String(rule.cstPis || ""),
      cstCofins: String(rule.cstCofins || ""),
      cstIpi: String(rule.cstIpi || ""),
      icmsAliquot: String(rule.icmsAliquot || ""),
      icmsStAliquot: String(rule.icmsStAliquot || ""),
      pisAliquot: String(rule.pisAliquot || ""),
      cofinsAliquot: String(rule.cofinsAliquot || ""),
      ipiAliquot: String(rule.ipiAliquot || ""),
      issAliquot: String(rule.issAliquot || ""),
      destinationIcmsAliquot: String(exceptionData.destinationIcmsAliquot || ""),
      fcpAliquot: String(exceptionData.fcpAliquot || ""),
      cBenef: String(exceptionData.cBenef || ""),
      motDesIcms: String(exceptionData.motDesIcms || ""),
      icmsDesonPercent: String(exceptionData.icmsDesonPercent || ""),
      priority: Number(rule.priority || 0),
    };
  };

  const filteredFiscalTaxRules = useMemo(() => {
    const query = taxRuleSearch.trim().toLowerCase();
    const filtered = fiscalTaxRules.filter((rule) => {
      const ex = (rule.exceptionData as Record<string, unknown>) || {};
      const matchesSearch =
        !query ||
        [
          rule.name,
          rule.description,
          rule.operationType,
          rule.customerType,
          rule.regime,
          rule.scope,
          rule.originUf,
          rule.destinationUf,
          rule.ncm,
          rule.cest,
          rule.cfop,
          rule.cstIcms,
          rule.csosn,
          ex.cBenef,
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(query));
      if (!matchesSearch) return false;
      if (taxRuleQuickFilter === "all") return true;
      if (taxRuleQuickFilter === "st") {
        return Number(rule.icmsStAliquot || 0) > 0;
      }
      if (taxRuleQuickFilter === "difal") {
        return Number(ex.destinationIcmsAliquot || 0) > 0;
      }
      if (taxRuleQuickFilter === "fcp") {
        return Number(ex.fcpAliquot || 0) > 0;
      }
      if (taxRuleQuickFilter === "benefit") {
        return String(ex.cBenef || "").trim().length > 0;
      }
      if (taxRuleQuickFilter === "desoneracao") {
        return (
          String(ex.motDesIcms || "").trim().length > 0 ||
          Number(ex.icmsDesonPercent || 0) > 0
        );
      }
      return true;
    });
    const sorted = [...filtered].sort((a, b) => {
      const dir = taxRuleSort.direction === "asc" ? 1 : -1;
      const aUf = `${a.originUf || ""}-${a.destinationUf || ""}`;
      const bUf = `${b.originUf || ""}-${b.destinationUf || ""}`;
      const aVal =
        taxRuleSort.key === "priority"
          ? Number(a.priority || 0)
          : taxRuleSort.key === "name"
            ? String(a.name || "").toLowerCase()
            : taxRuleSort.key === "cfop"
              ? String(a.cfop || "").toLowerCase()
              : taxRuleSort.key === "ncm"
                ? String(a.ncm || "").toLowerCase()
                : aUf.toLowerCase();
      const bVal =
        taxRuleSort.key === "priority"
          ? Number(b.priority || 0)
          : taxRuleSort.key === "name"
            ? String(b.name || "").toLowerCase()
            : taxRuleSort.key === "cfop"
              ? String(b.cfop || "").toLowerCase()
              : taxRuleSort.key === "ncm"
                ? String(b.ncm || "").toLowerCase()
                : bUf.toLowerCase();
      if (aVal < bVal) return -1 * dir;
      if (aVal > bVal) return 1 * dir;
      return 0;
    });
    return sorted;
  }, [fiscalTaxRules, taxRuleQuickFilter, taxRuleSearch, taxRuleSort]);

  const toggleTaxRuleSort = (
    key: "priority" | "name" | "cfop" | "ncm" | "uf",
  ) => {
    setTaxRuleSort((prev) =>
      prev.key === key
        ? {
            key,
            direction: prev.direction === "asc" ? "desc" : "asc",
          }
        : {
            key,
            direction: key === "priority" ? "desc" : "asc",
          },
    );
  };

  const sortIndicator = (key: "priority" | "name" | "cfop" | "ncm" | "uf") =>
    taxRuleSort.key === key ? (taxRuleSort.direction === "asc" ? " ↑" : " ↓") : "";

  const handleAddTaxRule = async () => {
    try {
      if (!newTaxRule.name.trim()) {
        toast({
          title: "Erro",
          description: "Informe o nome da regra fiscal",
          variant: "destructive",
        });
        return;
      }
      const payload = buildTaxRulePayload(newTaxRule);

      const response = await fetch("/api/fiscal-tax-rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error("Erro ao criar regra fiscal");
      }

      const created = await response.json();
      setFiscalTaxRules([created, ...fiscalTaxRules]);
      setShowNewTaxRule(false);
      setNewTaxRule(createEmptyTaxRuleForm());
      toast({ title: "Sucesso", description: "Regra fiscal criada" });
    } catch (error) {
      toast({
        title: "Erro",
        description: "Falha ao criar regra fiscal",
        variant: "destructive",
      });
    }
  };

  const handleStartEditTaxRule = (rule: FiscalTaxRule) => {
    setEditingTaxRuleId(rule.id);
    setEditTaxRule(mapRuleToTaxRuleForm(rule));
  };

  const handleDuplicateTaxRule = (rule: FiscalTaxRule) => {
    const cloned = mapRuleToTaxRuleForm(rule);
    setNewTaxRule({
      ...cloned,
      name: cloned.name ? `${cloned.name} (Copia)` : "Nova regra (Copia)",
      priority: Number(cloned.priority || 0),
    });
    setShowNewTaxRule(true);
    setEditingTaxRuleId(null);
  };

  const handleCancelEditTaxRule = () => {
    setEditingTaxRuleId(null);
    setEditTaxRule(createEmptyTaxRuleForm());
  };

  const handleUpdateTaxRule = async () => {
    if (!editingTaxRuleId) return;
    try {
      if (!editTaxRule.name.trim()) {
        toast({
          title: "Erro",
          description: "Informe o nome da regra fiscal",
          variant: "destructive",
        });
        return;
      }
      const response = await fetch(`/api/fiscal-tax-rules/${editingTaxRuleId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildTaxRulePayload(editTaxRule)),
      });
      if (!response.ok) {
        throw new Error("Erro ao atualizar regra fiscal");
      }
      const updated = await response.json();
      setFiscalTaxRules((prev) =>
        prev.map((rule) => (rule.id === updated.id ? updated : rule)),
      );
      handleCancelEditTaxRule();
      toast({ title: "Sucesso", description: "Regra fiscal atualizada" });
    } catch (error) {
      toast({
        title: "Erro",
        description: "Falha ao atualizar regra fiscal",
        variant: "destructive",
      });
    }
  };

  const handleDeleteTaxRule = async (id: number) => {
    try {
      const response = await fetch(`/api/fiscal-tax-rules/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        throw new Error("Erro ao excluir regra fiscal");
      }
      setFiscalTaxRules(fiscalTaxRules.filter((rule) => rule.id !== id));
      toast({ title: "Sucesso", description: "Regra fiscal removida" });
    } catch (error) {
      toast({
        title: "Erro",
        description: "Falha ao excluir regra fiscal",
        variant: "destructive",
      });
    }
  };

  return (
    <Layout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <SettingsIcon className="h-8 w-8" />
            Configuração Fiscal
          </h1>
          <p className="text-muted-foreground mt-2">
            Gerenciar configurações de impostos, CFOP codes e alíquotas fiscais
          </p>
        </div>

        <Tabs defaultValue="cfop" className="space-y-4">
          <TabsList>
            <TabsTrigger value="resp-tec">Responsavel Tecnico</TabsTrigger>
            <TabsTrigger value="cfop">CFOP Codes</TabsTrigger>
            <TabsTrigger value="aliquots">Alíquotas</TabsTrigger>
            <TabsTrigger value="tax-rules">Regras Fiscais</TabsTrigger>
          </TabsList>

          {/* TAB: Configuração removida conforme solicitação. Dados movidos para Configurações > Dados da Empresa */}

          <TabsContent value="resp-tec" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Responsavel Tecnico (NFC-e)</CardTitle>
                <CardDescription>
                  Esses dados vao na tag &lt;infRespTec&gt; do XML.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="resptec-cnpj">CNPJ</Label>
                    <Input
                      id="resptec-cnpj"
                      value={config.respTecCnpj || ""}
                      onChange={(e) =>
                        setConfig({ ...config, respTecCnpj: e.target.value })
                      }
                      placeholder="12345678000199"
                    />
                  </div>
                  <div>
                    <Label htmlFor="resptec-contato">Contato</Label>
                    <Input
                      id="resptec-contato"
                      value={config.respTecContato || ""}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          respTecContato: e.target.value,
                        })
                      }
                      placeholder="Sistema PDV"
                    />
                  </div>
                  <div>
                    <Label htmlFor="resptec-email">E-mail</Label>
                    <Input
                      id="resptec-email"
                      type="email"
                      value={config.respTecEmail || ""}
                      onChange={(e) =>
                        setConfig({ ...config, respTecEmail: e.target.value })
                      }
                      placeholder="suporte@sistema.com"
                    />
                  </div>
                  <div>
                    <Label htmlFor="resptec-fone">Telefone</Label>
                    <Input
                      id="resptec-fone"
                      value={config.respTecFone || ""}
                      onChange={(e) =>
                        setConfig({ ...config, respTecFone: e.target.value })
                      }
                      placeholder="31999999999"
                    />
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button
                    onClick={handleSaveConfig}
                    disabled={saving}
                    data-testid="button-save-resp-tec"
                  >
                    {saving ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Salvando...
                      </>
                    ) : (
                      "Salvar"
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB: CFOP Codes */}
          <TabsContent value="cfop" className="space-y-4">
            {showNewCfop && (
              <Card>
                <CardHeader>
                  <CardTitle>Novo CFOP Code</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="cfop-code">Código (ex: 5102)</Label>
                      <Input
                        id="cfop-code"
                        data-testid="input-cfop-code"
                        value={newCfop.code}
                        onChange={(e) =>
                          setNewCfop({ ...newCfop, code: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <Label htmlFor="cfop-desc">Descrição</Label>
                      <Input
                        id="cfop-desc"
                        data-testid="input-cfop-desc"
                        value={newCfop.description}
                        onChange={(e) =>
                          setNewCfop({
                            ...newCfop,
                            description: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div>
                      <Label>Tipo</Label>
                      <Select
                        value={newCfop.type}
                        onValueChange={(v) =>
                          setNewCfop({ ...newCfop, type: v })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="entrada">Entrada</SelectItem>
                          <SelectItem value="saida">Saída</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Tipo de Operação</Label>
                      <Select
                        value={newCfop.operationType}
                        onValueChange={(v) =>
                          setNewCfop({ ...newCfop, operationType: v })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="compra">Compra</SelectItem>
                          <SelectItem value="venda">Venda</SelectItem>
                          <SelectItem value="devolução">Devolução</SelectItem>
                          <SelectItem value="serviço">Serviço</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Escopo</Label>
                      <Select
                        value={newCfop.scope}
                        onValueChange={(v) =>
                          setNewCfop({ ...newCfop, scope: v })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="interna">Interna</SelectItem>
                          <SelectItem value="interestadual">
                            Interestadual
                          </SelectItem>
                          <SelectItem value="exterior">Exterior</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="flex gap-2 justify-end pt-4">
                    <Button
                      variant="outline"
                      onClick={() => setShowNewCfop(false)}
                      data-testid="button-cancel-cfop"
                    >
                      Cancelar
                    </Button>
                    <Button
                      onClick={handleAddCfop}
                      data-testid="button-save-cfop"
                    >
                      Criar CFOP
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>CFOP - Código Fiscal de Operações</CardTitle>
                  <CardDescription>
                    Códigos de operações fiscais para saídas, entradas e
                    devoluções
                  </CardDescription>
                </div>
                <Button
                  onClick={() => setShowNewCfop(true)}
                  data-testid="button-new-cfop"
                >
                  + Novo CFOP
                </Button>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="border-b">
                        <tr>
                          <th className="text-left py-2 px-4">Código</th>
                          <th className="text-left py-2 px-4">Descrição</th>
                          <th className="text-left py-2 px-4">Tipo</th>
                          <th className="text-left py-2 px-4">Operação</th>
                          <th className="text-left py-2 px-4">Escopo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {cfopCodes.map((cfop) => (
                          <tr
                            key={cfop.id}
                            className="border-b hover:bg-muted/50"
                            data-testid={`row-cfop-${cfop.code}`}
                          >
                            <td className="py-2 px-4 font-mono font-semibold text-primary">
                              {cfop.code}
                            </td>
                            <td className="py-2 px-4">{cfop.description}</td>
                            <td className="py-2 px-4">
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                {cfop.type}
                              </span>
                            </td>
                            <td className="py-2 px-4">{cfop.operationType}</td>
                            <td className="py-2 px-4">
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                {cfop.scope}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB: Alíquotas */}
          <TabsContent value="aliquots" className="space-y-4">
            {showNewAliquot && (
              <Card>
                <CardHeader>
                  <CardTitle>Nova Alíquota</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="aliq-state">Estado (UF)</Label>
                      <Input
                        id="aliq-state"
                        data-testid="input-aliquot-state"
                        maxLength={2}
                        value={newAliquot.state}
                        onChange={(e) =>
                          setNewAliquot({
                            ...newAliquot,
                            state: e.target.value.toUpperCase(),
                          })
                        }
                        placeholder="SP"
                      />
                    </div>
                    <div>
                      <Label htmlFor="aliq-product">ID Produto (opcional)</Label>
                      <Input
                        id="aliq-product"
                        type="number"
                        min="1"
                        value={newAliquot.productId}
                        onChange={(e) =>
                          setNewAliquot({
                            ...newAliquot,
                            productId: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div>
                      <Label htmlFor="aliq-icms">ICMS (%)</Label>
                      <Input
                        id="aliq-icms"
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        value={newAliquot.icmsAliquot}
                        onChange={(e) =>
                          setNewAliquot({
                            ...newAliquot,
                            icmsAliquot: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div>
                      <Label htmlFor="aliq-icms-reduction">Reducao ICMS (%)</Label>
                      <Input
                        id="aliq-icms-reduction"
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        value={newAliquot.icmsReduction}
                        onChange={(e) =>
                          setNewAliquot({
                            ...newAliquot,
                            icmsReduction: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div>
                      <Label htmlFor="aliq-ipi">IPI (%)</Label>
                      <Input
                        id="aliq-ipi"
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        value={newAliquot.ipiAliquot}
                        onChange={(e) =>
                          setNewAliquot({
                            ...newAliquot,
                            ipiAliquot: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div>
                      <Label htmlFor="aliq-pis">PIS (%)</Label>
                      <Input
                        id="aliq-pis"
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        value={newAliquot.pisAliquot}
                        onChange={(e) =>
                          setNewAliquot({
                            ...newAliquot,
                            pisAliquot: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div>
                      <Label htmlFor="aliq-cofins">COFINS (%)</Label>
                      <Input
                        id="aliq-cofins"
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        value={newAliquot.cofinsAliquot}
                        onChange={(e) =>
                          setNewAliquot({
                            ...newAliquot,
                            cofinsAliquot: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div>
                      <Label htmlFor="aliq-iss">ISS (%)</Label>
                      <Input
                        id="aliq-iss"
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        value={newAliquot.issAliquot}
                        onChange={(e) =>
                          setNewAliquot({
                            ...newAliquot,
                            issAliquot: e.target.value,
                          })
                        }
                      />
                    </div>
                  </div>
                  <div className="flex gap-2 justify-end pt-4">
                    <Button
                      variant="outline"
                      onClick={() => setShowNewAliquot(false)}
                      data-testid="button-cancel-aliquot"
                    >
                      Cancelar
                    </Button>
                    <Button
                      onClick={handleAddAliquot}
                      data-testid="button-save-aliquot"
                    >
                      Criar Alíquota
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Alíquotas de Impostos</CardTitle>
                  <CardDescription>
                    Configure alíquotas fiscais por estado e por produto (opcional)
                  </CardDescription>
                </div>
                <Button
                  onClick={() => setShowNewAliquot(true)}
                  data-testid="button-new-aliquot"
                >
                  + Nova Alíquota
                </Button>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : (
                  <div className="space-y-4">
                    {taxAliquots.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <DollarSign className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p>Nenhuma alíquota configurada</p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="border-b">
                            <tr>
                              <th className="text-left py-2 px-4">Estado</th>
                              <th className="text-left py-2 px-4">Produto</th>
                              <th className="text-left py-2 px-4">ICMS</th>
                              <th className="text-left py-2 px-4">Red. ICMS</th>
                              <th className="text-left py-2 px-4">IPI</th>
                              <th className="text-left py-2 px-4">PIS</th>
                              <th className="text-left py-2 px-4">COFINS</th>
                              <th className="text-left py-2 px-4">ISS</th>
                            </tr>
                          </thead>
                          <tbody>
                            {taxAliquots.map((aliquot) => (
                              <tr
                                key={aliquot.id}
                                className="border-b hover:bg-muted/50"
                                data-testid={`row-aliquot-${aliquot.id}`}
                              >
                                <td className="py-2 px-4 font-semibold">
                                  {aliquot.state}
                                </td>
                                <td className="py-2 px-4">{aliquot.productId || "-"}</td>
                                <td className="py-2 px-4">{aliquot.icmsAliquot || "0"}%</td>
                                <td className="py-2 px-4">{aliquot.icmsReduction || "0"}%</td>
                                <td className="py-2 px-4">{aliquot.ipiAliquot || "0"}%</td>
                                <td className="py-2 px-4">{aliquot.pisAliquot || "0"}%</td>
                                <td className="py-2 px-4">{aliquot.cofinsAliquot || "0"}%</td>
                                <td className="py-2 px-4">{aliquot.issAliquot || "0"}%</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="tax-rules" className="space-y-4">
            {showNewTaxRule && (
              <Card>
                <CardHeader>
                  <CardTitle>Nova Regra Fiscal</CardTitle>
                  <CardDescription>
                    Defina filtros por operacao/UF/NCM/CFOP e o resultado tributario.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label>Nome da Regra</Label>
                      <Input
                        value={newTaxRule.name}
                        onChange={(e) =>
                          setNewTaxRule({ ...newTaxRule, name: e.target.value })
                        }
                        placeholder="Venda SN interna consumidor final"
                      />
                    </div>
                    <div>
                      <Label>Descricao</Label>
                      <Input
                        value={newTaxRule.description}
                        onChange={(e) =>
                          setNewTaxRule({
                            ...newTaxRule,
                            description: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div>
                      <Label>Prioridade</Label>
                      <Input
                        type="number"
                        value={newTaxRule.priority}
                        onChange={(e) =>
                          setNewTaxRule({
                            ...newTaxRule,
                            priority: parseInt(e.target.value || "0", 10) || 0,
                          })
                        }
                      />
                    </div>
                    <div>
                      <Label>Operacao</Label>
                      <Select
                        value={newTaxRule.operationType}
                        onValueChange={(v) =>
                          setNewTaxRule({ ...newTaxRule, operationType: v })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="venda">Venda</SelectItem>
                          <SelectItem value="compra">Compra</SelectItem>
                          <SelectItem value="devolucao">Devolucao</SelectItem>
                          <SelectItem value="servico">Servico</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Cliente</Label>
                      <Select
                        value={newTaxRule.customerType}
                        onValueChange={(v) =>
                          setNewTaxRule({ ...newTaxRule, customerType: v })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="consumidor_final">
                            Consumidor final
                          </SelectItem>
                          <SelectItem value="revenda">Revenda</SelectItem>
                          <SelectItem value="contribuinte">Contribuinte</SelectItem>
                          <SelectItem value="nao_contribuinte">
                            Isento
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Regime</Label>
                      <Select
                        value={newTaxRule.regime}
                        onValueChange={(v) =>
                          setNewTaxRule({ ...newTaxRule, regime: v })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Simples Nacional">
                            Simples Nacional
                          </SelectItem>
                          <SelectItem value="Lucro Presumido">
                            Lucro Presumido
                          </SelectItem>
                          <SelectItem value="Lucro Real">Lucro Real</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Escopo</Label>
                      <Select
                        value={newTaxRule.scope}
                        onValueChange={(v) =>
                          setNewTaxRule({ ...newTaxRule, scope: v })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="interna">Interna</SelectItem>
                          <SelectItem value="interestadual">
                            Interestadual
                          </SelectItem>
                          <SelectItem value="exterior">Exterior</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>UF Origem</Label>
                      <Input
                        maxLength={2}
                        value={newTaxRule.originUf}
                        onChange={(e) =>
                          setNewTaxRule({
                            ...newTaxRule,
                            originUf: e.target.value.toUpperCase(),
                          })
                        }
                        placeholder="SP"
                      />
                    </div>
                    <div>
                      <Label>UF Destino</Label>
                      <Input
                        maxLength={2}
                        value={newTaxRule.destinationUf}
                        onChange={(e) =>
                          setNewTaxRule({
                            ...newTaxRule,
                            destinationUf: e.target.value.toUpperCase(),
                          })
                        }
                        placeholder="MG"
                      />
                    </div>
                    <div>
                      <Label>NCM</Label>
                      <Input
                        value={newTaxRule.ncm}
                        onChange={(e) =>
                          setNewTaxRule({ ...newTaxRule, ncm: e.target.value })
                        }
                        placeholder="00000000"
                      />
                    </div>
                    <div>
                      <Label>CEST</Label>
                      <Input
                        value={newTaxRule.cest}
                        onChange={(e) =>
                          setNewTaxRule({ ...newTaxRule, cest: e.target.value })
                        }
                        placeholder="0000000"
                      />
                    </div>
                    <div>
                      <Label>CFOP</Label>
                      <Input
                        value={newTaxRule.cfop}
                        onChange={(e) =>
                          setNewTaxRule({ ...newTaxRule, cfop: e.target.value })
                        }
                        placeholder="5102"
                      />
                    </div>
                    <div>
                      <Label>CST ICMS</Label>
                      <Input
                        value={newTaxRule.cstIcms}
                        onChange={(e) =>
                          setNewTaxRule({
                            ...newTaxRule,
                            cstIcms: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div>
                      <Label>CSOSN</Label>
                      <Input
                        value={newTaxRule.csosn}
                        onChange={(e) =>
                          setNewTaxRule({ ...newTaxRule, csosn: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <Label>CST PIS</Label>
                      <Input
                        value={newTaxRule.cstPis}
                        onChange={(e) =>
                          setNewTaxRule({ ...newTaxRule, cstPis: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <Label>CST COFINS</Label>
                      <Input
                        value={newTaxRule.cstCofins}
                        onChange={(e) =>
                          setNewTaxRule({
                            ...newTaxRule,
                            cstCofins: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div>
                      <Label>CST IPI</Label>
                      <Input
                        value={newTaxRule.cstIpi}
                        onChange={(e) =>
                          setNewTaxRule({ ...newTaxRule, cstIpi: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <Label>Aliquota ICMS (%)</Label>
                      <Input
                        value={newTaxRule.icmsAliquot}
                        onChange={(e) =>
                          setNewTaxRule({
                            ...newTaxRule,
                            icmsAliquot: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div>
                      <Label>Aliquota ICMS-ST (%)</Label>
                      <Input
                        value={(newTaxRule as any).icmsStAliquot}
                        onChange={(e) =>
                          setNewTaxRule({
                            ...newTaxRule,
                            icmsStAliquot: e.target.value,
                          } as any)
                        }
                        placeholder="0.00"
                      />
                    </div>
                    <div>
                      <Label>Aliquota PIS (%)</Label>
                      <Input
                        value={newTaxRule.pisAliquot}
                        onChange={(e) =>
                          setNewTaxRule({
                            ...newTaxRule,
                            pisAliquot: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div>
                      <Label>Aliquota COFINS (%)</Label>
                      <Input
                        value={newTaxRule.cofinsAliquot}
                        onChange={(e) =>
                          setNewTaxRule({
                            ...newTaxRule,
                            cofinsAliquot: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div>
                      <Label>Aliquota ICMS Destino (DIFAL) %</Label>
                      <Input
                        value={(newTaxRule as any).destinationIcmsAliquot}
                        onChange={(e) =>
                          setNewTaxRule({
                            ...newTaxRule,
                            destinationIcmsAliquot: e.target.value,
                          } as any)
                        }
                        placeholder="18.00"
                      />
                    </div>
                    <div>
                      <Label>Aliquota FCP (%)</Label>
                      <Input
                        value={(newTaxRule as any).fcpAliquot}
                        onChange={(e) =>
                          setNewTaxRule({
                            ...newTaxRule,
                            fcpAliquot: e.target.value,
                          } as any)
                        }
                        placeholder="2.00"
                      />
                    </div>
                    <div>
                      <Label>cBenef</Label>
                      <Input
                        value={(newTaxRule as any).cBenef}
                        onChange={(e) =>
                          setNewTaxRule({
                            ...newTaxRule,
                            cBenef: e.target.value,
                          } as any)
                        }
                        placeholder="Codigo do beneficio fiscal"
                      />
                    </div>
                    <div>
                      <Label>Motivo Deson. ICMS</Label>
                      <Input
                        value={(newTaxRule as any).motDesIcms}
                        onChange={(e) =>
                          setNewTaxRule({
                            ...newTaxRule,
                            motDesIcms: e.target.value,
                          } as any)
                        }
                        placeholder="9"
                      />
                    </div>
                    <div>
                      <Label>% Desoneracao ICMS</Label>
                      <Input
                        value={(newTaxRule as any).icmsDesonPercent}
                        onChange={(e) =>
                          setNewTaxRule({
                            ...newTaxRule,
                            icmsDesonPercent: e.target.value,
                          } as any)
                        }
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2 justify-end">
                    <Button
                      variant="outline"
                      onClick={() => setShowNewTaxRule(false)}
                    >
                      Cancelar
                    </Button>
                    <Button onClick={handleAddTaxRule}>Criar Regra</Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {editingTaxRuleId && (
              <Card className="border-primary/40">
                <CardHeader>
                  <CardTitle>Editar Regra Fiscal #{editingTaxRuleId}</CardTitle>
                  <CardDescription>
                    Ajuste contexto, CST/CSOSN, ST, DIFAL/FCP e beneficios fiscais.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label>Nome da Regra</Label>
                      <Input
                        value={editTaxRule.name}
                        onChange={(e) =>
                          setEditTaxRule({ ...editTaxRule, name: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <Label>Descricao</Label>
                      <Input
                        value={editTaxRule.description}
                        onChange={(e) =>
                          setEditTaxRule({ ...editTaxRule, description: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <Label>Prioridade</Label>
                      <Input
                        type="number"
                        value={editTaxRule.priority}
                        onChange={(e) =>
                          setEditTaxRule({
                            ...editTaxRule,
                            priority: parseInt(e.target.value || "0", 10) || 0,
                          })
                        }
                      />
                    </div>
                    <div>
                      <Label>Operacao</Label>
                      <Input
                        value={editTaxRule.operationType}
                        onChange={(e) =>
                          setEditTaxRule({ ...editTaxRule, operationType: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <Label>Cliente</Label>
                      <Input
                        value={editTaxRule.customerType}
                        onChange={(e) =>
                          setEditTaxRule({ ...editTaxRule, customerType: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <Label>Regime</Label>
                      <Input
                        value={editTaxRule.regime}
                        onChange={(e) =>
                          setEditTaxRule({ ...editTaxRule, regime: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <Label>Escopo</Label>
                      <Input
                        value={editTaxRule.scope}
                        onChange={(e) =>
                          setEditTaxRule({ ...editTaxRule, scope: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <Label>UF Origem</Label>
                      <Input
                        maxLength={2}
                        value={editTaxRule.originUf}
                        onChange={(e) =>
                          setEditTaxRule({
                            ...editTaxRule,
                            originUf: e.target.value.toUpperCase(),
                          })
                        }
                      />
                    </div>
                    <div>
                      <Label>UF Destino</Label>
                      <Input
                        maxLength={2}
                        value={editTaxRule.destinationUf}
                        onChange={(e) =>
                          setEditTaxRule({
                            ...editTaxRule,
                            destinationUf: e.target.value.toUpperCase(),
                          })
                        }
                      />
                    </div>
                    <div>
                      <Label>NCM</Label>
                      <Input
                        value={editTaxRule.ncm}
                        onChange={(e) =>
                          setEditTaxRule({ ...editTaxRule, ncm: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <Label>CEST</Label>
                      <Input
                        value={editTaxRule.cest}
                        onChange={(e) =>
                          setEditTaxRule({ ...editTaxRule, cest: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <Label>CFOP</Label>
                      <Input
                        value={editTaxRule.cfop}
                        onChange={(e) =>
                          setEditTaxRule({ ...editTaxRule, cfop: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <Label>CST ICMS</Label>
                      <Input
                        value={editTaxRule.cstIcms}
                        onChange={(e) =>
                          setEditTaxRule({ ...editTaxRule, cstIcms: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <Label>CSOSN</Label>
                      <Input
                        value={editTaxRule.csosn}
                        onChange={(e) =>
                          setEditTaxRule({ ...editTaxRule, csosn: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <Label>CST IPI</Label>
                      <Input
                        value={editTaxRule.cstIpi}
                        onChange={(e) =>
                          setEditTaxRule({ ...editTaxRule, cstIpi: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <Label>CST PIS</Label>
                      <Input
                        value={editTaxRule.cstPis}
                        onChange={(e) =>
                          setEditTaxRule({ ...editTaxRule, cstPis: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <Label>CST COFINS</Label>
                      <Input
                        value={editTaxRule.cstCofins}
                        onChange={(e) =>
                          setEditTaxRule({ ...editTaxRule, cstCofins: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <Label>ICMS (%)</Label>
                      <Input
                        value={editTaxRule.icmsAliquot}
                        onChange={(e) =>
                          setEditTaxRule({ ...editTaxRule, icmsAliquot: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <Label>ICMS-ST (%)</Label>
                      <Input
                        value={editTaxRule.icmsStAliquot}
                        onChange={(e) =>
                          setEditTaxRule({ ...editTaxRule, icmsStAliquot: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <Label>ICMS Destino (DIFAL) %</Label>
                      <Input
                        value={editTaxRule.destinationIcmsAliquot}
                        onChange={(e) =>
                          setEditTaxRule({
                            ...editTaxRule,
                            destinationIcmsAliquot: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div>
                      <Label>FCP (%)</Label>
                      <Input
                        value={editTaxRule.fcpAliquot}
                        onChange={(e) =>
                          setEditTaxRule({ ...editTaxRule, fcpAliquot: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <Label>IPI (%)</Label>
                      <Input
                        value={editTaxRule.ipiAliquot}
                        onChange={(e) =>
                          setEditTaxRule({ ...editTaxRule, ipiAliquot: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <Label>PIS (%)</Label>
                      <Input
                        value={editTaxRule.pisAliquot}
                        onChange={(e) =>
                          setEditTaxRule({ ...editTaxRule, pisAliquot: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <Label>COFINS (%)</Label>
                      <Input
                        value={editTaxRule.cofinsAliquot}
                        onChange={(e) =>
                          setEditTaxRule({ ...editTaxRule, cofinsAliquot: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <Label>ISS (%)</Label>
                      <Input
                        value={editTaxRule.issAliquot}
                        onChange={(e) =>
                          setEditTaxRule({ ...editTaxRule, issAliquot: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <Label>cBenef</Label>
                      <Input
                        value={editTaxRule.cBenef}
                        onChange={(e) =>
                          setEditTaxRule({ ...editTaxRule, cBenef: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <Label>Motivo Deson. ICMS</Label>
                      <Input
                        value={editTaxRule.motDesIcms}
                        onChange={(e) =>
                          setEditTaxRule({ ...editTaxRule, motDesIcms: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <Label>% Desoneracao ICMS</Label>
                      <Input
                        value={editTaxRule.icmsDesonPercent}
                        onChange={(e) =>
                          setEditTaxRule({
                            ...editTaxRule,
                            icmsDesonPercent: e.target.value,
                          })
                        }
                      />
                    </div>
                  </div>
                  <div className="flex gap-2 justify-end">
                    <Button variant="outline" onClick={handleCancelEditTaxRule}>
                      Cancelar Edicao
                    </Button>
                    <Button onClick={handleUpdateTaxRule}>Salvar Alteracoes</Button>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Regras Fiscais
                  </CardTitle>
                  <CardDescription>
                    Cadastro por contexto fiscal: operacao, cliente, regime, UF, NCM e CFOP.
                  </CardDescription>
                  <div className="mt-3 max-w-md">
                    <Input
                      value={taxRuleSearch}
                      onChange={(e) => setTaxRuleSearch(e.target.value)}
                      placeholder="Buscar por nome, CFOP, NCM, UF, regime, cliente..."
                    />
                  </div>
                  <div className="flex flex-wrap gap-2 mt-3">
                    {[
                      { key: "all", label: "Todas" },
                      { key: "st", label: "ST" },
                      { key: "difal", label: "DIFAL" },
                      { key: "fcp", label: "FCP" },
                      { key: "benefit", label: "Beneficio" },
                      { key: "desoneracao", label: "Desoneracao" },
                    ].map((filter) => {
                      const active = taxRuleQuickFilter === (filter.key as typeof taxRuleQuickFilter);
                      return (
                        <Button
                          key={filter.key}
                          type="button"
                          variant={active ? "default" : "outline"}
                          size="sm"
                          onClick={() =>
                            setTaxRuleQuickFilter(filter.key as typeof taxRuleQuickFilter)
                          }
                          className="h-7 px-2 text-xs"
                        >
                          {filter.label}
                        </Button>
                      );
                    })}
                  </div>
                </div>
                <Button onClick={() => setShowNewTaxRule(true)}>
                  + Nova Regra
                </Button>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : filteredFiscalTaxRules.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>
                      {taxRuleSearch.trim()
                        ? "Nenhuma regra encontrada para a busca/filtro"
                        : taxRuleQuickFilter === "all"
                          ? "Nenhuma regra fiscal cadastrada"
                          : "Nenhuma regra encontrada para esse filtro"}
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="border-b">
                        <tr>
                          <th className="text-left py-2 px-4">
                            <button
                              type="button"
                              className="font-medium hover:underline"
                              onClick={() => toggleTaxRuleSort("name")}
                            >
                              Nome{sortIndicator("name")}
                            </button>
                          </th>
                          <th className="text-left py-2 px-4">Contexto</th>
                          <th className="text-left py-2 px-4">
                            <button
                              type="button"
                              className="font-medium hover:underline"
                              onClick={() => toggleTaxRuleSort("cfop")}
                            >
                              CFOP{sortIndicator("cfop")}
                            </button>
                          </th>
                          <th className="text-left py-2 px-4">
                            <button
                              type="button"
                              className="font-medium hover:underline"
                              onClick={() => toggleTaxRuleSort("ncm")}
                            >
                              NCM{sortIndicator("ncm")}
                            </button>
                          </th>
                          <th className="text-left py-2 px-4">
                            <button
                              type="button"
                              className="font-medium hover:underline"
                              onClick={() => toggleTaxRuleSort("uf")}
                            >
                              UFs{sortIndicator("uf")}
                            </button>
                          </th>
                          <th className="text-left py-2 px-4">Resultado</th>
                          <th className="text-left py-2 px-4">
                            <button
                              type="button"
                              className="font-medium hover:underline"
                              onClick={() => toggleTaxRuleSort("priority")}
                            >
                              Prioridade{sortIndicator("priority")}
                            </button>
                          </th>
                          <th className="text-right py-2 px-4">Acoes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredFiscalTaxRules.map((rule) => (
                          <tr key={rule.id} className="border-b hover:bg-muted/50">
                            <td className="py-2 px-4">
                              <div className="font-semibold">{rule.name}</div>
                              <div className="text-xs text-muted-foreground">
                                {rule.description || "-"}
                              </div>
                            </td>
                            <td className="py-2 px-4 text-xs">
                              {[
                                rule.operationType,
                                rule.customerType,
                                rule.regime,
                                rule.scope,
                                rule.originUf,
                                rule.destinationUf,
                                rule.ncm,
                                rule.cfop,
                              ]
                                .filter(Boolean)
                                .join(" | ") || "-"}
                            </td>
                            <td className="py-2 px-4 text-xs font-mono">
                              {rule.cfop || "-"}
                            </td>
                            <td className="py-2 px-4 text-xs font-mono">
                              {rule.ncm || "-"}
                            </td>
                            <td className="py-2 px-4 text-xs font-mono">
                              {[rule.originUf, rule.destinationUf].filter(Boolean).join(" -> ") ||
                                "-"}
                            </td>
                            <td className="py-2 px-4 text-xs">
                              <div className="flex flex-wrap gap-1 mb-1">
                                {rule.icmsStAliquot && Number(rule.icmsStAliquot) > 0 ? (
                                  <span className="inline-flex items-center rounded-full bg-amber-100 text-amber-800 px-2 py-0.5 text-[10px] font-semibold">
                                    ST
                                  </span>
                                ) : null}
                                {(rule.exceptionData as any)?.destinationIcmsAliquot ? (
                                  <span className="inline-flex items-center rounded-full bg-blue-100 text-blue-800 px-2 py-0.5 text-[10px] font-semibold">
                                    DIFAL
                                  </span>
                                ) : null}
                                {(rule.exceptionData as any)?.fcpAliquot ? (
                                  <span className="inline-flex items-center rounded-full bg-sky-100 text-sky-800 px-2 py-0.5 text-[10px] font-semibold">
                                    FCP
                                  </span>
                                ) : null}
                                {(rule.exceptionData as any)?.cBenef ? (
                                  <span className="inline-flex items-center rounded-full bg-emerald-100 text-emerald-800 px-2 py-0.5 text-[10px] font-semibold">
                                    Beneficio
                                  </span>
                                ) : null}
                                {(rule.exceptionData as any)?.motDesIcms ? (
                                  <span className="inline-flex items-center rounded-full bg-rose-100 text-rose-800 px-2 py-0.5 text-[10px] font-semibold">
                                    Desoneracao
                                  </span>
                                ) : null}
                              </div>
                              {[
                                rule.cstIcms ? `CST ${rule.cstIcms}` : null,
                                rule.csosn ? `CSOSN ${rule.csosn}` : null,
                                rule.cstPis ? `PIS ${rule.cstPis}` : null,
                                rule.cstCofins ? `COFINS ${rule.cstCofins}` : null,
                                rule.icmsAliquot ? `ICMS ${rule.icmsAliquot}%` : null,
                                rule.icmsStAliquot ? `ST ${rule.icmsStAliquot}%` : null,
                                (rule.exceptionData as any)?.destinationIcmsAliquot
                                  ? `DIFAL Dest ${(rule.exceptionData as any).destinationIcmsAliquot}%`
                                  : null,
                                (rule.exceptionData as any)?.fcpAliquot
                                  ? `FCP ${(rule.exceptionData as any).fcpAliquot}%`
                                  : null,
                                (rule.exceptionData as any)?.cBenef
                                  ? `cBenef ${(rule.exceptionData as any).cBenef}`
                                  : null,
                              ]
                                .filter(Boolean)
                                .join(" | ") || "-"}
                            </td>
                            <td className="py-2 px-4">{rule.priority ?? 0}</td>
                            <td className="py-2 px-4 text-right">
                              <div className="inline-flex gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleDuplicateTaxRule(rule)}
                                  title="Duplicar"
                                >
                                  <Copy className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleStartEditTaxRule(rule)}
                                  title="Editar"
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleDeleteTaxRule(rule.id)}
                                  title="Excluir"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
