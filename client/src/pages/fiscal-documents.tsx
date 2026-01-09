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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Plus, AlertCircle, Check } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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

  const cancelNfceMutation = useMutation<any, Error, number>({
    mutationFn: async (saleId) => {
      const res = await fetch("/api/fiscal/nfce/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ saleId }),
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
                                    onClick={() => cancelNfceMutation.mutate(sale.id)}
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
                <CardTitle>Emitir NFS-e</CardTitle>
                <CardDescription>
                  Nota Fiscal de Serviço Eletrônica
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    NFS-e em desenvolvimento. Requer integração com prefeitura
                    municipal.
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
