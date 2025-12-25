import { useState, useEffect, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import {
  Plus,
  Trash2,
  ImagePlus,
  Package,
  Search,
  Loader2,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

const productFormSchema = z.object({
  ean: z.string().min(1, "Código EAN é obrigatório"),
  name: z.string().min(1, "Nome é obrigatório"),
  sku: z.string().optional(),
  category: z.string().min(1, "Categoria é obrigatória"),
  unit: z.string().default("UN"),
  brand: z.string().optional(),
  type: z.string().optional(),
  ncm: z.string().min(1, "NCM é obrigatório"),
  serviceCode: z.string().optional(),
  cest: z.string().min(1, "CEST é obrigatório"),
  csosnCode: z.string().optional(),
  origin: z.string().default("nacional"),
  description: z.string().optional(),
  mainImageUrl: z.string().optional(),
  purchasePrice: z.string().optional(),
  margin: z.string().optional(),
  price: z.string().min(1, "Preço de venda é obrigatório"),
  promoPrice: z.string().optional(),
  stock: z.number().default(0),
  minStock: z.number().optional().nullable(),
  maxStock: z.number().optional().nullable(),
  isKit: z.boolean().default(false),
  isActive: z.boolean().default(true),
  supplierId: z.number().optional().nullable(),
});

type ProductFormData = z.infer<typeof productFormSchema>;

interface Variation {
  name: string;
  sku?: string;
  attributes?: Record<string, string>;
  extraPrice?: string;
  stock: number;
}

interface MediaItem {
  url: string;
  isPrimary: boolean;
}

interface KitItemData {
  productId: number;
  productName?: string;
  quantity: number;
}

interface ProductFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editProduct?: any;
}

const categories = [
  "Alimentos",
  "Bebidas",
  "Limpeza",
  "Higiene",
  "Eletrônicos",
  "Vestuário",
  "Outros",
];

const units = [
  { value: "UN", label: "Unidade (UN)" },
  { value: "KG", label: "Quilograma (KG)" },
  { value: "L", label: "Litro (L)" },
  { value: "M", label: "Metro (M)" },
  { value: "CX", label: "Caixa (CX)" },
  { value: "PCT", label: "Pacote (PCT)" },
  { value: "DZ", label: "Dúzia (DZ)" },
];

const variationAttributes = [
  { key: "weight", label: "Peso" },
  { key: "color", label: "Cor" },
  { key: "size", label: "Tamanho" },
];

export default function ProductForm({
  open,
  onOpenChange,
  editProduct,
}: ProductFormProps) {
  const queryClient = useQueryClient();
  const [variations, setVariations] = useState<Variation[]>([]);
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [kitItemsList, setKitItemsList] = useState<KitItemData[]>([]);
  const [newImageUrl, setNewImageUrl] = useState("");
  const [selectedKitProduct, setSelectedKitProduct] = useState<string>("");
  const [kitQuantity, setKitQuantity] = useState(1);
  const [isLookingUpEan, setIsLookingUpEan] = useState(false);
  const [eanLookupError, setEanLookupError] = useState<string | null>(null);

  const { data: suppliers = [] } = useQuery({
    queryKey: ["/api/suppliers"],
    queryFn: async () => {
      const res = await fetch("/api/suppliers");
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const { data: allProducts = [] } = useQuery({
    queryKey: ["/api/products"],
    queryFn: async () => {
      const res = await fetch("/api/products");
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const { data: csosns = [] } = useQuery({
    queryKey: ["/api/csosn-codes"],
    queryFn: async () => {
      const res = await fetch("/api/csosn-codes");
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const form = useForm<ProductFormData>({
    resolver: zodResolver(productFormSchema),
    defaultValues: {
      ean: "",
      name: "",
      sku: "",
      category: "",
      unit: "UN",
      brand: "",
      type: "",
      ncm: "",
      serviceCode: "",
      cest: "",
      origin: "nacional",
      description: "",
      mainImageUrl: "",
      purchasePrice: "",
      margin: "",
      price: "",
      promoPrice: "",
      stock: 0,
      minStock: 10,
      maxStock: 100,
      isKit: false,
      isActive: true,
    },
  });

  const watchPurchasePrice = form.watch("purchasePrice");
  const watchMargin = form.watch("margin");
  const watchPrice = form.watch("price");
  const watchIsKit = form.watch("isKit");
  const watchProductName = form.watch("name");

  const lookupEanProduct = useCallback(
    async (ean: string) => {
      if (!ean || ean.length < 8) return;

      setIsLookingUpEan(true);
      setEanLookupError(null);

      try {
        const res = await fetch(`/api/ean/${ean}`);
        if (res.ok) {
          const data = await res.json();
          if (data.name && !form.getValues("name")) {
            form.setValue("name", data.name);
          }
          if (data.brand && !form.getValues("brand")) {
            form.setValue("brand", data.brand);
          }
          if (data.description && !form.getValues("description")) {
            form.setValue("description", data.description);
          }
          if (data.ncm && !form.getValues("ncm")) {
            form.setValue("ncm", data.ncm);
          }
          if (data.cest && !form.getValues("cest")) {
            form.setValue("cest", data.cest);
          }
          if (data.thumbnail && !form.getValues("mainImageUrl")) {
            form.setValue("mainImageUrl", data.thumbnail);
          }
          toast.success("Produto encontrado!");

          // Try to lookup fiscal data by the product name
          const productName = data.name || form.getValues("name");
          if (productName && productName.length > 2) {
            try {
              const fiscalRes = await fetch(
                `/api/products/fiscal/${encodeURIComponent(productName)}`
              );
              if (fiscalRes.ok) {
                const fiscalData = await fiscalRes.json();
                if (fiscalData.ncm && !form.getValues("ncm")) {
                  form.setValue("ncm", fiscalData.ncm);
                }
                if (fiscalData.cest && !form.getValues("cest")) {
                  form.setValue("cest", fiscalData.cest);
                }
              }
            } catch (error) {
              // Silent fail
            }
          }
        } else if (res.status === 404) {
          setEanLookupError(
            "EAN não encontrado em nossas bases (BrasilAPI, OpenFoodFacts, EANCode). Você pode preencher os dados manualmente. Dica: Digite o nome do produto para busca automática de NCM e origem"
          );
        } else {
          setEanLookupError("Erro ao buscar produto. Tente novamente");
        }
      } catch (error) {
        setEanLookupError("Erro de conexão. Verifique sua internet");
      } finally {
        setIsLookingUpEan(false);
      }
    },
    [form]
  );

  const lookupFiscalDataByName = useCallback(
    async (productName: string) => {
      if (!productName || productName.length < 2) return;

      try {
        const res = await fetch(
          `/api/products/fiscal/${encodeURIComponent(productName)}`
        );
        if (res.ok) {
          const data = await res.json();
          if (data.ncm && !form.getValues("ncm")) {
            form.setValue("ncm", data.ncm);
          }
          if (data.serviceCode && !form.getValues("serviceCode")) {
            form.setValue("serviceCode", data.serviceCode);
          }
          if (data.cest && !form.getValues("cest")) {
            form.setValue("cest", data.cest);
          }
          if (data.origin && !form.getValues("origin")) {
            form.setValue("origin", data.origin);
          }
        }
      } catch (error) {
        // Silent fail for auto-lookup
      }
    },
    [form]
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      if (watchProductName && watchProductName.length > 2 && !editProduct) {
        lookupFiscalDataByName(watchProductName);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [watchProductName, editProduct, lookupFiscalDataByName]);

  useEffect(() => {
    if (watchPurchasePrice && watchMargin) {
      const purchase = parseFloat(watchPurchasePrice);
      const margin = parseFloat(watchMargin);
      if (purchase > 0 && margin > 0) {
        const salePrice = purchase * (1 + margin / 100);
        form.setValue("price", salePrice.toFixed(2));
      }
    }
  }, [watchPurchasePrice, watchMargin, form]);

  useEffect(() => {
    if (watchPurchasePrice && watchPrice) {
      const purchase = parseFloat(watchPurchasePrice);
      const sale = parseFloat(watchPrice);
      if (purchase > 0 && sale > 0 && sale > purchase) {
        const calculatedMargin = ((sale - purchase) / purchase) * 100;
        const currentMargin = parseFloat(watchMargin || "0");
        if (Math.abs(calculatedMargin - currentMargin) > 0.01) {
          form.setValue("margin", calculatedMargin.toFixed(2), {
            shouldValidate: false,
          });
        }
      }
    }
  }, [watchPrice]);

  useEffect(() => {
    if (editProduct) {
      form.reset({
        ean: editProduct.ean || "",
        name: editProduct.name || "",
        sku: editProduct.sku || "",
        category: editProduct.category || "",
        unit: editProduct.unit || "UN",
        brand: editProduct.brand || "",
        type: editProduct.type || "",
        ncm: editProduct.ncm || "",
        cest: editProduct.cest || "",
        description: editProduct.description || "",
        mainImageUrl: editProduct.mainImageUrl || "",
        purchasePrice: editProduct.purchasePrice || "",
        margin: editProduct.margin || "",
        price: editProduct.price || "",
        promoPrice: editProduct.promoPrice || "",
        stock: editProduct.stock || 0,
        minStock: editProduct.minStock || 10,
        maxStock: editProduct.maxStock || 100,
        isKit: editProduct.isKit || false,
        isActive: editProduct.isActive !== false,
        supplierId: editProduct.supplierId,
      });
      setVariations(editProduct.variations || []);
      setMediaItems(editProduct.media || []);
      setKitItemsList(editProduct.kitItems || []);
    } else {
      form.reset();
      setVariations([]);
      setMediaItems([]);
      setKitItemsList([]);
    }
  }, [editProduct, form, open]);

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const url = editProduct
        ? `/api/products/${editProduct.id}`
        : "/api/products";
      const method = editProduct ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to save product");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast.success(
        editProduct
          ? "Produto atualizado com sucesso!"
          : "Produto cadastrado com sucesso!"
      );
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const onSubmit = (data: ProductFormData) => {
    const primaryMedia = mediaItems.find((m) => m.isPrimary);
    const productData = {
      product: {
        ...data,
        mainImageUrl: primaryMedia?.url || data.mainImageUrl || null,
        purchasePrice: data.purchasePrice || null,
        margin: data.margin || null,
        promoPrice: data.promoPrice || null,
        supplierId: data.supplierId || null,
      },
      variations: variations.map((v) => ({
        name: v.name,
        sku: v.sku,
        attributes: v.attributes || {},
        extraPrice: v.extraPrice || "0",
        stock: v.stock,
      })),
      media: mediaItems.map((m) => ({
        url: m.url,
        isPrimary: m.isPrimary,
      })),
      kitItems: data.isKit
        ? kitItemsList.map((k) => ({
            productId: k.productId,
            quantity: k.quantity,
          }))
        : [],
    };
    createMutation.mutate(productData);
  };

  const onFormError = (errors: any) => {
    console.log("Form validation errors:", errors);
    const errorMessages = Object.entries(errors)
      .map(([field, error]: [string, any]) => `${field}: ${error?.message}`)
      .join(", ");
    toast.error(`Erros de validação: ${errorMessages}`);
  };

  const addVariation = () => {
    setVariations([...variations, { name: "", stock: 0, attributes: {} }]);
  };

  const removeVariation = (index: number) => {
    setVariations(variations.filter((_, i) => i !== index));
  };

  const updateVariation = (
    index: number,
    field: keyof Variation,
    value: any
  ) => {
    const updated = [...variations];
    updated[index] = { ...updated[index], [field]: value };
    setVariations(updated);
  };

  const updateVariationAttribute = (
    index: number,
    attrKey: string,
    value: string
  ) => {
    const updated = [...variations];
    updated[index] = {
      ...updated[index],
      attributes: { ...(updated[index].attributes || {}), [attrKey]: value },
    };
    setVariations(updated);
  };

  const addMedia = () => {
    if (newImageUrl.trim()) {
      setMediaItems([
        ...mediaItems,
        { url: newImageUrl.trim(), isPrimary: mediaItems.length === 0 },
      ]);
      setNewImageUrl("");
    }
  };

  const removeMedia = (index: number) => {
    const updated = mediaItems.filter((_, i) => i !== index);
    if (updated.length > 0 && !updated.some((m) => m.isPrimary)) {
      updated[0].isPrimary = true;
    }
    setMediaItems(updated);
  };

  const setPrimaryMedia = (index: number) => {
    const updated = mediaItems.map((m, i) => ({
      ...m,
      isPrimary: i === index,
    }));
    setMediaItems(updated);
  };

  const addKitItem = () => {
    if (selectedKitProduct && kitQuantity > 0) {
      const product = allProducts.find(
        (p: any) => p.id.toString() === selectedKitProduct
      );
      if (product && !kitItemsList.some((k) => k.productId === product.id)) {
        setKitItemsList([
          ...kitItemsList,
          {
            productId: product.id,
            productName: product.name,
            quantity: kitQuantity,
          },
        ]);
        setSelectedKitProduct("");
        setKitQuantity(1);
      }
    }
  };

  const removeKitItem = (productId: number) => {
    setKitItemsList(kitItemsList.filter((k) => k.productId !== productId));
  };

  const updateKitItemQuantity = (productId: number, quantity: number) => {
    setKitItemsList(
      kitItemsList.map((k) =>
        k.productId === productId ? { ...k, quantity } : k
      )
    );
  };

  const availableProducts = allProducts.filter(
    (p: any) =>
      p.id !== editProduct?.id &&
      !p.isKit &&
      !kitItemsList.some((k) => k.productId === p.id)
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>
            {editProduct ? "Editar Produto" : "Novo Produto"}
          </DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[75vh] pr-4">
          <form
            onSubmit={form.handleSubmit(onSubmit, onFormError)}
            className="space-y-6"
          >
            <Tabs defaultValue="basic" className="w-full">
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="basic">Dados Básicos</TabsTrigger>
                <TabsTrigger value="pricing">Preços</TabsTrigger>
                <TabsTrigger value="variations">Variações</TabsTrigger>
                <TabsTrigger value="kit" disabled={!watchIsKit}>
                  Kit
                </TabsTrigger>
                <TabsTrigger value="media">Fotos</TabsTrigger>
              </TabsList>

              <TabsContent value="basic" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="ean">Código de Barras (EAN) *</Label>
                  <div className="flex gap-2">
                    <Input
                      id="ean"
                      {...form.register("ean")}
                      placeholder="7891234567890"
                      data-testid="input-ean"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          lookupEanProduct(form.getValues("ean") || "");
                        }
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() =>
                        lookupEanProduct(form.getValues("ean") || "")
                      }
                      disabled={isLookingUpEan}
                      data-testid="button-ean-lookup"
                    >
                      {isLookingUpEan ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Search className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  {form.formState.errors.ean && (
                    <p className="text-sm text-destructive">
                      {form.formState.errors.ean.message}
                    </p>
                  )}
                  {eanLookupError && (
                    <p className="text-sm text-amber-600">{eanLookupError}</p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Nome do Produto *</Label>
                    <Input
                      id="name"
                      {...form.register("name")}
                      placeholder="Ex: Arroz Integral 5kg"
                    />
                    {form.formState.errors.name && (
                      <p className="text-sm text-destructive">
                        {form.formState.errors.name.message}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="category">Categoria *</Label>
                    <Select
                      value={form.watch("category")}
                      onValueChange={(value) =>
                        form.setValue("category", value)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione uma categoria" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((cat) => (
                          <SelectItem key={cat} value={cat}>
                            {cat}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {form.formState.errors.category && (
                      <p className="text-sm text-destructive">
                        {form.formState.errors.category.message}
                      </p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="sku">SKU</Label>
                    <Input
                      id="sku"
                      {...form.register("sku")}
                      placeholder="PROD-001"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="unit">Unidade</Label>
                    <Select
                      value={form.watch("unit")}
                      onValueChange={(value) => form.setValue("unit", value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {units.map((unit) => (
                          <SelectItem key={unit.value} value={unit.value}>
                            {unit.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="brand">Marca</Label>
                    <Input
                      id="brand"
                      {...form.register("brand")}
                      placeholder="Ex: Tio João"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="csosnCode">CSOSN *</Label>
                    <Select
                      value={form.watch("csosnCode")}
                      onValueChange={(value) =>
                        form.setValue("csosnCode", value)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o CSOSN" />
                      </SelectTrigger>
                      <SelectContent>
                        {csosns.map((c: any) => (
                          <SelectItem key={c.code} value={c.code}>
                            {c.code} - {c.description}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="origin">Origem da Mercadoria</Label>
                    <Select
                      value={form.watch("origin") || "nacional"}
                      onValueChange={(value) => form.setValue("origin", value)}
                    >
                      <SelectTrigger data-testid="select-origin">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="nacional">Nacional</SelectItem>
                        <SelectItem value="importada">Importada</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="ncm">NCM (Produto) *</Label>
                    <Input
                      id="ncm"
                      {...form.register("ncm")}
                      placeholder="1006.30.21"
                      data-testid="input-ncm"
                    />
                    {form.formState.errors.ncm && (
                      <p className="text-sm text-destructive">
                        {form.formState.errors.ncm.message}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cest">CEST *</Label>
                    <Input
                      id="cest"
                      {...form.register("cest")}
                      placeholder="17.001.00"
                      data-testid="input-cest"
                    />
                    {form.formState.errors.cest && (
                      <p className="text-sm text-destructive">
                        {form.formState.errors.cest.message}
                      </p>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="serviceCode">
                    Código de Serviço (LC 116)
                  </Label>
                  <Input
                    id="serviceCode"
                    {...form.register("serviceCode")}
                    placeholder="01.01"
                    data-testid="input-service-code"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Descrição</Label>
                  <Textarea
                    id="description"
                    {...form.register("description")}
                    placeholder="Descrição detalhada do produto..."
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="supplierId">Fornecedor</Label>
                  <Select
                    value={form.watch("supplierId")?.toString() || ""}
                    onValueChange={(value) =>
                      form.setValue("supplierId", parseInt(value))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um fornecedor" />
                    </SelectTrigger>
                    <SelectContent>
                      {suppliers.map((supplier: any) => (
                        <SelectItem
                          key={supplier.id}
                          value={supplier.id.toString()}
                        >
                          {supplier.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center gap-6">
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="isKit"
                      checked={form.watch("isKit")}
                      onCheckedChange={(checked) =>
                        form.setValue("isKit", checked)
                      }
                    />
                    <Label htmlFor="isKit">É um Kit/Combo</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="isActive"
                      checked={form.watch("isActive")}
                      onCheckedChange={(checked) =>
                        form.setValue("isActive", checked)
                      }
                    />
                    <Label htmlFor="isActive">Ativo</Label>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="pricing" className="space-y-4 mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Formação de Preço</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="purchasePrice">
                          Preço de Compra (R$)
                        </Label>
                        <Input
                          id="purchasePrice"
                          {...form.register("purchasePrice")}
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="margin">Margem (%)</Label>
                        <Input
                          id="margin"
                          {...form.register("margin")}
                          type="number"
                          step="0.01"
                          placeholder="30"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="price">Preço de Venda (R$) *</Label>
                        <Input
                          id="price"
                          {...form.register("price")}
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                        />
                        {form.formState.errors.price && (
                          <p className="text-sm text-destructive">
                            {form.formState.errors.price.message}
                          </p>
                        )}
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Preencha o preço de compra e margem para calcular
                      automaticamente o preço de venda, ou edite o preço de
                      venda diretamente.
                    </p>
                    <div className="space-y-2">
                      <Label htmlFor="promoPrice">Preço Promocional (R$)</Label>
                      <Input
                        id="promoPrice"
                        {...form.register("promoPrice")}
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                      />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">
                      Controle de Estoque
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="stock">Estoque Inicial</Label>
                        <Input
                          id="stock"
                          type="number"
                          {...form.register("stock", { valueAsNumber: true })}
                          disabled={!!editProduct}
                        />
                        {editProduct && (
                          <p className="text-xs text-muted-foreground">
                            Estoque atual: {editProduct.stock} un
                          </p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="minStock">Estoque Mínimo</Label>
                        <Input
                          id="minStock"
                          type="number"
                          {...form.register("minStock", {
                            valueAsNumber: true,
                          })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="maxStock">Estoque Máximo</Label>
                        <Input
                          id="maxStock"
                          type="number"
                          {...form.register("maxStock", {
                            valueAsNumber: true,
                          })}
                        />
                      </div>
                    </div>
                    {editProduct && (
                      <div className="p-3 bg-amber-50 border border-amber-200 rounded-md text-sm text-amber-800">
                        <strong>Nota:</strong> Para alterar o estoque, use a
                        função "Ajustar Estoque" no menu de ações do produto.
                        Isso garante o registro correto das movimentações para
                        fins fiscais e de auditoria.
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="variations" className="space-y-4 mt-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="text-lg">
                      Variações do Produto
                    </CardTitle>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addVariation}
                    >
                      <Plus className="h-4 w-4 mr-2" /> Adicionar Variação
                    </Button>
                  </CardHeader>
                  <CardContent>
                    {variations.length === 0 ? (
                      <p className="text-muted-foreground text-center py-8">
                        Nenhuma variação cadastrada. Adicione variações como
                        peso, cor ou tamanho.
                      </p>
                    ) : (
                      <div className="space-y-4">
                        {variations.map((variation, index) => (
                          <div
                            key={index}
                            className="border rounded-lg p-4 space-y-3"
                          >
                            <div className="flex justify-between items-start">
                              <span className="font-medium">
                                Variação {index + 1}
                              </span>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => removeVariation(index)}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                            <div className="grid grid-cols-4 gap-3">
                              <div className="space-y-1">
                                <Label>Nome *</Label>
                                <Input
                                  value={variation.name}
                                  onChange={(e) =>
                                    updateVariation(
                                      index,
                                      "name",
                                      e.target.value
                                    )
                                  }
                                  placeholder="Ex: 500g"
                                />
                              </div>
                              <div className="space-y-1">
                                <Label>SKU</Label>
                                <Input
                                  value={variation.sku || ""}
                                  onChange={(e) =>
                                    updateVariation(
                                      index,
                                      "sku",
                                      e.target.value
                                    )
                                  }
                                  placeholder="PROD-001-V1"
                                />
                              </div>
                              <div className="space-y-1">
                                <Label>Preço Extra (R$)</Label>
                                <Input
                                  type="number"
                                  step="0.01"
                                  value={variation.extraPrice || ""}
                                  onChange={(e) =>
                                    updateVariation(
                                      index,
                                      "extraPrice",
                                      e.target.value
                                    )
                                  }
                                  placeholder="0.00"
                                />
                              </div>
                              <div className="space-y-1">
                                <Label>Estoque</Label>
                                <Input
                                  type="number"
                                  value={variation.stock}
                                  onChange={(e) =>
                                    updateVariation(
                                      index,
                                      "stock",
                                      parseInt(e.target.value) || 0
                                    )
                                  }
                                />
                              </div>
                            </div>
                            <div className="grid grid-cols-3 gap-3">
                              {variationAttributes.map((attr) => (
                                <div key={attr.key} className="space-y-1">
                                  <Label>{attr.label}</Label>
                                  <Input
                                    value={
                                      variation.attributes?.[attr.key] || ""
                                    }
                                    onChange={(e) =>
                                      updateVariationAttribute(
                                        index,
                                        attr.key,
                                        e.target.value
                                      )
                                    }
                                    placeholder={`Ex: ${
                                      attr.key === "weight"
                                        ? "500g"
                                        : attr.key === "color"
                                        ? "Azul"
                                        : "M"
                                    }`}
                                  />
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="kit" className="space-y-4 mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Composição do Kit</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex gap-2">
                      <Select
                        value={selectedKitProduct}
                        onValueChange={setSelectedKitProduct}
                      >
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder="Selecione um produto" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableProducts.map((product: any) => (
                            <SelectItem
                              key={product.id}
                              value={product.id.toString()}
                            >
                              {product.name} - R${" "}
                              {parseFloat(product.price).toFixed(2)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        type="number"
                        min="1"
                        value={kitQuantity}
                        onChange={(e) =>
                          setKitQuantity(parseInt(e.target.value) || 1)
                        }
                        className="w-24"
                        placeholder="Qtd"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={addKitItem}
                      >
                        <Plus className="h-4 w-4 mr-2" /> Adicionar
                      </Button>
                    </div>

                    {kitItemsList.length === 0 ? (
                      <p className="text-muted-foreground text-center py-8">
                        Nenhum produto adicionado ao kit. Selecione produtos
                        acima para compor o kit.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {kitItemsList.map((item) => {
                          const product = allProducts.find(
                            (p: any) => p.id === item.productId
                          );
                          return (
                            <div
                              key={item.productId}
                              className="flex items-center justify-between border rounded-lg p-3"
                            >
                              <div className="flex items-center gap-3">
                                <Package className="h-5 w-5 text-muted-foreground" />
                                <div>
                                  <p className="font-medium">
                                    {product?.name || item.productName}
                                  </p>
                                  <p className="text-sm text-muted-foreground">
                                    R${" "}
                                    {product
                                      ? parseFloat(product.price).toFixed(2)
                                      : "0.00"}{" "}
                                    cada
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Input
                                  type="number"
                                  min="1"
                                  value={item.quantity}
                                  onChange={(e) =>
                                    updateKitItemQuantity(
                                      item.productId,
                                      parseInt(e.target.value) || 1
                                    )
                                  }
                                  className="w-20"
                                />
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => removeKitItem(item.productId)}
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="media" className="space-y-4 mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Fotos do Produto</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex gap-2">
                      <Input
                        value={newImageUrl}
                        onChange={(e) => setNewImageUrl(e.target.value)}
                        placeholder="Cole a URL da imagem aqui..."
                        className="flex-1"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={addMedia}
                      >
                        <ImagePlus className="h-4 w-4 mr-2" /> Adicionar
                      </Button>
                    </div>
                    {mediaItems.length === 0 ? (
                      <p className="text-muted-foreground text-center py-8">
                        Nenhuma foto cadastrada. Adicione URLs de imagens do
                        produto.
                      </p>
                    ) : (
                      <div className="grid grid-cols-4 gap-4">
                        {mediaItems.map((item, index) => (
                          <div
                            key={index}
                            className={`relative border rounded-lg overflow-hidden ${
                              item.isPrimary ? "ring-2 ring-primary" : ""
                            }`}
                          >
                            <img
                              src={item.url}
                              alt={`Foto ${index + 1}`}
                              className="w-full h-24 object-cover"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src =
                                  "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100'><rect fill='%23f3f4f6' width='100' height='100'/><text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' fill='%239ca3af'>Erro</text></svg>";
                              }}
                            />
                            <div className="absolute top-1 right-1 flex gap-1">
                              <Button
                                type="button"
                                size="icon"
                                variant="secondary"
                                className="h-6 w-6"
                                onClick={() => setPrimaryMedia(index)}
                                title="Definir como principal"
                              >
                                {item.isPrimary ? "★" : "☆"}
                              </Button>
                              <Button
                                type="button"
                                size="icon"
                                variant="destructive"
                                className="h-6 w-6"
                                onClick={() => removeMedia(index)}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending
                  ? "Salvando..."
                  : editProduct
                  ? "Salvar Alterações"
                  : "Cadastrar Produto"}
              </Button>
            </div>
          </form>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
