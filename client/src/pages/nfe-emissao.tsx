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
  productName: string;
  ncm: string;
  cfop: string;
  quantity: number;
  unitPrice: number;
  icmsAliquot: number;
  ipiAliquot: number;
}

export default function NFEEmissao() {
  const { toast } = useToast();
  const [environment, setEnvironment] = useState("homologacao");
  const [series, setSeries] = useState("1");

  // Dados da empresa (viriam da sessão em produção)
  const [companyName] = useState("Sua Empresa LTDA");
  const [cnpj] = useState("00.000.000/0000-00");
  const [ie] = useState("000.000.000.000");

  // Dados do cliente
  const [customerName, setCustomerName] = useState("");
  const [customerType, setCustomerType] = useState("pf");
  const [customerDocument, setCustomerDocument] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");

  // Itens
  const [items, setItems] = useState<NFEItem[]>([]);
  const [showItemDialog, setShowItemDialog] = useState(false);
  const [currentItem, setCurrentItem] = useState<Partial<NFEItem>>({
    productName: "",
    ncm: "28112090",
    cfop: "5102",
    quantity: 1,
    unitPrice: 0,
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
    return items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  };

  const addItem = () => {
    if (!currentItem.productName) {
      toast({
        title: "Erro",
        description: "Informe o nome do produto",
        variant: "destructive",
      });
      return;
    }

    const newItem: NFEItem = {
      id: Date.now().toString(),
      productName: currentItem.productName || "",
      ncm: currentItem.ncm || "28112090",
      cfop: currentItem.cfop || "5102",
      quantity: currentItem.quantity || 1,
      unitPrice: currentItem.unitPrice || 0,
      icmsAliquot: currentItem.icmsAliquot || 18,
      ipiAliquot: currentItem.ipiAliquot || 0,
    };

    setItems([...items, newItem]);
    setCurrentItem({
      productName: "",
      ncm: "28112090",
      cfop: "5102",
      quantity: 1,
      unitPrice: 0,
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
      items,
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
                <CardTitle>Empresa</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4">
                  <div>
                    <label className="text-sm font-medium">{companyName}</label>
                    <p className="text-xs text-muted-foreground">{cnpj}</p>
                  </div>
                  <div className="grid gap-2">
                    <label className="text-sm font-medium">Série</label>
                    <Input
                      value={series}
                      onChange={(e) => setSeries(e.target.value)}
                      placeholder="1"
                      type="number"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Dados Cliente */}
            <Card>
              <CardHeader>
                <CardTitle>Cliente</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Tipo</label>
                  <Select value={customerType} onValueChange={setCustomerType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pf">Pessoa Física</SelectItem>
                      <SelectItem value="pj">Pessoa Jurídica</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium">Nome</label>
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
                  <label className="text-sm font-medium">Endereço</label>
                  <Input
                    value={customerAddress}
                    onChange={(e) => setCustomerAddress(e.target.value)}
                    placeholder="Endereço do cliente"
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
                          <p className="font-medium">{item.productName}</p>
                          <p className="text-xs text-muted-foreground">
                            {item.quantity} x R$ {item.unitPrice.toFixed(2)} =
                            R$ {(item.quantity * item.unitPrice).toFixed(2)}
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

            {/* Ambiente */}
            <Card>
              <CardHeader>
                <CardTitle>Configuração</CardTitle>
              </CardHeader>
              <CardContent>
                <div>
                  <label className="text-sm font-medium">Ambiente</label>
                  <Select value={environment} onValueChange={setEnvironment}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="homologacao">
                        Homologação (Testes)
                      </SelectItem>
                      <SelectItem value="producao">Produção</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
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
                  <p className="text-xs text-muted-foreground">Valor Total</p>
                  <p className="text-2xl font-bold">
                    R$ {calcularTotal().toFixed(2)}
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
              <label className="text-sm font-medium">Produto</label>
              <Input
                value={currentItem.productName || ""}
                onChange={(e) =>
                  setCurrentItem({
                    ...currentItem,
                    productName: e.target.value,
                  })
                }
                placeholder="Nome do produto"
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
