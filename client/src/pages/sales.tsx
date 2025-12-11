import Layout from "@/components/layout";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Eye, Printer, FileText } from "lucide-react";

const MOCK_SALES = [
  { id: "1024", date: "11/12/2025 10:42", client: "Consumidor Final", total: 156.00, items: 8, status: "Concluído", method: "Cartão Crédito" },
  { id: "1023", date: "11/12/2025 10:38", client: "Maria Oliveira", total: 42.50, items: 3, status: "Concluído", method: "PIX" },
  { id: "1022", date: "11/12/2025 10:35", client: "Consumidor Final", total: 89.90, items: 5, status: "Concluído", method: "Dinheiro" },
  { id: "1021", date: "11/12/2025 10:30", client: "José Silva", total: 210.00, items: 12, status: "Concluído", method: "Cartão Débito" },
  { id: "1020", date: "11/12/2025 10:15", client: "Consumidor Final", total: 15.00, items: 1, status: "Cancelado", method: "Dinheiro" },
];

export default function Sales() {
  return (
    <Layout>
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-heading font-bold tracking-tight text-foreground">Vendas & Pedidos</h1>
            <p className="text-muted-foreground">Histórico de vendas e emissão de notas.</p>
          </div>
          <Button>
            <Printer className="mr-2 h-4 w-4" /> Relatório de Fechamento
          </Button>
        </div>

        <div className="flex items-center gap-4 bg-card p-4 rounded-lg border border-border shadow-sm">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nº pedido, cliente..."
              className="pl-9"
            />
          </div>
          <div className="flex gap-2">
            <Button variant="outline">Filtros</Button>
            <Button variant="outline">Hoje</Button>
          </div>
        </div>

        <div className="rounded-md border border-border bg-card shadow-sm overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead>Nº Venda</TableHead>
                <TableHead>Data/Hora</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Pagamento</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {MOCK_SALES.map((sale) => (
                <TableRow key={sale.id}>
                  <TableCell className="font-medium">#{sale.id}</TableCell>
                  <TableCell>{sale.date}</TableCell>
                  <TableCell>{sale.client}</TableCell>
                  <TableCell>{sale.method}</TableCell>
                  <TableCell className="font-bold">R$ {sale.total.toFixed(2)}</TableCell>
                  <TableCell>
                    <Badge variant={sale.status === 'Cancelado' ? 'destructive' : 'default'} className={sale.status === 'Concluído' ? 'bg-emerald-600 hover:bg-emerald-700' : ''}>
                      {sale.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="icon" title="Ver Detalhes">
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" title="Imprimir 2ª Via">
                        <FileText className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </Layout>
  );
}
