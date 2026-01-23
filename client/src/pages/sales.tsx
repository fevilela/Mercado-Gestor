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
import { useAuth } from "@/lib/auth";

function NfceQrCode({ nfceKey }: { nfceKey?: string | null }) {
  const { data } = useQuery<{ qrCodeUrl: string } | null>({
    queryKey: ["/api/fiscal/nfce/qrcode", nfceKey],
    queryFn: async () => {
      if (!nfceKey) return null;
      const res = await fetch(`/api/fiscal/nfce/qrcode/${nfceKey}`);
      if (!res.ok) return null;
      return res.json();
    },
    enabled: Boolean(nfceKey),
  });

  if (!data?.qrCodeUrl) return null;
  return (
    <div className="flex justify-center">
      <img src={data.qrCodeUrl} alt="QR Code NFC-e" className="h-32 w-32" />
    </div>
  );
}
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ClosingReport {
  date: string;
  totalSales: number;
  totalValue: string;
  totalItems: number;
  averageTicket: string;
  paymentMethods: Array<{
    method: string;
    count: number;
    total: string;
    percentage: string;
  }>;
  salesByStatus: {
    authorized: number;
    pending: number;
    contingency: number;
    cancelled: number;
  };
  sales: Array<{
    id: number;
    time: string;
    customer: string;
    total: string;
    paymentMethod: string;
    status: string;
  }>;
}

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
  const { company } = useAuth();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [processingId, setProcessingId] = useState<number | null>(null);
  const [exportMonth, setExportMonth] = useState<string>(
    (new Date().getMonth() + 1).toString(),
  );
  const [exportYear, setExportYear] = useState<string>(
    new Date().getFullYear().toString(),
  );
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [showClosingDialog, setShowClosingDialog] = useState(false);
  const [closingReport, setClosingReport] = useState<ClosingReport | null>(
    null,
  );
  const [isLoadingReport, setIsLoadingReport] = useState(false);

  const { data: sales = [], isLoading } = useQuery({
    queryKey: ["/api/sales"],
    queryFn: async () => {
      const res = await fetch("/api/sales");
      if (!res.ok) throw new Error("Failed to fetch sales");
      return res.json();
    },
  });

  const handleTransmit = async (id: number) => {
    setProcessingId(id);
    toast({
      title: "Transmitindo...",
      description: "Enviando nota para SEFAZ.",
    });

    try {
      const res = await fetch("/api/fiscal/nfce/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ saleIds: [id] }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "Falha ao transmitir NFC-e");
      }
      const result = data?.results?.[0];
      if (!result?.success) {
        throw new Error(result?.error || "Falha ao transmitir NFC-e");
      }
      queryClient.invalidateQueries({ queryKey: ["/api/sales"] });
      toast({
        title: "Sucesso!",
        description: "NFC-e autorizada com sucesso.",
        className: "bg-emerald-500 text-white border-none",
      });
    } catch (error) {
      toast({
        title: "Erro",
        description:
          error instanceof Error ? error.message : "Falha ao transmitir NFC-e.",
        variant: "destructive",
      });
    } finally {
      setProcessingId(null);
    }
  };

  const [isExporting, setIsExporting] = useState(false);

  const handleExportXml = async () => {
    setIsExporting(true);
    try {
      const url = `/api/sales/export/xml?month=${exportMonth}&year=${exportYear}`;
      const response = await fetch(url);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Falha ao exportar");
      }

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = `vendas_${exportMonth}_${exportYear}.xml`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(downloadUrl);

      setShowExportDialog(false);
      toast({
        title: "Sucesso!",
        description: `Arquivo XML exportado com sucesso.`,
        className: "bg-emerald-500 text-white border-none",
      });
    } catch (error) {
      toast({
        title: "Erro",
        description:
          error instanceof Error ? error.message : "Falha ao exportar XML.",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleClosingReport = async () => {
    setIsLoadingReport(true);
    try {
      const today = new Date().toISOString().split("T")[0];
      const res = await fetch(`/api/sales/report/closing?date=${today}`);
      if (!res.ok) throw new Error("Failed to fetch report");
      const report = await res.json();
      setClosingReport(report);
      setShowClosingDialog(true);
    } catch (error) {
      toast({
        title: "Erro",
        description: "Falha ao gerar relatório de fechamento.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingReport(false);
    }
  };

  const handlePrintReport = () => {
    if (!closingReport) return;

    const formattedDate = closingReport.date
      ? format(new Date(closingReport.date), "dd 'de' MMMM 'de' yyyy", {
          locale: ptBR,
        })
      : "";

    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      toast({
        title: "Erro",
        description:
          "Não foi possível abrir a janela de impressão. Verifique se pop-ups estão permitidos.",
        variant: "destructive",
      });
      return;
    }

    const salesRows = closingReport.sales
      .map(
        (sale) => `
      <tr>
        <td>${sale.time}</td>
        <td>${sale.customer}</td>
        <td>${sale.paymentMethod}</td>
        <td>${sale.status}</td>
        <td style="text-align: right; font-weight: bold;">R$ ${parseFloat(
          sale.total,
        ).toFixed(2)}</td>
      </tr>
    `,
      )
      .join("");

    const paymentRows = closingReport.paymentMethods
      .map(
        (pm) => `
      <div style="display: flex; justify-content: space-between; padding: 8px; background: #f5f5f5; margin-bottom: 4px; border-radius: 4px;">
        <span>${pm.method}</span>
        <span><strong>R$ ${pm.total}</strong> (${pm.count} vendas - ${pm.percentage}%)</span>
      </div>
    `,
      )
      .join("");

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Relatório de Fechamento - ${formattedDate}</title>
        <meta charset="UTF-8">
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { 
            font-family: Arial, sans-serif; 
            padding: 20px; 
            color: #333;
            font-size: 12px;
          }
          .header { 
            text-align: center; 
            margin-bottom: 20px; 
            padding-bottom: 15px; 
            border-bottom: 2px solid #333; 
          }
          .header h1 { font-size: 20px; margin-bottom: 5px; }
          .header p { color: #666; font-size: 14px; }
          .summary { 
            display: flex; 
            justify-content: space-between; 
            margin-bottom: 20px; 
            gap: 10px;
          }
          .summary-item { 
            flex: 1; 
            text-align: center; 
            padding: 12px; 
            background: #f5f5f5; 
            border-radius: 6px; 
          }
          .summary-item .value { font-size: 18px; font-weight: bold; color: #2563eb; }
          .summary-item .label { font-size: 11px; color: #666; margin-top: 4px; }
          .section { margin-bottom: 20px; }
          .section h3 { font-size: 14px; margin-bottom: 10px; border-bottom: 1px solid #ddd; padding-bottom: 5px; }
          .status-grid { display: flex; gap: 10px; margin-bottom: 15px; }
          .status-item { 
            flex: 1; 
            padding: 10px; 
            background: #f5f5f5; 
            border-radius: 4px; 
            text-align: center;
          }
          .status-item .count { font-size: 16px; font-weight: bold; }
          .status-item .label { font-size: 10px; color: #666; }
          table { width: 100%; border-collapse: collapse; font-size: 11px; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background: #f5f5f5; font-weight: bold; }
          .footer { 
            margin-top: 30px; 
            text-align: center; 
            font-size: 10px; 
            color: #999; 
            border-top: 1px solid #ddd; 
            padding-top: 10px; 
          }
          @media print {
            body { padding: 10px; }
            @page { margin: 1cm; size: A4; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Relatório de Fechamento do Dia</h1>
          <p>${formattedDate}</p>
        </div>

        <div class="summary">
          <div class="summary-item">
            <div class="value">${closingReport.totalSales}</div>
            <div class="label">Total de Vendas</div>
          </div>
          <div class="summary-item">
            <div class="value" style="color: #16a34a;">R$ ${
              closingReport.totalValue
            }</div>
            <div class="label">Valor Total</div>
          </div>
          <div class="summary-item">
            <div class="value">${closingReport.totalItems}</div>
            <div class="label">Itens Vendidos</div>
          </div>
          <div class="summary-item">
            <div class="value">R$ ${closingReport.averageTicket}</div>
            <div class="label">Ticket Médio</div>
          </div>
        </div>

        <div class="section">
          <h3>Status das Notas Fiscais</h3>
          <div class="status-grid">
            <div class="status-item">
              <div class="count">${closingReport.salesByStatus.authorized}</div>
              <div class="label">Autorizadas</div>
            </div>
            <div class="status-item">
              <div class="count">${closingReport.salesByStatus.pending}</div>
              <div class="label">Pendentes</div>
            </div>
            <div class="status-item">
              <div class="count">${
                closingReport.salesByStatus.contingency
              }</div>
              <div class="label">Contingência</div>
            </div>
            <div class="status-item">
              <div class="count">${closingReport.salesByStatus.cancelled}</div>
              <div class="label">Canceladas</div>
            </div>
          </div>
        </div>

        <div class="section">
          <h3>Formas de Pagamento</h3>
          ${paymentRows || "<p>Nenhuma venda hoje</p>"}
        </div>

        ${
          closingReport.sales.length > 0
            ? `
        <div class="section">
          <h3>Detalhamento das Vendas</h3>
          <table>
            <thead>
              <tr>
                <th>Hora</th>
                <th>Cliente</th>
                <th>Pagamento</th>
                <th>Status</th>
                <th style="text-align: right;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${salesRows}
            </tbody>
          </table>
        </div>
        `
            : ""
        }

        <div class="footer">
          Relatório gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", {
            locale: ptBR,
          })}
        </div>
      </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.focus();

    setTimeout(() => {
      printWindow.print();
    }, 250);
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
      sale.nfceStatus === "Pendente Fiscal",
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
            <Dialog open={showExportDialog} onOpenChange={setShowExportDialog}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <FileCheck className="mr-2 h-4 w-4" /> Exportar XML (Mensal)
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Exportar Vendas em XML</DialogTitle>
                  <DialogDescription>
                    Selecione o período para exportação
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Mês</label>
                      <Select
                        value={exportMonth}
                        onValueChange={setExportMonth}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Mês" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">Janeiro</SelectItem>
                          <SelectItem value="2">Fevereiro</SelectItem>
                          <SelectItem value="3">Março</SelectItem>
                          <SelectItem value="4">Abril</SelectItem>
                          <SelectItem value="5">Maio</SelectItem>
                          <SelectItem value="6">Junho</SelectItem>
                          <SelectItem value="7">Julho</SelectItem>
                          <SelectItem value="8">Agosto</SelectItem>
                          <SelectItem value="9">Setembro</SelectItem>
                          <SelectItem value="10">Outubro</SelectItem>
                          <SelectItem value="11">Novembro</SelectItem>
                          <SelectItem value="12">Dezembro</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Ano</label>
                      <Select value={exportYear} onValueChange={setExportYear}>
                        <SelectTrigger>
                          <SelectValue placeholder="Ano" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="2023">2023</SelectItem>
                          <SelectItem value="2024">2024</SelectItem>
                          <SelectItem value="2025">2025</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setShowExportDialog(false)}
                    disabled={isExporting}
                  >
                    Cancelar
                  </Button>
                  <Button onClick={handleExportXml} disabled={isExporting}>
                    {isExporting ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <FileCheck className="mr-2 h-4 w-4" />
                    )}
                    {isExporting ? "Exportando..." : "Exportar XML"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            <Dialog
              open={showClosingDialog}
              onOpenChange={setShowClosingDialog}
            >
              <DialogTrigger asChild>
                <Button
                  onClick={handleClosingReport}
                  disabled={isLoadingReport}
                >
                  {isLoadingReport ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Printer className="mr-2 h-4 w-4" />
                  )}
                  Relatório de Fechamento
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto print-content">
                <div className="print-header hidden print:block">
                  <h1>Relatório de Fechamento do Dia</h1>
                  <p>
                    {closingReport?.date
                      ? format(
                          new Date(closingReport.date),
                          "dd 'de' MMMM 'de' yyyy",
                          { locale: ptBR },
                        )
                      : ""}
                  </p>
                </div>
                <DialogHeader className="print:hidden">
                  <DialogTitle>Relatório de Fechamento do Dia</DialogTitle>
                  <DialogDescription>
                    {closingReport?.date
                      ? format(
                          new Date(closingReport.date),
                          "dd 'de' MMMM 'de' yyyy",
                          { locale: ptBR },
                        )
                      : "Carregando..."}
                  </DialogDescription>
                </DialogHeader>
                {closingReport && (
                  <div className="space-y-6">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="bg-muted p-4 rounded-lg text-center">
                        <p className="text-2xl font-bold text-primary">
                          {closingReport.totalSales}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Total de Vendas
                        </p>
                      </div>
                      <div className="bg-muted p-4 rounded-lg text-center">
                        <p className="text-2xl font-bold text-emerald-600">
                          R$ {closingReport.totalValue}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Valor Total
                        </p>
                      </div>
                      <div className="bg-muted p-4 rounded-lg text-center">
                        <p className="text-2xl font-bold">
                          {closingReport.totalItems}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Itens Vendidos
                        </p>
                      </div>
                      <div className="bg-muted p-4 rounded-lg text-center">
                        <p className="text-2xl font-bold">
                          R$ {closingReport.averageTicket}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Ticket Médio
                        </p>
                      </div>
                    </div>

                    <div>
                      <h4 className="font-semibold mb-3">
                        Formas de Pagamento
                      </h4>
                      <div className="space-y-2">
                        {closingReport.paymentMethods.length > 0 ? (
                          closingReport.paymentMethods.map((pm) => (
                            <div
                              key={pm.method}
                              className="flex justify-between items-center bg-muted/50 p-3 rounded-lg"
                            >
                              <span className="font-medium">{pm.method}</span>
                              <div className="text-right">
                                <span className="font-bold">R$ {pm.total}</span>
                                <span className="text-muted-foreground text-sm ml-2">
                                  ({pm.count} vendas - {pm.percentage}%)
                                </span>
                              </div>
                            </div>
                          ))
                        ) : (
                          <p className="text-muted-foreground text-center py-4">
                            Nenhuma venda hoje
                          </p>
                        )}
                      </div>
                    </div>

                    <div>
                      <h4 className="font-semibold mb-3">
                        Status das Notas Fiscais
                      </h4>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        <div className="flex items-center gap-2 bg-emerald-50 p-3 rounded-lg">
                          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                          <div>
                            <p className="font-bold">
                              {closingReport.salesByStatus.authorized}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Autorizadas
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 bg-amber-50 p-3 rounded-lg">
                          <AlertCircle className="h-4 w-4 text-amber-500" />
                          <div>
                            <p className="font-bold">
                              {closingReport.salesByStatus.pending}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Pendentes
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 bg-orange-50 p-3 rounded-lg">
                          <WifiOff className="h-4 w-4 text-orange-500" />
                          <div>
                            <p className="font-bold">
                              {closingReport.salesByStatus.contingency}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Contingência
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 bg-red-50 p-3 rounded-lg">
                          <AlertCircle className="h-4 w-4 text-red-500" />
                          <div>
                            <p className="font-bold">
                              {closingReport.salesByStatus.cancelled}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Canceladas
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {closingReport.sales.length > 0 && (
                      <div>
                        <h4 className="font-semibold mb-3">
                          Detalhamento das Vendas
                        </h4>
                        <div className="border rounded-lg overflow-hidden">
                          <Table>
                            <TableHeader>
                              <TableRow className="bg-muted/50">
                                <TableHead>Hora</TableHead>
                                <TableHead>Cliente</TableHead>
                                <TableHead>Pagamento</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">
                                  Total
                                </TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {closingReport.sales.map((sale) => (
                                <TableRow key={sale.id}>
                                  <TableCell>{sale.time}</TableCell>
                                  <TableCell>{sale.customer}</TableCell>
                                  <TableCell>{sale.paymentMethod}</TableCell>
                                  <TableCell>
                                    <Badge
                                      variant={
                                        sale.status === "Autorizada"
                                          ? "default"
                                          : "secondary"
                                      }
                                    >
                                      {sale.status}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="text-right font-bold">
                                    R$ {parseFloat(sale.total).toFixed(2)}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    )}

                    <div className="flex justify-end gap-2 pt-4 border-t">
                      <Button variant="outline" onClick={handlePrintReport}>
                        <Printer className="mr-2 h-4 w-4" /> Imprimir
                      </Button>
                      <Button onClick={() => setShowClosingDialog(false)}>
                        Fechar
                      </Button>
                    </div>
                  </div>
                )}
              </DialogContent>
            </Dialog>
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
                                    {company?.razaoSocial || "Empresa"}
                                  </p>
                                  <p>CNPJ: {company?.cnpj || "-"}</p>
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
