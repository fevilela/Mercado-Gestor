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
} from "lucide-react";
import { Link } from "wouter";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
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
  fiscalEnabled?: boolean;
  cscToken?: string;
  cscId?: string;
  stoneCode?: string;
  stoneEnabled?: boolean;
  mpAccessToken?: string;
  mpTerminalId?: string;
  mpEnabled?: boolean;
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
}

export default function Settings() {
  const { toast } = useToast();
  const [stoneStatus, setStoneStatus] = useState<
    "idle" | "connecting" | "connected"
  >("idle");
  const [mpStatus, setMpStatus] = useState<"idle" | "connecting" | "connected">(
    "idle"
  );
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<CompanySettings>({
    cnpj: "",
    ie: "",
    razaoSocial: "",
    nomeFantasia: "",
    fiscalEnabled: false,
    cscToken: "",
    cscId: "",
    stoneCode: "",
    stoneEnabled: false,
    mpAccessToken: "",
    mpTerminalId: "",
    mpEnabled: false,
    printerEnabled: false,
    printerModel: "",
    printerPort: "",
    printerBaudRate: 9600,
    printerColumns: 48,
    printerCutCommand: true,
    printerBeepOnSale: true,
    barcodeScannerEnabled: true,
    barcodeScannerAutoAdd: true,
    barcodeScannerBeep: true,
  });
  const [printerStatus, setPrinterStatus] = useState<
    "idle" | "testing" | "connected"
  >("idle");

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/settings");
      if (response.ok) {
        const data = await response.json();
        if (data && Object.keys(data).length > 0) {
          setSettings((prev) => ({ ...prev, ...data }));
        }
      }
    } catch (error) {
      console.error("Failed to fetch settings:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async () => {
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
    setStoneStatus("connecting");
    setTimeout(() => setStoneStatus("connected"), 2000);
  };

  const handleConnectMP = () => {
    setMpStatus("connecting");
    setTimeout(() => setMpStatus("connected"), 2000);
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
    value: string | boolean
  ) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

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

        <Tabs defaultValue="payments" className="space-y-4">
          <TabsList>
            <TabsTrigger value="company">Dados da Empresa</TabsTrigger>
            <TabsTrigger value="fiscal">Fiscal & Tributário</TabsTrigger>
            <TabsTrigger value="payments">Pagamentos & TEF</TabsTrigger>
            <TabsTrigger value="equipment">Equipamentos</TabsTrigger>
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
                    />
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
                <div className="flex items-center justify-between space-x-2">
                  <div className="space-y-0.5">
                    <Label className="text-base">Ambiente de Produção</Label>
                    <p className="text-sm text-muted-foreground">
                      Ativar emissão real de notas (com valor fiscal).
                    </p>
                  </div>
                  <Switch
                    checked={settings.fiscalEnabled || false}
                    onCheckedChange={(checked) =>
                      updateSetting("fiscalEnabled", checked)
                    }
                  />
                </div>
                <Separator />
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>
                      Token CSC (Código de Segurança do Contribuinte)
                    </Label>
                    <Input
                      type="password"
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
                      value={settings.cscId || ""}
                      className="w-24"
                      onChange={(e) => updateSetting("cscId", e.target.value)}
                      placeholder="000001"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Certificado Digital (A1)</Label>
                  <div className="flex gap-2">
                    <Input type="file" className="cursor-pointer" />
                    <Button variant="outline">Carregar</Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Válido até: 15/08/2026
                  </p>
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
                    <Label>Stone Code / ID da Loja</Label>
                    <Input
                      placeholder="123456789"
                      value={settings.stoneCode || ""}
                      onChange={(e) =>
                        updateSetting("stoneCode", e.target.value)
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Tipo de Conexão</Label>
                    <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50">
                      <option>Integrado (TEF - Valor vai automático)</option>
                      <option>Manual (POS - Digitar valor na máquina)</option>
                    </select>
                  </div>

                  {stoneStatus === "connected" ? (
                    <div className="rounded-md bg-emerald-100 p-3 flex items-center gap-3 text-emerald-700">
                      <CheckCircle2 className="h-5 w-5" />
                      <div className="text-sm font-medium">
                        Conectado: Terminal S920
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
                    <Label>ID do Terminal (Point)</Label>
                    <Input
                      placeholder="POINT-123456"
                      value={settings.mpTerminalId || ""}
                      onChange={(e) =>
                        updateSetting("mpTerminalId", e.target.value)
                      }
                    />
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
                      onValueChange={(value) =>
                        updateSetting("printerModel", value)
                      }
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
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Porta de Comunicação</Label>
                    <Select
                      value={settings.printerPort || ""}
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
