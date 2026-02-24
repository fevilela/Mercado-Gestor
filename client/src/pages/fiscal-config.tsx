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
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2,
  FileText,
  DollarSign,
  Trash2,
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
  priority?: number | null;
  isActive?: boolean | null;
}

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
  const [newTaxRule, setNewTaxRule] = useState({
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
    pisAliquot: "",
    cofinsAliquot: "",
    ipiAliquot: "",
    issAliquot: "",
    priority: 0,
  });

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

      const payload = {
        name: newTaxRule.name.trim(),
        description: normalizeOptional(newTaxRule.description),
        priority: Number.isFinite(newTaxRule.priority) ? newTaxRule.priority : 0,
        isActive: true,
        operationType: normalizeOptional(newTaxRule.operationType),
        customerType: normalizeOptional(newTaxRule.customerType),
        regime: normalizeOptional(newTaxRule.regime),
        scope: normalizeOptional(newTaxRule.scope),
        originUf: normalizeOptional(newTaxRule.originUf)?.toUpperCase(),
        destinationUf: normalizeOptional(newTaxRule.destinationUf)?.toUpperCase(),
        ncm: normalizeOptional(newTaxRule.ncm),
        cest: normalizeOptional(newTaxRule.cest),
        cfop: normalizeOptional(newTaxRule.cfop),
        cstIcms: normalizeOptional(newTaxRule.cstIcms),
        csosn: normalizeOptional(newTaxRule.csosn),
        cstPis: normalizeOptional(newTaxRule.cstPis),
        cstCofins: normalizeOptional(newTaxRule.cstCofins),
        cstIpi: normalizeOptional(newTaxRule.cstIpi),
        icmsAliquot: normalizeOptional(newTaxRule.icmsAliquot),
        pisAliquot: normalizeOptional(newTaxRule.pisAliquot),
        cofinsAliquot: normalizeOptional(newTaxRule.cofinsAliquot),
        ipiAliquot: normalizeOptional(newTaxRule.ipiAliquot),
        issAliquot: normalizeOptional(newTaxRule.issAliquot),
      };

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
      setNewTaxRule({
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
        pisAliquot: "",
        cofinsAliquot: "",
        ipiAliquot: "",
        issAliquot: "",
        priority: 0,
      });
      toast({ title: "Sucesso", description: "Regra fiscal criada" });
    } catch (error) {
      toast({
        title: "Erro",
        description: "Falha ao criar regra fiscal",
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
                ) : fiscalTaxRules.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>Nenhuma regra fiscal cadastrada</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="border-b">
                        <tr>
                          <th className="text-left py-2 px-4">Nome</th>
                          <th className="text-left py-2 px-4">Contexto</th>
                          <th className="text-left py-2 px-4">Resultado</th>
                          <th className="text-left py-2 px-4">Prioridade</th>
                          <th className="text-right py-2 px-4">Acoes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {fiscalTaxRules.map((rule) => (
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
                            <td className="py-2 px-4 text-xs">
                              {[
                                rule.cstIcms ? `CST ${rule.cstIcms}` : null,
                                rule.csosn ? `CSOSN ${rule.csosn}` : null,
                                rule.cstPis ? `PIS ${rule.cstPis}` : null,
                                rule.cstCofins ? `COFINS ${rule.cstCofins}` : null,
                              ]
                                .filter(Boolean)
                                .join(" | ") || "-"}
                            </td>
                            <td className="py-2 px-4">{rule.priority ?? 0}</td>
                            <td className="py-2 px-4 text-right">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDeleteTaxRule(rule.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
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
