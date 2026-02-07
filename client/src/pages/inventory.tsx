import { useState, useRef } from "react";
import Layout from "@/components/layout";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  price: string;
  purchasePrice: string;
  existingProductId: number | null;
  existingProductName: string | null;
  existingStock: number;
  isExisting: boolean;
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
  const [isConfirmingImport, setIsConfirmingImport] = useState(false);
  const [selectedStockFilter, setSelectedStockFilter] = useState<
    "all" | "in_stock" | "low" | "critical" | "out"
  >("all");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["/api/products"],
    queryFn: async () => {
      const res = await fetch("/api/products");
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const handleXmlImport = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".xml")) {
      toast.error("Por favor, selecione um arquivo XML válido");
      return;
    }

    setIsImporting(true);
    try {
      const xmlContent = await file.text();
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
      setXmlPreviewProducts(result.products);
      setXmlPreviewOpen(true);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Erro ao processar XML"
      );
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleConfirmImport = async () => {
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
        p.tempId === tempId ? { ...p, quantity: Math.max(0, newQuantity) } : p
      )
    );
  };

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

  const categoryOptions: string[] = Array.from(
    new Set<string>(
      products
        .map((product: any) => String(product.category || "").trim())
        .filter((category: string | any[]) => category.length > 0)
    )
  );

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
      <div className="flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-heading font-bold tracking-tight text-foreground">
              Produtos & Estoque
            </h1>
            <p className="text-muted-foreground">
              Gerencie seu catálogo, preços e níveis de estoque.
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
            <Button onClick={handleNewProduct}>
              <Plus className="mr-2 h-4 w-4" /> Novo Produto
            </Button>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-card p-4 rounded-lg border border-border shadow-sm">
          <div className="relative w-full sm:w-96">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              data-testid="input-search-products"
              placeholder="Buscar por nome, código de barras, EAN ou SKU..."
              className="pl-9"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <Button
              variant="outline"
              className="flex-1 sm:flex-none"
              onClick={() => setFiltersOpen(true)}
            >
              <Filter className="mr-2 h-4 w-4" /> Filtros
            </Button>
            <Button
              variant="outline"
              className="flex-1 sm:flex-none"
              onClick={() => setCategoriesOpen(true)}
            >
              Categorias
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
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-[100px]">Imagem</TableHead>
                  <TableHead className="min-w-[200px]">
                    <Button
                      variant="ghost"
                      className="p-0 font-semibold hover:bg-transparent"
                    >
                      Produto <ArrowUpDown className="ml-2 h-3 w-3" />
                    </Button>
                  </TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Unidade</TableHead>
                  <TableHead>Preço Venda</TableHead>
                  <TableHead className="min-w-[150px]">Estoque</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProducts.map((product: any) => {
                  const maxStock = product.maxStock || 100;
                  const stockPercentage = Math.min(
                    (product.stock / maxStock) * 100,
                    100
                  );
                  const minStock = product.minStock || 10;
                  let statusColor = "bg-emerald-500";
                  let statusText = "Em Estoque";

                  if (product.stock <= minStock * 0.5) {
                    statusColor = "bg-destructive";
                    statusText = "Crítico";
                  } else if (product.stock <= minStock) {
                    statusColor = "bg-amber-500";
                    statusText = "Baixo";
                  }

                  return (
                    <TableRow
                      key={product.id}
                      data-testid={`row-product-${product.id}`}
                    >
                      <TableCell>
                        <div className="h-12 w-12 rounded-md bg-muted flex items-center justify-center overflow-hidden border border-border">
                          {product.mainImageUrl ? (
                            <img
                              src={product.mainImageUrl}
                              alt={product.name}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <Package className="h-6 w-6 text-muted-foreground opacity-50" />
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">{product.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {product.ean
                              ? `EAN: ${product.ean}`
                              : product.sku
                              ? `SKU: ${product.sku}`
                              : "Sem código"}
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
                      <TableCell>
                        <span className="text-sm">{product.unit || "UN"}</span>
                      </TableCell>
                      <TableCell className="font-medium">
                        <div className="flex flex-col">
                          <span>R$ {parseFloat(product.price).toFixed(2)}</span>
                          {product.promoPrice && (
                            <span className="text-xs text-emerald-600">
                              Promo: R${" "}
                              {parseFloat(product.promoPrice).toFixed(2)}
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
                              Máx: {maxStock}
                            </span>
                          </div>
                          <Progress
                            value={stockPercentage}
                            className="h-2"
                            indicatorClassName={statusColor}
                          />
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`${
                            statusText === "Crítico"
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
                            <DropdownMenuLabel>Ações</DropdownMenuLabel>
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

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[200px]">Produto</TableHead>
                      <TableHead>EAN</TableHead>
                      <TableHead>Unidade</TableHead>
                      <TableHead>Quantidade</TableHead>
                      <TableHead>Preço</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {xmlPreviewProducts.map((product) => (
                      <TableRow key={product.tempId}>
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
                          <span className="text-xs font-mono">
                            {product.ean || "-"}
                          </span>
                        </TableCell>
                        <TableCell>{product.unit}</TableCell>
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
                          R$ {parseFloat(product.price).toFixed(2)}
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
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeFromPreview(product.tempId)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>

          <DialogFooter className="border-t pt-4">
            <Button
              variant="outline"
              onClick={() => {
                setXmlPreviewOpen(false);
                setXmlPreviewProducts([]);
              }}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleConfirmImport}
              disabled={isConfirmingImport || xmlPreviewProducts.length === 0}
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
