import { useState, useEffect, useCallback, useRef } from "react";
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
import { Link } from "wouter";

const productFormSchema = z.object({
  ean: z.string().optional(),
  name: z.string().min(1, "Nome é obrigatório"),
  sku: z.string().optional(),
  category: z.string().min(1, "Categoria é obrigatória"),
  marketClassification: z.string().optional(),
  additionalInfo: z.string().optional(),
  complementaryInfo: z.string().optional(),
  nutritionalInfo: z.string().optional(),
  labelInfo: z.string().optional(),
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
  promoStart: z.string().optional(),
  promoEnd: z.string().optional(),
  expirationDate: z.string().optional(),
  stock: z.string().default("0"),
  minStock: z.string().optional().nullable(),
  maxStock: z.string().optional().nullable(),
  isKit: z.boolean().default(false),
  isIngredient: z.boolean().default(false),
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

interface IngredientItemData {
  ingredientProductId: number;
  ingredientProductName?: string;
  quantity: number;
  consumptionUnit: "kg" | "g";
}

interface ProductFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editProduct?: any;
}

interface ProductOperationalConfig {
  enabled: boolean;
  stockUnit: "UN" | "KG";
  saleMode: "unit" | "weight" | "unit_or_weight";
  averageUnitWeightKg: string;
  carcassYieldPercent: string;
  cookingYieldPercent: string;
  purchaseStage: "raw" | "cooked";
  saleStage: "raw" | "cooked";
}

type ReferenceOption = {
  id: number;
  name: string;
  code?: string | null;
  isActive?: boolean | null;
};

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

const defaultOperationalConfig: ProductOperationalConfig = {
  enabled: false,
  stockUnit: "KG",
  saleMode: "unit_or_weight",
  averageUnitWeightKg: "",
  carcassYieldPercent: "100",
  cookingYieldPercent: "100",
  purchaseStage: "raw",
  saleStage: "raw",
};

const formatDecimalInput = (value: unknown, fallback: string) => {
  if (value === null || value === undefined || value === "") return fallback;
  return String(value);
};

const normalizeDecimalString = (
  value: string | number | null | undefined,
  fallback: string | null = null
) => {
  const raw = String(value ?? "").trim();
  if (!raw) return fallback;

  const compact = raw.replace(/\s/g, "");
  let normalized = compact;

  if (compact.includes(",") && compact.includes(".")) {
    if (compact.lastIndexOf(",") > compact.lastIndexOf(".")) {
      normalized = compact.replace(/\./g, "").replace(",", ".");
    } else {
      normalized = compact.replace(/,/g, "");
    }
  } else if (compact.includes(",")) {
    normalized = compact.replace(/\./g, "").replace(",", ".");
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? String(parsed) : fallback;
};

const toNormalizedNumber = (value: string | number | null | undefined) => {
  const normalized = normalizeDecimalString(value, null);
  if (normalized === null) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

const calculateEan13CheckDigit = (base12: string) => {
  const digits = base12
    .split("")
    .map((digit) => Number(digit))
    .filter((digit) => Number.isFinite(digit));
  if (digits.length !== 12) return null;

  const total = digits.reduce((sum, digit, index) => {
    const weight = index % 2 === 0 ? 1 : 3;
    return sum + digit * weight;
  }, 0);

  return String((10 - (total % 10)) % 10);
};

const generateInternalEan13 = (existingEans: Set<string>) => {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const seed = `${Date.now()}${Math.floor(Math.random() * 1000)}`
      .replace(/\D/g, "")
      .slice(-9)
      .padStart(9, "0");
    const base12 = `200${seed}`;
    const checkDigit = calculateEan13CheckDigit(base12);
    if (!checkDigit) continue;
    const ean = `${base12}${checkDigit}`;
    if (!existingEans.has(ean)) {
      return ean;
    }
  }

  return null;
};

export default function ProductForm({
  open,
  onOpenChange,
  editProduct,
}: ProductFormProps) {
  const toDateInputValue = (value: unknown) => {
    if (!value) return "";
    const date = new Date(String(value));
    if (!Number.isNaN(date.getTime())) {
      return date.toISOString().slice(0, 10);
    }
    const raw = String(value);
    return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : "";
  };

  const queryClient = useQueryClient();
  const [variations, setVariations] = useState<Variation[]>([]);
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [kitItemsList, setKitItemsList] = useState<KitItemData[]>([]);
  const [ingredientItemsList, setIngredientItemsList] = useState<
    IngredientItemData[]
  >([]);
  const [newImageUrl, setNewImageUrl] = useState("");
  const [selectedKitProduct, setSelectedKitProduct] = useState<string>("");
  const [kitQuantity, setKitQuantity] = useState(1);
  const [selectedIngredientProduct, setSelectedIngredientProduct] = useState<string>("");
  const [ingredientQuantity, setIngredientQuantity] = useState("1");
  const [ingredientConsumptionUnit, setIngredientConsumptionUnit] = useState<"kg" | "g">("kg");
  const [isLookingUpEan, setIsLookingUpEan] = useState(false);
  const [eanLookupError, setEanLookupError] = useState<string | null>(null);
  const submitLockRef = useRef(false);
  const createIdempotencyKeyRef = useRef<string | null>(null);

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

  const { data: marketClassifications = [] } = useQuery<ReferenceOption[]>({
    queryKey: ["/api/reference-tables", "classificacao_mercadologica"],
    queryFn: async () => {
      const res = await fetch("/api/reference-tables/classificacao_mercadologica");
      if (!res.ok) return [];
      return res.json();
    },
  });
  const { data: additionalInfos = [] } = useQuery<ReferenceOption[]>({
    queryKey: ["/api/reference-tables", "infos_adicionais"],
    queryFn: async () => {
      const res = await fetch("/api/reference-tables/infos_adicionais");
      if (!res.ok) return [];
      return res.json();
    },
  });
  const { data: complementaryInfos = [] } = useQuery<ReferenceOption[]>({
    queryKey: ["/api/reference-tables", "infos_complementares"],
    queryFn: async () => {
      const res = await fetch("/api/reference-tables/infos_complementares");
      if (!res.ok) return [];
      return res.json();
    },
  });
  const { data: nutritionalInfos = [] } = useQuery<ReferenceOption[]>({
    queryKey: ["/api/reference-tables", "infos_nutricionais"],
    queryFn: async () => {
      const res = await fetch("/api/reference-tables/infos_nutricionais");
      if (!res.ok) return [];
      return res.json();
    },
  });
  const { data: labelInfos = [] } = useQuery<ReferenceOption[]>({
    queryKey: ["/api/reference-tables", "etiquetas"],
    queryFn: async () => {
      const res = await fetch("/api/reference-tables/etiquetas");
      if (!res.ok) return [];
      return res.json();
    },
  });
  const { data: settings } = useQuery({
    queryKey: ["/api/settings"],
    queryFn: async () => {
      const res = await fetch("/api/settings");
      if (!res.ok) return {};
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
      marketClassification: "",
      additionalInfo: "",
      complementaryInfo: "",
      nutritionalInfo: "",
      labelInfo: "",
      unit: "UN",
      brand: "",
      type: "",
      ncm: "",
      serviceCode: "",
      cest: "",
      csosnCode: "",
      origin: "nacional",
      description: "",
      mainImageUrl: "",
      purchasePrice: "",
      margin: "",
      price: "",
      promoPrice: "",
      promoStart: "",
      promoEnd: "",
      expirationDate: "",
      stock: "0",
      minStock: "10",
      maxStock: "100",
      isKit: false,
      isIngredient: false,
      isActive: true,
    },
  });
  const [operationalConfig, setOperationalConfig] = useState<ProductOperationalConfig>(
    defaultOperationalConfig
  );
  const [priceSyncSource, setPriceSyncSource] = useState<"margin" | "price">(
    "margin"
  );

  const purchasePriceField = form.register("purchasePrice");
  const marginField = form.register("margin");
  const priceField = form.register("price");
  const promoPriceField = form.register("promoPrice");

  const watchPurchasePrice = form.watch("purchasePrice");
  const watchMargin = form.watch("margin");
  const watchPrice = form.watch("price");
  const watchPromoPrice = form.watch("promoPrice");
  const watchIsKit = form.watch("isKit");
  const watchIsIngredient = form.watch("isIngredient");
  const watchProductName = form.watch("name");
  const parseDecimalInputValue = (value: string | number | null | undefined) => {
    const normalized = normalizeDecimalString(value, null);
    if (normalized === null) return null;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  };
  const syncSalePriceFromMargin = (
    purchaseValue: string | number | null | undefined,
    marginValue: string | number | null | undefined
  ) => {
    const purchase = parseDecimalInputValue(purchaseValue);
    const margin = parseDecimalInputValue(marginValue);
    if (purchase === null || margin === null || purchase <= 0 || margin <= 0) {
      return;
    }

    const nextPrice = (purchase * (1 + margin / 100)).toFixed(2);
    if ((form.getValues("price") || "") !== nextPrice) {
      form.setValue("price", nextPrice, { shouldValidate: false });
    }
  };
  const syncMarginFromSalePrice = (
    purchaseValue: string | number | null | undefined,
    saleValue: string | number | null | undefined
  ) => {
    const purchase = parseDecimalInputValue(purchaseValue);
    const sale = parseDecimalInputValue(saleValue);
    if (purchase === null || sale === null || purchase <= 0 || sale <= purchase) {
      return;
    }

    const nextMargin = (((sale - purchase) / purchase) * 100).toFixed(2);
    if ((form.getValues("margin") || "") !== nextMargin) {
      form.setValue("margin", nextMargin, { shouldValidate: false });
    }
  };
  const promoDiscountPercent = (() => {
    const price = parseFloat(watchPrice || "");
    const promo = parseFloat(watchPromoPrice || "");
    if (!Number.isFinite(price) || !Number.isFinite(promo) || price <= 0 || promo >= price) {
      return null;
    }
    return ((price - promo) / price) * 100;
  })();

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
    if (!open) return;
    if (editProduct) {
      form.reset({
        ean: editProduct.ean || "",
        name: editProduct.name || "",
        sku: editProduct.sku || "",
        category: editProduct.category || "",
        marketClassification: editProduct.marketClassification || "",
        additionalInfo: editProduct.additionalInfo || "",
        complementaryInfo: editProduct.complementaryInfo || "",
        nutritionalInfo: editProduct.nutritionalInfo || "",
        labelInfo: editProduct.labelInfo || "",
        unit: editProduct.unit || "UN",
        brand: editProduct.brand || "",
        type: editProduct.type || "",
        ncm: editProduct.ncm || "",
        serviceCode: editProduct.serviceCode || "",
        cest: editProduct.cest || "",
        csosnCode: editProduct.csosnCode || "",
        origin: editProduct.origin || "nacional",
        description: editProduct.description || "",
        mainImageUrl: editProduct.mainImageUrl || "",
        purchasePrice: editProduct.purchasePrice || "",
        margin: editProduct.margin || "",
        price: editProduct.price || "",
        promoPrice: editProduct.promoPrice || "",
        promoStart: toDateInputValue(editProduct.promoStart),
        promoEnd: toDateInputValue(editProduct.promoEnd),
        expirationDate: editProduct.expirationDate || "",
        stock: formatDecimalInput(editProduct.stock, "0"),
        minStock: formatDecimalInput(editProduct.minStock, "10"),
        maxStock: formatDecimalInput(editProduct.maxStock, "100"),
        isKit: editProduct.isKit || false,
        isIngredient: editProduct.isIngredient || false,
        isActive: editProduct.isActive !== false,
        supplierId: editProduct.supplierId,
      });
      setOperationalConfig({
        ...defaultOperationalConfig,
        ...(editProduct.operationalConfig || {}),
        enabled: Boolean(editProduct.operationalConfig?.enabled),
        stockUnit:
          editProduct.operationalConfig?.stockUnit === "UN" ? "UN" : "KG",
        saleMode:
          editProduct.operationalConfig?.saleMode === "weight" ||
          editProduct.operationalConfig?.saleMode === "unit"
            ? editProduct.operationalConfig.saleMode
            : "unit_or_weight",
        averageUnitWeightKg: formatDecimalInput(
          editProduct.operationalConfig?.averageUnitWeightKg,
          ""
        ),
        carcassYieldPercent: formatDecimalInput(
          editProduct.operationalConfig?.carcassYieldPercent,
          "100"
        ),
        cookingYieldPercent: formatDecimalInput(
          editProduct.operationalConfig?.cookingYieldPercent,
          "100"
        ),
        purchaseStage:
          editProduct.operationalConfig?.purchaseStage === "cooked"
            ? "cooked"
            : "raw",
        saleStage:
          editProduct.operationalConfig?.saleStage === "cooked"
            ? "cooked"
            : "raw",
      });
      setVariations(editProduct.variations || []);
      setMediaItems(editProduct.media || []);
      setKitItemsList(editProduct.kitItems || []);
      setIngredientItemsList(
        (editProduct.ingredients || []).map((item: any) => ({
          ...item,
          consumptionUnit: item.consumptionUnit === "g" ? "g" : "kg",
        }))
      );
    } else {
      form.reset();
      setOperationalConfig(defaultOperationalConfig);
      setVariations([]);
      setMediaItems([]);
      setKitItemsList([]);
      setIngredientItemsList([]);
    }
  }, [editProduct, form, open]);

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const url = editProduct
        ? `/api/products/${editProduct.id}`
        : "/api/products";
      const method = editProduct ? "PATCH" : "POST";
      if (!editProduct && !createIdempotencyKeyRef.current) {
        createIdempotencyKeyRef.current =
          globalThis.crypto?.randomUUID?.() ||
          `produto-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      }
      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          ...(createIdempotencyKeyRef.current
            ? { "x-idempotency-key": createIdempotencyKeyRef.current }
            : {}),
        },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to save product");
      }
      return res.json();
    },
    onSuccess: () => {
      submitLockRef.current = false;
      createIdempotencyKeyRef.current = null;
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast.success(
        editProduct
          ? "Produto atualizado com sucesso!"
          : "Produto cadastrado com sucesso!"
      );
      onOpenChange(false);
    },
    onError: (error: Error) => {
      submitLockRef.current = false;
      createIdempotencyKeyRef.current = null;
      toast.error(error.message);
    },
  });

  const onSubmit = (data: ProductFormData) => {
    if (submitLockRef.current || createMutation.isPending) {
      return;
    }

    const normalizedEan = String(data.ean || "").trim();
    const primaryMedia = mediaItems.find((m) => m.isPrimary);
    const normalizedPurchasePrice = normalizeDecimalString(
      data.purchasePrice,
      null
    );
    const normalizedMargin = normalizeDecimalString(data.margin, null);
    const normalizedPrice = normalizeDecimalString(data.price, "0");
    const normalizedPromoPrice = normalizeDecimalString(data.promoPrice, null);
    const normalizedStock = normalizeDecimalString(data.stock, "0");
    const normalizedMinStock = normalizeDecimalString(data.minStock, "0");
    const normalizedMaxStock = normalizeDecimalString(data.maxStock, "0");
    const productData = {
      product: {
        ...data,
        ean: normalizedEan || null,
        marketClassification: data.marketClassification || null,
        additionalInfo: data.additionalInfo || null,
        complementaryInfo: data.complementaryInfo || null,
        nutritionalInfo: data.nutritionalInfo || null,
        labelInfo: data.labelInfo || null,
        mainImageUrl: primaryMedia?.url || data.mainImageUrl || null,
        purchasePrice: normalizedPurchasePrice,
        margin: normalizedMargin,
        price: normalizedPrice,
        promoPrice: normalizedPromoPrice,
        promoStart: data.promoStart || null,
        promoEnd: data.promoEnd || null,
        expirationDate: data.expirationDate || null,
        stock: normalizedStock,
        minStock: normalizedMinStock,
        maxStock: normalizedMaxStock,
        supplierId: data.supplierId || null,
        operationalConfig:
          settings?.butcherEnabled && operationalConfig.enabled
            ? {
                enabled: true,
                stockUnit: operationalConfig.stockUnit,
                saleMode: operationalConfig.saleMode,
                averageUnitWeightKg: toNormalizedNumber(
                  operationalConfig.averageUnitWeightKg
                ),
                carcassYieldPercent: toNormalizedNumber(
                  operationalConfig.carcassYieldPercent
                ),
                cookingYieldPercent: toNormalizedNumber(
                  operationalConfig.cookingYieldPercent
                ),
                purchaseStage: operationalConfig.purchaseStage,
                saleStage: operationalConfig.saleStage,
              }
            : null,
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
      ingredients: ingredientItemsList.map((item) => ({
        ingredientProductId: item.ingredientProductId,
        quantity: item.quantity,
        consumptionUnit: item.consumptionUnit || "kg",
      })),
    };
    submitLockRef.current = true;
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

  const addIngredientItem = () => {
    const normalizedQuantity = Number(
      normalizeDecimalString(ingredientQuantity, "0") || "0"
    );
    if (selectedIngredientProduct && normalizedQuantity > 0) {
      const product = allProducts.find(
        (p: any) => p.id.toString() === selectedIngredientProduct
      );
      if (
        product &&
        !ingredientItemsList.some(
          (item) => item.ingredientProductId === product.id
        )
      ) {
        setIngredientItemsList([
          ...ingredientItemsList,
          {
            ingredientProductId: product.id,
            ingredientProductName: product.name,
            quantity: normalizedQuantity,
            consumptionUnit: ingredientConsumptionUnit,
          },
        ]);
        setSelectedIngredientProduct("");
        setIngredientQuantity("1");
        setIngredientConsumptionUnit("kg");
      }
    }
  };

  const removeIngredientItem = (ingredientProductId: number) => {
    setIngredientItemsList(
      ingredientItemsList.filter(
        (item) => item.ingredientProductId !== ingredientProductId
      )
    );
  };

  const updateIngredientItemQuantity = (
    ingredientProductId: number,
    quantity: number
  ) => {
    setIngredientItemsList(
      ingredientItemsList.map((item) =>
        item.ingredientProductId === ingredientProductId
          ? { ...item, quantity }
          : item
      )
    );
  };

  const updateIngredientItemUnit = (
    ingredientProductId: number,
    consumptionUnit: "kg" | "g"
  ) => {
    setIngredientItemsList(
      ingredientItemsList.map((item) =>
        item.ingredientProductId === ingredientProductId
          ? { ...item, consumptionUnit }
          : item
      )
    );
  };

  const availableProducts = allProducts.filter(
    (p: any) =>
      p.id !== editProduct?.id &&
      !p.isKit &&
      !kitItemsList.some((k) => k.productId === p.id)
  );

  const availableIngredients = allProducts.filter(
    (p: any) =>
      p.id !== editProduct?.id &&
      p.isActive !== false &&
      !ingredientItemsList.some((item) => item.ingredientProductId === p.id)
  );

  const handleGenerateInternalEan = () => {
    const existingEans = new Set(
      allProducts
        .map((product: any) => String(product?.ean || "").trim())
        .filter(Boolean)
    );
    const generatedEan = generateInternalEan13(existingEans);
    if (!generatedEan) {
      toast.error("Nao foi possivel gerar um codigo interno agora");
      return;
    }
    form.setValue("ean", generatedEan, { shouldDirty: true, shouldValidate: true });
    setEanLookupError(
      "Codigo interno gerado automaticamente. Use o EAN real do fornecedor quando existir."
    );
  };

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
              <TabsList className="grid w-full grid-cols-6">
                <TabsTrigger value="basic">Dados Básicos</TabsTrigger>
                <TabsTrigger value="pricing">Preços</TabsTrigger>
                <TabsTrigger value="variations">Variações</TabsTrigger>
                <TabsTrigger value="kit" disabled={!watchIsKit}>
                  Kit
                </TabsTrigger>
                <TabsTrigger value="recipe">Fórmula</TabsTrigger>
                <TabsTrigger value="media">Fotos</TabsTrigger>
              </TabsList>

              <TabsContent value="basic" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="ean">Código de Barras (EAN)</Label>
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
                      onClick={handleGenerateInternalEan}
                    >
                      Gerar
                    </Button>
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
                      value={form.watch("csosnCode") || ""}
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
                </div>                <Card className="border-dashed">
                  <CardHeader className="py-3">
                    <CardTitle className="text-base flex items-center justify-between">
                      Tabelas de Apoio
                      <Link href="/tables">
                        <Button type="button" variant="outline" size="sm">
                          Gerenciar Tabelas
                        </Button>
                      </Link>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Classificacao Mercadologica</Label>
                        <Select
                          value={form.watch("marketClassification") || "__none__"}
                          onValueChange={(value) =>
                            form.setValue(
                              "marketClassification",
                              value === "__none__" ? "" : value
                            )
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecionar" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">Nenhuma</SelectItem>
                            {marketClassifications
                              .filter((item) => item.isActive !== false)
                              .map((item) => (
                                <SelectItem key={item.id} value={item.name}>
                                  {item.code ? `${item.code} - ` : ""}
                                  {item.name}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Infos. Adicionais</Label>
                        <Select
                          value={form.watch("additionalInfo") || "__none__"}
                          onValueChange={(value) =>
                            form.setValue(
                              "additionalInfo",
                              value === "__none__" ? "" : value
                            )
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecionar" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">Nenhuma</SelectItem>
                            {additionalInfos
                              .filter((item) => item.isActive !== false)
                              .map((item) => (
                                <SelectItem key={item.id} value={item.name}>
                                  {item.code ? `${item.code} - ` : ""}
                                  {item.name}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Infos. Complementares</Label>
                        <Select
                          value={form.watch("complementaryInfo") || "__none__"}
                          onValueChange={(value) =>
                            form.setValue(
                              "complementaryInfo",
                              value === "__none__" ? "" : value
                            )
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecionar" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">Nenhuma</SelectItem>
                            {complementaryInfos
                              .filter((item) => item.isActive !== false)
                              .map((item) => (
                                <SelectItem key={item.id} value={item.name}>
                                  {item.code ? `${item.code} - ` : ""}
                                  {item.name}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Infos. Nutricionais</Label>
                        <Select
                          value={form.watch("nutritionalInfo") || "__none__"}
                          onValueChange={(value) =>
                            form.setValue(
                              "nutritionalInfo",
                              value === "__none__" ? "" : value
                            )
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecionar" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">Nenhuma</SelectItem>
                            {nutritionalInfos
                              .filter((item) => item.isActive !== false)
                              .map((item) => (
                                <SelectItem key={item.id} value={item.name}>
                                  {item.code ? `${item.code} - ` : ""}
                                  {item.name}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Etiqueta</Label>
                      <Select
                        value={form.watch("labelInfo") || "__none__"}
                        onValueChange={(value) =>
                          form.setValue("labelInfo", value === "__none__" ? "" : value)
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecionar" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">Nenhuma</SelectItem>
                          {labelInfos
                            .filter((item) => item.isActive !== false)
                            .map((item) => (
                              <SelectItem key={item.id} value={item.name}>
                                {item.code ? `${item.code} - ` : ""}
                                {item.name}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </CardContent>
                </Card>


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
                      id="isIngredient"
                      checked={watchIsIngredient}
                      onCheckedChange={(checked) =>
                        form.setValue("isIngredient", checked)
                      }
                    />
                    <Label htmlFor="isIngredient">Usado como matéria-prima</Label>
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
                          {...purchasePriceField}
                          onChange={(event) => {
                            purchasePriceField.onChange(event);
                            const nextPurchase = event.target.value;
                            if (priceSyncSource === "margin") {
                              syncSalePriceFromMargin(
                                nextPurchase,
                                form.getValues("margin")
                              );
                            } else {
                              syncMarginFromSalePrice(
                                nextPurchase,
                                form.getValues("price")
                              );
                            }
                          }}
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="margin">Margem (%)</Label>
                        <Input
                          id="margin"
                          {...marginField}
                          onChange={(event) => {
                            setPriceSyncSource("margin");
                            marginField.onChange(event);
                            syncSalePriceFromMargin(
                              form.getValues("purchasePrice"),
                              event.target.value
                            );
                          }}
                          type="number"
                          step="0.01"
                          placeholder="30"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="price">Preço de Venda (R$) *</Label>
                        <Input
                          id="price"
                          {...priceField}
                          onChange={(event) => {
                            setPriceSyncSource("price");
                            priceField.onChange(event);
                            syncMarginFromSalePrice(
                              form.getValues("purchasePrice"),
                              event.target.value
                            );
                          }}
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
                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <Label htmlFor="promoPrice">Preço Promocional (R$)</Label>
                          {promoDiscountPercent !== null && (
                            <span className="text-xs text-emerald-600">
                              -{promoDiscountPercent.toFixed(2)}%
                            </span>
                          )}
                        </div>
                        <Input
                          id="promoPrice"
                          {...promoPriceField}
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="promoStart">Início da Promoção</Label>
                        <Input
                          id="promoStart"
                          type="date"
                          {...form.register("promoStart")}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="promoEnd">Fim da Promoção</Label>
                        <Input
                          id="promoEnd"
                          type="date"
                          {...form.register("promoEnd")}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="expirationDate">Data de Validade</Label>
                      <Input
                        id="expirationDate"
                        type="date"
                        {...form.register("expirationDate")}
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
                          step="0.001"
                          {...form.register("stock")}
                          disabled={!!editProduct}
                        />
                        {editProduct && (
                          <p className="text-xs text-muted-foreground">
                            Estoque atual: {editProduct.stock} {editProduct.unit || "UN"}
                          </p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="minStock">Estoque Mínimo</Label>
                        <Input
                          id="minStock"
                          type="number"
                          step="0.001"
                          {...form.register("minStock")}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="maxStock">Estoque Máximo</Label>
                        <Input
                          id="maxStock"
                          type="number"
                          step="0.001"
                          {...form.register("maxStock")}
                        />
                      </div>
                    </div>
                    {settings?.butcherEnabled && (
                      <Card className="border-dashed">
                        <CardHeader className="py-3">
                          <CardTitle className="text-base">
                            Configuração de Açougue
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                              <Label>Ativar regra operacional</Label>
                              <p className="text-xs text-muted-foreground">
                                Compra em kg, venda em unidade/kg e cálculo de rendimento
                              </p>
                            </div>
                            <Switch
                              checked={operationalConfig.enabled}
                              onCheckedChange={(checked) =>
                                setOperationalConfig((current) => ({
                                  ...current,
                                  enabled: checked,
                                }))
                              }
                            />
                          </div>

                          {operationalConfig.enabled && (
                            <>
                              <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                  <Label>Unidade do estoque</Label>
                                  <Select
                                    value={operationalConfig.stockUnit}
                                    onValueChange={(value) =>
                                      setOperationalConfig((current) => ({
                                        ...current,
                                        stockUnit: value as "UN" | "KG",
                                      }))
                                    }
                                  >
                                    <SelectTrigger>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="KG">Quilo (KG)</SelectItem>
                                      <SelectItem value="UN">Unidade (UN)</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div className="space-y-2">
                                  <Label>Modo de venda</Label>
                                  <Select
                                    value={operationalConfig.saleMode}
                                    onValueChange={(value) =>
                                      setOperationalConfig((current) => ({
                                        ...current,
                                        saleMode: value as "unit" | "weight" | "unit_or_weight",
                                      }))
                                    }
                                  >
                                    <SelectTrigger>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="unit">Somente unidade</SelectItem>
                                      <SelectItem value="weight">Somente kg</SelectItem>
                                      <SelectItem value="unit_or_weight">
                                        Unidade ou kg
                                      </SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>

                              <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                  <Label>Peso médio por unidade (kg)</Label>
                                  <Input
                                    type="number"
                                    step="0.001"
                                    value={operationalConfig.averageUnitWeightKg}
                                    onChange={(e) =>
                                      setOperationalConfig((current) => ({
                                        ...current,
                                        averageUnitWeightKg: e.target.value,
                                      }))
                                    }
                                    placeholder="Ex: 1.250"
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label>Rendimento de carcaça (%)</Label>
                                  <Input
                                    type="number"
                                    step="0.01"
                                    value={operationalConfig.carcassYieldPercent}
                                    onChange={(e) =>
                                      setOperationalConfig((current) => ({
                                        ...current,
                                        carcassYieldPercent: e.target.value,
                                      }))
                                    }
                                    placeholder="Ex: 72"
                                  />
                                </div>
                              </div>

                              <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                  <Label>Rendimento pós-preparo (%)</Label>
                                  <Input
                                    type="number"
                                    step="0.01"
                                    value={operationalConfig.cookingYieldPercent}
                                    onChange={(e) =>
                                      setOperationalConfig((current) => ({
                                        ...current,
                                        cookingYieldPercent: e.target.value,
                                      }))
                                    }
                                    placeholder="Ex: 65"
                                  />
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                  <div className="space-y-2">
                                    <Label>Compra</Label>
                                    <Select
                                      value={operationalConfig.purchaseStage}
                                      onValueChange={(value) =>
                                        setOperationalConfig((current) => ({
                                          ...current,
                                          purchaseStage: value as "raw" | "cooked",
                                        }))
                                      }
                                    >
                                      <SelectTrigger>
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="raw">Cru</SelectItem>
                                        <SelectItem value="cooked">Assado</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <div className="space-y-2">
                                    <Label>Venda</Label>
                                    <Select
                                      value={operationalConfig.saleStage}
                                      onValueChange={(value) =>
                                        setOperationalConfig((current) => ({
                                          ...current,
                                          saleStage: value as "raw" | "cooked",
                                        }))
                                      }
                                    >
                                      <SelectTrigger>
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="raw">Cru</SelectItem>
                                        <SelectItem value="cooked">Assado</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                </div>
                              </div>

                              <p className="text-xs text-muted-foreground">
                                O desconto do estoque será calculado pelo peso vendido,
                                peso médio por unidade e rendimentos configurados.
                              </p>
                            </>
                          )}
                        </CardContent>
                      </Card>
                    )}
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

              <TabsContent value="recipe" className="space-y-4 mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Fórmula / Ingredientes</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                      Configure os insumos usados para produzir este item. Ao fazer uma
                      entrada no estoque deste produto, o sistema baixa automaticamente os
                      ingredientes informados abaixo.
                    </div>

                    <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_140px_120px_auto]">
                      <div className="space-y-2">
                        <Label>Ingrediente</Label>
                        <Select
                          value={selectedIngredientProduct}
                          onValueChange={setSelectedIngredientProduct}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione um produto" />
                          </SelectTrigger>
                          <SelectContent>
                            {availableIngredients.map((product: any) => (
                              <SelectItem
                                key={product.id}
                                value={product.id.toString()}
                              >
                                {product.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>Qtd. por unidade</Label>
                        <Input
                          type="number"
                          min="0.001"
                          step="0.001"
                          value={ingredientQuantity}
                          onChange={(e) => setIngredientQuantity(e.target.value)}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Unidade</Label>
                        <Select
                          value={ingredientConsumptionUnit}
                          onValueChange={(value) =>
                            setIngredientConsumptionUnit(value as "kg" | "g")
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Unidade" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="kg">kg</SelectItem>
                            <SelectItem value="g">g</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="flex items-end">
                        <Button type="button" onClick={addIngredientItem}>
                          <Plus className="mr-2 h-4 w-4" /> Adicionar
                        </Button>
                      </div>
                    </div>

                    {ingredientItemsList.length === 0 ? (
                      <p className="py-8 text-center text-muted-foreground">
                        Nenhum ingrediente configurado.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {ingredientItemsList.map((item) => {
                          const product = allProducts.find(
                            (p: any) => p.id === item.ingredientProductId
                          );
                          return (
                            <div
                              key={item.ingredientProductId}
                              className="flex items-center justify-between rounded-lg border p-3"
                            >
                              <div>
                                <p className="font-medium">
                                  {product?.name || item.ingredientProductName}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                  Baixa {Number(item.quantity || 0).toFixed(3)}{" "}
                                  {item.consumptionUnit === "g" ? "g" : "kg"} por unidade
                                  produzida
                                </p>
                              </div>

                              <div className="flex items-center gap-2">
                                <Input
                                  type="number"
                                  min="0.001"
                                  step="0.001"
                                  value={item.quantity}
                                  onChange={(e) =>
                                    updateIngredientItemQuantity(
                                      item.ingredientProductId,
                                      Number(
                                        normalizeDecimalString(
                                          e.target.value,
                                          String(item.quantity)
                                        ) || item.quantity
                                      )
                                    )
                                  }
                                  className="w-24"
                                />
                                <Select
                                  value={item.consumptionUnit || "kg"}
                                  onValueChange={(value) =>
                                    updateIngredientItemUnit(
                                      item.ingredientProductId,
                                      value as "kg" | "g"
                                    )
                                  }
                                >
                                  <SelectTrigger className="w-20">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="kg">kg</SelectItem>
                                    <SelectItem value="g">g</SelectItem>
                                  </SelectContent>
                                </Select>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() =>
                                    removeIngredientItem(item.ingredientProductId)
                                  }
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
