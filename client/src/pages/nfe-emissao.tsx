import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertCircle,
  CheckCircle,
  Loader,
  Plus,
  Trash2,
  Send,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import Layout from "@/components/layout";

interface NFEItem {
  id: string;
  code: string;
  description: string;
  ncm: string;
  cfop: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  icmsAliquot: number;
  ipiAliquot: number;
}

export default function NFEEmissao() {
  const { toast } = useToast();
  const [environment, setEnvironment] = useState("homologacao");
  const [series, setSeries] = useState("1");
  const [documentNumber] = useState("Automatico");
  const [operationType, setOperationType] = useState("saida");
  const [issueDate, setIssueDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [paymentForm, setPaymentForm] = useState("a_vista");
  const [paymentCondition, setPaymentCondition] = useState("imediato");
  const [additionalInfo, setAdditionalInfo] = useState("");
  const [showTaxDetails, setShowTaxDetails] = useState(false);

  // Dados da empresa (viriam da sessão em produção)
  const [companyName] = useState("Sua Empresa LTDA");
  const [cnpj] = useState("00.000.000/0000-00");
  const [ie] = useState("000.000.000.000");
  const [im] = useState("00000000");
  const [regime] = useState("Simples Nacional");

  // Dados do cliente
  const [customerName, setCustomerName] = useState("");
  const [customerType, setCustomerType] = useState("pf");
  const [customerDocument, setCustomerDocument] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [customerZip, setCustomerZip] = useState("");
  const [customerIeIndicator, setCustomerIeIndicator] =
    useState("nao_contribuinte");

  // Itens
  const [items, setItems] = useState<NFEItem[]>([]);
  const [showItemDialog, setShowItemDialog] = useState(false);
  const [currentItem, setCurrentItem] = useState<Partial<NFEItem>>({
    code: "",
    description: "",
    ncm: "28112090",
    cfop: "5102",
    quantity: 1,
    unitPrice: 0,
    discount: 0,
    icmsAliquot: 18,
    ipiAliquot: 0,
  });

  const [generatedXml, setGeneratedXml] = useState("");
  const [signed, setSigned] = useState(false);
  const [result, setResult] = useState<any>(null);

  // Mutations
  const generateMutation = useMutation({
    mutationFn: async (config: any) => {
      const response = await fetch("/api/fiscal/nfe/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Erro ao gerar NF-e");
      }
      return response.json();
    },
  });

  const submitMutation = useMutation({
    mutationFn: async (xml: string) => {
      const response = await fetch("/api/fiscal/sefaz/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ xmlContent: xml, environment }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Erro ao submeter NF-e");
      }
      return response.json();
    },
  });

  const calcularTotal = () => {
    return items.reduce((sum, item) => {
      const totalItem = item.quantity * item.unitPrice - item.discount;
      return sum + Math.max(0, totalItem);
    }, 0);
  };

  const calcularImpostos = () => {
    return items.reduce((sum, item) => {
      const base = Math.max(0, item.quantity * item.unitPrice - item.discount);
      const aliquota = (item.icmsAliquot || 0) + (item.ipiAliquot || 0);
      return sum + base * (aliquota / 100);
    }, 0);
  };

  const addItem = () => {
    if (!currentItem.description) {
      toast({
        title: "Erro",
        description: "Informe a descriÇõÇœo do item",
        variant: "destructive",
      });
      return;
    }

    const newItem: NFEItem = {
      id: Date.now().toString(),
      code: currentItem.code || "",
      description: currentItem.description || "",
      ncm: currentItem.ncm || "28112090",
      cfop: currentItem.cfop || "5102",
      quantity: currentItem.quantity || 1,
      unitPrice: currentItem.unitPrice || 0,
      discount: currentItem.discount || 0,
      icmsAliquot: currentItem.icmsAliquot || 18,
      ipiAliquot: currentItem.ipiAliquot || 0,
    };

    setItems([...items, newItem]);
    setCurrentItem({
      code: "",
      description: "",
      ncm: "28112090",
      cfop: "5102",
      quantity: 1,
      unitPrice: 0,
      discount: 0,
      icmsAliquot: 18,
      ipiAliquot: 0,
    });
    setShowItemDialog(false);
  };

  const removeItem = (id: string) => {
    setItems(items.filter((item) => item.id !== id));
  };

  const handleGenerate = async () => {
    if (!customerName) {
      toast({
        title: "Erro",
        description: "Informe o nome do cliente",
        variant: "destructive",
      });
      return;
    }

    if (items.length === 0) {
      toast({
        title: "Erro",
        description: "Adicione pelo menos um item",
        variant: "destructive",
      });
      return;
    }

    const config = {
      companyName,
      cnpj: cnpj.replace(/\D/g, ""),
      ie: ie.replace(/\D/g, ""),
      ufCode: "35",
      customerName,
      customerCNPJ:
        customerType === "pj" ? customerDocument.replace(/\D/g, "") : undefined,
      customerCPF:
        customerType === "pf" ? customerDocument.replace(/\D/g, "") : undefined,
      items: items.map((item) => ({
        ...item,
        productName: item.description,
      })),
      cfop: items[0]?.cfop || "5102",
    };

    generateMutation.mutate(config, {
      onSuccess: (data) => {
        setGeneratedXml(data.xml);
        setSigned(data.signed);
        setResult(data);
        toast({
          title: "Sucesso",
          description: `NF-e ${data.signed ? "assinada ✓" : "gerada"}`,
        });
      },
      onError: (error) => {
        toast({
          title: "Erro",
          description:
            error instanceof Error ? error.message : "Erro ao gerar NF-e",
          variant: "destructive",
        });
      },
    });
  };

  const handleSubmit = async () => {
    if (!generatedXml) {
      toast({
        title: "Erro",
        description: "Gere uma NF-e primeiro",
        variant: "destructive",
      });
      return;
    }

    submitMutation.mutate(generatedXml, {
      onSuccess: (data) => {
        setResult(data);
        toast({
          title: "Sucesso",
          description: "NF-e enviada para SEFAZ com sucesso!",
        });
      },
      onError: (error) => {
        toast({
          title: "Erro",
          description:
            error instanceof Error ? error.message : "Erro ao submeter",
          variant: "destructive",
        });
      },
    });
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Emissão de NF-e</h1>
          <p className="text-muted-foreground">
            Gere e envie notas fiscais eletrônicas para SEFAZ
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {/* Formulário */}
          <div className="md:col-span-2 space-y-6">
                        {/* Dados Empresa */}
            <Card>
              <CardHeader>
                <CardTitle>Cabecalho da Nota</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-3">
                <div>
                  <label className="text-sm font-medium">Tipo de documento</label>
                  <Input value="NF-e" disabled />
                </div>
                <div>
                  <label className="text-sm font-medium">Tipo de operacao</label>
                  <Select value={operationType} onValueChange={setOperationType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="saida">Saida</SelectItem>
                      <SelectItem value="entrada">Entrada</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium">Numero</label>
                  <Input value={documentNumber} disabled />
                </div>
                <div>
                  <label className="text-sm font-medium">Serie</label>
                  <Input value={series} onChange={(e) => setSeries(e.target.value)} disabled />
                </div>
                <div>
                  <label className="text-sm font-medium">Data de emissao</label>
                  <Input
                    type="date"
                    value={issueDate}
                    onChange={(e) => setIssueDate(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Ambiente</label>
                  <Select value={environment} onValueChange={setEnvironment}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="homologacao">Homologacao</SelectItem>
                      <SelectItem value="producao">Producao</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Emitente</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-sm font-medium">Razao social</label>
                  <Input value={companyName} disabled />
                </div>
                <div>
                  <label className="text-sm font-medium">CNPJ</label>
                  <Input value={cnpj} disabled />
                </div>
                <div>
                  <label className="text-sm font-medium">IE</label>
                  <Input value={ie} disabled />
                </div>
                <div>
                  <label className="text-sm font-medium">IM</label>
                  <Input value={im} disabled />
                </div>
                <div>
                  <label className="text-sm font-medium">Regime tributario</label>
                  <Input value={regime} disabled />
                </div>
              </CardContent>
            </Card>

                        {/* Dados Cliente */}
            <Card>
              <CardHeader>
                <CardTitle>Destinatario / Tomador</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-sm font-medium">Tipo</label>
                  <Select value={customerType} onValueChange={setCustomerType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pf">Pessoa Fisica</SelectItem>
                      <SelectItem value="pj">Pessoa Juridica</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium">Indicador IE</label>
                  <Select
                    value={customerIeIndicator}
                    onValueChange={setCustomerIeIndicator}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="contribuinte">Contribuinte</SelectItem>
                      <SelectItem value="nao_contribuinte">Nao contribuinte</SelectItem>
                      <SelectItem value="isento">Isento</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium">Nome / Razao social</label>
                  <Input
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Nome do cliente"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">
                    {customerType === "pf" ? "CPF" : "CNPJ"}
                  </label>
                  <Input
                    value={customerDocument}
                    onChange={(e) => setCustomerDocument(e.target.value)}
                    placeholder={
                      customerType === "pf"
                        ? "000.000.000-00"
                        : "00.000.000/0000-00"
                    }
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">CEP</label>
                  <Input
                    value={customerZip}
                    onChange={(e) => setCustomerZip(e.target.value)}
                    placeholder="00000-000"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Endereco</label>
                  <Input
                    value={customerAddress}
                    onChange={(e) => setCustomerAddress(e.target.value)}
                    placeholder="Endereco do cliente"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Itens */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Itens</CardTitle>
                <Button
                  size="sm"
                  onClick={() => setShowItemDialog(true)}
                  data-testid="button-add-item"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Adicionar Item
                </Button>
              </CardHeader>
              <CardContent>
                {items.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Nenhum item adicionado
                  </p>
                ) : (
                  <div className="space-y-2">
                    {items.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between p-3 border rounded-lg"
                        data-testid={`item-row-${item.id}`}
                      >
                        <div className="flex-1">
                          <p className="font-medium">{item.description}</p>
                          <p className="text-xs text-muted-foreground">
                            Codigo: {item.code || "-"} - CFOP: {item.cfop}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {item.quantity} x R$ {item.unitPrice.toFixed(2)} -
                            R$ {item.discount.toFixed(2)} = R${" "}
                            {Math.max(
                              0,
                              item.quantity * item.unitPrice - item.discount
                            ).toFixed(2)}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeItem(item.id)}
                          data-testid={`button-delete-item-${item.id}`}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

                        {/* Impostos */}
            <Card>
              <CardHeader>
                <CardTitle>Impostos</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">Total de impostos</div>
                  <div className="text-lg font-semibold">R$ {calcularImpostos().toFixed(2)}</div>
                </div>
                <Button
                  variant="outline"
                  onClick={() => setShowTaxDetails(!showTaxDetails)}
                >
                  {showTaxDetails ? "Ocultar detalhes" : "Ver detalhes"}
                </Button>
                {showTaxDetails && (
                  <div className="space-y-2">
                    {items.map((item) => {
                      const base = Math.max(0, item.quantity * item.unitPrice - item.discount);
                      const aliquota = (item.icmsAliquot || 0) + (item.ipiAliquot || 0);
                      const imposto = base * (aliquota / 100);
                      return (
                        <div key={item.id} className="text-sm flex justify-between">
                          <span>{item.description}</span>
                          <span>R$ {imposto.toFixed(2)}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Totais */}
            <Card>
              <CardHeader>
                <CardTitle>Totais da Nota</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-3">
                <div>
                  <label className="text-sm font-medium">Produtos</label>
                  <Input value={`R$ ${calcularTotal().toFixed(2)}`} disabled />
                </div>
                <div>
                  <label className="text-sm font-medium">Impostos</label>
                  <Input value={`R$ ${calcularImpostos().toFixed(2)}`} disabled />
                </div>
                <div>
                  <label className="text-sm font-medium">Valor total</label>
                  <Input
                    value={`R$ ${(calcularTotal() + calcularImpostos()).toFixed(2)}`}
                    disabled
                  />
                </div>
              </CardContent>
            </Card>

            {/* Pagamento */}
            <Card>
              <CardHeader>
                <CardTitle>Pagamento</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-sm font-medium">Forma</label>
                  <Select value={paymentForm} onValueChange={setPaymentForm}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="a_vista">A vista</SelectItem>
                      <SelectItem value="credito">Credito</SelectItem>
                      <SelectItem value="debito">Debito</SelectItem>
                      <SelectItem value="pix">Pix</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium">Condicao</label>
                  <Select value={paymentCondition} onValueChange={setPaymentCondition}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="imediato">Imediato</SelectItem>
                      <SelectItem value="30">30 dias</SelectItem>
                      <SelectItem value="30_60">30/60 dias</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Observacoes */}
            <Card>
              <CardHeader>
                <CardTitle>Observacoes</CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={additionalInfo}
                  onChange={(e) => setAdditionalInfo(e.target.value)}
                  placeholder="Informacoes complementares"
                />
              </CardContent>
            </Card>

            {/* Botões de Ação */}
            <div className="flex gap-2">
              <Button
                onClick={handleGenerate}
                disabled={generateMutation.isPending}
                className="flex-1"
                data-testid="button-generate-nfe"
              >
                {generateMutation.isPending ? (
                  <>
                    <Loader className="mr-2 h-4 w-4 animate-spin" />
                    Gerando...
                  </>
                ) : (
                  "Gerar e Assinar NF-e"
                )}
              </Button>

              {signed && (
                <Button
                  onClick={handleSubmit}
                  disabled={submitMutation.isPending}
                  variant="default"
                  data-testid="button-submit-sefaz"
                >
                  {submitMutation.isPending ? (
                    <>
                      <Loader className="mr-2 h-4 w-4 animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    <>
                      <Send className="mr-2 h-4 w-4" />
                      Enviar para SEFAZ
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>

          {/* Resumo e Resultado */}
          <div className="space-y-6">
            {/* Resumo */}
            <Card>
              <CardHeader>
                <CardTitle>Resumo</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-xs text-muted-foreground">
                    Total de Itens
                  </p>
                  <p className="text-2xl font-bold">{items.length}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Produtos</p>
                  <p className="text-2xl font-bold">
                    R$ {calcularTotal().toFixed(2)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Impostos</p>
                  <p className="text-2xl font-bold">
                    R$ {calcularImpostos().toFixed(2)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Valor Total</p>
                  <p className="text-2xl font-bold">
                    R$ {(calcularTotal() + calcularImpostos()).toFixed(2)}
                  </p>
                </div>
                <div className="pt-4 border-t">
                  {generatedXml ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        {signed ? (
                          <>
                            <CheckCircle className="h-5 w-5 text-green-600" />
                            <span className="font-medium text-green-600">
                              Assinada ✓
                            </span>
                          </>
                        ) : (
                          <>
                            <AlertCircle className="h-5 w-5 text-yellow-600" />
                            <span className="font-medium text-yellow-600">
                              Não assinada
                            </span>
                          </>
                        )}
                      </div>
                      {result?.protocol && (
                        <div className="text-xs">
                          <p className="text-muted-foreground">Protocolo</p>
                          <p className="font-mono">{result.protocol}</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Aguardando geração...
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Status */}
            {result && (
              <Card>
                <CardHeader>
                  <CardTitle>Status</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-xs space-y-2">
                    {result.error ? (
                      <div className="p-2 bg-red-50 border border-red-200 rounded text-red-700">
                        {result.error}
                      </div>
                    ) : (
                      <>
                        <Badge variant="outline" className="bg-green-50">
                          {result.message}
                        </Badge>
                        {result.protocol && (
                          <div>
                            <p className="font-medium">Protocolo SEFAZ:</p>
                            <p className="font-mono">{result.protocol}</p>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* Dialog de Item */}
      <Dialog open={showItemDialog} onOpenChange={setShowItemDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar Item</DialogTitle>
            <DialogDescription>Informe os dados do produto</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Codigo</label>
              <Input
                value={currentItem.code || ""}
                onChange={(e) =>
                  setCurrentItem({
                    ...currentItem,
                    code: e.target.value,
                  })
                }
                placeholder="Codigo do item"
              />
            </div>

            <div>
              <label className="text-sm font-medium">Descricao</label>
              <Input
                value={currentItem.description || ""}
                onChange={(e) =>
                  setCurrentItem({
                    ...currentItem,
                    description: e.target.value,
                  })
                }
                placeholder="Descricao do item"
              />
            </div>

            <div className="grid gap-4 grid-cols-2">
              <div>
                <label className="text-sm font-medium">NCM</label>
                <Input
                  value={currentItem.ncm || ""}
                  onChange={(e) =>
                    setCurrentItem({ ...currentItem, ncm: e.target.value })
                  }
                  placeholder="28112090"
                />
              </div>
              <div>
                <label className="text-sm font-medium">CFOP</label>
                <Input
                  value={currentItem.cfop || ""}
                  onChange={(e) =>
                    setCurrentItem({ ...currentItem, cfop: e.target.value })
                  }
                  placeholder="5102"
                />
              </div>
            </div>

            <div className="grid gap-4 grid-cols-2">
              <div>
                <label className="text-sm font-medium">Quantidade</label>
                <Input
                  type="number"
                  value={currentItem.quantity || 1}
                  onChange={(e) =>
                    setCurrentItem({
                      ...currentItem,
                      quantity: parseFloat(e.target.value),
                    })
                  }
                />
              </div>
              <div>
                <label className="text-sm font-medium">Valor Unitário</label>
                <Input
                  type="number"
                  step="0.01"
                  value={currentItem.unitPrice || 0}
                  onChange={(e) =>
                    setCurrentItem({
                      ...currentItem,
                      unitPrice: parseFloat(e.target.value),
                    })
                  }
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium">Desconto</label>
              <Input
                type="number"
                step="0.01"
                value={currentItem.discount || 0}
                onChange={(e) =>
                  setCurrentItem({
                    ...currentItem,
                    discount: parseFloat(e.target.value),
                  })
                }
              />
            </div>

            <div className="grid gap-4 grid-cols-2">
              <div>
                <label className="text-sm font-medium">ICMS %</label>
                <Input
                  type="number"
                  step="0.01"
                  value={currentItem.icmsAliquot || 18}
                  onChange={(e) =>
                    setCurrentItem({
                      ...currentItem,
                      icmsAliquot: parseFloat(e.target.value),
                    })
                  }
                />
              </div>
              <div>
                <label className="text-sm font-medium">IPI %</label>
                <Input
                  type="number"
                  step="0.01"
                  value={currentItem.ipiAliquot || 0}
                  onChange={(e) =>
                    setCurrentItem({
                      ...currentItem,
                      ipiAliquot: parseFloat(e.target.value),
                    })
                  }
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowItemDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={addItem} data-testid="button-confirm-item">
              Adicionar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
