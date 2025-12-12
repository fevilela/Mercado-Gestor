import { useState } from "react";
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
  FileDown,
  ArrowUpDown,
  Package,
  Pencil,
  Trash2,
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

export default function Inventory() {
  const [formOpen, setFormOpen] = useState(false);
  const [editProduct, setEditProduct] = useState<any>(null);
  const [deleteProductId, setDeleteProductId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const queryClient = useQueryClient();

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["/api/products"],
    queryFn: async () => {
      const res = await fetch("/api/products");
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

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

  const filteredProducts = products.filter((product: any) => {
    const search = searchTerm.toLowerCase();
    return (
      product.name.toLowerCase().includes(search) ||
      (product.ean && product.ean.toLowerCase().includes(search)) ||
      (product.sku && product.sku.toLowerCase().includes(search)) ||
      product.category.toLowerCase().includes(search)
    );
  });

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
            <Button variant="outline">
              <FileDown className="mr-2 h-4 w-4" /> Importar XML
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
              placeholder="Buscar por nome, código de barras ou SKU..."
              className="pl-9"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <Button variant="outline" className="flex-1 sm:flex-none">
              <Filter className="mr-2 h-4 w-4" /> Filtros
            </Button>
            <Button variant="outline" className="flex-1 sm:flex-none">
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
                    <TableRow key={product.id}>
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
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <span className="sr-only">Open menu</span>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Ações</DropdownMenuLabel>
                            <DropdownMenuItem
                              onClick={() => handleEdit(product)}
                            >
                              <Pencil className="mr-2 h-4 w-4" /> Editar Produto
                            </DropdownMenuItem>
                            <DropdownMenuItem>Ajustar Estoque</DropdownMenuItem>
                            <DropdownMenuItem>
                              Imprimir Etiqueta
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => setDeleteProductId(product.id)}
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
    </Layout>
  );
}
