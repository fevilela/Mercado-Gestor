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
import { Search, Eye, Printer, FileText, CheckCircle2, AlertCircle, FileCheck, RefreshCw, WifiOff } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

const INITIAL_SALES = [
  { id: "1025", date: "11/12/2025 11:10", client: "Consumidor Final", total: 125.50, items: 4, status: "Concluído", method: "Dinheiro", nfce: "-", nfceStatus: "Contingência" },
  { id: "1024", date: "11/12/2025 10:42", client: "Consumidor Final", total: 156.00, items: 8, status: "Concluído", method: "Cartão Crédito", nfce: "135230004567890", nfceStatus: "Autorizada" },
  { id: "1023", date: "11/12/2025 10:38", client: "Maria Oliveira", total: 42.50, items: 3, status: "Concluído", method: "PIX", nfce: "135230004567889", nfceStatus: "Autorizada" },
  { id: "1022", date: "11/12/2025 10:35", client: "Consumidor Final", total: 89.90, items: 5, status: "Concluído", method: "Dinheiro", nfce: "135230004567888", nfceStatus: "Autorizada" },
  { id: "1021", date: "11/12/2025 10:30", client: "José Silva", total: 210.00, items: 12, status: "Concluído", method: "Cartão Débito", nfce: "135230004567887", nfceStatus: "Autorizada" },
  { id: "1020", date: "11/12/2025 10:15", client: "Consumidor Final", total: 15.00, items: 1, status: "Cancelado", method: "Dinheiro", nfce: "-", nfceStatus: "Cancelada" },
];

export default function Sales() {
  const [sales, setSales] = useState(INITIAL_SALES);
  const { toast } = useToast();
  const [processingId, setProcessingId] = useState<string | null>(null);

  const handleTransmit = (id: string) => {
    setProcessingId(id);
    toast({
      title: "Transmitindo...",
      description: "Enviando nota de contingência para SEFAZ.",
    });

    setTimeout(() => {
      setSales(prev => prev.map(sale => {
        if (sale.id === id) {
          return {
            ...sale,
            nfceStatus: "Autorizada",
            nfce: `1352300045679${Math.floor(Math.random() * 90) + 10}`
          };
        }
        return sale;
      }));
      setProcessingId(null);
      toast({
        title: "Sucesso!",
        description: "Nota autorizada com sucesso.",
        className: "bg-emerald-500 text-white border-none"
      });
    }, 2000);
  };

  return (
    <Layout>
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-heading font-bold tracking-tight text-foreground">Vendas & Notas Fiscais</h1>
            <p className="text-muted-foreground">Histórico de vendas, NFC-e emitidas e arquivos XML.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline">
              <FileCheck className="mr-2 h-4 w-4" /> Exportar XML (Mensal)
            </Button>
            <Button>
              <Printer className="mr-2 h-4 w-4" /> Relatório de Fechamento
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-4 bg-card p-4 rounded-lg border border-border shadow-sm">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nº pedido, cliente ou chave de acesso..."
              className="pl-9"
            />
          </div>
          <div className="flex gap-2">
            <Button variant="outline">Somente Autorizadas</Button>
            <Button variant="outline" className="text-amber-600 border-amber-200 bg-amber-50 hover:bg-amber-100">
              <WifiOff className="mr-2 h-4 w-4" /> Contingência (1)
            </Button>
          </div>
        </div>

        <div className="rounded-md border border-border bg-card shadow-sm overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead>Nº Venda</TableHead>
                <TableHead>Data/Hora</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>NFC-e (Protocolo)</TableHead>
                <TableHead>Status Sefaz</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sales.map((sale) => (
                <TableRow key={sale.id}>
                  <TableCell className="font-medium">#{sale.id}</TableCell>
                  <TableCell>{sale.date}</TableCell>
                  <TableCell>{sale.client}</TableCell>
                  <TableCell className="font-bold">R$ {sale.total.toFixed(2)}</TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="text-xs font-mono">{sale.nfce}</span>
                      <span className="text-[10px] text-muted-foreground">Série 1</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {sale.nfceStatus === 'Autorizada' && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
                      {sale.nfceStatus === 'Cancelada' && <AlertCircle className="h-4 w-4 text-destructive" />}
                      {sale.nfceStatus === 'Contingência' && <WifiOff className="h-4 w-4 text-amber-500" />}
                      
                      <span className={`
                        ${sale.nfceStatus === 'Autorizada' ? 'text-emerald-700' : ''}
                        ${sale.nfceStatus === 'Cancelada' ? 'text-destructive' : ''}
                        ${sale.nfceStatus === 'Contingência' ? 'text-amber-700 font-bold' : ''}
                      `}>
                        {sale.nfceStatus}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      {sale.nfceStatus === 'Contingência' ? (
                        <Button 
                          size="sm" 
                          className="bg-amber-500 hover:bg-amber-600 text-white"
                          onClick={() => handleTransmit(sale.id)}
                          disabled={processingId === sale.id}
                        >
                          {processingId === sale.id ? (
                            <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                          ) : (
                            <RefreshCw className="h-4 w-4 mr-2" />
                          )}
                          Transmitir
                        </Button>
                      ) : (
                        <Dialog>
                          <DialogTrigger asChild>
                             <Button variant="ghost" size="icon" title="Ver Danfe/Cupom">
                              <FileText className="h-4 w-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Nota Fiscal de Consumidor Eletrônica</DialogTitle>
                              <DialogDescription>Detalhes do Documento Fiscal (Simulação)</DialogDescription>
                            </DialogHeader>
                            <div className="bg-muted p-4 rounded-md font-mono text-xs space-y-2 border border-border">
                              <div className="text-center border-b border-border pb-2 mb-2">
                                <p className="font-bold text-sm">MERCADO MODELO LTDA</p>
                                <p>CNPJ: 00.000.000/0000-00</p>
                                <p>Rua Exemplo, 123 - Centro</p>
                              </div>
                              <div className="flex justify-between">
                                <span>Nº Venda:</span>
                                <span>{sale.id}</span>
                              </div>
                               <div className="flex justify-between">
                                <span>Data Emissão:</span>
                                <span>{sale.date}</span>
                              </div>
                              <div className="border-b border-border my-2"></div>
                              <div className="flex justify-between font-bold">
                                <span>TOTAL R$</span>
                                <span>{sale.total.toFixed(2)}</span>
                              </div>
                               <div className="border-b border-border my-2"></div>
                               <div className="text-center">
                                 <p>Consulte pela Chave de Acesso em</p>
                                 <p>http://nfce.fazenda.sp.gov.br</p>
                                 <p className="mt-2 break-all">{sale.nfce !== '-' ? `3523 1200 0000 0000 0000 6500 1000 00${sale.id} 1000` : 'NÃO AUTORIZADA'}</p>
                               </div>
                               <div className="text-center mt-4">
                                 <p className="font-bold">Protocolo de Autorização</p>
                                 <p>{sale.nfce}</p>
                               </div>
                            </div>
                            <div className="flex gap-2 justify-end mt-4">
                              <Button variant="outline">Baixar XML</Button>
                              <Button>Imprimir</Button>
                            </div>
                          </DialogContent>
                        </Dialog>
                      )}
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
