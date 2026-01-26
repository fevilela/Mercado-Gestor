import { useState, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Layout from "@/components/layout";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Plus, AlertCircle, Check, Trash2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface Product {
  id: number;
  name: string;
  ean?: string;
  price: string;
  purchasePrice?: string;
  ncm?: string;
  csosnCode?: string;
  cstIcms?: string;
  cstIpi?: string;
  cstPisCofins?: string;
  origin?: string;
  unit?: string;
  category?: string;
  serviceCode?: string;
  cest?: string;
}

interface Customer {
  id: number;
  name: string;
  cpfCnpj?: string;
  personType?: string;
  isIcmsContributor?: boolean;
}

interface CfopCode {
  id: number;
  code: string;
  description: string;
  type: string;
  operationType: string;
  scope: string;
}

interface FormItem {
  productId: number;
  productName: string;
  description: string;
  quantity: string;
  unitPrice: string;
  ncm: string;
  csosn: string;
  cstIcms: string;
  cstIpi: string;
  cstPisCofins: string;
  origin: string;
  serviceCode: string;
  cest: string;
}

interface NfseItem {
  id: string;
  code: string;
  description: string;
  quantity: string;
  unitPrice: string;
  discount: string;
  serviceCode: string;
}

interface NfceSale {
  id: number;
  customerName: string;
  total: string;
  nfceStatus: string;
  nfceProtocol: string | null;
  nfceKey: string | null;
  nfceError?: string | null;
  createdAt: string;
}

export default function FiscalDocuments() {
  const [activeTab, setActiveTab] = useState("nfe");
  const queryClient = useQueryClient();
  const [companyName] = useState("Sua Empresa LTDA");
  const [companyCnpj] = useState("00.000.000/0000-00");
  const [companyIe] = useState("000.000.000.000");
  const [companyIm] = useState("00000000");
  const [companyRegime] = useState("Simples Nacional");
  const [productSearch, setProductSearch] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(
    null
  );
  const [productSearchOpen, setProductSearchOpen] = useState(false);
  const [customerSearchOpen, setCustomerSearchOpen] = useState(false);
  const [selectedNfceIds, setSelectedNfceIds] = useState<number[]>([]);
  const [inutilizeForm, setInutilizeForm] = useState({
    serie: "",
    startNumber: "",
    endNumber: "",
    reason: "",
  });
  const [cancelNfceDialog, setCancelNfceDialog] = useState({
    open: false,
    saleId: 0,
    reason: "",
  });
  const [nfeOps, setNfeOps] = useState({
    uf: "MG",
    environment: "homologacao",
    xmlContent: "",
    cancelAccessKey: "",
    cancelProtocol: "",
    cancelReason: "",
    cceAccessKey: "",
    cceText: "",
    cceSequence: "1",
    inutilizeSeries: "",
    inutilizeStart: "",
    inutilizeEnd: "",
    inutilizeReason: "",
  });

  const [formData, setFormData] = useState({
    customerId: "",
    customerCPFCNPJ: "",
    cfopCode: "",
    scope: "interna" as "interna" | "interestadual" | "exterior",
    items: [
      {
        productId: 0,
        productName: "",
        description: "",
        quantity: "1",
        unitPrice: "0",
        ncm: "",
        csosn: "101",
        cstIcms: "00",
        cstIpi: "00",
        cstPisCofins: "00",
        origin: "nacional",
        serviceCode: "",
        cest: "",
      } as FormItem,
    ],
  });

  const [nfseIssueDate, setNfseIssueDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [nfseEnvironment, setNfseEnvironment] = useState("homologacao");
  const [nfseOperationType, setNfseOperationType] = useState("prestacao");
  const [nfseSeries] = useState("1");
  const [nfseNumber] = useState("Automatico");
  const [nfseCustomerType, setNfseCustomerType] = useState("pj");
  const [nfseCustomerName, setNfseCustomerName] = useState("");
  const [nfseCustomerDocument, setNfseCustomerDocument] = useState("");
  const [nfseCustomerIeIndicator, setNfseCustomerIeIndicator] =
    useState("nao_contribuinte");
  const [nfseCustomerZip, setNfseCustomerZip] = useState("");
  const [nfseCustomerAddress, setNfseCustomerAddress] = useState("");
  const [nfsePaymentForm, setNfsePaymentForm] = useState("a_vista");
  const [nfsePaymentCondition, setNfsePaymentCondition] = useState("imediato");
  const [nfseAdditionalInfo, setNfseAdditionalInfo] = useState("");
  const [nfseShowTaxDetails, setNfseShowTaxDetails] = useState(false);
  const [nfseItems, setNfseItems] = useState<NfseItem[]>([
    {
      id: "1",
      code: "",
      description: "",
      quantity: "1",
      unitPrice: "0",
      discount: "0",
      serviceCode: "",
    },
  ]);

  // Fetch CFOP codes
  const { data: cfopCodes = [] } = useQuery<CfopCode[]>({
    queryKey: ["cfop-codes"],
    queryFn: async () => {
      const res = await fetch("/api/cfop-codes");
      if (!res.ok) return [];
      return res.json();
    },
  });

  // Search products
  const { data: productResults = [] } = useQuery<Product[]>({
    queryKey: ["products/search", productSearch],
    queryFn: async () => {
      if (!productSearch.trim()) return [];
      const res = await fetch(
        `/api/products/search/${encodeURIComponent(productSearch)}`
      );
      if (!res.ok) return [];
      return res.json();
    },
    enabled: productSearch.length > 1,
  });

  // Search customers
  const { data: customerResults = [] } = useQuery<Customer[]>({
    queryKey: ["customers/search", customerSearch],
    queryFn: async () => {
      if (!customerSearch.trim()) return [];
      const res = await fetch(
        `/api/customers/search/${encodeURIComponent(customerSearch)}`
      );
      if (!res.ok) return [];
      return res.json();
    },
    enabled: customerSearch.length > 1,
  });

  const { data: sales = [], isLoading: isLoadingSales } = useQuery<NfceSale[]>({
    queryKey: ["/api/sales"],
    queryFn: async () => {
      const res = await fetch("/api/sales");
      if (!res.ok) throw new Error("Erro ao carregar vendas");
      return res.json();
    },
  });

  // Validar NF-e
  const validateNFeMutation = useMutation<any, Error, any>({
    mutationFn: async (data) => {
      const res = await fetch("/api/fiscal/nfe/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      toast.success("NF-e validada com sucesso!");
    },
    onError: (error) => {
      toast.error("Erro ao validar NF-e: " + error.message);
    },
  });

  // Calcular impostos
  const calculateTaxesMutation = useMutation<any, Error, any>({
    mutationFn: async (data) => {
      const res = await fetch("/api/fiscal/nfe/calculate-taxes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: (data) => {
      toast.success("Impostos calculados!");
      console.log("Cálculo de impostos:", data);
    },
  });

  const sendNfceMutation = useMutation<any, Error, number[]>({
    mutationFn: async (saleIds) => {
      const res = await fetch("/api/fiscal/nfce/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ saleIds }),
      });
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.error || "Falha ao enviar NFC-e");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sales"] });
      setSelectedNfceIds([]);
      toast.success("Envio de NFC-e iniciado");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const cancelNfceMutation = useMutation<
    any,
    Error,
    { saleId: number; reason: string }
  >({
    mutationFn: async (payload) => {
      const res = await fetch("/api/fiscal/nfce/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          saleId: payload.saleId,
          reason: payload.reason,
        }),
      });
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.error || "Falha ao cancelar NFC-e");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sales"] });
      toast.success("NFC-e cancelada");
      setCancelNfceDialog({ open: false, saleId: 0, reason: "" });
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const inutilizeNfceMutation = useMutation<any, Error, typeof inutilizeForm>({
    mutationFn: async (payload) => {
      const res = await fetch("/api/fiscal/nfce/inutilize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serie: payload.serie,
          startNumber: payload.startNumber,
          endNumber: payload.endNumber,
          reason: payload.reason,
        }),
      });
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.error || "Falha ao inutilizar numeracao");
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success("Inutilizacao registrada");
      setInutilizeForm({ serie: "", startNumber: "", endNumber: "", reason: "" });
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const submitNfeMutation = useMutation<any, Error, typeof nfeOps>({
    mutationFn: async (payload) => {
      const res = await fetch("/api/fiscal/sefaz/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          xmlContent: payload.xmlContent,
          uf: payload.uf,
          environment: payload.environment,
        }),
      });
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.error || "Falha ao enviar NF-e");
      }
      return res.json();
    },
    onSuccess: (data) => {
      toast.success(`NF-e enviada: ${data.status || "OK"}`);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const cancelNfeMutation = useMutation<any, Error, typeof nfeOps>({
    mutationFn: async (payload) => {
      const res = await fetch("/api/fiscal/sefaz/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accessKey: payload.cancelAccessKey,
          protocol: payload.cancelProtocol,
          reason: payload.cancelReason,
          uf: payload.uf,
          environment: payload.environment,
        }),
      });
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.error || "Falha ao cancelar NF-e");
      }
      return res.json();
    },
    onSuccess: (data) => {
      toast.success(`NF-e cancelada: ${data.status || "OK"}`);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const cceNfeMutation = useMutation<any, Error, typeof nfeOps>({
    mutationFn: async (payload) => {
      const res = await fetch("/api/fiscal/sefaz/correction-letter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accessKey: payload.cceAccessKey,
          correctedContent: payload.cceText,
          sequence: Number(payload.cceSequence || "1"),
          uf: payload.uf,
          environment: payload.environment,
        }),
      });
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.error || "Falha ao enviar CC-e");
      }
      return res.json();
    },
    onSuccess: (data) => {
      toast.success(`CC-e enviada: ${data.status || "OK"}`);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const inutilizeNfeMutation = useMutation<any, Error, typeof nfeOps>({
    mutationFn: async (payload) => {
      const res = await fetch("/api/fiscal/sefaz/inutilize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          series: payload.inutilizeSeries,
          startNumber: payload.inutilizeStart,
          endNumber: payload.inutilizeEnd,
          reason: payload.inutilizeReason,
          uf: payload.uf,
          environment: payload.environment,
        }),
      });
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.error || "Falha ao inutilizar numeracao");
      }
      return res.json();
    },
    onSuccess: (data) => {
      toast.success(`Inutilizacao registrada: ${data.status || "OK"}`);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleSelectProduct = (product: Product, itemIndex: number) => {
    const newItems = [...formData.items];
    newItems[itemIndex] = {
      ...newItems[itemIndex],
      productId: product.id,
      productName: product.name,
      description: product.name,
      unitPrice: product.price,
      ncm: product.ncm || "",
      csosn: product.csosnCode || "101",
      cstIcms: product.cstIcms || "00",
      cstIpi: product.cstIpi || "00",
      cstPisCofins: product.cstPisCofins || "00",
      origin: product.origin || "nacional",
      serviceCode: product.serviceCode || "",
      cest: product.cest || "",
    };
    setFormData({ ...formData, items: newItems });
    setProductSearch("");
    setProductSearchOpen(false);
    toast.success(`Produto ${product.name} selecionado! Tributação carregada.`);
  };

  const handleSelectCustomer = (customer: Customer) => {
    setSelectedCustomer(customer);
    setFormData({
      ...formData,
      customerId: String(customer.id),
      customerCPFCNPJ: customer.cpfCnpj || "",
    });
    setCustomerSearch("");
    setCustomerSearchOpen(false);
    toast.success(`Cliente ${customer.name} selecionado!`);
  };

  const handleAddItem = () => {
    setFormData({
      ...formData,
      items: [
        ...formData.items,
        {
          productId: 0,
          productName: "",
          description: "",
          quantity: "1",
          unitPrice: "0",
          ncm: "",
          csosn: "101",
          cstIcms: "00",
          cstIpi: "00",
          cstPisCofins: "00",
          origin: "nacional",
          serviceCode: "",
          cest: "",
        },
      ],
    });
  };

  const handleRemoveItem = (index: number) => {
    setFormData({
      ...formData,
      items: formData.items.filter((_, i) => i !== index),
    });
  };

  const handleItemChange = (index: number, field: string, value: string) => {
    const newItems = [...formData.items];
    newItems[index] = { ...newItems[index], [field]: value };
    setFormData({ ...formData, items: newItems });
  };

  const totalValue = useMemo(() => {
    return formData.items.reduce(
      (acc, item) =>
        acc +
        parseFloat(item.unitPrice || "0") * parseInt(item.quantity || "1"),
      0
    );
  }, [formData.items]);

  const nfseSubtotal = useMemo(() => {
    return nfseItems.reduce((acc, item) => {
      const quantity = parseFloat(item.quantity || "0");
      const unitPrice = parseFloat(item.unitPrice || "0");
      const discount = parseFloat(item.discount || "0");
      return acc + Math.max(0, quantity * unitPrice - discount);
    }, 0);
  }, [nfseItems]);

  const nfseTaxes = useMemo(() => {
    const rate = 5;
    return nfseSubtotal * (rate / 100);
  }, [nfseSubtotal]);

  const nfseTotal = useMemo(() => {
    return nfseSubtotal + nfseTaxes;
  }, [nfseSubtotal, nfseTaxes]);

  const addNfseItem = () => {
    setNfseItems((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        code: "",
        description: "",
        quantity: "1",
        unitPrice: "0",
        discount: "0",
        serviceCode: "",
      },
    ]);
  };

  const updateNfseItem = (id: string, field: keyof NfseItem, value: string) => {
    setNfseItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  const removeNfseItem = (id: string) => {
    setNfseItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleValidateNFe = () => {
    if (!formData.customerId) {
      toast.error("Selecione um cliente");
      return;
    }
    if (!formData.cfopCode) {
      toast.error("Selecione um CFOP");
      return;
    }
    if (formData.items.length === 0 || formData.items[0].productId === 0) {
      toast.error("Adicione pelo menos um produto");
      return;
    }

    validateNFeMutation.mutate({
      customerId: parseInt(formData.customerId),
      customerType: "contribuinte",
      originState: "SP",
      destinyState: formData.scope === "interestadual" ? "RJ" : "SP",
      scope: formData.scope,
      cfopCode: formData.cfopCode,
      items: formData.items.map((item) => ({
        productId: item.productId,
        description: item.description,
        ncm: item.ncm,
        cfop: formData.cfopCode,
        csosn: item.csosn,
        cstIcms: item.cstIcms,
        cstIpi: item.cstIpi,
        cstPisCofins: item.cstPisCofins,
        quantity: parseInt(item.quantity),
        unit: item.origin || "UN",
        unitPrice: parseFloat(item.unitPrice),
        totalValue: parseFloat(item.unitPrice) * parseInt(item.quantity),
        icmsValue: 0,
        icmsAliquot: 18,
        piValue: 0,
        cofinsValue: 0,
        ipiValue: 0,
      })),
    });
  };

  const handleCalculateTaxes = () => {
    if (formData.items.length === 0) {
      toast.error("Adicione itens para calcular impostos");
      return;
    }

    calculateTaxesMutation.mutate({
      items: formData.items.map((item) => ({
        ...item,
        csosn: item.csosn,
        totalValue: parseFloat(item.unitPrice) * parseInt(item.quantity),
      })),
    });
  };

  const nfceSales = useMemo(() => {
    return sales.map((sale) => ({
      ...sale,
      nfceStatus: sale.nfceStatus || "Pendente",
    }));
  }, [sales]);

  const normalizeNfceStatus = (status: string) => {
    if (status === "Autorizada") return "Autorizada";
    if (status === "Cancelada") return "Cancelada";
    if (status === "Rejeitada") return "Rejeitada";
    return "Pendente";
  };

  const toggleSelectNfce = (saleId: number, checked: boolean) => {
    if (checked) {
      setSelectedNfceIds((prev) => [...prev, saleId]);
    } else {
      setSelectedNfceIds((prev) => prev.filter((id) => id !== saleId));
    }
  };

  const handleBatchSend = () => {
    if (selectedNfceIds.length === 0) {
      toast.error("Selecione NFC-e para envio");
      return;
    }
    sendNfceMutation.mutate(selectedNfceIds);
  };

  const updateNfeOps = (field: keyof typeof nfeOps, value: string) => {
    setNfeOps((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-title">
            Documentos Fiscais
          </h1>
          <p className="text-gray-500 mt-2">
            Emita NF-e, NFC-e com tributação completa validada para Receita
            Federal
          </p>
        </div>

        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="space-y-4"
        >
          <TabsList>
            <TabsTrigger value="nfe">NF-e (Modelo 55)</TabsTrigger>
            <TabsTrigger value="nfce">NFC-e (Modelo 65)</TabsTrigger>
            <TabsTrigger value="nfse">NFS-e</TabsTrigger>
          </TabsList>

          {/* NF-e */}
          <TabsContent value="nfe" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Emitir NF-e</CardTitle>
                <CardDescription>
                  Nota Fiscal Eletrônica com tributação completa
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Alert>
                  <Check className="h-4 w-4" />
                  <AlertDescription>
                    Tributação automática com CSOSN, CST ICMS, IPI, PIS/COFINS
                    conforme produto
                  </AlertDescription>
                </Alert>

                {/* Cliente Selection */}
                <div>
                  <Label>Cliente *</Label>
                  <Popover
                    open={customerSearchOpen}
                    onOpenChange={setCustomerSearchOpen}
                  >
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full justify-start text-left"
                        data-testid="button-select-customer"
                      >
                        {selectedCustomer
                          ? selectedCustomer.name
                          : "Selecione um cliente"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-full p-0" align="start">
                      <div className="p-4 space-y-2">
                        <Input
                          placeholder="Buscar cliente..."
                          value={customerSearch}
                          onChange={(e) => setCustomerSearch(e.target.value)}
                          data-testid="input-customer-search"
                        />
                        <div className="max-h-48 overflow-y-auto space-y-1">
                          {customerResults.length > 0 ? (
                            customerResults.map((customer) => (
                              <button
                                key={customer.id}
                                onClick={() => handleSelectCustomer(customer)}
                                className="w-full text-left px-3 py-2 hover:bg-accent rounded-md text-sm"
                                data-testid={`option-customer-${customer.id}`}
                              >
                                <div className="font-medium">
                                  {customer.name}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {customer.cpfCnpj}
                                </div>
                              </button>
                            ))
                          ) : customerSearch.trim() ? (
                            <div className="text-sm text-muted-foreground p-2">
                              Nenhum cliente encontrado
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>CFOP *</Label>
                    <Select
                      value={formData.cfopCode}
                      onValueChange={(val) =>
                        setFormData({ ...formData, cfopCode: val })
                      }
                    >
                      <SelectTrigger data-testid="select-cfop">
                        <SelectValue placeholder="Selecione um CFOP" />
                      </SelectTrigger>
                      <SelectContent>
                        {cfopCodes.map((cfop) => (
                          <SelectItem key={cfop.id} value={cfop.code}>
                            {cfop.code} - {cfop.description}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Escopo</Label>
                    <Select
                      value={formData.scope}
                      onValueChange={(val) =>
                        setFormData({
                          ...formData,
                          scope: val as
                            | "interna"
                            | "interestadual"
                            | "exterior",
                        })
                      }
                    >
                      <SelectTrigger data-testid="select-scope">
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

                {/* Items */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <Label className="text-base font-semibold">
                      Itens da NF-e *
                    </Label>
                    <Button
                      onClick={handleAddItem}
                      size="sm"
                      variant="outline"
                      data-testid="button-add-item"
                    >
                      <Plus className="h-4 w-4 mr-1" /> Adicionar
                    </Button>
                  </div>

                  {formData.items.map((item, index) => (
                    <Card key={index} className="p-4 space-y-3">
                      <div>
                        <Label className="text-sm">Produto *</Label>
                        <Popover
                          open={productSearchOpen && index === 0}
                          onOpenChange={setProductSearchOpen}
                        >
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              className="w-full justify-start text-left"
                              data-testid={`button-select-product-${index}`}
                            >
                              {item.productName || "Buscar produto..."}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-full p-0" align="start">
                            <div className="p-4 space-y-2">
                              <Input
                                placeholder="Buscar por nome, EAN..."
                                value={productSearch}
                                onChange={(e) =>
                                  setProductSearch(e.target.value)
                                }
                                data-testid={`input-product-search-${index}`}
                              />
                              <div className="max-h-48 overflow-y-auto space-y-1">
                                {productResults.length > 0 ? (
                                  productResults.map((product) => (
                                    <button
                                      key={product.id}
                                      onClick={() =>
                                        handleSelectProduct(product, index)
                                      }
                                      className="w-full text-left px-3 py-2 hover:bg-accent rounded-md text-sm"
                                      data-testid={`option-product-${product.id}`}
                                    >
                                      <div className="font-medium">
                                        {product.name}
                                      </div>
                                      <div className="text-xs text-muted-foreground">
                                        R${" "}
                                        {parseFloat(
                                          String(product.price)
                                        ).toFixed(2)}{" "}
                                        • NCM: {product.ncm || "N/A"}
                                      </div>
                                      <div className="text-xs text-muted-foreground">
                                        CSOSN: {product.csosnCode || "N/A"} •
                                        Origem: {product.origin || "N/A"}
                                      </div>
                                    </button>
                                  ))
                                ) : productSearch.trim() ? (
                                  <div className="text-sm text-muted-foreground p-2">
                                    Nenhum produto encontrado
                                  </div>
                                ) : null}
                              </div>
                            </div>
                          </PopoverContent>
                        </Popover>
                      </div>

                      {/* Informações do Produto */}
                      {item.productId > 0 && (
                        <div className="bg-blue-50 p-3 rounded-md space-y-2">
                          <div className="grid grid-cols-3 gap-2 text-xs">
                            <div>
                              <span className="font-semibold">NCM:</span>{" "}
                              {item.ncm || "N/A"}
                            </div>
                            <div>
                              <span className="font-semibold">CSOSN:</span>{" "}
                              {item.csosn}
                            </div>
                            <div>
                              <span className="font-semibold">Origem:</span>{" "}
                              {item.origin}
                            </div>
                          </div>
                          <div className="grid grid-cols-3 gap-2 text-xs">
                            <div>
                              <span className="font-semibold">CST ICMS:</span>{" "}
                              {item.cstIcms}
                            </div>
                            <div>
                              <span className="font-semibold">CST IPI:</span>{" "}
                              {item.cstIpi}
                            </div>
                            <div>
                              <span className="font-semibold">
                                CST PIS/COFINS:
                              </span>{" "}
                              {item.cstPisCofins}
                            </div>
                          </div>
                          {item.cest && (
                            <div className="text-xs">
                              <span className="font-semibold">CEST:</span>{" "}
                              {item.cest}
                            </div>
                          )}
                          {item.serviceCode && (
                            <div className="text-xs">
                              <span className="font-semibold">
                                Código de Serviço:
                              </span>{" "}
                              {item.serviceCode}
                            </div>
                          )}
                        </div>
                      )}

                      <div className="grid grid-cols-4 gap-2">
                        <div>
                          <Label className="text-sm">Qtd</Label>
                          <Input
                            placeholder="1"
                            type="number"
                            value={item.quantity}
                            onChange={(e) =>
                              handleItemChange(
                                index,
                                "quantity",
                                e.target.value
                              )
                            }
                            data-testid={`input-quantity-${index}`}
                          />
                        </div>
                        <div>
                          <Label className="text-sm">Preço Unit.</Label>
                          <Input
                            placeholder="0.00"
                            type="number"
                            step="0.01"
                            value={item.unitPrice}
                            onChange={(e) =>
                              handleItemChange(
                                index,
                                "unitPrice",
                                e.target.value
                              )
                            }
                            data-testid={`input-price-${index}`}
                          />
                        </div>
                        <div>
                          <Label className="text-sm">CSOSN</Label>
                          <Input
                            placeholder="101"
                            value={item.csosn}
                            data-testid={`input-csosn-${index}`}
                            disabled
                            className="bg-gray-100"
                          />
                        </div>
                        <div>
                          <Label className="text-sm">&nbsp;</Label>
                          <Button
                            onClick={() => handleRemoveItem(index)}
                            variant="destructive"
                            size="sm"
                            className="w-full"
                            data-testid={`button-remove-item-${index}`}
                          >
                            Remover
                          </Button>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>

                {/* Total */}
                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="text-right">
                    <div className="text-sm text-muted-foreground">Total</div>
                    <div
                      className="text-2xl font-bold"
                      data-testid="text-total"
                    >
                      R$ {totalValue.toFixed(2)}
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 pt-4">
                  <Button
                    onClick={handleValidateNFe}
                    disabled={validateNFeMutation.isPending}
                    data-testid="button-validate-nfe"
                  >
                    {validateNFeMutation.isPending && (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    )}
                    Validar NF-e
                  </Button>
                  <Button
                    onClick={handleCalculateTaxes}
                    variant="secondary"
                    disabled={calculateTaxesMutation.isPending}
                    data-testid="button-calculate-taxes"
                  >
                    {calculateTaxesMutation.isPending && (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    )}
                    Calcular Impostos
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Operacoes SEFAZ (NF-e)</CardTitle>
                <CardDescription>
                  Envio, cancelamento, carta de correcao e inutilizacao
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Necessario certificado digital configurado para a empresa.
                  </AlertDescription>
                </Alert>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>UF</Label>
                    <Input
                      value={nfeOps.uf}
                      onChange={(e) => updateNfeOps("uf", e.target.value)}
                      data-testid="input-nfe-uf"
                    />
                  </div>
                  <div>
                    <Label>Ambiente</Label>
                    <Select
                      value={nfeOps.environment}
                      onValueChange={(val) => updateNfeOps("environment", val)}
                    >
                      <SelectTrigger data-testid="select-nfe-environment">
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
                </div>

                <div className="space-y-2">
                  <Label>XML NF-e</Label>
                  <Textarea
                    value={nfeOps.xmlContent}
                    onChange={(e) => updateNfeOps("xmlContent", e.target.value)}
                    rows={6}
                    data-testid="input-nfe-xml"
                  />
                  <Button
                    onClick={() => {
                      if (!nfeOps.xmlContent.trim()) {
                        toast.error("Informe o XML da NF-e");
                        return;
                      }
                      submitNfeMutation.mutate(nfeOps);
                    }}
                    disabled={submitNfeMutation.isPending}
                    data-testid="button-submit-nfe"
                  >
                    {submitNfeMutation.isPending && (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    )}
                    Enviar NF-e
                  </Button>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label>Chave de acesso</Label>
                    <Input
                      value={nfeOps.cancelAccessKey}
                      onChange={(e) =>
                        updateNfeOps("cancelAccessKey", e.target.value)
                      }
                      data-testid="input-nfe-cancel-key"
                    />
                  </div>
                  <div>
                    <Label>Protocolo (nProt)</Label>
                    <Input
                      value={nfeOps.cancelProtocol}
                      onChange={(e) =>
                        updateNfeOps("cancelProtocol", e.target.value)
                      }
                      data-testid="input-nfe-cancel-protocol"
                    />
                  </div>
                  <div>
                    <Label>Justificativa</Label>
                    <Input
                      value={nfeOps.cancelReason}
                      onChange={(e) =>
                        updateNfeOps("cancelReason", e.target.value)
                      }
                      data-testid="input-nfe-cancel-reason"
                    />
                  </div>
                </div>
                <Button
                  variant="destructive"
                  onClick={() => {
                    if (
                      nfeOps.cancelReason.trim().length < 15 ||
                      nfeOps.cancelAccessKey.trim().length !== 44
                    ) {
                      toast.error(
                        "Informe chave (44 digitos) e justificativa (min 15)"
                      );
                      return;
                    }
                    cancelNfeMutation.mutate(nfeOps);
                  }}
                  disabled={cancelNfeMutation.isPending}
                  data-testid="button-cancel-nfe"
                >
                  {cancelNfeMutation.isPending && (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  )}
                  Cancelar NF-e
                </Button>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label>Chave de acesso (CC-e)</Label>
                    <Input
                      value={nfeOps.cceAccessKey}
                      onChange={(e) =>
                        updateNfeOps("cceAccessKey", e.target.value)
                      }
                      data-testid="input-nfe-cce-key"
                    />
                  </div>
                  <div>
                    <Label>Sequencia</Label>
                    <Input
                      value={nfeOps.cceSequence}
                      onChange={(e) =>
                        updateNfeOps("cceSequence", e.target.value)
                      }
                      data-testid="input-nfe-cce-seq"
                    />
                  </div>
                  <div>
                    <Label>Texto da correcao</Label>
                    <Input
                      value={nfeOps.cceText}
                      onChange={(e) => updateNfeOps("cceText", e.target.value)}
                      data-testid="input-nfe-cce-text"
                    />
                  </div>
                </div>
                <Button
                  onClick={() => {
                    if (
                      nfeOps.cceAccessKey.trim().length !== 44 ||
                      nfeOps.cceText.trim().length < 15
                    ) {
                      toast.error(
                        "Informe chave (44 digitos) e texto (min 15)"
                      );
                      return;
                    }
                    cceNfeMutation.mutate(nfeOps);
                  }}
                  disabled={cceNfeMutation.isPending}
                  data-testid="button-cce-nfe"
                >
                  {cceNfeMutation.isPending && (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  )}
                  Enviar CC-e
                </Button>

                <div className="grid grid-cols-4 gap-4">
                  <div>
                    <Label>Serie</Label>
                    <Input
                      value={nfeOps.inutilizeSeries}
                      onChange={(e) =>
                        updateNfeOps("inutilizeSeries", e.target.value)
                      }
                      data-testid="input-nfe-inut-serie"
                    />
                  </div>
                  <div>
                    <Label>Numero inicial</Label>
                    <Input
                      value={nfeOps.inutilizeStart}
                      onChange={(e) =>
                        updateNfeOps("inutilizeStart", e.target.value)
                      }
                      data-testid="input-nfe-inut-start"
                    />
                  </div>
                  <div>
                    <Label>Numero final</Label>
                    <Input
                      value={nfeOps.inutilizeEnd}
                      onChange={(e) =>
                        updateNfeOps("inutilizeEnd", e.target.value)
                      }
                      data-testid="input-nfe-inut-end"
                    />
                  </div>
                  <div>
                    <Label>Justificativa</Label>
                    <Input
                      value={nfeOps.inutilizeReason}
                      onChange={(e) =>
                        updateNfeOps("inutilizeReason", e.target.value)
                      }
                      data-testid="input-nfe-inut-reason"
                    />
                  </div>
                </div>
                <Button
                  onClick={() => {
                    if (
                      !nfeOps.inutilizeSeries.trim() ||
                      !nfeOps.inutilizeStart.trim() ||
                      !nfeOps.inutilizeEnd.trim() ||
                      nfeOps.inutilizeReason.trim().length < 15
                    ) {
                      toast.error(
                        "Preencha serie, intervalo e justificativa (min 15)"
                      );
                      return;
                    }
                    inutilizeNfeMutation.mutate(nfeOps);
                  }}
                  disabled={inutilizeNfeMutation.isPending}
                  data-testid="button-inutilize-nfe"
                >
                  {inutilizeNfeMutation.isPending && (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  )}
                  Inutilizar numeracao
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* NFC-e */}
          <TabsContent value="nfce" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Gestao de NFC-e</CardTitle>
                <CardDescription>
                  NFC-e geradas automaticamente a partir das vendas do PDV
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Alert>
                  <Check className="h-4 w-4" />
                  <AlertDescription>
                    A emissao e automatica no PDV. Esta tela e apenas para gestao.
                  </AlertDescription>
                </Alert>

                <div className="flex items-center gap-2">
                  <Button
                    onClick={handleBatchSend}
                    disabled={sendNfceMutation.isPending}
                    data-testid="button-send-nfce-batch"
                  >
                    {sendNfceMutation.isPending && (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    )}
                    Enviar selecionadas
                  </Button>
                </div>

                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-8" />
                        <TableHead>ID</TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Valor</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Protocolo</TableHead>
                        <TableHead>Erro</TableHead>
                        <TableHead>Acoes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {isLoadingSales ? (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center">
                            Carregando NFC-e...
                          </TableCell>
                        </TableRow>
                      ) : nfceSales.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center">
                            Nenhuma NFC-e encontrada
                          </TableCell>
                        </TableRow>
                      ) : (
                        nfceSales.map((sale) => {
                          const normalizedStatus = normalizeNfceStatus(
                            sale.nfceStatus
                          );
                          const canSend =
                            normalizedStatus === "Pendente" ||
                            normalizedStatus === "Rejeitada";
                          const canCancel = normalizedStatus === "Autorizada";
                          return (
                            <TableRow key={sale.id}>
                              <TableCell>
                                <Checkbox
                                  checked={selectedNfceIds.includes(sale.id)}
                                  onCheckedChange={(checked) =>
                                    toggleSelectNfce(sale.id, !!checked)
                                  }
                                  data-testid={`checkbox-nfce-${sale.id}`}
                                />
                              </TableCell>
                              <TableCell>{sale.id}</TableCell>
                              <TableCell>{sale.customerName}</TableCell>
                              <TableCell>
                                R$ {parseFloat(sale.total).toFixed(2)}
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline">
                                  {normalizedStatus}
                                </Badge>
                              </TableCell>
                              <TableCell>{sale.nfceProtocol || "-"}</TableCell>
                              <TableCell>{sale.nfceError || "-"}</TableCell>
                              <TableCell>
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    variant="secondary"
                                    disabled={!canSend || sendNfceMutation.isPending}
                                    onClick={() => sendNfceMutation.mutate([sale.id])}
                                    data-testid={`button-send-nfce-${sale.id}`}
                                  >
                                    {normalizedStatus === "Rejeitada"
                                      ? "Reenviar"
                                      : "Enviar"}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    disabled={!canCancel || cancelNfceMutation.isPending}
                                    onClick={() => {
                                      if (!sale.nfceKey || !sale.nfceProtocol) {
                                        toast.error(
                                          "NFC-e sem chave ou protocolo. Nao e possivel cancelar."
                                        );
                                        return;
                                      }
                                      setCancelNfceDialog({
                                        open: true,
                                        saleId: sale.id,
                                        reason: "",
                                      });
                                    }}
                                    data-testid={`button-cancel-nfce-${sale.id}`}
                                  >
                                    Cancelar
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>

                <Dialog
                  open={cancelNfceDialog.open}
                  onOpenChange={(open) =>
                    setCancelNfceDialog((prev) => ({ ...prev, open }))
                  }
                >
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Cancelar NFC-e</DialogTitle>
                      <DialogDescription>
                        Informe a justificativa do cancelamento (min 15
                        caracteres).
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-2">
                      <Label>Justificativa</Label>
                      <Textarea
                        value={cancelNfceDialog.reason}
                        onChange={(e) =>
                          setCancelNfceDialog((prev) => ({
                            ...prev,
                            reason: e.target.value,
                          }))
                        }
                        rows={4}
                        data-testid="input-cancel-nfce-reason"
                      />
                    </div>
                    <DialogFooter>
                      <Button
                        variant="destructive"
                        onClick={() => {
                          if (cancelNfceDialog.reason.trim().length < 15) {
                            toast.error(
                              "Justificativa obrigatoria (min 15 caracteres)"
                            );
                            return;
                          }
                          cancelNfceMutation.mutate({
                            saleId: cancelNfceDialog.saleId,
                            reason: cancelNfceDialog.reason.trim(),
                          });
                        }}
                        disabled={cancelNfceMutation.isPending}
                        data-testid="button-confirm-cancel-nfce"
                      >
                        {cancelNfceMutation.isPending && (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        )}
                        Confirmar cancelamento
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                <Card>
                  <CardHeader>
                    <CardTitle>Inutilizar numeracao</CardTitle>
                    <CardDescription>
                      Use quando houver lacuna de numeracao
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <Label>Serie</Label>
                        <Input
                          value={inutilizeForm.serie}
                          onChange={(e) =>
                            setInutilizeForm({
                              ...inutilizeForm,
                              serie: e.target.value,
                            })
                          }
                          data-testid="input-inutilize-serie"
                        />
                      </div>
                      <div>
                        <Label>Numero inicial</Label>
                        <Input
                          value={inutilizeForm.startNumber}
                          onChange={(e) =>
                            setInutilizeForm({
                              ...inutilizeForm,
                              startNumber: e.target.value,
                            })
                          }
                          data-testid="input-inutilize-start"
                        />
                      </div>
                      <div>
                        <Label>Numero final</Label>
                        <Input
                          value={inutilizeForm.endNumber}
                          onChange={(e) =>
                            setInutilizeForm({
                              ...inutilizeForm,
                              endNumber: e.target.value,
                            })
                          }
                          data-testid="input-inutilize-end"
                        />
                      </div>
                    </div>
                    <div>
                      <Label>Justificativa</Label>
                      <Input
                        value={inutilizeForm.reason}
                        onChange={(e) =>
                          setInutilizeForm({
                            ...inutilizeForm,
                            reason: e.target.value,
                          })
                        }
                        data-testid="input-inutilize-reason"
                      />
                    </div>
                    <Button
                      onClick={() => inutilizeNfceMutation.mutate(inutilizeForm)}
                      disabled={inutilizeNfceMutation.isPending}
                      data-testid="button-inutilize-nfce"
                    >
                      {inutilizeNfceMutation.isPending && (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      )}
                      Inutilizar numeracao
                    </Button>
                  </CardContent>
                </Card>
              </CardContent>
            </Card>
          </TabsContent>

                    {/* NFS-e */}
          <TabsContent value="nfse" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Cabecalho da Nota</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-3">
                <div>
                  <Label>Tipo de documento</Label>
                  <Input value="NFS-e" disabled />
                </div>
                <div>
                  <Label>Tipo de operacao</Label>
                  <Select value={nfseOperationType} onValueChange={setNfseOperationType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="prestacao">Prestacao</SelectItem>
                      <SelectItem value="cancelamento">Cancelamento</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Numero</Label>
                  <Input value={nfseNumber} disabled />
                </div>
                <div>
                  <Label>Serie</Label>
                  <Input value={nfseSeries} disabled />
                </div>
                <div>
                  <Label>Data de emissao</Label>
                  <Input
                    type="date"
                    value={nfseIssueDate}
                    onChange={(e) => setNfseIssueDate(e.target.value)}
                  />
                </div>
                <div>
                  <Label>Ambiente</Label>
                  <Select value={nfseEnvironment} onValueChange={setNfseEnvironment}>
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
                  <Label>Razao social</Label>
                  <Input value={companyName} disabled />
                </div>
                <div>
                  <Label>CNPJ</Label>
                  <Input value={companyCnpj} disabled />
                </div>
                <div>
                  <Label>IE</Label>
                  <Input value={companyIe} disabled />
                </div>
                <div>
                  <Label>IM</Label>
                  <Input value={companyIm} disabled />
                </div>
                <div>
                  <Label>Regime tributario</Label>
                  <Input value={companyRegime} disabled />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Destinatario / Tomador</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label>Tipo</Label>
                  <Select value={nfseCustomerType} onValueChange={setNfseCustomerType}>
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
                  <Label>Indicador IE</Label>
                  <Select
                    value={nfseCustomerIeIndicator}
                    onValueChange={setNfseCustomerIeIndicator}
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
                  <Label>Nome / Razao social</Label>
                  <Input
                    value={nfseCustomerName}
                    onChange={(e) => setNfseCustomerName(e.target.value)}
                    placeholder="Nome do tomador"
                  />
                </div>
                <div>
                  <Label>{nfseCustomerType === "pf" ? "CPF" : "CNPJ"}</Label>
                  <Input
                    value={nfseCustomerDocument}
                    onChange={(e) => setNfseCustomerDocument(e.target.value)}
                    placeholder={
                      nfseCustomerType === "pf"
                        ? "000.000.000-00"
                        : "00.000.000/0000-00"
                    }
                  />
                </div>
                <div>
                  <Label>CEP</Label>
                  <Input
                    value={nfseCustomerZip}
                    onChange={(e) => setNfseCustomerZip(e.target.value)}
                    placeholder="00000-000"
                  />
                </div>
                <div>
                  <Label>Endereco</Label>
                  <Input
                    value={nfseCustomerAddress}
                    onChange={(e) => setNfseCustomerAddress(e.target.value)}
                    placeholder="Endereco do tomador"
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Itens (servicos)</CardTitle>
                <Button variant="outline" size="sm" onClick={addNfseItem}>
                  <Plus className="mr-2 h-4 w-4" /> Adicionar
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                {nfseItems.map((item) => (
                  <div key={item.id} className="grid gap-3 md:grid-cols-12 items-end">
                    <div className="md:col-span-2">
                      <Label>Codigo</Label>
                      <Input
                        value={item.code}
                        onChange={(e) => updateNfseItem(item.id, "code", e.target.value)}
                        placeholder="Codigo"
                      />
                    </div>
                    <div className="md:col-span-4">
                      <Label>Descricao</Label>
                      <Input
                        value={item.description}
                        onChange={(e) => updateNfseItem(item.id, "description", e.target.value)}
                        placeholder="Descricao do servico"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <Label>Quantidade</Label>
                      <Input
                        value={item.quantity}
                        onChange={(e) => updateNfseItem(item.id, "quantity", e.target.value)}
                        type="number"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <Label>Valor unitario</Label>
                      <Input
                        value={item.unitPrice}
                        onChange={(e) => updateNfseItem(item.id, "unitPrice", e.target.value)}
                        type="number"
                        step="0.01"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <Label>Desconto</Label>
                      <Input
                        value={item.discount}
                        onChange={(e) => updateNfseItem(item.id, "discount", e.target.value)}
                        type="number"
                        step="0.01"
                      />
                    </div>
                    <div className="md:col-span-3">
                      <Label>Codigo de servico</Label>
                      <Input
                        value={item.serviceCode}
                        onChange={(e) => updateNfseItem(item.id, "serviceCode", e.target.value)}
                        placeholder="Codigo"
                      />
                    </div>
                    <div className="md:col-span-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeNfseItem(item.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Impostos</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Total de impostos</span>
                  <span className="text-lg font-semibold">R$ {nfseTaxes.toFixed(2)}</span>
                </div>
                <Button
                  variant="outline"
                  onClick={() => setNfseShowTaxDetails(!nfseShowTaxDetails)}
                >
                  {nfseShowTaxDetails ? "Ocultar detalhes" : "Ver detalhes"}
                </Button>
                {nfseShowTaxDetails && (
                  <div className="space-y-2">
                    {nfseItems.map((item) => {
                      const quantity = parseFloat(item.quantity || "0");
                      const unitPrice = parseFloat(item.unitPrice || "0");
                      const discount = parseFloat(item.discount || "0");
                      const base = Math.max(0, quantity * unitPrice - discount);
                      const imposto = base * 0.05;
                      return (
                        <div key={item.id} className="text-sm flex justify-between">
                          <span>{item.description || "Servico"}</span>
                          <span>R$ {imposto.toFixed(2)}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Totais da Nota</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-3">
                <div>
                  <Label>Servicos</Label>
                  <Input value={`R$ ${nfseSubtotal.toFixed(2)}`} disabled />
                </div>
                <div>
                  <Label>Impostos</Label>
                  <Input value={`R$ ${nfseTaxes.toFixed(2)}`} disabled />
                </div>
                <div>
                  <Label>Valor total</Label>
                  <Input value={`R$ ${nfseTotal.toFixed(2)}`} disabled />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Pagamento</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label>Forma</Label>
                  <Select value={nfsePaymentForm} onValueChange={setNfsePaymentForm}>
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
                  <Label>Condicao</Label>
                  <Select value={nfsePaymentCondition} onValueChange={setNfsePaymentCondition}>
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

            <Card>
              <CardHeader>
                <CardTitle>Observacoes</CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={nfseAdditionalInfo}
                  onChange={(e) => setNfseAdditionalInfo(e.target.value)}
                  placeholder="Informacoes complementares"
                />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
