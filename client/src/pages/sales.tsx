import Layout from "@/components/layout";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Search,
  Eye,
  Printer,
  FileText,
  CheckCircle2,
  AlertCircle,
  FileCheck,
  RefreshCw,
  WifiOff,
  ShoppingCart,
  Loader2,
} from "lucide-react";
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
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Sale {
  id: number;
  customerName: string;
  total: string;
  itemsCount: number;
  paymentMethod: string;
  status: string;
  nfceProtocol: string | null;
  nfceStatus: string;
  nfceKey: string | null;
  createdAt: string;
}

export default function Sales() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [processingId, setProcessingId] = useState<number | null>(null);

  const { data: sales = [], isLoading } = useQuery({
    queryKey: ["/api/sales"],
    queryFn: async () => {
      const res = await fetch("/api/sales");
      if (!res.ok) throw new Error("Failed to fetch sales");
      return res.json();
    },
  });

  const updateNfceStatusMutation = useMutation({
    mutationFn: async ({
      id,
      status,
      protocol,
    }: {
      id: number;
      status: string;
      protocol: string;
    }) => {
      const res = await fetch(`/api/sales/${id}/nfce-status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, protocol }),
      });
      if (!res.ok) throw new Error("Failed to update NFC-e status");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sales"] });
      toast({
        title: "Sucesso!",
        description: "Nota autorizada com sucesso.",
        className: "bg-emerald-500 text-white border-none",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Falha ao transmitir nota.",
        variant: "destructive",
      });
    },
  });

  const handleTransmit = (id: number) => {
    setProcessingId(id);
    toast({
      title: "Transmitindo...",
      description: "Enviando nota de contingência para SEFAZ.",
    });

    setTimeout(() => {
      const protocol = `1352300045679${Math.floor(Math.random() * 90) + 10}`;
      updateNfceStatusMutation.mutate({ id, status: "Autorizada", protocol });
      setProcessingId(null);
    }, 2000);
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return format(date, "dd/MM/yyyy HH:mm", { locale: ptBR });
    } catch {
      return dateString;
    }
  };

  const filteredSales = sales.filter((sale: Sale) => {
    const search = searchTerm.toLowerCase();
    return (
      sale.id.toString().includes(search) ||
      sale.customerName.toLowerCase().includes(search) ||
      (sale.nfceProtocol && sale.nfceProtocol.includes(search)) ||
      (sale.nfceKey && sale.nfceKey.includes(search))
    );
  });

  const contingencySales = sales.filter(
    (sale: Sale) =>
      sale.nfceStatus === "Contingência" ||
      sale.nfceStatus === "Pendente Fiscal"
  );

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
            <p className="text-muted-foreground">Carregando vendas...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-heading font-bold tracking-tight text-foreground">
              Vendas & Notas Fiscais
            </h1>
            <p className="text-muted-foreground">
              Histórico de vendas, NFC-e emitidas e arquivos XML.
            </p>
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
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <Button variant="outline">Somente Autorizadas</Button>
            {contingencySales.length > 0 && (
              <Button
                variant="outline"
                className="text-amber-600 border-amber-200 bg-amber-50 hover:bg-amber-100"
              >
                <WifiOff className="mr-2 h-4 w-4" /> Contingência (
                {contingencySales.length})
              </Button>
            )}
          </div>
        </div>

        {filteredSales.length === 0 ? (
          <div className="rounded-md border border-border bg-card shadow-sm p-12 text-center">
            <ShoppingCart className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">
              Nenhuma venda encontrada
            </h3>
            <p className="text-muted-foreground">
              {searchTerm
                ? "Tente ajustar sua busca."
                : "As vendas realizadas no PDV aparecerão aqui."}
            </p>
          </div>
        ) : (
          <div className="rounded-md border border-border bg-card shadow-sm overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Nº Venda</TableHead>
                  <TableHead>Data/Hora</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Pagamento</TableHead>
                  <TableHead>NFC-e (Protocolo)</TableHead>
                  <TableHead>Status Sefaz</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSales.map((sale: Sale) => (
                  <TableRow key={sale.id}>
                    <TableCell className="font-medium">#{sale.id}</TableCell>
                    <TableCell>{formatDate(sale.createdAt)}</TableCell>
                    <TableCell>{sale.customerName}</TableCell>
                    <TableCell className="font-bold">
                      R$ {parseFloat(sale.total).toFixed(2)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{sale.paymentMethod}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="text-xs font-mono">
                          {sale.nfceProtocol || "-"}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          Série 1
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {sale.nfceStatus === "Autorizada" && (
                          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                        )}
                        {sale.nfceStatus === "Cancelada" && (
                          <AlertCircle className="h-4 w-4 text-destructive" />
                        )}
                        {(sale.nfceStatus === "Contingência" ||
                          sale.nfceStatus === "Pendente Fiscal") && (
                          <WifiOff className="h-4 w-4 text-amber-500" />
                        )}
                        {sale.nfceStatus === "Pendente" && (
                          <AlertCircle className="h-4 w-4 text-muted-foreground" />
                        )}

                        <span
                          className={`
                          ${
                            sale.nfceStatus === "Autorizada"
                              ? "text-emerald-700"
                              : ""
                          }
                          ${
                            sale.nfceStatus === "Cancelada"
                              ? "text-destructive"
                              : ""
                          }
                          ${
                            sale.nfceStatus === "Contingência" ||
                            sale.nfceStatus === "Pendente Fiscal"
                              ? "text-amber-700 font-bold"
                              : ""
                          }
                        `}
                        >
                          {sale.nfceStatus}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {sale.nfceStatus === "Contingência" ||
                        sale.nfceStatus === "Pendente Fiscal" ? (
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
                              <Button
                                variant="ghost"
                                size="icon"
                                title="Ver Danfe/Cupom"
                              >
                                <FileText className="h-4 w-4" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>
                                  Nota Fiscal de Consumidor Eletrônica
                                </DialogTitle>
                                <DialogDescription>
                                  Detalhes do Documento Fiscal
                                </DialogDescription>
                              </DialogHeader>
                              <div className="bg-muted p-4 rounded-md font-mono text-xs space-y-2 border border-border">
                                <div className="text-center border-b border-border pb-2 mb-2">
                                  <p className="font-bold text-sm">
                                    MERCADO MODELO LTDA
                                  </p>
                                  <p>CNPJ: 00.000.000/0000-00</p>
                                  <p>Rua Exemplo, 123 - Centro</p>
                                </div>
                                <div className="flex justify-between">
                                  <span>Nº Venda:</span>
                                  <span>{sale.id}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span>Data Emissão:</span>
                                  <span>{formatDate(sale.createdAt)}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span>Cliente:</span>
                                  <span>{sale.customerName}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span>Itens:</span>
                                  <span>{sale.itemsCount}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span>Pagamento:</span>
                                  <span>{sale.paymentMethod}</span>
                                </div>
                                <div className="border-b border-border my-2"></div>
                                <div className="flex justify-between font-bold">
                                  <span>TOTAL R$</span>
                                  <span>
                                    {parseFloat(sale.total).toFixed(2)}
                                  </span>
                                </div>
                                <div className="border-b border-border my-2"></div>
                                <div className="text-center">
                                  <p>Consulte pela Chave de Acesso em</p>
                                  <p>http://nfce.fazenda.sp.gov.br</p>
                                  <p className="mt-2 break-all">
                                    {sale.nfceKey || "NÃO AUTORIZADA"}
                                  </p>
                                </div>
                                <div className="text-center mt-4">
                                  <p className="font-bold">
                                    Protocolo de Autorização
                                  </p>
                                  <p>{sale.nfceProtocol || "-"}</p>
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
        )}
      </div>
    </Layout>
  );
}
