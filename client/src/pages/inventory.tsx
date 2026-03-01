import { useState, useRef, useMemo } from "react";
import Layout from "@/components/layout";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  TablePaginationControls,
  useTablePagination,
} from "@/components/ui/table-pagination-controls";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Search,
  Filter,
  Plus,
  MoreHorizontal,
  FileUp,
  ArrowUpDown,
  Package,
  Pencil,
  Trash2,
  PackagePlus,
  PackageMinus,
  Loader2,
  Upload,
  RefreshCw,
  ReceiptText,
  List,
  Grid3X3,
  AlertTriangle,
  CircleAlert,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Progress } from "@/components/ui/progress";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import ProductForm from "@/components/product-form";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

interface StockAdjustment {
  productId: number;
  productName: string;
  currentStock: number;
}

interface XmlPreviewProduct {
  tempId: number;
  name: string;
  ean: string | null;
  ncm: string | null;
  unit: string;
  quantity: number;
  unitsPerPackage: number;
  stockQuantity: number;
  totalPurchaseValue: string;
  price: string;
  purchasePrice: string;
  marginPercent: number;
  manualSalePrice?: boolean;
  cfop: string;
  cstIcms: string;
  cstIpi: string;
  cstPisCofins: string;
  csosnCode: string;
  origin: string;
  serviceCode: string;
  cest: string;
  discountValue: string;
  bcIcmsValue: string;
  icmsValue: string;
  ipiValue: string;
  icmsStValue: string;
  icmsAliquot: number;
  icmsReduction: number;
  ipiAliquot: number;
  pisAliquot: number;
  cofinsAliquot: number;
  issAliquot: number;
  irrfAliquot: number;
  existingProductId: number | null;
  existingProductName: string | null;
  existingStock: number;
  isExisting: boolean;
}

interface XmlReferenceTotals {
  productsTotal: number;
  discountTotal: number;
  otherExpensesTotal: number;
  icmsStTotal: number;
  ipiTotal: number;
  noteTotal: number;
}

interface ManifestDocumentRow {
  id: number;
  documentKey: string;
  issuerCnpj: string;
  receiverCnpj: string;
  xmlContent: string;
  downloadedAt: string | null;
  createdAt: string | null;
}

interface ManifestNoteSummary extends ManifestDocumentRow {
  issuerName: string;
  nfeNumber: string;
  nfeSeries: string;
  issuedAt: string | null;
  noteTotal: number | null;
}

interface ManifestSyncResult {
  success?: boolean;
  status?: string;
  message?: string;
  usedUltNSU?: string | null;
  lastNSU?: string | null;
  maxNSU?: string | null;
  documents?: Array<{
    nsu?: string;
    schema?: string;
    documentKey?: string;
    issuerCnpj?: string;
    receiverCnpj?: string;
  }>;
  batches?: Array<{
    status?: string;
    message?: string;
    lastNSU?: string;
    maxNSU?: string;
    documentsCount?: number;
  }>;
}

const adjustmentTypes = [
  {
    value: "entrada",
    label: "Entrada (Compra/Recebimento)",
    icon: PackagePlus,
  },
  { value: "saida", label: "Saída (Uso/Transferência)", icon: PackageMinus },
  { value: "ajuste", label: "Ajuste de Inventário", icon: Package },
  { value: "perda", label: "Perda/Avaria", icon: PackageMinus },
  { value: "devolucao", label: "Devolução", icon: PackagePlus },
];

const adjustmentReasons = [
  "Contagem de inventário",
  "Compra de fornecedor",
  "Devolução de cliente",
  "Produto avariado",
  "Produto vencido",
  "Transferência entre lojas",
  "Correção de erro",
  "Outro",
];

export default function Inventory() {
  const [formOpen, setFormOpen] = useState(false);
  const [editProduct, setEditProduct] = useState<any>(null);
  const [deleteProductId, setDeleteProductId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [stockAdjustment, setStockAdjustment] =
    useState<StockAdjustment | null>(null);
  const [adjustType, setAdjustType] = useState<string>("entrada");
  const [adjustQuantity, setAdjustQuantity] = useState<string>("");
  const [adjustReason, setAdjustReason] = useState<string>("");
  const [adjustNotes, setAdjustNotes] = useState<string>("");
  const [isImporting, setIsImporting] = useState(false);
  const [xmlPreviewOpen, setXmlPreviewOpen] = useState(false);
  const [xmlPreviewProducts, setXmlPreviewProducts] = useState<
    XmlPreviewProduct[]
  >([]);
  const [xmlReferenceTotals, setXmlReferenceTotals] =
    useState<XmlReferenceTotals | null>(null);
  const [xmlFiscalEditTempId, setXmlFiscalEditTempId] = useState<number | null>(
    null
  );
  const [isConfirmingImport, setIsConfirmingImport] = useState(false);
  const [selectedStockFilter, setSelectedStockFilter] = useState<
    "all" | "in_stock" | "low" | "critical" | "out"
  >("all");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [isSendingPdvLoad, setIsSendingPdvLoad] = useState(false);
  const [pdvLoadFeedback, setPdvLoadFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [manifestSearchTerm, setManifestSearchTerm] = useState("");
  const [selectedManifestNoteId, setSelectedManifestNoteId] = useState<
    number | null
  >(null);
  const [isSyncingManifestNotes, setIsSyncingManifestNotes] = useState(false);
  const [manifestAccessKeySearch, setManifestAccessKeySearch] = useState("");
  const [manifestLastSyncResult, setManifestLastSyncResult] =
    useState<ManifestSyncResult | null>(null);
  const [manifestModalOpen, setManifestModalOpen] = useState(false);
  const [manifestPeriodFilter, setManifestPeriodFilter] = useState<
    "all" | "current_month" | "30d" | "90d"
  >("all");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const toMoney = (value: string | number | null | undefined) => {
    const raw = String(value ?? "").trim();
    if (!raw) return 0;

    const compact = raw.replace(/\s/g, "");
    let normalized = compact;

    // Accept both BR (1.234,56) and US (1,234.56) formats while typing.
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
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const round2 = (value: number) => Number(value.toFixed(2));

  const calcSalePriceFromMargin = (purchasePrice: number, margin: number) =>
    purchasePrice * (1 + margin / 100);

  const calcMarginFromSalePrice = (purchasePrice: number, salePrice: number) =>
    purchasePrice > 0 ? ((salePrice - purchasePrice) / purchasePrice) * 100 : 0;

  const calcUnitCost = (totalPurchaseValue: number, stockQuantity: number) =>
    stockQuantity > 0 ? totalPurchaseValue / stockQuantity : 0;

  const parseManifestSummary = (
    docRow: ManifestDocumentRow
  ): ManifestNoteSummary => {
    try {
      const parser = new DOMParser();
      const xml = parser.parseFromString(docRow.xmlContent || "", "text/xml");
      const getTag = (scope: Document | Element, tag: string) =>
        scope.getElementsByTagName(tag)?.[0]?.textContent?.trim() || "";
      const ide = xml.getElementsByTagName("ide")?.[0] || xml;
      const emit = xml.getElementsByTagName("emit")?.[0] || xml;

      const nfeNumber = getTag(ide, "nNF");
      const nfeSeries = getTag(ide, "serie");
      const issuedAt = getTag(ide, "dhEmi") || getTag(ide, "dEmi") || null;
      const totalNode = xml.getElementsByTagName("ICMSTot")?.[0] || xml;
      const noteTotalRaw = getTag(totalNode, "vNF") || getTag(xml, "vNF");
      const issuerName = getTag(emit, "xNome") || "Fornecedor";
      const noteTotal = Number(String(noteTotalRaw || "").replace(",", "."));

      return {
        ...docRow,
        issuerName,
        nfeNumber,
        nfeSeries,
        issuedAt,
        noteTotal: Number.isFinite(noteTotal) ? noteTotal : null,
      };
    } catch {
      return {
        ...docRow,
        issuerName: "Fornecedor",
        nfeNumber: "",
        nfeSeries: "",
        issuedAt: null,
        noteTotal: null,
      };
    }
  };

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["/api/products"],
    queryFn: async () => {
      const res = await fetch("/api/products");
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const {
    data: manifestDocuments = [],
    isLoading: isLoadingManifestDocuments,
    error: manifestDocumentsError,
    refetch: refetchManifestDocuments,
  } = useQuery<ManifestDocumentRow[]>({
    queryKey: ["/api/fiscal/manifestation"],
    queryFn: async () => {
      const res = await fetch("/api/fiscal/manifestation");
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Falha ao listar notas recebidas");
      }
      return res.json();
    },
    retry: false,
  });

  const manifestNotes = useMemo(
    () => manifestDocuments.map(parseManifestSummary),
    [manifestDocuments]
  );

  const filteredManifestNotes = useMemo(() => {
    const search = manifestSearchTerm.trim().toLowerCase();
    const now = new Date();
    const startOfCurrentMonth = new Date(
      now.getFullYear(),
      now.getMonth(),
      1,
      0,
      0,
      0,
      0
    );
    const cutoffDate =
      manifestPeriodFilter === "30d"
        ? new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        : manifestPeriodFilter === "90d"
        ? new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
        : null;

    return manifestNotes.filter((note) => {
      const searchable = [
        note.issuerName,
        note.nfeNumber,
        note.nfeSeries,
        note.documentKey,
        note.issuerCnpj,
      ]
        .join(" ")
        .toLowerCase();
      if (search && !searchable.includes(search)) return false;

      const referenceDateRaw = note.issuedAt || note.downloadedAt || note.createdAt;
      const referenceDate = referenceDateRaw ? new Date(referenceDateRaw) : null;
      const hasValidDate =
        referenceDate instanceof Date && !Number.isNaN(referenceDate.getTime());

      if (manifestPeriodFilter === "current_month") {
        if (!hasValidDate) return false;
        return referenceDate >= startOfCurrentMonth;
      }

      if (cutoffDate) {
        if (!hasValidDate) return false;
        return referenceDate >= cutoffDate;
      }

      return true;
    });
  }, [manifestNotes, manifestSearchTerm, manifestPeriodFilter]);

  const selectedManifestNote =
    filteredManifestNotes.find((note) => note.id === selectedManifestNoteId) ||
    manifestNotes.find((note) => note.id === selectedManifestNoteId) ||
    null;

  const openXmlPreviewFromContent = async (xmlContent: string) => {
    setIsImporting(true);
    try {
      const res = await fetch("/api/products/preview-xml", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ xmlContent }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Falha ao processar XML");
      }

      const result = await res.json();
      const normalizedProducts: XmlPreviewProduct[] = (result.products || []).map(
        (product: any) => {
          const purchasePrice = toMoney(product.purchasePrice ?? product.price);
          const salePrice = toMoney(product.price);
          const unitsPerPackage = Math.max(
            1,
            Number(product.unitsPerPackage || 1)
          );
          const packageQty = Math.max(0, Number(product.quantity || 0));
          const totalPurchaseValue = toMoney(product.purchasePrice) * packageQty;
          const marginPercentRaw =
            typeof product.marginPercent === "number"
              ? product.marginPercent
              : calcMarginFromSalePrice(purchasePrice, salePrice);
          const marginPercent = Number.isFinite(marginPercentRaw)
            ? round2(marginPercentRaw)
            : 30;
          const stockQuantity = Math.max(
            0,
            Math.floor(
              Number(product.stockQuantity ?? packageQty * unitsPerPackage)
            )
          );
          return {
            ...product,
            unitsPerPackage,
            quantity: packageQty,
            stockQuantity,
            totalPurchaseValue: totalPurchaseValue.toFixed(2),
            purchasePrice: purchasePrice.toFixed(2),
            price: salePrice.toFixed(2),
            marginPercent,
            manualSalePrice: false,
            cfop: String((product as any).cfop || ""),
            cstIcms: String((product as any).cstIcms || "00"),
            cstIpi: String((product as any).cstIpi || "00"),
            cstPisCofins: String((product as any).cstPisCofins || "00"),
            csosnCode: String((product as any).csosnCode || "101"),
            origin: String((product as any).origin || "nacional"),
            serviceCode: String((product as any).serviceCode || ""),
            cest: String((product as any).cest || ""),
            discountValue: String((product as any).discountValue || "0"),
            bcIcmsValue: String((product as any).bcIcmsValue || "0"),
            icmsValue: String((product as any).icmsValue || "0"),
            ipiValue: String((product as any).ipiValue || "0"),
            icmsStValue: String((product as any).icmsStValue || "0"),
            icmsAliquot: Number((product as any).icmsAliquot || 0),
            icmsReduction: Number((product as any).icmsReduction || 0),
            ipiAliquot: Number((product as any).ipiAliquot || 0),
            pisAliquot: Number((product as any).pisAliquot || 0),
            cofinsAliquot: Number((product as any).cofinsAliquot || 0),
            issAliquot: Number((product as any).issAliquot || 0),
            irrfAliquot: Number((product as any).irrfAliquot || 0),
          };
        }
      );

      setXmlPreviewProducts(normalizedProducts);
      if (result.noteTotals) {
        setXmlReferenceTotals({
          productsTotal: toMoney(result.noteTotals.productsTotal),
          discountTotal: toMoney(result.noteTotals.discountTotal),
          otherExpensesTotal: toMoney(result.noteTotals.otherExpensesTotal),
          icmsStTotal: toMoney(result.noteTotals.icmsStTotal),
          ipiTotal: toMoney(result.noteTotals.ipiTotal),
          noteTotal: toMoney(result.noteTotals.noteTotal),
        });
      } else {
        setXmlReferenceTotals(null);
      }
      setXmlPreviewOpen(true);
    } finally {
      setIsImporting(false);
    }
  };

  const handleSendPdvLoad = async () => {
    setPdvLoadFeedback(null);
    setIsSendingPdvLoad(true);
    try {
      const response = await fetch("/api/pdv/load", { method: "POST" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || "Falha ao enviar carga do PDV");
      }
      const successMessage = `Carga PDV enviada: ${data.products ?? 0} produtos e ${data.paymentMethods ?? 0} pagamentos`;
      setPdvLoadFeedback({
        type: "success",
        message: successMessage,
      });
      toast.success(
        successMessage
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Erro ao enviar carga do PDV";
      setPdvLoadFeedback({
        type: "error",
        message: errorMessage,
      });
      toast.error(
        errorMessage
      );
    } finally {
      setIsSendingPdvLoad(false);
    }
  };

  const handleXmlImport = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".xml")) {
      toast.error("Por favor, selecione um arquivo XML válido");
      return;
    }

    try {
      const xmlContent = await file.text();
      await openXmlPreviewFromContent(xmlContent);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Erro ao processar XML"
      );
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleSyncManifestNotes = async (accessKey?: string) => {
    setIsSyncingManifestNotes(true);
    try {
      const sanitizedAccessKey = String(accessKey || "").replace(/\D/g, "");
      const res = await fetch("/api/fiscal/manifestation/distribute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          sanitizedAccessKey ? { accessKey: sanitizedAccessKey } : {}
        ),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) {
        setManifestLastSyncResult(result || null);
        throw new Error(result.error || "Falha ao buscar notas na SEFAZ");
      }
      setManifestLastSyncResult(result || null);
      await refetchManifestDocuments();
      toast.success(
        sanitizedAccessKey
          ? `Consulta por chave concluida: ${result.documents?.length ?? 0} documento(s) retornado(s)`
          : `Sincronizacao concluida: ${result.documents?.length ?? 0} documento(s) retornado(s)`
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Erro ao sincronizar notas"
      );
    } finally {
      setIsSyncingManifestNotes(false);
    }
  };

  const handleImportSelectedManifestNote = async () => {
    if (!selectedManifestNote?.xmlContent) {
      toast.error("Selecione uma nota para importar");
      return;
    }
    try {
      await openXmlPreviewFromContent(selectedManifestNote.xmlContent);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Erro ao importar nota"
      );
    }
  };

  const handleSearchManifestByAccessKey = async () => {
    const sanitized = manifestAccessKeySearch.replace(/\D/g, "");
    if (sanitized.length !== 44) {
      toast.error("Informe uma chave de NF-e com 44 digitos");
      return;
    }
    await handleSyncManifestNotes(sanitized);
  };

  const manifestSchemasSummary = useMemo(() => {
    const docs = manifestLastSyncResult?.documents || [];
    const counts = new Map<string, number>();
    for (const doc of docs) {
      const schema = String(doc.schema || "desconhecido");
      counts.set(schema, (counts.get(schema) || 0) + 1);
    }
    return Array.from(counts.entries());
  }, [manifestLastSyncResult]);

  const handleConfirmImport = async () => {
    if (xmlTotalsComparison && !xmlTotalsComparison.canImport) {
      toast.error(
        `Totais da nota divergentes do XML: ${xmlTotalsComparison.mismatches.join(
          ", "
        )}`
      );
      return;
    }
    setIsConfirmingImport(true);
    try {
      const res = await fetch("/api/products/import-confirmed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ products: xmlPreviewProducts }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Falha ao importar produtos");
      }

      const result = await res.json();
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      setXmlPreviewOpen(false);
      setXmlPreviewProducts([]);
      setXmlReferenceTotals(null);

      if (result.imported > 0 && result.updated > 0) {
        toast.success(
          `${result.imported} produto(s) criado(s) e ${result.updated} estoque(s) atualizado(s)!`
        );
      } else if (result.imported > 0) {
        toast.success(
          `${result.imported} produto(s) importado(s) com sucesso!`
        );
      } else if (result.updated > 0) {
        toast.success(`${result.updated} estoque(s) atualizado(s)!`);
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Erro ao importar produtos"
      );
    } finally {
      setIsConfirmingImport(false);
    }
  };

  const updatePreviewQuantity = (tempId: number, newQuantity: number) => {
    setXmlPreviewProducts((prev) =>
      prev.map((p) =>
        p.tempId === tempId
          ? (() => {
              const quantity = Math.max(0, newQuantity);
              const stockQuantity = Math.max(
                0,
                Math.floor(quantity * (p.unitsPerPackage || 1))
              );
              const purchasePrice = calcUnitCost(
                toMoney(p.totalPurchaseValue),
                stockQuantity
              );
              const salePrice = calcSalePriceFromMargin(
                purchasePrice,
                p.marginPercent
              );
              const nextSalePrice = p.manualSalePrice
                ? toMoney(p.price)
                : salePrice;
              return {
                ...p,
                quantity,
                stockQuantity,
                purchasePrice: purchasePrice.toFixed(2),
                price: nextSalePrice.toFixed(2),
              };
            })()
          : p
      )
    );
  };

  const updatePreviewUnitsPerPackage = (tempId: number, newValue: number) => {
    setXmlPreviewProducts((prev) =>
      prev.map((p) =>
        p.tempId === tempId
          ? (() => {
              const unitsPerPackage = Math.max(1, newValue);
              const stockQuantity = Math.max(
                0,
                Math.floor(p.quantity * unitsPerPackage)
              );
              const purchasePrice = calcUnitCost(
                toMoney(p.totalPurchaseValue),
                stockQuantity
              );
              const salePrice = calcSalePriceFromMargin(
                purchasePrice,
                p.marginPercent
              );
              const nextSalePrice = p.manualSalePrice
                ? toMoney(p.price)
                : salePrice;
              return {
                ...p,
                unitsPerPackage,
                stockQuantity,
                purchasePrice: purchasePrice.toFixed(2),
                price: nextSalePrice.toFixed(2),
              };
            })()
          : p
      )
    );
  };

  const updatePreviewTotalPurchaseValue = (tempId: number, value: string) => {
    setXmlPreviewProducts((prev) =>
      prev.map((p) => {
        if (p.tempId !== tempId) return p;
        const totalPurchaseValue = toMoney(value);
        const purchasePrice = calcUnitCost(totalPurchaseValue, p.stockQuantity);
        const salePrice = calcSalePriceFromMargin(purchasePrice, p.marginPercent);
        const nextSalePrice = p.manualSalePrice ? toMoney(p.price) : salePrice;
        return {
          ...p,
          totalPurchaseValue: totalPurchaseValue.toFixed(2),
          purchasePrice: purchasePrice.toFixed(2),
          price: nextSalePrice.toFixed(2),
        };
      })
    );
  };

  const updatePreviewPackagePurchaseValue = (tempId: number, value: string) => {
    setXmlPreviewProducts((prev) =>
      prev.map((p) => {
        if (p.tempId !== tempId) return p;
        const packagePurchaseValue = toMoney(value);
        const totalPurchaseValue = packagePurchaseValue * Math.max(0, p.quantity);
        const purchasePrice = calcUnitCost(totalPurchaseValue, p.stockQuantity);
        const salePrice = calcSalePriceFromMargin(purchasePrice, p.marginPercent);
        const nextSalePrice = p.manualSalePrice ? toMoney(p.price) : salePrice;
        return {
          ...p,
          totalPurchaseValue: totalPurchaseValue.toFixed(2),
          purchasePrice: purchasePrice.toFixed(2),
          price: nextSalePrice.toFixed(2),
        };
      })
    );
  };

  const updatePreviewMarginPercent = (tempId: number, value: string) => {
    setXmlPreviewProducts((prev) =>
      prev.map((p) => {
        if (p.tempId !== tempId) return p;
        const marginPercent = Math.max(0, toMoney(value));
        const salePrice = calcSalePriceFromMargin(
          toMoney(p.purchasePrice),
          marginPercent
        );
        return {
          ...p,
          marginPercent: round2(marginPercent),
          price: salePrice.toFixed(2),
          manualSalePrice: false,
        };
      })
    );
  };

  const updatePreviewSalePrice = (tempId: number, value: string) => {
    setXmlPreviewProducts((prev) =>
      prev.map((p) => {
        if (p.tempId !== tempId) return p;
        const salePrice = toMoney(value);
        const marginPercent = calcMarginFromSalePrice(
          toMoney(p.purchasePrice),
          salePrice
        );
        return {
          ...p,
          price: salePrice.toFixed(2),
          marginPercent: round2(Math.max(0, marginPercent)),
          manualSalePrice: true,
        };
      })
    );
  };

  const updatePreviewEan = (tempId: number, value: string) => {
    const sanitized = value.replace(/\D/g, "").slice(0, 14);
    setXmlPreviewProducts((prev) =>
      prev.map((p) =>
        p.tempId === tempId
          ? {
              ...p,
              ean: sanitized.length > 0 ? sanitized : null,
            }
          : p
      )
    );
  };

  const updatePreviewFiscalField = (
    tempId: number,
    field: keyof XmlPreviewProduct,
    value: string
  ) => {
    setXmlPreviewProducts((prev) =>
      prev.map((p) => {
        if (p.tempId !== tempId) return p;
        const numericFields: Array<keyof XmlPreviewProduct> = [
          "icmsAliquot",
          "icmsReduction",
          "ipiAliquot",
          "pisAliquot",
          "cofinsAliquot",
          "issAliquot",
          "irrfAliquot",
        ];
        if (numericFields.includes(field)) {
          return { ...p, [field]: toMoney(value) } as XmlPreviewProduct;
        }
        return { ...p, [field]: value } as XmlPreviewProduct;
      })
    );
  };

  const xmlImportTotals = useMemo(() => {
    const productsTotal = round2(
      xmlPreviewProducts.reduce((acc, p) => acc + toMoney(p.totalPurchaseValue), 0)
    );
    const discountTotal = round2(
      xmlPreviewProducts.reduce((acc, p) => acc + toMoney(p.discountValue), 0)
    );
    const icmsStTotal = round2(
      xmlPreviewProducts.reduce((acc, p) => acc + toMoney(p.icmsStValue), 0)
    );
    const totalIpi = round2(
      xmlPreviewProducts.reduce((acc, p) => acc + toMoney(p.ipiValue), 0)
    );
    const otherExpensesTotal = round2(xmlReferenceTotals?.otherExpensesTotal ?? 0);
    const noteTotal = round2(
      productsTotal - discountTotal + otherExpensesTotal + icmsStTotal + totalIpi
    );
    return {
      productsTotal,
      discountTotal,
      otherExpensesTotal,
      icmsStTotal,
      totalIpi,
      noteTotal,
    };
  }, [xmlPreviewProducts, xmlReferenceTotals]);

  const formatSignedMoney = (value: number) =>
    `${value >= 0 ? "+" : ""}${value.toFixed(2)}`;

  const xmlTotalsComparison = useMemo(() => {
    if (!xmlReferenceTotals) return null;
    const tolerance = 0.01;
    const details = [
      {
        key: "productsTotal" as const,
        label: "Valor total dos produtos",
        current: xmlImportTotals.productsTotal,
        expected: round2(xmlReferenceTotals.productsTotal),
      },
      {
        key: "discountTotal" as const,
        label: "Valor total dos descontos",
        current: xmlImportTotals.discountTotal,
        expected: round2(xmlReferenceTotals.discountTotal),
      },
      {
        key: "icmsStTotal" as const,
        label: "Valor do ICMS ST",
        current: xmlImportTotals.icmsStTotal,
        expected: round2(xmlReferenceTotals.icmsStTotal),
      },
      {
        key: "totalIpi" as const,
        label: "Valor total do IPI",
        current: xmlImportTotals.totalIpi,
        expected: round2(xmlReferenceTotals.ipiTotal),
      },
      {
        key: "noteTotal" as const,
        label: "Valor total da nota",
        current: xmlImportTotals.noteTotal,
        expected: round2(xmlReferenceTotals.noteTotal),
      },
    ].map((field) => {
      const diff = round2(field.current - field.expected);
      return {
        ...field,
        diff,
        mismatch: Math.abs(diff) > tolerance,
      };
    });
    const byKey = Object.fromEntries(
      details.map((detail) => [detail.key, detail])
    ) as Record<
      "productsTotal" | "discountTotal" | "icmsStTotal" | "totalIpi" | "noteTotal",
      (typeof details)[number]
    >;
    const mismatches = details
      .filter((detail) => detail.mismatch)
      .map((detail) => detail.label);
    return { details, byKey, mismatches, canImport: mismatches.length === 0 };
  }, [xmlImportTotals, xmlReferenceTotals]);

  const editingXmlFiscalProduct =
    xmlFiscalEditTempId === null
      ? null
      : xmlPreviewProducts.find((p) => p.tempId === xmlFiscalEditTempId) || null;

  const removeFromPreview = (tempId: number) => {
    setXmlPreviewProducts((prev) => prev.filter((p) => p.tempId !== tempId));
  };

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/products/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete product");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast.success("Produto excluído com sucesso!");
      setDeleteProductId(null);
    },
    onError: () => {
      toast.error("Erro ao excluir produto");
    },
  });

  const adjustStockMutation = useMutation({
    mutationFn: async (data: {
      productId: number;
      quantity: number;
      type: string;
      reason?: string;
      notes?: string;
    }) => {
      const res = await fetch("/api/inventory/adjust", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Falha ao ajustar estoque");
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      const typeLabel =
        adjustmentTypes.find((t) => t.value === adjustType)?.label ||
        adjustType;
      toast.success(
        `Estoque ajustado com sucesso! ${typeLabel}: ${adjustQuantity} unidades`
      );
      closeAdjustDialog();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const handleEdit = async (product: any) => {
    const res = await fetch(`/api/products/${product.id}`);
    if (res.ok) {
      const fullProduct = await res.json();
      setEditProduct(fullProduct);
      setFormOpen(true);
    }
  };

  const handleNewProduct = () => {
    setEditProduct(null);
    setFormOpen(true);
  };

  const handleAdjustStock = (product: any) => {
    setStockAdjustment({
      productId: product.id,
      productName: product.name,
      currentStock: product.stock,
    });
    setAdjustType("entrada");
    setAdjustQuantity("");
    setAdjustReason("");
    setAdjustNotes("");
  };

  const closeAdjustDialog = () => {
    setStockAdjustment(null);
    setAdjustType("entrada");
    setAdjustQuantity("");
    setAdjustReason("");
    setAdjustNotes("");
  };

  const handleSubmitAdjustment = () => {
    if (!stockAdjustment) return;

    const quantity = parseInt(adjustQuantity);
    if (isNaN(quantity) || quantity <= 0) {
      toast.error("Quantidade deve ser um número positivo");
      return;
    }

    if (!adjustReason) {
      toast.error("Selecione um motivo para o ajuste");
      return;
    }

    adjustStockMutation.mutate({
      productId: stockAdjustment.productId,
      quantity,
      type: adjustType,
      reason: adjustReason,
      notes: adjustNotes || undefined,
    });
  };

  const getNewStockPreview = () => {
    if (!stockAdjustment) return 0;
    const quantity = parseInt(adjustQuantity) || 0;
    if (adjustType === "saida" || adjustType === "perda") {
      return stockAdjustment.currentStock - quantity;
    }
    return stockAdjustment.currentStock + quantity;
  };

  const filteredProducts = products.filter((product: any) => {
    const categoryValue = String(product.category || "").trim();
    const categoryMatches =
      selectedCategory === "all" || categoryValue === selectedCategory;
    if (!categoryMatches) return false;

    const stock = Number(product.stock || 0);
    const minStock = Number(product.minStock || 10);
    const lowThreshold = minStock * 0.5;
    let stockMatches = true;
    if (selectedStockFilter === "in_stock") {
      stockMatches = stock > 0;
    } else if (selectedStockFilter === "low") {
      stockMatches = stock > lowThreshold && stock <= minStock;
    } else if (selectedStockFilter === "critical") {
      stockMatches = stock <= lowThreshold;
    } else if (selectedStockFilter === "out") {
      stockMatches = stock <= 0;
    }
    if (!stockMatches) return false;

    const search = searchTerm.toLowerCase().trim();
    if (!search) return true;
    return (
      String(product.name || "").toLowerCase().includes(search) ||
      (product.ean && product.ean.toLowerCase().includes(search)) ||
      (product.sku && product.sku.toLowerCase().includes(search)) ||
      categoryValue.toLowerCase().includes(search)
    );
  });
  const productsPagination = useTablePagination(filteredProducts);
  const manifestNotesPagination = useTablePagination(filteredManifestNotes);
  const xmlPreviewPagination = useTablePagination(xmlPreviewProducts);

  const categoryOptions: string[] = Array.from(
    new Set<string>(
      products
        .map((product: any) => String(product.category || "").trim())
        .filter((category: string | any[]) => category.length > 0)
    )
  );

  const inventorySummary = useMemo(() => {
    const total = products.length;
    const critical = products.filter((product: any) => {
      const stock = Number(product.stock || 0);
      const minStock = Math.max(1, Number(product.minStock || 1));
      return stock <= minStock * 0.5;
    }).length;
    const belowMin = products.filter((product: any) => {
      const stock = Number(product.stock || 0);
      const minStock = Math.max(1, Number(product.minStock || 1));
      return stock > minStock * 0.5 && stock <= minStock;
    }).length;
    return { total, critical, belowMin };
  }, [products]);

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Carregando produtos...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-4xl font-heading font-bold tracking-tight text-foreground">
              Produtos & Estoque
            </h1>
            <p className="text-sm text-muted-foreground">
              Gerencie seu catalogo, precos e niveis de estoque.
            </p>
          </div>
          <div className="flex gap-2">
            <input
              type="file"
              ref={fileInputRef}
              accept=".xml"
              onChange={handleXmlImport}
              className="hidden"
            />
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={isImporting}
            >
              {isImporting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <FileUp className="mr-2 h-4 w-4" />
              )}
              {isImporting ? "Importando..." : "Importar XML"}
            </Button>
            <Button
              variant="outline"
              onClick={handleSendPdvLoad}
              disabled={isSendingPdvLoad}
              data-testid="button-send-pdv-load-inventory"
            >
              {isSendingPdvLoad ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Upload className="mr-2 h-4 w-4" />
              )}
              Enviar Carga PDV
            </Button>
            <Button
              variant="outline"
              onClick={() => setManifestModalOpen(true)}
              data-testid="button-open-manifest-notes"
            >
              <ReceiptText className="mr-2 h-4 w-4" />
              Notas SEFAZ
            </Button>
            <Button onClick={handleNewProduct}>
              <Plus className="mr-2 h-4 w-4" /> Novo Produto
            </Button>
          </div>
        </div>
        {pdvLoadFeedback && (
          <p
            className={`text-sm ${
              pdvLoadFeedback.type === "success"
                ? "text-emerald-700"
                : "text-red-600"
            }`}
            data-testid="pdv-load-feedback-message"
          >
            {pdvLoadFeedback.message}
          </p>
        )}

        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-lg border border-border bg-slate-50 px-4 py-3">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Produtos</p>
              <Package className="h-4 w-4 text-slate-600" />
            </div>
            <p className="text-2xl font-semibold text-slate-800">{inventorySummary.total}</p>
          </div>
          <div className="rounded-lg border border-border bg-rose-50 px-4 py-3">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Criticos</p>
              <AlertTriangle className="h-4 w-4 text-rose-600" />
            </div>
            <p className="text-2xl font-semibold text-rose-700">{inventorySummary.critical}</p>
          </div>
          <div className="rounded-lg border border-border bg-amber-50 px-4 py-3">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Abaixo do minimo</p>
              <CircleAlert className="h-4 w-4 text-amber-600" />
            </div>
            <p className="text-2xl font-semibold text-amber-700">{inventorySummary.belowMin}</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-card p-3 rounded-lg border border-border shadow-sm">
          <div className="relative w-full sm:w-96">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              data-testid="input-search-products"
              placeholder="Buscar produto por nome, EAN ou SKU..."
              className="pl-9"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <Button
              variant="outline"
              className="h-9 rounded-lg flex-1 sm:flex-none"
              onClick={() => setFiltersOpen(true)}
            >
              <Filter className="mr-2 h-4 w-4" /> Filtros
            </Button>
            <Button
              variant="outline"
              className="h-9 rounded-lg flex-1 sm:flex-none"
              onClick={() => setCategoriesOpen(true)}
            >
              Categorias
            </Button>
          </div>
        </div>

        <div className="rounded-md border border-border bg-card p-2">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant={viewMode === "list" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode("list")}
            >
              <List className="mr-1.5 h-4 w-4" />
              Lista
            </Button>
            <Button
              type="button"
              variant={viewMode === "grid" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode("grid")}
            >
              <Grid3X3 className="mr-1.5 h-4 w-4" />
              Grade
            </Button>
          </div>
        </div>

        {filteredProducts.length === 0 ? (
          <div className="rounded-md border border-border bg-card shadow-sm p-12 text-center">
            <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">
              Nenhum produto cadastrado
            </h3>
            <p className="text-muted-foreground mb-4">
              Comece cadastrando seu primeiro produto.
            </p>
            <Button onClick={handleNewProduct}>
              <Plus className="mr-2 h-4 w-4" /> Cadastrar Produto
            </Button>
          </div>
        ) : (
          <div className="rounded-md border border-border bg-card shadow-sm overflow-hidden">
            {viewMode === "list" && (
            <Table className="table-fixed">
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-[90px] text-center">ID</TableHead>
                  <TableHead className="w-[34%] min-w-[220px]">
                    <Button
                      variant="ghost"
                      className="p-0 font-semibold hover:bg-transparent"
                    >
                      Produto <ArrowUpDown className="ml-2 h-3 w-3" />
                    </Button>
                  </TableHead>
                  <TableHead className="w-[13%]">Categoria</TableHead>
                  <TableHead className="w-[9%] text-center">Unidade</TableHead>
                  <TableHead className="w-[12%] text-center">Preco Venda</TableHead>
                  <TableHead className="w-[18%]">Estoque</TableHead>
                  <TableHead className="w-[9%] text-center">Status</TableHead>
                  <TableHead className="w-[6%] text-right">Acoes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {productsPagination.paginatedItems.map((product: any) => {
                  const maxStock = product.maxStock || 100;
                  const stockPercentage = Math.min(
                    (product.stock / maxStock) * 100,
                    100
                  );
                  const minStock = product.minStock || 10;
                  const basePrice = Number.parseFloat(String(product.price || "0"));
                  const promoPrice = Number.parseFloat(String(product.promoPrice || "0"));
                  const hasPromo = Number.isFinite(promoPrice) && promoPrice > 0;
                  const promoDiscount =
                    hasPromo && Number.isFinite(basePrice) && basePrice > 0 && promoPrice < basePrice
                      ? ((basePrice - promoPrice) / basePrice) * 100
                      : null;
                  const formatPromoDate = (value: unknown) => {
                    if (!value) return null;
                    const date = new Date(String(value));
                    if (Number.isNaN(date.getTime())) return null;
                    return date.toLocaleDateString("pt-BR");
                  };
                  const promoStart = formatPromoDate(product.promoStart);
                  const promoEnd = formatPromoDate(product.promoEnd);
                  let statusColor = "bg-emerald-500";
                  let statusText = "Em Estoque";

                  if (product.stock <= minStock * 0.5) {
                    statusColor = "bg-destructive";
                    statusText = "Critico";
                  } else if (product.stock <= minStock) {
                    statusColor = "bg-amber-500";
                    statusText = "Baixo";
                  }

                  return (
                    <TableRow
                      key={product.id}
                      data-testid={`row-product-${product.id}`}
                    >
                      <TableCell className="text-center">
                        <span className="inline-flex min-w-[56px] items-center justify-center rounded-md border border-border bg-muted px-2 py-1 text-xs font-semibold text-foreground">
                          {product.id}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">{product.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {product.ean
                              ? `EAN: ${product.ean}`
                              : product.sku
                              ? `SKU: ${product.sku}`
                              : "Sem codigo"}
                          </span>
                          {product.brand && (
                            <span className="text-xs text-muted-foreground">
                              Marca: {product.brand}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="font-normal">
                          {product.category}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="text-sm">{product.unit || "UN"}</span>
                      </TableCell>
                      <TableCell className="text-center font-medium">
                        <div className="flex flex-col">
                          <span>R$ {parseFloat(product.price).toFixed(2)}</span>
                          {hasPromo && (
                            <span className="text-xs text-emerald-600">
                              Promo: R${" "}
                              {promoPrice.toFixed(2)}
                              {promoDiscount !== null
                                ? ` (${promoDiscount.toFixed(2)}% mais barato)`
                                : ""}
                            </span>
                          )}
                          {(promoStart || promoEnd) && (
                            <span className="text-xs text-muted-foreground">
                              Vigência: {promoStart || "--"} até {promoEnd || "--"}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="flex justify-between text-xs">
                            <span>
                              {product.stock} {product.unit || "un"}
                            </span>
                            <span className="text-muted-foreground">
                              Max: {maxStock}
                            </span>
                          </div>
                          <Progress
                            value={stockPercentage}
                            className="h-2"
                            indicatorClassName={statusColor}
                          />
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge
                          variant="outline"
                          className={`${
                            statusText === "Critico"
                              ? "text-destructive border-destructive/50"
                              : statusText === "Baixo"
                              ? "text-amber-600 border-amber-500/50"
                              : ""
                          }`}
                        >
                          {statusText}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              className="h-8 w-8 p-0"
                              data-testid={`button-actions-${product.id}`}
                            >
                              <span className="sr-only">Open menu</span>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Acoes</DropdownMenuLabel>
                            <DropdownMenuItem
                              onClick={() => handleEdit(product)}
                              data-testid={`button-edit-${product.id}`}
                            >
                              <Pencil className="mr-2 h-4 w-4" /> Editar Produto
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleAdjustStock(product)}
                              data-testid={`button-adjust-stock-${product.id}`}
                            >
                              <PackagePlus className="mr-2 h-4 w-4" /> Ajustar
                              Estoque
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              Imprimir Etiqueta
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => setDeleteProductId(product.id)}
                              data-testid={`button-delete-${product.id}`}
                            >
                              <Trash2 className="mr-2 h-4 w-4" /> Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            )}
            {viewMode === "grid" && (
              <div className="grid gap-3 p-3 sm:grid-cols-2 lg:grid-cols-3">
                {productsPagination.paginatedItems.map((product: any) => {
                  const maxStock = product.maxStock || 100;
                  const stockPercentage = Math.min((product.stock / maxStock) * 100, 100);
                  const minStock = product.minStock || 10;
                  let statusColor = "bg-emerald-500";
                  let statusText = "Em Estoque";

                  if (product.stock <= minStock * 0.5) {
                    statusColor = "bg-destructive";
                    statusText = "Critico";
                  } else if (product.stock <= minStock) {
                    statusColor = "bg-amber-500";
                    statusText = "Baixo";
                  }

                  return (
                    <div key={product.id} className="rounded-lg border border-border bg-white p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex min-w-0 items-start gap-3">
                          <div className="h-12 min-w-[56px] rounded-md bg-muted border border-border flex items-center justify-center text-xs font-semibold text-foreground">
                            {product.id}
                          </div>
                          <div className="min-w-0">
                            <p className="line-clamp-1 font-medium">{product.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {product.ean ? `EAN: ${product.ean}` : product.sku ? `SKU: ${product.sku}` : "Sem codigo"}
                            </p>
                          </div>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Acoes</DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => handleEdit(product)}>
                              <Pencil className="mr-2 h-4 w-4" /> Editar Produto
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleAdjustStock(product)}>
                              <PackagePlus className="mr-2 h-4 w-4" /> Ajustar Estoque
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-destructive" onClick={() => setDeleteProductId(product.id)}>
                              <Trash2 className="mr-2 h-4 w-4" /> Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <p className="text-xs text-muted-foreground">Categoria</p>
                          <Badge variant="secondary" className="mt-1 font-normal">{product.category}</Badge>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Preco Venda</p>
                          <p className="font-semibold">R$ {parseFloat(product.price).toFixed(2)}</p>
                        </div>
                      </div>
                      <div className="mt-2 space-y-1">
                        <div className="flex justify-between text-xs">
                          <span>{product.stock} {product.unit || "un"}</span>
                          <span className="text-muted-foreground">Max: {maxStock}</span>
                        </div>
                        <Progress value={stockPercentage} className="h-2" indicatorClassName={statusColor} />
                        <Badge
                          variant="outline"
                          className={`${
                            statusText === "Critico"
                              ? "text-destructive border-destructive/50"
                              : statusText === "Baixo"
                              ? "text-amber-600 border-amber-500/50"
                              : ""
                          }`}
                        >
                          {statusText}
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <div className="flex items-center justify-between border-t border-border px-3 py-2 text-xs text-muted-foreground">
              <span>
                Exibindo {productsPagination.startItem} a {productsPagination.endItem} de{" "}
                {filteredProducts.length} produtos
              </span>
              <span>{viewMode === "list" ? "Lista" : "Grade"}</span>
            </div>
            <TablePaginationControls
              page={productsPagination.page}
              pageSize={productsPagination.pageSize}
              totalItems={productsPagination.totalItems}
              totalPages={productsPagination.totalPages}
              startItem={productsPagination.startItem}
              endItem={productsPagination.endItem}
              onPageChange={productsPagination.setPage}
              onPageSizeChange={productsPagination.setPageSize}
            />
          </div>
        )}
      </div>

      <Dialog open={filtersOpen} onOpenChange={setFiltersOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Filtros</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <p>Selecione o filtro de estoque.</p>
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant={selectedStockFilter === "all" ? "default" : "outline"}
                onClick={() => setSelectedStockFilter("all")}
              >
                Todos
              </Button>
              <Button
                type="button"
                variant={
                  selectedStockFilter === "in_stock" ? "default" : "outline"
                }
                onClick={() => setSelectedStockFilter("in_stock")}
              >
                Em estoque
              </Button>
              <Button
                type="button"
                variant={selectedStockFilter === "low" ? "default" : "outline"}
                onClick={() => setSelectedStockFilter("low")}
              >
                Baixo
              </Button>
              <Button
                type="button"
                variant={
                  selectedStockFilter === "critical" ? "default" : "outline"
                }
                onClick={() => setSelectedStockFilter("critical")}
              >
                Critico
              </Button>
              <Button
                type="button"
                variant={selectedStockFilter === "out" ? "default" : "outline"}
                onClick={() => setSelectedStockFilter("out")}
              >
                Sem estoque
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFiltersOpen(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={categoriesOpen} onOpenChange={setCategoriesOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Categorias</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <p>Selecione a categoria.</p>
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant={selectedCategory === "all" ? "default" : "outline"}
                onClick={() => {
                  setSelectedCategory("all");
                  setCategoriesOpen(false);
                }}
              >
                Todas
              </Button>
              {categoryOptions.map((category) => (
                <Button
                  key={String(category)}
                  type="button"
                  variant={
                    selectedCategory === category ? "default" : "outline"
                  }
                  onClick={() => {
                    setSelectedCategory(category);
                    setCategoriesOpen(false);
                  }}
                >
                  {category}
                </Button>
              ))}
            </div>
            {categoryOptions.length === 0 && (
              <span className="text-sm text-muted-foreground">
                Sem categorias cadastradas.
              </span>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCategoriesOpen(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={manifestModalOpen} onOpenChange={setManifestModalOpen}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ReceiptText className="h-5 w-5" />
              Notas emitidas para seu CNPJ
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 overflow-y-auto pr-1">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
              <p className="text-sm text-muted-foreground">
                Busque notas recebidas via SEFAZ, selecione uma e importe os
                produtos.
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => handleSyncManifestNotes()}
                  disabled={isSyncingManifestNotes}
                >
                  {isSyncingManifestNotes ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="mr-2 h-4 w-4" />
                  )}
                  {isSyncingManifestNotes ? "Buscando..." : "Buscar na SEFAZ"}
                </Button>
                <Button
                  onClick={async () => {
                    await handleImportSelectedManifestNote();
                    if (selectedManifestNote) setManifestModalOpen(false);
                  }}
                  disabled={!selectedManifestNote || isImporting}
                >
                  {isImporting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <FileUp className="mr-2 h-4 w-4" />
                  )}
                  Importar produtos da nota
                </Button>
              </div>
            </div>

            <div className="flex flex-col lg:flex-row gap-3">
              <div className="relative w-full lg:max-w-sm">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por fornecedor, numero, serie, chave..."
                  className="pl-9"
                  value={manifestSearchTerm}
                  onChange={(e) => setManifestSearchTerm(e.target.value)}
                />
              </div>
              <div className="flex w-full lg:max-w-[430px] gap-2">
                <Input
                  placeholder="Consultar por chave NF-e (44 digitos)"
                  value={manifestAccessKeySearch}
                  onChange={(e) =>
                    setManifestAccessKeySearch(
                      e.target.value.replace(/\D/g, "").slice(0, 44)
                    )
                  }
                  className="font-mono"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleSearchManifestByAccessKey}
                  disabled={isSyncingManifestNotes}
                >
                  {isSyncingManifestNotes ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="mr-2 h-4 w-4" />
                  )}
                  Consultar chave
                </Button>
              </div>
              <Select
                value={manifestPeriodFilter}
                onValueChange={(value) =>
                  setManifestPeriodFilter(
                    value as "all" | "current_month" | "30d" | "90d"
                  )
                }
              >
                <SelectTrigger className="w-full lg:w-[220px]">
                  <SelectValue placeholder="Periodo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todo periodo</SelectItem>
                  <SelectItem value="current_month">Este mes</SelectItem>
                  <SelectItem value="30d">Ultimos 30 dias</SelectItem>
                  <SelectItem value="90d">Ultimos 90 dias</SelectItem>
                </SelectContent>
              </Select>
              <div className="text-sm text-muted-foreground flex items-center">
                {manifestDocumentsError
                  ? "Nao foi possivel carregar notas"
                  : isLoadingManifestDocuments
                  ? "Carregando notas salvas..."
                  : `${filteredManifestNotes.length} nota(s) encontrada(s)`}
              </div>
            </div>

            <div className="max-h-[360px] overflow-auto rounded-md border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[44px]"></TableHead>
                    <TableHead>Numero</TableHead>
                    <TableHead>Fornecedor</TableHead>
                    <TableHead>Data emissao</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Chave</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {manifestDocumentsError ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-6">
                        <span className="text-muted-foreground">
                          {manifestDocumentsError instanceof Error
                            ? manifestDocumentsError.message
                            : "Erro ao carregar notas recebidas"}
                        </span>
                      </TableCell>
                    </TableRow>
                  ) : filteredManifestNotes.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-6">
                        <span className="text-muted-foreground">
                          Nenhuma nota salva. Clique em "Buscar na SEFAZ" para
                          sincronizar.
                        </span>
                      </TableCell>
                    </TableRow>
                  ) : (
                    manifestNotesPagination.paginatedItems.map((note) => (
                      <TableRow
                        key={note.id}
                        className="cursor-pointer"
                        onClick={() => setSelectedManifestNoteId(note.id)}
                        data-state={
                          selectedManifestNoteId === note.id
                            ? "selected"
                            : undefined
                        }
                      >
                        <TableCell>
                          <input
                            type="radio"
                            checked={selectedManifestNoteId === note.id}
                            onChange={() => setSelectedManifestNoteId(note.id)}
                            aria-label={`Selecionar nota ${note.nfeNumber || note.documentKey}`}
                          />
                        </TableCell>
                        <TableCell>
                          {note.nfeSeries || note.nfeNumber
                            ? `${note.nfeSeries || "-"} / ${note.nfeNumber || "-"}`
                            : "-"}
                        </TableCell>
                        <TableCell className="max-w-[240px] truncate">
                          {note.issuerName}
                        </TableCell>
                        <TableCell>
                          {note.issuedAt
                            ? new Date(note.issuedAt).toLocaleDateString("pt-BR")
                            : "-"}
                        </TableCell>
                        <TableCell>
                          {typeof note.noteTotal === "number"
                            ? note.noteTotal.toLocaleString("pt-BR", {
                                style: "currency",
                                currency: "BRL",
                              })
                            : "-"}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {note.documentKey || "-"}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
              <TablePaginationControls
                page={manifestNotesPagination.page}
                pageSize={manifestNotesPagination.pageSize}
                totalItems={manifestNotesPagination.totalItems}
                totalPages={manifestNotesPagination.totalPages}
                startItem={manifestNotesPagination.startItem}
                endItem={manifestNotesPagination.endItem}
                onPageChange={manifestNotesPagination.setPage}
                onPageSizeChange={manifestNotesPagination.setPageSize}
              />
            </div>

            {manifestLastSyncResult && (
              <div className="rounded-md border border-border bg-muted/30 p-3 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    variant={
                      manifestLastSyncResult.success ? "default" : "destructive"
                    }
                  >
                    {manifestLastSyncResult.status || "sem-status"}
                  </Badge>
                  <span className="text-sm">
                    {manifestLastSyncResult.message || "Sem mensagem da SEFAZ"}
                  </span>
                </div>

                <div className="text-xs text-muted-foreground flex flex-wrap gap-x-4 gap-y-1">
                  <span>
                    `usedUltNSU`: {manifestLastSyncResult.usedUltNSU || "-"}
                  </span>
                  <span>`lastNSU`: {manifestLastSyncResult.lastNSU || "-"}</span>
                  <span>`maxNSU`: {manifestLastSyncResult.maxNSU || "-"}</span>
                  <span>`docs`: {manifestLastSyncResult.documents?.length ?? 0}</span>
                </div>

                {manifestSchemasSummary.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {manifestSchemasSummary.map(([schema, count]) => (
                      <Badge key={schema} variant="outline">
                        {schema}: {count}
                      </Badge>
                    ))}
                  </div>
                )}

                {manifestLastSyncResult.documents &&
                  manifestLastSyncResult.documents.length > 0 && (
                    <div className="text-xs text-muted-foreground">
                      {manifestLastSyncResult.documents
                        .slice(0, 3)
                        .map((doc) => doc.documentKey || doc.nsu || "-")
                        .join(" | ")}
                      {manifestLastSyncResult.documents.length > 3 ? " ..." : ""}
                    </div>
                  )}

                {manifestLastSyncResult.batches &&
                  manifestLastSyncResult.batches.length > 1 && (
                    <div className="text-xs text-muted-foreground">
                      Lotes consultados: {manifestLastSyncResult.batches.length}
                    </div>
                  )}
              </div>
            )}
          </div>

          <DialogFooter className="border-t pt-4">
            <Button variant="outline" onClick={() => setManifestModalOpen(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ProductForm
        open={formOpen}
        onOpenChange={setFormOpen}
        editProduct={editProduct}
      />

      <AlertDialog
        open={deleteProductId !== null}
        onOpenChange={() => setDeleteProductId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Produto</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este produto? Esta ação não pode
              ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                deleteProductId && deleteMutation.mutate(deleteProductId)
              }
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={stockAdjustment !== null}
        onOpenChange={() => closeAdjustDialog()}
      >
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Ajustar Estoque</DialogTitle>
          </DialogHeader>

          {stockAdjustment && (
            <div className="space-y-4">
              <div className="p-3 bg-muted rounded-lg">
                <p className="font-medium">{stockAdjustment.productName}</p>
                <p className="text-sm text-muted-foreground">
                  Estoque atual:{" "}
                  <span className="font-semibold text-foreground">
                    {stockAdjustment.currentStock}
                  </span>{" "}
                  unidades
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="adjustType">Tipo de Movimentação *</Label>
                <Select value={adjustType} onValueChange={setAdjustType}>
                  <SelectTrigger
                    id="adjustType"
                    data-testid="select-adjust-type"
                  >
                    <SelectValue placeholder="Selecione o tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    {adjustmentTypes.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        <div className="flex items-center gap-2">
                          <type.icon className="h-4 w-4" />
                          {type.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="adjustQuantity">Quantidade *</Label>
                <Input
                  id="adjustQuantity"
                  type="number"
                  min="1"
                  placeholder="Ex: 10"
                  value={adjustQuantity}
                  onChange={(e) => setAdjustQuantity(e.target.value)}
                  data-testid="input-adjust-quantity"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="adjustReason">Motivo *</Label>
                <Select value={adjustReason} onValueChange={setAdjustReason}>
                  <SelectTrigger
                    id="adjustReason"
                    data-testid="select-adjust-reason"
                  >
                    <SelectValue placeholder="Selecione o motivo" />
                  </SelectTrigger>
                  <SelectContent>
                    {adjustmentReasons.map((reason) => (
                      <SelectItem key={reason} value={reason}>
                        {reason}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="adjustNotes">Observações (opcional)</Label>
                <Textarea
                  id="adjustNotes"
                  placeholder="Detalhes adicionais sobre o ajuste..."
                  value={adjustNotes}
                  onChange={(e) => setAdjustNotes(e.target.value)}
                  data-testid="textarea-adjust-notes"
                />
              </div>

              {adjustQuantity && (
                <div className="p-3 bg-muted rounded-lg border">
                  <p className="text-sm">
                    <span className="text-muted-foreground">
                      Novo estoque:{" "}
                    </span>
                    <span
                      className={`font-semibold ${
                        getNewStockPreview() < 0
                          ? "text-destructive"
                          : "text-emerald-600"
                      }`}
                    >
                      {getNewStockPreview()} unidades
                    </span>
                  </p>
                  {getNewStockPreview() < 0 && (
                    <p className="text-xs text-destructive mt-1">
                      Atenção: O estoque não pode ficar negativo
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={closeAdjustDialog}>
              Cancelar
            </Button>
            <Button
              onClick={handleSubmitAdjustment}
              disabled={
                adjustStockMutation.isPending || getNewStockPreview() < 0
              }
              data-testid="button-confirm-adjustment"
            >
              {adjustStockMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                "Confirmar Ajuste"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={xmlPreviewOpen}
        onOpenChange={(open) => {
          if (!open) {
            setXmlPreviewOpen(false);
            setXmlPreviewProducts([]);
            setXmlFiscalEditTempId(null);
            setXmlReferenceTotals(null);
          }
        }}
      >
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Pré-visualização da Importação XML</DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-auto">
            {xmlPreviewProducts.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhum produto encontrado no XML
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex gap-4 text-sm">
                  <Badge variant="outline" className="px-3 py-1">
                    Total: {xmlPreviewProducts.length} produtos
                  </Badge>
                  <Badge variant="secondary" className="px-3 py-1">
                    Novos:{" "}
                    {xmlPreviewProducts.filter((p) => !p.isExisting).length}
                  </Badge>
                  <Badge className="px-3 py-1 bg-amber-500">
                    Existentes:{" "}
                    {xmlPreviewProducts.filter((p) => p.isExisting).length}
                  </Badge>
                </div>

                <div className="rounded-md border p-3 grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
                  <div>
                    <span className="text-muted-foreground">V. total produtos</span>
                    <p
                      className={`font-semibold ${
                        xmlTotalsComparison?.byKey.productsTotal?.mismatch
                          ? "text-red-600"
                          : ""
                      }`}
                    >
                      R$ {xmlImportTotals.productsTotal.toFixed(2)}
                    </p>
                    {xmlTotalsComparison?.byKey.productsTotal?.mismatch && (
                      <p className="text-xs text-red-600">
                        XML: R$ {xmlTotalsComparison.byKey.productsTotal.expected.toFixed(2)} | Dif: R$ {formatSignedMoney(xmlTotalsComparison.byKey.productsTotal.diff)}
                      </p>
                    )}
                  </div>
                  <div>
                    <span className="text-muted-foreground">V. desconto</span>
                    <p
                      className={`font-semibold ${
                        xmlTotalsComparison?.byKey.discountTotal?.mismatch
                          ? "text-red-600"
                          : ""
                      }`}
                    >
                      R$ {xmlImportTotals.discountTotal.toFixed(2)}
                    </p>
                    {xmlTotalsComparison?.byKey.discountTotal?.mismatch && (
                      <p className="text-xs text-red-600">
                        XML: R$ {xmlTotalsComparison.byKey.discountTotal.expected.toFixed(2)} | Dif: R$ {formatSignedMoney(xmlTotalsComparison.byKey.discountTotal.diff)}
                      </p>
                    )}
                  </div>
                  <div>
                    <span className="text-muted-foreground">ICMS ST total</span>
                    <p
                      className={`font-semibold ${
                        xmlTotalsComparison?.byKey.icmsStTotal?.mismatch
                          ? "text-red-600"
                          : ""
                      }`}
                    >
                      R$ {xmlImportTotals.icmsStTotal.toFixed(2)}
                    </p>
                    {xmlTotalsComparison?.byKey.icmsStTotal?.mismatch && (
                      <p className="text-xs text-red-600">
                        XML: R$ {xmlTotalsComparison.byKey.icmsStTotal.expected.toFixed(2)} | Dif: R$ {formatSignedMoney(xmlTotalsComparison.byKey.icmsStTotal.diff)}
                      </p>
                    )}
                  </div>
                  <div>
                    <span className="text-muted-foreground">IPI total</span>
                    <p
                      className={`font-semibold ${
                        xmlTotalsComparison?.byKey.totalIpi?.mismatch
                          ? "text-red-600"
                          : ""
                      }`}
                    >
                      R$ {xmlImportTotals.totalIpi.toFixed(2)}
                    </p>
                    {xmlTotalsComparison?.byKey.totalIpi?.mismatch && (
                      <p className="text-xs text-red-600">
                        XML: R$ {xmlTotalsComparison.byKey.totalIpi.expected.toFixed(2)} | Dif: R$ {formatSignedMoney(xmlTotalsComparison.byKey.totalIpi.diff)}
                      </p>
                    )}
                  </div>
                  <div>
                    <span className="text-muted-foreground">V. total nota</span>
                    <p
                      className={`font-semibold ${
                        xmlTotalsComparison?.byKey.noteTotal?.mismatch
                          ? "text-red-600"
                          : ""
                      }`}
                    >
                      R$ {xmlImportTotals.noteTotal.toFixed(2)}
                    </p>
                    {xmlTotalsComparison?.byKey.noteTotal?.mismatch && (
                      <p className="text-xs text-red-600">
                        XML: R$ {xmlTotalsComparison.byKey.noteTotal.expected.toFixed(2)} | Dif: R$ {formatSignedMoney(xmlTotalsComparison.byKey.noteTotal.diff)}
                      </p>
                    )}
                  </div>
                </div>
                {xmlTotalsComparison && !xmlTotalsComparison.canImport && (
                  <p className="text-sm text-red-600">
                    Divergência com a capa da nota XML:{" "}
                    {xmlTotalsComparison.mismatches.join(", ")}. A importação
                    será bloqueada.
                  </p>
                )}

                <Table>
                  <TableHeader className="sticky top-0 z-10 bg-background">
                    <TableRow className="bg-background">
                      <TableHead className="min-w-[200px]">Produto</TableHead>
                      <TableHead>EAN</TableHead>
                      <TableHead>Unidade</TableHead>
                      <TableHead>Unid/Embalagem</TableHead>
                      <TableHead>Qtde Pacotes</TableHead>
                      <TableHead>Valor Fardo Unit. (R$)</TableHead>
                      <TableHead>Valor Total (R$)</TableHead>
                      <TableHead>Estoque Final</TableHead>
                      <TableHead>Custo Unit. (R$)</TableHead>
                      <TableHead>Margem (%)</TableHead>
                      <TableHead>Venda (R$)</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Acoes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {xmlPreviewPagination.paginatedItems.map((product) => (
                      <TableRow
                        key={product.tempId}
                        onDoubleClick={() => setXmlFiscalEditTempId(product.tempId)}
                        className="cursor-pointer"
                      >
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium">{product.name}</span>
                            {product.ncm && (
                              <span className="text-xs text-muted-foreground">
                                NCM: {product.ncm}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Input
                            type="text"
                            inputMode="numeric"
                            className="w-36 font-mono text-xs"
                            value={product.ean || ""}
                            placeholder="Sem EAN"
                            onChange={(e) =>
                              updatePreviewEan(product.tempId, e.target.value)
                            }
                          />
                        </TableCell>
                        <TableCell>{product.unit}</TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min="1"
                            className="w-24"
                            value={product.unitsPerPackage ?? 1}
                            onChange={(e) =>
                              updatePreviewUnitsPerPackage(
                                product.tempId,
                                parseInt(e.target.value) || 1
                              )
                            }
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min="0"
                            className="w-20"
                            value={product.quantity}
                            onChange={(e) =>
                              updatePreviewQuantity(
                                product.tempId,
                                parseInt(e.target.value) || 0
                              )
                            }
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="text"
                            inputMode="decimal"
                            className="w-28"
                            value={(
                              product.quantity > 0
                                ? toMoney(product.totalPurchaseValue) / product.quantity
                                : 0
                            ).toFixed(2)}
                            onChange={(e) =>
                              updatePreviewPackagePurchaseValue(
                                product.tempId,
                                e.target.value
                              )
                            }
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="text"
                            inputMode="decimal"
                            className="w-28"
                            value={product.totalPurchaseValue}
                            onChange={(e) =>
                              updatePreviewTotalPurchaseValue(
                                product.tempId,
                                e.target.value
                              )
                            }
                          />
                        </TableCell>
                        <TableCell>
                          <span className="font-medium">
                            {product.stockQuantity}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="font-medium">
                            {Number(product.purchasePrice).toFixed(2)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Input
                            type="text"
                            inputMode="decimal"
                            className="w-24"
                            value={product.marginPercent ?? 0}
                            onChange={(e) =>
                              updatePreviewMarginPercent(
                                product.tempId,
                                e.target.value
                              )
                            }
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="text"
                            inputMode="decimal"
                            className="w-28"
                            value={product.price}
                            onChange={(e) =>
                              updatePreviewSalePrice(
                                product.tempId,
                                e.target.value
                              )
                            }
                          />
                        </TableCell>
                        <TableCell>
                          {product.isExisting ? (
                            <div className="flex flex-col gap-1">
                              <Badge className="bg-amber-500 text-xs">
                                Existente
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                Estoque atual: {product.existingStock}
                              </span>
                            </div>
                          ) : (
                            <Badge variant="secondary" className="text-xs">
                              Novo
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setXmlFiscalEditTempId(product.tempId)}
                            >
                              Tributação
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeFromPreview(product.tempId)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <TablePaginationControls
                  page={xmlPreviewPagination.page}
                  pageSize={xmlPreviewPagination.pageSize}
                  totalItems={xmlPreviewPagination.totalItems}
                  totalPages={xmlPreviewPagination.totalPages}
                  startItem={xmlPreviewPagination.startItem}
                  endItem={xmlPreviewPagination.endItem}
                  onPageChange={xmlPreviewPagination.setPage}
                  onPageSizeChange={xmlPreviewPagination.setPageSize}
                />
              </div>
            )}
          </div>

          <Dialog
            open={xmlFiscalEditTempId !== null}
            onOpenChange={(open) => {
              if (!open) setXmlFiscalEditTempId(null);
            }}
          >
            <DialogContent className="max-w-4xl">
              <DialogHeader>
                <DialogTitle>Tributação do item (Importação XML)</DialogTitle>
              </DialogHeader>
              {editingXmlFiscalProduct && (
                <div className="space-y-4">
                  <div className="rounded-md border p-3 text-sm">
                    <p className="font-semibold">{editingXmlFiscalProduct.name}</p>
                    <p className="text-muted-foreground">EAN: {editingXmlFiscalProduct.ean || "-"}</p>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div>
                      <Label>CFOP</Label>
                      <Input
                        value={editingXmlFiscalProduct.cfop}
                        onChange={(e) =>
                          updatePreviewFiscalField(
                            editingXmlFiscalProduct.tempId,
                            "cfop",
                            e.target.value
                          )
                        }
                      />
                    </div>
                    <div>
                      <Label>CEST</Label>
                      <Input
                        value={editingXmlFiscalProduct.cest || ""}
                        onChange={(e) =>
                          updatePreviewFiscalField(
                            editingXmlFiscalProduct.tempId,
                            "cest",
                            e.target.value
                          )
                        }
                      />
                    </div>
                    <div>
                      <Label>CST ICMS</Label>
                      <Input
                        value={editingXmlFiscalProduct.cstIcms}
                        onChange={(e) =>
                          updatePreviewFiscalField(
                            editingXmlFiscalProduct.tempId,
                            "cstIcms",
                            e.target.value
                          )
                        }
                      />
                    </div>
                    <div>
                      <Label>CST IPI</Label>
                      <Input
                        value={editingXmlFiscalProduct.cstIpi}
                        onChange={(e) =>
                          updatePreviewFiscalField(
                            editingXmlFiscalProduct.tempId,
                            "cstIpi",
                            e.target.value
                          )
                        }
                      />
                    </div>
                    <div>
                      <Label>CST PIS/COFINS</Label>
                      <Input
                        value={editingXmlFiscalProduct.cstPisCofins}
                        onChange={(e) =>
                          updatePreviewFiscalField(
                            editingXmlFiscalProduct.tempId,
                            "cstPisCofins",
                            e.target.value
                          )
                        }
                      />
                    </div>
                    <div>
                      <Label>V. desconto (R$)</Label>
                      <Input
                        type="text"
                        inputMode="decimal"
                        value={editingXmlFiscalProduct.discountValue}
                        onChange={(e) =>
                          updatePreviewFiscalField(
                            editingXmlFiscalProduct.tempId,
                            "discountValue",
                            e.target.value
                          )
                        }
                      />
                    </div>
                    <div>
                      <Label>BC ICMS (R$)</Label>
                      <Input
                        type="text"
                        inputMode="decimal"
                        value={editingXmlFiscalProduct.bcIcmsValue}
                        onChange={(e) =>
                          updatePreviewFiscalField(
                            editingXmlFiscalProduct.tempId,
                            "bcIcmsValue",
                            e.target.value
                          )
                        }
                      />
                    </div>
                    <div>
                      <Label>V. ICMS (R$)</Label>
                      <Input
                        type="text"
                        inputMode="decimal"
                        value={editingXmlFiscalProduct.icmsValue}
                        onChange={(e) =>
                          updatePreviewFiscalField(
                            editingXmlFiscalProduct.tempId,
                            "icmsValue",
                            e.target.value
                          )
                        }
                      />
                    </div>
                    <div>
                      <Label>V. IPI (R$)</Label>
                      <Input
                        type="text"
                        inputMode="decimal"
                        value={editingXmlFiscalProduct.ipiValue}
                        onChange={(e) =>
                          updatePreviewFiscalField(
                            editingXmlFiscalProduct.tempId,
                            "ipiValue",
                            e.target.value
                          )
                        }
                      />
                    </div>
                    <div>
                      <Label>Aliq. ICMS (%)</Label>
                      <Input
                        type="text"
                        inputMode="decimal"
                        value={editingXmlFiscalProduct.icmsAliquot}
                        onChange={(e) =>
                          updatePreviewFiscalField(
                            editingXmlFiscalProduct.tempId,
                            "icmsAliquot",
                            e.target.value
                          )
                        }
                      />
                    </div>
                    <div>
                      <Label>Aliq. IPI (%)</Label>
                      <Input
                        type="text"
                        inputMode="decimal"
                        value={editingXmlFiscalProduct.ipiAliquot}
                        onChange={(e) =>
                          updatePreviewFiscalField(
                            editingXmlFiscalProduct.tempId,
                            "ipiAliquot",
                            e.target.value
                          )
                        }
                      />
                    </div>
                    <div>
                      <Label>V. ICMS ST (R$)</Label>
                      <Input
                        type="text"
                        inputMode="decimal"
                        value={editingXmlFiscalProduct.icmsStValue}
                        onChange={(e) =>
                          updatePreviewFiscalField(
                            editingXmlFiscalProduct.tempId,
                            "icmsStValue",
                            e.target.value
                          )
                        }
                      />
                    </div>
                    <div>
                      <Label>Origem</Label>
                      <Input
                        value={editingXmlFiscalProduct.origin}
                        onChange={(e) =>
                          updatePreviewFiscalField(
                            editingXmlFiscalProduct.tempId,
                            "origin",
                            e.target.value
                          )
                        }
                      />
                    </div>
                  </div>
                </div>
              )}
              <DialogFooter>
                <Button variant="outline" onClick={() => setXmlFiscalEditTempId(null)}>
                  Concluir
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <DialogFooter className="border-t pt-4">
            <Button
              variant="outline"
              onClick={() => {
                setXmlPreviewOpen(false);
                setXmlPreviewProducts([]);
                setXmlFiscalEditTempId(null);
                setXmlReferenceTotals(null);
              }}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleConfirmImport}
              disabled={
                isConfirmingImport ||
                xmlPreviewProducts.length === 0 ||
                (xmlTotalsComparison ? !xmlTotalsComparison.canImport : false)
              }
            >
              {isConfirmingImport ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Importando...
                </>
              ) : (
                <>Confirmar Importação ({xmlPreviewProducts.length} produtos)</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
