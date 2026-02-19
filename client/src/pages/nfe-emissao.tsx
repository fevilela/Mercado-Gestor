import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { AlertCircle, CheckCircle, Loader, Plus, Search, Send, Trash2 } from "lucide-react";
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
  icmsReduction: number;
  ipiAliquot: number;
  pisAliquot: number;
  cofinsAliquot: number;
  issAliquot: number;
  irrfAliquot: number;
}

interface TaxCalculationItem {
  description: string;
  subtotal: number;
  icmsValue: number;
  ipiValue: number;
  pisValue: number;
  cofinsValue: number;
  issValue: number;
  irrfValue: number;
  totalTaxes: number;
}

interface TaxCalculationTotals {
  baseValue: number;
  icmsTotal: number;
  ipiTotal: number;
  pisTotal: number;
  cofinsTotal: number;
  issTotal: number;
  irrfTotal: number;
  totalTaxes: number;
  grossTotal: number;
}
interface CustomerOption {
  id: number;
  name: string;
  cpfCnpj?: string | null;
  personType?: string | null;
  isIcmsContributor?: boolean | null;
  address?: string | null;
  zipCode?: string | null;
}

interface ProductOption {
  id: number;
  name: string;
  ean?: string | null;
  ncm?: string | null;
  price?: string | null;
}

export default function NFEEmissao() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const [activeSection, setActiveSection] = useState("itens");
  const [series, setSeries] = useState("1");
  const [documentNumber] = useState("Automatico");
  const [operationType, setOperationType] = useState("saida");
  const [operationName, setOperationName] = useState("1 - VENDA");
  const [sellerName, setSellerName] = useState("1 - PADRAO");
  const [presenceIndicator, setPresenceIndicator] = useState("1 - Operacao presencial");
  const [isFinalConsumer, setIsFinalConsumer] = useState(true);
  const [issueDate, setIssueDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [dispatchDate, setDispatchDate] = useState(() => new Date().toISOString().slice(0, 16));

  const [paymentForm, setPaymentForm] = useState("a_vista");
  const [paymentCondition, setPaymentCondition] = useState("imediato");
  const [additionalInfo, setAdditionalInfo] = useState("");
  const [showTaxDetails, setShowTaxDetails] = useState(false);

  const [freightValue, setFreightValue] = useState(0);
  const [insuranceValue, setInsuranceValue] = useState(0);
  const [otherExpensesValue, setOtherExpensesValue] = useState(0);

  const [companyName] = useState("Sua Empresa LTDA");
  const [cnpj] = useState("00.000.000/0000-00");
  const [ie] = useState("000.000.000.000");
  const [im] = useState("00000000");
  const [regime] = useState("Simples Nacional");

  const [customerName, setCustomerName] = useState("");
  const [customerType, setCustomerType] = useState("pf");
  const [customerDocument, setCustomerDocument] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [customerZip, setCustomerZip] = useState("");
  const [customerIeIndicator, setCustomerIeIndicator] = useState("nao_contribuinte");
  const [selectedCustomerId, setSelectedCustomerId] = useState("__none__");
  const [customerSearchOpen, setCustomerSearchOpen] = useState(false);
  const [customerSearch, setCustomerSearch] = useState("");

  const [items, setItems] = useState<NFEItem[]>([]);
  const [showItemDialog, setShowItemDialog] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState("__none__");
  const [productSearchOpen, setProductSearchOpen] = useState(false);
  const [productSearch, setProductSearch] = useState("");
  const [currentItem, setCurrentItem] = useState<Partial<NFEItem>>({
    code: "",
    description: "",
    ncm: "28112090",
    cfop: "5102",
    quantity: 1,
    unitPrice: 0,
    discount: 0,
    icmsAliquot: 18,
    icmsReduction: 0,
    ipiAliquot: 0,
    pisAliquot: 0,
    cofinsAliquot: 0,
    issAliquot: 0,
    irrfAliquot: 0,
  });

  const [generatedXml, setGeneratedXml] = useState("");
  const [signed, setSigned] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [taxCalculation, setTaxCalculation] = useState<{
    calculations: TaxCalculationItem[];
    totals: TaxCalculationTotals;
  } | null>(null);
  const { data: customers = [] } = useQuery<CustomerOption[]>({
    queryKey: ["/api/customers"],
    queryFn: async () => {
      const res = await fetch("/api/customers");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: products = [] } = useQuery<ProductOption[]>({
    queryKey: ["/api/products"],
    queryFn: async () => {
      const res = await fetch("/api/products");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: settings } = useQuery<any>({
    queryKey: ["/api/settings"],
    queryFn: async () => {
      const res = await fetch("/api/settings");
      if (!res.ok) return null;
      return res.json();
    },
  });

  const ufToCode: Record<string, string> = {
    RO: "11",
    AC: "12",
    AM: "13",
    RR: "14",
    PA: "15",
    AP: "16",
    TO: "17",
    MA: "21",
    PI: "22",
    CE: "23",
    RN: "24",
    PB: "25",
    PE: "26",
    AL: "27",
    SE: "28",
    BA: "29",
    MG: "31",
    ES: "32",
    RJ: "33",
    SP: "35",
    PR: "41",
    SC: "42",
    RS: "43",
    MS: "50",
    MT: "51",
    GO: "52",
    DF: "53",
  };

  useEffect(() => {
    if (selectedCustomerId === "__none__") return;
    const selected = customers.find((c) => String(c.id) === selectedCustomerId);
    if (!selected) return;

    setCustomerName(selected.name || "");
    setCustomerDocument(String(selected.cpfCnpj || ""));
    setCustomerAddress(String(selected.address || ""));
    setCustomerZip(String(selected.zipCode || ""));
    const typeToken = String(selected.personType || "").toLowerCase();
    setCustomerType(typeToken.includes("jur") ? "pj" : "pf");
    setCustomerIeIndicator(selected.isIcmsContributor ? "contribuinte" : "nao_contribuinte");
  }, [selectedCustomerId, customers]);

  const filteredCustomers = useMemo(() => {
    const term = customerSearch.trim().toLowerCase();
    if (!term) return customers.slice(0, 20);
    return customers
      .filter((customer) => {
        const nameMatch = customer.name?.toLowerCase().includes(term);
        const docMatch = String(customer.cpfCnpj || "")
          .toLowerCase()
          .includes(term);
        return nameMatch || docMatch;
      })
      .slice(0, 20);
  }, [customers, customerSearch]);

  const handleSelectCustomer = (customerId: string) => {
    setSelectedCustomerId(customerId);
    setCustomerSearchOpen(false);
    setCustomerSearch("");
  };

  const handleSelectProductForItem = (productId: string) => {
    setSelectedProductId(productId);
    setProductSearchOpen(false);
    setProductSearch("");
    if (productId === "__none__") return;
    const selected = products.find((p) => String(p.id) === productId);
    if (!selected) return;
    setCurrentItem((prev) => ({
      ...prev,
      code: String(selected.ean || selected.id || ""),
      description: selected.name || "",
      ncm: String(selected.ncm || prev.ncm || "28112090"),
      unitPrice: Number(String(selected.price || 0).replace(",", ".")) || 0,
    }));
  };

  const filteredProducts = useMemo(() => {
    const term = productSearch.trim().toLowerCase();
    if (!term) return products.slice(0, 30);
    return products
      .filter((product) => {
        const nameMatch = product.name?.toLowerCase().includes(term);
        const eanMatch = String(product.ean || "")
          .toLowerCase()
          .includes(term);
        return nameMatch || eanMatch;
      })
      .slice(0, 30);
  }, [products, productSearch]);
  const generateMutation = useMutation({
    mutationFn: async (config: any) => {
      const response = await fetch("/api/fiscal/nfe/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config, series }),
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
      const uf = String(settings?.sefazUf || settings?.state || "MG").toUpperCase();
      const response = await fetch("/api/fiscal/sefaz/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ xmlContent: xml, uf }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Erro ao submeter NF-e");
      }
      return response.json();
    },
  });

  const calculateTaxesMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/fiscal/nfe/calculate-taxes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: items.map((item, index) => ({
            productId: index + 1,
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            icmsAliquot: item.icmsAliquot || 0,
            icmsReduction: item.icmsReduction || 0,
            ipiAliquot: item.ipiAliquot || 0,
            pisAliquot: item.pisAliquot || 0,
            cofinsAliquot: item.cofinsAliquot || 0,
            issAliquot: item.issAliquot || 0,
            irrfAliquot: item.irrfAliquot || 0,
          })),
        }),
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || "Erro ao calcular impostos");
      }
      return response.json();
    },
    onSuccess: (data) => {
      setTaxCalculation(data);
      toast({
        title: "Sucesso",
        description: "Impostos calculados conforme regras fiscais.",
      });
    },
    onError: (error) => {
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Erro ao calcular impostos",
        variant: "destructive",
      });
    },
  });

  const totalProdutos = useMemo(
    () =>
      items.reduce((sum, item) => {
        const totalItem = item.quantity * item.unitPrice - item.discount;
        return sum + Math.max(0, totalItem);
      }, 0),
    [items]
  );

  const totalImpostos = useMemo(
    () => taxCalculation?.totals?.totalTaxes ?? 0,
    [taxCalculation]
  );

  const totalDesconto = useMemo(
    () => items.reduce((sum, item) => sum + Math.max(0, item.discount), 0),
    [items]
  );

  const totalDocumento = useMemo(
    () => Math.max(0, totalProdutos + totalImpostos + freightValue + insuranceValue + otherExpensesValue),
    [totalProdutos, totalImpostos, freightValue, insuranceValue, otherExpensesValue]
  );

  const addItem = () => {
    if (!currentItem.description) {
      toast({
        title: "Erro",
        description: "Informe a descricao do item",
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
      icmsReduction: currentItem.icmsReduction || 0,
      ipiAliquot: currentItem.ipiAliquot || 0,
      pisAliquot: currentItem.pisAliquot || 0,
      cofinsAliquot: currentItem.cofinsAliquot || 0,
      issAliquot: currentItem.issAliquot || 0,
      irrfAliquot: currentItem.irrfAliquot || 0,
    };

    setItems((prev) => [...prev, newItem]);
    setTaxCalculation(null);
    setCurrentItem({
      code: "",
      description: "",
      ncm: "28112090",
      cfop: "5102",
      quantity: 1,
      unitPrice: 0,
      discount: 0,
      icmsAliquot: 18,
      icmsReduction: 0,
      ipiAliquot: 0,
      pisAliquot: 0,
      cofinsAliquot: 0,
      issAliquot: 0,
      irrfAliquot: 0,
    });
    setShowItemDialog(false);
    setSelectedProductId("__none__");
  };

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
    setTaxCalculation(null);
  };

  const handleCalculateTaxes = () => {
    if (items.length === 0) {
      toast({
        title: "Erro",
        description: "Adicione itens para calcular impostos.",
        variant: "destructive",
      });
      return;
    }
    calculateTaxesMutation.mutate();
  };

  const handleGenerate = () => {
    if (!operationName.trim() || !sellerName.trim() || !customerName.trim()) {
      toast({
        title: "Erro",
        description: "Preencha Operacao, Cliente e Vendedor.",
        variant: "destructive",
      });
      return;
    }

    if (items.length === 0) {
      toast({
        title: "Erro",
        description: "Adicione pelo menos um item.",
        variant: "destructive",
      });
      return;
    }

    const doc = customerDocument.replace(/\D/g, "");
    if (customerType === "pf" && doc.length !== 11) {
      toast({
        title: "Erro",
        description: "CPF invalido. Informe 11 digitos.",
        variant: "destructive",
      });
      return;
    }
    if (customerType === "pj" && doc.length !== 14) {
      toast({
        title: "Erro",
        description: "CNPJ invalido. Informe 14 digitos.",
        variant: "destructive",
      });
      return;
    }

    const invalidItem = items.some(
      (item) => !item.ncm.trim() || !item.cfop.trim() || item.quantity <= 0 || item.unitPrice < 0
    );

    if (invalidItem) {
      toast({
        title: "Erro",
        description: "Todos os itens devem ter NCM, CFOP, quantidade e valor validos.",
        variant: "destructive",
      });
      return;
    }

    const settingsUf = String(settings?.sefazUf || settings?.state || "MG").toUpperCase();
    const resolvedUfCode = ufToCode[settingsUf] || "31";
    const config = {
      companyName: String(settings?.razaoSocial || companyName),
      cnpj: String(settings?.cnpj || cnpj).replace(/\D/g, ""),
      ie: String(settings?.ie || ie).replace(/\D/g, ""),
      ufCode: resolvedUfCode,
      operationType,
      operationName,
      sellerName,
      presenceIndicator,
      isFinalConsumer,
      issueDate,
      dispatchDate,
      customerName,
      customerCNPJ: customerType === "pj" ? doc : undefined,
      customerCPF: customerType === "pf" ? doc : undefined,
      items: items.map((item) => ({ ...item, productName: item.description })),
      cfop: items[0]?.cfop || "5102",
      paymentForm,
      paymentCondition,
      additionalInfo,
      totals: {
        products: totalProdutos,
        taxes: totalImpostos,
        discount: totalDesconto,
        freight: freightValue,
        insurance: insuranceValue,
        otherExpenses: otherExpensesValue,
        document: totalDocumento,
      },
    };

    generateMutation.mutate(config, {
      onSuccess: (data) => {
        setGeneratedXml(data.xml);
        setSigned(data.signed);
        setResult(data);
        toast({
          title: "Sucesso",
          description: `NF-e ${data.signed ? "assinada" : "gerada"}`,
        });
      },
      onError: (error) => {
        toast({
          title: "Erro",
          description: error instanceof Error ? error.message : "Erro ao gerar NF-e",
          variant: "destructive",
        });
      },
    });
  };

  const handleSubmit = () => {
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
        toast({ title: "Sucesso", description: "NF-e enviada para SEFAZ com sucesso" });
      },
      onError: (error) => {
        toast({
          title: "Erro",
          description: error instanceof Error ? error.message : "Erro ao submeter",
          variant: "destructive",
        });
      },
    });
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Nova venda</h1>
          <p className="text-muted-foreground">Emissao de NF-e com validacoes fiscais</p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Geral</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-3">
                <div>
                  <Label>Operacao *</Label>
                  <Input value={operationName} onChange={(e) => setOperationName(e.target.value)} />
                </div>
                <div>
                  <Label>Cliente *</Label>
                  <div className="flex gap-2">
                    <Popover open={customerSearchOpen} onOpenChange={setCustomerSearchOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          className="w-full justify-start text-left font-normal"
                          data-testid="button-select-customer"
                        >
                          <Search className="mr-2 h-4 w-4 text-muted-foreground" />
                          {customerName || "Pesquisar cliente"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[420px] p-0" align="start">
                        <div className="space-y-2 p-3">
                          <div className="relative">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                              className="pl-8"
                              placeholder="Buscar por nome ou CPF/CNPJ"
                              value={customerSearch}
                              onChange={(e) => setCustomerSearch(e.target.value)}
                              data-testid="input-customer-search"
                            />
                          </div>
                          <div className="max-h-60 space-y-1 overflow-y-auto">
                            {filteredCustomers.length > 0 ? (
                              filteredCustomers.map((customer) => (
                                <button
                                  key={customer.id}
                                  type="button"
                                  onClick={() => handleSelectCustomer(String(customer.id))}
                                  className="w-full rounded-md px-3 py-2 text-left hover:bg-accent"
                                  data-testid={`option-customer-${customer.id}`}
                                >
                                  <p className="text-sm font-medium">{customer.name}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {customer.cpfCnpj || "Sem documento"}
                                  </p>
                                </button>
                              ))
                            ) : (
                              <p className="px-2 py-3 text-sm text-muted-foreground">Nenhum cliente encontrado.</p>
                            )}
                          </div>
                        </div>
                      </PopoverContent>
                    </Popover>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => setLocation("/contacts")}
                      title="Cadastrar cliente"
                      data-testid="button-new-customer"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div>
                  <Label>Vendedor *</Label>
                  <Input value={sellerName} onChange={(e) => setSellerName(e.target.value)} />
                </div>
                <div>
                  <Label>Data de saida</Label>
                  <Input type="datetime-local" value={dispatchDate} onChange={(e) => setDispatchDate(e.target.value)} />
                </div>
                <div>
                  <Label>Indicador de presenca</Label>
                  <Select value={presenceIndicator} onValueChange={setPresenceIndicator}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1 - Operacao presencial">1 - Operacao presencial</SelectItem>
                      <SelectItem value="2 - Nao presencial, internet">2 - Nao presencial, internet</SelectItem>
                      <SelectItem value="9 - Nao presencial, outros">9 - Nao presencial, outros</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end gap-3 pb-1">
                  <Switch checked={isFinalConsumer} onCheckedChange={setIsFinalConsumer} />
                  <span className="text-sm font-medium">Consumo final</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <Tabs value={activeSection} onValueChange={setActiveSection}>
                  <TabsList className="w-full justify-start overflow-x-auto">
                    <TabsTrigger value="itens">Itens</TabsTrigger>
                    <TabsTrigger value="observacoes">Observacoes</TabsTrigger>
                    <TabsTrigger value="tributos">Tributos</TabsTrigger>
                    <TabsTrigger value="fiscal">Configuracoes Fiscais</TabsTrigger>
                    <TabsTrigger value="informacoes">Informacoes</TabsTrigger>
                  </TabsList>

                  <TabsContent value="itens" className="space-y-4 mt-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold">Itens da movimentacao</h3>
                      <Button size="sm" onClick={() => setShowItemDialog(true)} data-testid="button-add-item">
                        <Plus className="mr-2 h-4 w-4" /> Inserir novo item
                      </Button>
                    </div>
                    <div className="rounded-lg border">
                      <div className="grid grid-cols-[80px_1fr_130px_140px_130px_130px] gap-3 p-3 text-xs font-semibold text-muted-foreground">
                        <span>Acoes</span><span>Produto</span><span>Quantidade</span><span>Unitario (R$)</span><span>Desconto (R$)</span><span>Total (R$)</span>
                      </div>
                      <div className="border-t" />
                      {items.length === 0 ? (
                        <div className="p-5 text-sm text-muted-foreground">Nenhum item inserido.</div>
                      ) : (
                        items.map((item) => (
                          <div key={item.id} className="grid grid-cols-[80px_1fr_130px_140px_130px_130px] gap-3 p-3 items-center border-t text-sm">
                            <Button variant="ghost" size="sm" onClick={() => removeItem(item.id)} data-testid={`button-delete-item-${item.id}`}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                            <div>
                              <p className="font-medium">{item.description}</p>
                              <p className="text-xs text-muted-foreground">NCM {item.ncm} | CFOP {item.cfop}</p>
                            </div>
                            <span>{item.quantity.toFixed(2)}</span>
                            <span>{item.unitPrice.toFixed(2)}</span>
                            <span>{item.discount.toFixed(2)}</span>
                            <span>{Math.max(0, item.quantity * item.unitPrice - item.discount).toFixed(2)}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </TabsContent>

                  <TabsContent value="observacoes" className="space-y-4 mt-4">
                    <Label>Informacoes complementares</Label>
                    <Textarea value={additionalInfo} onChange={(e) => setAdditionalInfo(e.target.value)} placeholder="Observacoes da nota" />
                  </TabsContent>

                  <TabsContent value="tributos" className="space-y-4 mt-4">
                    <div className="flex items-center justify-between">
                      <Label>Total de impostos</Label>
                      <span className="font-semibold">R$ {totalImpostos.toFixed(2)}</span>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        onClick={handleCalculateTaxes}
                        disabled={calculateTaxesMutation.isPending}
                        data-testid="button-calculate-taxes-nfe"
                      >
                        {calculateTaxesMutation.isPending && (
                          <Loader className="mr-2 h-4 w-4 animate-spin" />
                        )}
                        Calcular impostos
                      </Button>
                      <Button variant="outline" onClick={() => setShowTaxDetails((prev) => !prev)}>
                        {showTaxDetails ? "Ocultar detalhes" : "Ver detalhes"}
                      </Button>
                    </div>
                    {showTaxDetails && (
                      <div className="space-y-2 rounded border p-3">
                        {taxCalculation?.calculations?.length ? (
                          <>
                            {taxCalculation.calculations.map((calc, idx) => (
                              <div key={`${calc.description}-${idx}`} className="rounded border p-3">
                                <p className="text-sm font-medium">{calc.description}</p>
                                <div className="mt-2 grid gap-1 text-xs text-muted-foreground md:grid-cols-4">
                                  <span>Base: R$ {Number(calc.subtotal || 0).toFixed(2)}</span>
                                  <span>ICMS: R$ {Number(calc.icmsValue || 0).toFixed(2)}</span>
                                  <span>IPI: R$ {Number(calc.ipiValue || 0).toFixed(2)}</span>
                                  <span>PIS: R$ {Number(calc.pisValue || 0).toFixed(2)}</span>
                                  <span>COFINS: R$ {Number(calc.cofinsValue || 0).toFixed(2)}</span>
                                  <span>ISS: R$ {Number(calc.issValue || 0).toFixed(2)}</span>
                                  <span>IRRF: R$ {Number(calc.irrfValue || 0).toFixed(2)}</span>
                                  <span className="font-semibold text-foreground">
                                    Total: R$ {Number(calc.totalTaxes || 0).toFixed(2)}
                                  </span>
                                </div>
                              </div>
                            ))}

                            <div className="mt-2 rounded border bg-muted/30 p-3 text-sm">
                              <div className="grid gap-1 md:grid-cols-4">
                                <span>ICMS: R$ {Number(taxCalculation.totals.icmsTotal || 0).toFixed(2)}</span>
                                <span>IPI: R$ {Number(taxCalculation.totals.ipiTotal || 0).toFixed(2)}</span>
                                <span>PIS: R$ {Number(taxCalculation.totals.pisTotal || 0).toFixed(2)}</span>
                                <span>COFINS: R$ {Number(taxCalculation.totals.cofinsTotal || 0).toFixed(2)}</span>
                                <span>ISS: R$ {Number(taxCalculation.totals.issTotal || 0).toFixed(2)}</span>
                                <span>IRRF: R$ {Number(taxCalculation.totals.irrfTotal || 0).toFixed(2)}</span>
                                <span>Base: R$ {Number(taxCalculation.totals.baseValue || 0).toFixed(2)}</span>
                                <span className="font-semibold">
                                  Total tributos: R$ {Number(taxCalculation.totals.totalTaxes || 0).toFixed(2)}
                                </span>
                              </div>
                            </div>
                          </>
                        ) : (
                          <p className="text-sm text-muted-foreground">
                            Clique em "Calcular impostos" para detalhar os tributos por item.
                          </p>
                        )}
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="fiscal" className="space-y-4 mt-4">
                    <div className="grid gap-4 md:grid-cols-3">
                      <div>
                        <Label>Ambiente</Label>
                        <Input
                          value={
                            settings?.fiscalEnvironment === "producao"
                              ? "Producao (configuracao da empresa)"
                              : "Homologacao (configuracao da empresa)"
                          }
                          disabled
                        />
                      </div>
                      <div>
                        <Label>Tipo operacao</Label>
                        <Select value={operationType} onValueChange={setOperationType}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="saida">Saida</SelectItem>
                            <SelectItem value="entrada">Entrada</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Serie</Label>
                        <Input value={series} onChange={(e) => setSeries(e.target.value)} />
                      </div>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <Label>Forma pagamento</Label>
                        <Select value={paymentForm} onValueChange={setPaymentForm}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="a_vista">A vista</SelectItem>
                            <SelectItem value="credito">Credito</SelectItem>
                            <SelectItem value="debito">Debito</SelectItem>
                            <SelectItem value="pix">Pix</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Condicao pagamento</Label>
                        <Select value={paymentCondition} onValueChange={setPaymentCondition}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="imediato">Imediato</SelectItem>
                            <SelectItem value="30">30 dias</SelectItem>
                            <SelectItem value="30_60">30/60 dias</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="informacoes" className="space-y-4 mt-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div><Label>Razao social emitente</Label><Input value={companyName} disabled /></div>
                      <div><Label>CNPJ emitente</Label><Input value={cnpj} disabled /></div>
                      <div><Label>IE emitente</Label><Input value={ie} disabled /></div>
                      <div><Label>IM emitente</Label><Input value={im} disabled /></div>
                      <div><Label>Regime tributario</Label><Input value={regime} disabled /></div>
                      <div>
                        <Label>Data emissao</Label>
                        <Input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
                      </div>
                      <div>
                        <Label>{customerType === "pf" ? "CPF" : "CNPJ"} cliente *</Label>
                        <Input
                          value={customerDocument}
                          onChange={(e) => setCustomerDocument(e.target.value)}
                          placeholder={customerType === "pf" ? "000.000.000-00" : "00.000.000/0000-00"}
                        />
                      </div>
                      <div>
                        <Label>Tipo cliente</Label>
                        <Select value={customerType} onValueChange={setCustomerType}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pf">Pessoa Fisica</SelectItem>
                            <SelectItem value="pj">Pessoa Juridica</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Indicador IE</Label>
                        <Select value={customerIeIndicator} onValueChange={setCustomerIeIndicator}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="contribuinte">Contribuinte</SelectItem>
                            <SelectItem value="nao_contribuinte">Nao contribuinte</SelectItem>
                            <SelectItem value="isento">Isento</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div><Label>CEP</Label><Input value={customerZip} onChange={(e) => setCustomerZip(e.target.value)} /></div>
                      <div className="md:col-span-2"><Label>Endereco</Label><Input value={customerAddress} onChange={(e) => setCustomerAddress(e.target.value)} /></div>
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>

            <div className="flex gap-2">
              <Button onClick={handleGenerate} disabled={generateMutation.isPending} className="flex-1" data-testid="button-generate-nfe">
                {generateMutation.isPending ? (
                  <><Loader className="mr-2 h-4 w-4 animate-spin" /> Salvar...</>
                ) : (
                  "Salvar"
                )}
              </Button>

              {signed && (
                <Button onClick={handleSubmit} disabled={submitMutation.isPending} data-testid="button-submit-sefaz">
                  {submitMutation.isPending ? (
                    <><Loader className="mr-2 h-4 w-4 animate-spin" /> Autorizando...</>
                  ) : (
                    <><Send className="mr-2 h-4 w-4" /> Autorizar NF-e</>
                  )}
                </Button>
              )}
            </div>
          </div>

          <div className="space-y-6">
            <Card className="sticky top-20">
              <CardHeader>
                <CardTitle>Totais do pedido</CardTitle>
                <CardDescription>NF-e {documentNumber}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div><Label>Desconto total</Label><Input value={`R$ ${totalDesconto.toFixed(2)}`} disabled /></div>
                <div><Label>Acrescimos/Despesas</Label><Input value={`R$ ${(freightValue + insuranceValue + otherExpensesValue).toFixed(2)}`} disabled /></div>
                <div className="text-sm space-y-1 border-t pt-3">
                  <div className="flex justify-between"><span>Itens</span><span>{items.length}</span></div>
                  <div className="flex justify-between"><span>Quantidade</span><span>{items.reduce((sum, item) => sum + Math.max(0, item.quantity), 0)}</span></div>
                  <div className="flex justify-between text-primary"><span>Total de impostos</span><span>R$ {totalImpostos.toFixed(2)}</span></div>
                  <div className="flex justify-between"><span>Frete</span><span>R$ {freightValue.toFixed(2)}</span></div>
                  <div className="flex justify-between"><span>Seguro</span><span>R$ {insuranceValue.toFixed(2)}</span></div>
                  <div className="flex justify-between"><span>Outras despesas</span><span>R$ {otherExpensesValue.toFixed(2)}</span></div>
                </div>
                <div className="border-t pt-3">
                  <div className="flex justify-between font-semibold">
                    <span>Total do documento</span>
                    <span className="text-red-600">R$ {totalDocumento.toFixed(2)}</span>
                  </div>
                </div>
                <div><Label>Frete</Label><Input type="number" step="0.01" value={freightValue} onChange={(e) => setFreightValue(Number(e.target.value || 0))} /></div>
                <div><Label>Seguro</Label><Input type="number" step="0.01" value={insuranceValue} onChange={(e) => setInsuranceValue(Number(e.target.value || 0))} /></div>
                <div><Label>Outras despesas</Label><Input type="number" step="0.01" value={otherExpensesValue} onChange={(e) => setOtherExpensesValue(Number(e.target.value || 0))} /></div>

                <div className="pt-2 border-t">
                  {generatedXml ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        {signed ? (
                          <>
                            <CheckCircle className="h-5 w-5 text-green-600" />
                            <span className="font-medium text-green-600">Assinada</span>
                          </>
                        ) : (
                          <>
                            <AlertCircle className="h-5 w-5 text-yellow-600" />
                            <span className="font-medium text-yellow-600">Nao assinada</span>
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
                    <p className="text-sm text-muted-foreground">Aguardando geracao...</p>
                  )}
                </div>
              </CardContent>
            </Card>

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
                        <Badge variant="outline" className="bg-green-50">{result.message}</Badge>
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

      <Dialog open={showItemDialog} onOpenChange={setShowItemDialog}>
        <DialogContent className="max-h-[90vh] overflow-hidden sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Adicionar Item</DialogTitle>
            <DialogDescription>Informe os dados do produto</DialogDescription>
          </DialogHeader>

          <div className="max-h-[65vh] space-y-4 overflow-y-auto pr-1">
            <div>
              <Label>Produto cadastrado</Label>
              <div className="flex gap-2">
                <Popover open={productSearchOpen} onOpenChange={setProductSearchOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full justify-start text-left font-normal"
                      data-testid="button-select-product"
                    >
                      <Search className="mr-2 h-4 w-4 text-muted-foreground" />
                      {currentItem.description || "Pesquisar produto"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[420px] p-0" align="start">
                    <div className="space-y-2 p-3">
                      <div className="relative">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          className="pl-8"
                          placeholder="Buscar por nome ou EAN"
                          value={productSearch}
                          onChange={(e) => setProductSearch(e.target.value)}
                          data-testid="input-product-search"
                        />
                      </div>
                      <div className="max-h-60 space-y-1 overflow-y-auto">
                        <button
                          type="button"
                          onClick={() => handleSelectProductForItem("__none__")}
                          className="w-full rounded-md px-3 py-2 text-left hover:bg-accent"
                        >
                          <p className="text-sm font-medium">Selecionar manualmente</p>
                        </button>
                        {filteredProducts.map((product) => (
                          <button
                            key={product.id}
                            type="button"
                            onClick={() => handleSelectProductForItem(String(product.id))}
                            className="w-full rounded-md px-3 py-2 text-left hover:bg-accent"
                            data-testid={`option-product-${product.id}`}
                          >
                            <p className="text-sm font-medium">{product.name}</p>
                            <p className="text-xs text-muted-foreground">{product.ean || "Sem EAN"}</p>
                          </button>
                        ))}
                        {filteredProducts.length === 0 && (
                          <p className="px-2 py-3 text-sm text-muted-foreground">Nenhum produto encontrado.</p>
                        )}
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setLocation("/inventory")}
                  title="Cadastrar produto"
                  data-testid="button-new-product"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div>
              <Label>Codigo</Label>
              <Input value={currentItem.code || ""} onChange={(e) => setCurrentItem({ ...currentItem, code: e.target.value })} placeholder="Codigo do item" />
            </div>

            <div>
              <Label>Descricao</Label>
              <Input value={currentItem.description || ""} onChange={(e) => setCurrentItem({ ...currentItem, description: e.target.value })} placeholder="Descricao do item" />
            </div>

            <div className="grid gap-4 grid-cols-2">
              <div>
                <Label>NCM</Label>
                <Input value={currentItem.ncm || ""} onChange={(e) => setCurrentItem({ ...currentItem, ncm: e.target.value })} placeholder="28112090" />
              </div>
              <div>
                <Label>CFOP</Label>
                <Input value={currentItem.cfop || ""} onChange={(e) => setCurrentItem({ ...currentItem, cfop: e.target.value })} placeholder="5102" />
              </div>
            </div>

            <div className="grid gap-4 grid-cols-2">
              <div>
                <Label>Quantidade</Label>
                <Input type="number" value={currentItem.quantity || 1} onChange={(e) => setCurrentItem({ ...currentItem, quantity: parseFloat(e.target.value) || 0 })} />
              </div>
              <div>
                <Label>Valor Unitario</Label>
                <Input type="number" step="0.01" value={currentItem.unitPrice || 0} onChange={(e) => setCurrentItem({ ...currentItem, unitPrice: parseFloat(e.target.value) || 0 })} />
              </div>
            </div>

            <div>
              <Label>Desconto</Label>
              <Input type="number" step="0.01" value={currentItem.discount || 0} onChange={(e) => setCurrentItem({ ...currentItem, discount: parseFloat(e.target.value) || 0 })} />
            </div>

            <div className="grid gap-4 grid-cols-2">
              <div>
                <Label>ICMS %</Label>
                <Input type="number" step="0.01" value={currentItem.icmsAliquot || 18} onChange={(e) => setCurrentItem({ ...currentItem, icmsAliquot: parseFloat(e.target.value) || 0 })} />
              </div>
              <div>
                <Label>Reducao ICMS %</Label>
                <Input type="number" step="0.01" value={currentItem.icmsReduction || 0} onChange={(e) => setCurrentItem({ ...currentItem, icmsReduction: parseFloat(e.target.value) || 0 })} />
              </div>
            </div>

            <div className="grid gap-4 grid-cols-2">
              <div>
                <Label>IPI %</Label>
                <Input type="number" step="0.01" value={currentItem.ipiAliquot || 0} onChange={(e) => setCurrentItem({ ...currentItem, ipiAliquot: parseFloat(e.target.value) || 0 })} />
              </div>
              <div>
                <Label>PIS %</Label>
                <Input type="number" step="0.01" value={currentItem.pisAliquot || 0} onChange={(e) => setCurrentItem({ ...currentItem, pisAliquot: parseFloat(e.target.value) || 0 })} />
              </div>
            </div>

            <div className="grid gap-4 grid-cols-2">
              <div>
                <Label>COFINS %</Label>
                <Input type="number" step="0.01" value={currentItem.cofinsAliquot || 0} onChange={(e) => setCurrentItem({ ...currentItem, cofinsAliquot: parseFloat(e.target.value) || 0 })} />
              </div>
              <div>
                <Label>ISS %</Label>
                <Input type="number" step="0.01" value={currentItem.issAliquot || 0} onChange={(e) => setCurrentItem({ ...currentItem, issAliquot: parseFloat(e.target.value) || 0 })} />
              </div>
            </div>

            <div className="grid gap-4 grid-cols-2">
              <div>
                <Label>IRRF %</Label>
                <Input type="number" step="0.01" value={currentItem.irrfAliquot || 0} onChange={(e) => setCurrentItem({ ...currentItem, irrfAliquot: parseFloat(e.target.value) || 0 })} />
              </div>
            </div>
          </div>

          <DialogFooter className="border-t pt-3">
            <Button variant="outline" onClick={() => setShowItemDialog(false)}>Cancelar</Button>
            <Button onClick={addItem} data-testid="button-confirm-item">Adicionar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}













