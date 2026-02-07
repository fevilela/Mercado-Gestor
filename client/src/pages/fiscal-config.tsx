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
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import {
  Loader2,
  FileText,
  DollarSign,
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
  state?: string;
  taxType?: string;
  regime?: string;
  aliquot?: number;
  description?: string;
}

export default function FiscalConfig() {
  const { toast } = useToast();
  const { company } = useAuth();
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
  const [showNewCfop, setShowNewCfop] = useState(false);
  const [showNewAliquot, setShowNewAliquot] = useState(false);
  const [newCfop, setNewCfop] = useState({
    code: "",
    description: "",
    type: "entrada",
    operationType: "compra",
    scope: "interna",
  });
  const [newAliquot, setNewAliquot] = useState({
    state: "",
    taxType: "",
    regime: "Simples Nacional",
    aliquot: 0,
    description: "",
  });

  useEffect(() => {
    loadFiscalData();
  }, []);

  const loadFiscalData = async () => {
    setLoading(true);
    try {
      const [configRes, cfopRes, taxRes] = await Promise.all([
        fetch("/api/fiscal-config"),
        fetch("/api/cfop-codes"),
        fetch("/api/tax-aliquots"),
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
      if (
        !newAliquot.state ||
        !newAliquot.taxType ||
        newAliquot.aliquot === undefined
      ) {
        toast({
          title: "Erro",
          description: "Preencha todos os campos",
          variant: "destructive",
        });
        return;
      }
      const response = await fetch("/api/tax-aliquots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newAliquot),
      });
      if (!response.ok) throw new Error("Erro ao criar alíquota");
      const createdAliquot = await response.json();
      setTaxAliquots([...taxAliquots, createdAliquot]);
      setNewAliquot({
        state: "",
        taxType: "",
        regime: "Simples Nacional",
        aliquot: 0,
        description: "",
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
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                      <Label>Tipo de Imposto</Label>
                      <Select
                        value={newAliquot.taxType}
                        onValueChange={(v) =>
                          setNewAliquot({ ...newAliquot, taxType: v })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ICMS">ICMS</SelectItem>
                          <SelectItem value="ICMS-ST">ICMS-ST</SelectItem>
                          <SelectItem value="PIS/COFINS">PIS/COFINS</SelectItem>
                          <SelectItem value="IPI">IPI</SelectItem>
                          <SelectItem value="ISS">ISS</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Regime</Label>
                      <Select
                        value={newAliquot.regime}
                        onValueChange={(v) =>
                          setNewAliquot({ ...newAliquot, regime: v })
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
                      <Label htmlFor="aliq-aliquot">Alíquota (%)</Label>
                      <Input
                        id="aliq-aliquot"
                        data-testid="input-aliquot-value"
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        value={newAliquot.aliquot}
                        onChange={(e) =>
                          setNewAliquot({
                            ...newAliquot,
                            aliquot: parseFloat(e.target.value) || 0,
                          })
                        }
                      />
                    </div>
                    <div className="col-span-2">
                      <Label htmlFor="aliq-desc">Descrição (opcional)</Label>
                      <Input
                        id="aliq-desc"
                        data-testid="input-aliquot-desc"
                        value={newAliquot.description}
                        onChange={(e) =>
                          setNewAliquot({
                            ...newAliquot,
                            description: e.target.value,
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
                    Configure alíquotas de impostos por estado e regime
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
                              <th className="text-left py-2 px-4">
                                Tipo de Imposto
                              </th>
                              <th className="text-left py-2 px-4">Regime</th>
                              <th className="text-left py-2 px-4">Alíquota</th>
                              <th className="text-left py-2 px-4">Descrição</th>
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
                                <td className="py-2 px-4">{aliquot.taxType}</td>
                                <td className="py-2 px-4 text-xs">
                                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                                    {aliquot.regime}
                                  </span>
                                </td>
                                <td className="py-2 px-4 font-semibold text-primary">
                                  {aliquot.aliquot}%
                                </td>
                                <td className="py-2 px-4 text-muted-foreground">
                                  {aliquot.description}
                                </td>
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
        </Tabs>
      </div>
    </Layout>
  );
}
