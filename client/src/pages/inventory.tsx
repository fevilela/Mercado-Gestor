import Layout from "@/components/layout";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { 
  Search, 
  Filter, 
  Plus, 
  MoreHorizontal, 
  FileDown,
  ArrowUpDown
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { MOCK_PRODUCTS } from "@/lib/mock-data";
import { Progress } from "@/components/ui/progress";

export default function Inventory() {
  return (
    <Layout>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-heading font-bold tracking-tight text-foreground">Produtos & Estoque</h1>
            <p className="text-muted-foreground">Gerencie seu catálogo, preços e níveis de estoque.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline">
              <FileDown className="mr-2 h-4 w-4" /> Importar XML
            </Button>
            <Button>
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

        <div className="rounded-md border border-border bg-card shadow-sm overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-[100px]">Imagem</TableHead>
                <TableHead className="min-w-[200px]">
                  <Button variant="ghost" className="p-0 font-semibold hover:bg-transparent">
                    Produto <ArrowUpDown className="ml-2 h-3 w-3" />
                  </Button>
                </TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Preço Venda</TableHead>
                <TableHead className="min-w-[150px]">Estoque</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {MOCK_PRODUCTS.map((product) => {
                const stockPercentage = Math.min((product.stock / 100) * 100, 100);
                let statusColor = "bg-emerald-500";
                let statusText = "Em Estoque";
                
                if (product.stock <= 10) {
                  statusColor = "bg-destructive";
                  statusText = "Crítico";
                } else if (product.stock <= 30) {
                  statusColor = "bg-amber-500";
                  statusText = "Baixo";
                }

                return (
                  <TableRow key={product.id}>
                    <TableCell>
                      <div className="h-12 w-12 rounded-md bg-muted flex items-center justify-center overflow-hidden border border-border">
                        {/* Placeholder for real images */}
                        <Package className="h-6 w-6 text-muted-foreground opacity-50" />
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">{product.name}</span>
                        <span className="text-xs text-muted-foreground">EAN: {product.code}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="font-normal">{product.category}</Badge>
                    </TableCell>
                    <TableCell className="font-medium">
                      R$ {product.price.toFixed(2)}
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span>{product.stock} un</span>
                          <span className="text-muted-foreground">Meta: 100</span>
                        </div>
                        <Progress value={stockPercentage} className={`h-2`} indicatorClassName={statusColor} />
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`${statusText === 'Crítico' ? 'text-destructive border-destructive/50' : ''}`}>
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
                          <DropdownMenuItem>Editar Produto</DropdownMenuItem>
                          <DropdownMenuItem>Ajustar Estoque</DropdownMenuItem>
                          <DropdownMenuItem>Imprimir Etiqueta</DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive">Inativar</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>
    </Layout>
  );
}

function Package(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m7.5 4.27 9 5.15" />
      <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
      <path d="m3.3 7 8.7 5 8.7-5" />
      <path d="M12 22v-10" />
    </svg>
  );
}
