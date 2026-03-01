import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, parseISO, startOfMonth, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import Layout from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from "recharts";
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
import { Loader2, Download, Eye } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { FileText, Receipt, Percent, BookOpen, Wallet, Users } from "lucide-react";

type CsvValue = string | number;
type ReportRow = Record<string, CsvValue>;

interface Sale {
  id: number;
  userId: string | null;
  userName?: string | null;
  customerName: string;
  total: string;
  itemsCount: number;
  paymentMethod: string;
  status: string;
  nfceStatus: string;
  nfceProtocol: string | null;
  nfceKey: string | null;
  createdAt: string;
}

interface SaleItem {
  id: number;
  saleId: number;
  productId: number;
  productName: string;
  quantity: number;
  subtotal: string;
  unitPrice: string;
  icmsValue?: string;
  ipiValue?: string;
  pisValue?: string;
  cofinsValue?: string;
  issValue?: string;
}

interface Product {
  id: number;
  name: string;
  category: string;
  stock: number;
  minStock: number | null;
  price: string;
  promoPrice?: string | null;
  promoStart?: string | null;
  promoEnd?: string | null;
  purchasePrice: string | null;
  createdAt: string;
}

interface Payable {
  id: number;
  description: string;
  supplierName: string | null;
  amount: string;
  dueDate: string;
  paidDate: string | null;
  status: string;
  createdAt: string;
}

interface Receivable {
  id: number;
  description: string;
  customerName: string | null;
  amount: string;
  dueDate: string;
  receivedDate: string | null;
  status: string;
  createdAt: string;
}

interface Customer {
  id: number;
  name: string;
  createdAt: string;
}

interface Supplier {
  id: number;
  name: string;
  createdAt: string;
}

interface CashRegister {
  id: number;
  userName: string;
  openingAmount: string;
  closingAmount: string | null;
  expectedAmount: string | null;
  difference: string | null;
  status: string;
  openedAt: string;
  closedAt: string | null;
}

interface CashMovement {
  id: number;
  cashRegisterId: number;
  userName: string;
  type: string;
  amount: string;
  reason: string | null;
  createdAt: string;
}

interface CashHistoryResponse {
  registers: CashRegister[];
  movements: CashMovement[];
}

interface NfeHistoryRecord {
  id: number;
  status: "gerada" | "processando" | "autorizada" | "cancelada";
  environment: "homologacao" | "producao";
  nfeNumber: string | null;
  nfeSeries: string | null;
  documentKey: string;
  protocol: string;
  createdAt: string;
  updatedAt: string;
}

interface AccessoryAuditRecord {
  id: number;
  action: string;
  success: boolean;
  createdAt: string;
}

interface ReportOutput {
  id: string;
  title: string;
  group: string;
  description: string;
  columns: string[];
  rows: ReportRow[];
  note?: string;
}

interface ReportDefinition {
  id: string;
  title: string;
  description: string;
  group: string;
}

const REPORT_ICON_BY_ID: Record<string, typeof FileText> = {
  fiscal_vendas_periodo: Receipt,
  fiscal_notas_emitidas: FileText,
  fiscal_cancelamentos: Receipt,
  fiscal_impostos: Percent,
  fiscal_livro: BookOpen,
  financeiro_fluxo_caixa: Wallet,
  auditoria_log_usuarios: Users,
};
const REPORT_ICON_STYLE_BY_ID: Record<string, string> = {
  fiscal_vendas_periodo: "bg-emerald-100 text-emerald-600",
  fiscal_notas_emitidas: "bg-blue-100 text-blue-600",
  fiscal_cancelamentos: "bg-rose-100 text-rose-600",
  fiscal_impostos: "bg-amber-100 text-amber-600",
  fiscal_livro: "bg-violet-100 text-violet-600",
  financeiro_fluxo_caixa: "bg-emerald-100 text-emerald-600",
  auditoria_log_usuarios: "bg-slate-100 text-slate-600",
};
const REPORT_ICON_STYLE_BY_GROUP: Record<string, string> = {
  "Relatorios Fiscais": "bg-rose-100 text-rose-600",
  "Relatorios Financeiros": "bg-emerald-100 text-emerald-600",
  "Relatorios de Estoque": "bg-indigo-100 text-indigo-600",
  "Relatorios de PDV": "bg-sky-100 text-sky-600",
  "Relatorios Gerenciais": "bg-amber-100 text-amber-600",
  "Relatorios de Auditoria": "bg-slate-100 text-slate-600",
};

interface ReportBuildContext {
  filteredSales: Sale[];
  filteredPayables: Payable[];
  filteredReceivables: Receivable[];
  filteredCashRegisters: CashRegister[];
  filteredCashMovements: CashMovement[];
  products: Product[];
  customers: Customer[];
  suppliers: Supplier[];
  nfeHistory: NfeHistoryRecord[];
  accessoryAudit: AccessoryAuditRecord[];
  allSales: Sale[];
  loadSaleItemsForSales: (sales: Sale[]) => Promise<SaleItem[]>;
}
type DetailLevel = "resumo" | "completo";

type FilterControlType = "text" | "select";
type ChartKind = "bar" | "line" | "pie";

const REPORT_DEFINITIONS: ReportDefinition[] = [
  { id: "fiscal_vendas_periodo", group: "Relatorios Fiscais", title: "Vendas por periodo", description: "Total bruto, descontos, cancelamentos, devolucoes e liquido" },
  { id: "fiscal_notas_emitidas", group: "Relatorios Fiscais", title: "Notas fiscais emitidas", description: "NF-e, NFC-e e status" },
  { id: "fiscal_cancelamentos", group: "Relatorios Fiscais", title: "Cancelamentos e devolucoes", description: "Motivo, usuario e data/hora quando disponivel" },
  { id: "fiscal_impostos", group: "Relatorios Fiscais", title: "Impostos apurados", description: "ICMS, ICMS-ST, PIS, COFINS, IPI e ISS" },
  { id: "fiscal_livro", group: "Relatorios Fiscais", title: "Livro de entradas e saidas", description: "Conferencia de compras x vendas para contabilidade" },
  { id: "financeiro_fluxo_caixa", group: "Relatorios Financeiros", title: "Fluxo de caixa", description: "Entradas, saidas, saldo diario e acumulado" },
  { id: "financeiro_pagar", group: "Relatorios Financeiros", title: "Contas a pagar", description: "Por vencimento, fornecedor e atraso" },
  { id: "financeiro_receber", group: "Relatorios Financeiros", title: "Contas a receber", description: "Por cliente, em aberto, recebidas e inadimplentes" },
  { id: "financeiro_forma_pagamento", group: "Relatorios Financeiros", title: "Recebimentos por forma de pagamento", description: "Dinheiro, cartoes, PIX, boleto e outros" },
  { id: "financeiro_conciliacao_cartoes", group: "Relatorios Financeiros", title: "Conciliacao de cartoes", description: "Taxas e valores liquidos estimados por metodo" },
  { id: "estoque_atual", group: "Relatorios de Estoque", title: "Estoque atual", description: "Quantidade disponivel, custo medio e valor total" },
  { id: "estoque_movimentacao", group: "Relatorios de Estoque", title: "Movimentacao de estoque", description: "Entradas, saidas, ajustes e perdas" },
  { id: "estoque_minimo", group: "Relatorios de Estoque", title: "Produtos com estoque minimo", description: "Itens abaixo do estoque minimo" },
  { id: "estoque_giro", group: "Relatorios de Estoque", title: "Giro de estoque", description: "Mais vendidos e parados" },
  { id: "estoque_promocoes", group: "Relatorios de Estoque", title: "Produtos em promocao", description: "Preco anterior, preco promocional e duracao da promocao" },
  { id: "estoque_inventario", group: "Relatorios de Estoque", title: "Inventario fisico", description: "Comparativo sistema x contagem real" },
  { id: "pdv_fechamento", group: "Relatorios de PDV", title: "Fechamento de caixa (X e Z)", description: "Abertura, suprimentos, sangrias e diferenca de caixa" },
  { id: "pdv_vendas_vendedor", group: "Relatorios de PDV", title: "Vendas por vendedor", description: "Meta, comissao e ticket medio por operador" },
  { id: "pdv_ticket_medio", group: "Relatorios de PDV", title: "Ticket medio", description: "Valor medio por venda no periodo" },
  { id: "pdv_produtos_vendidos", group: "Relatorios de PDV", title: "Produtos mais vendidos", description: "Por quantidade e faturamento" },
  { id: "gerencial_margem", group: "Relatorios Gerenciais", title: "Margem de lucro por produto", description: "Custo, venda e lucro bruto" },
  { id: "gerencial_dre", group: "Relatorios Gerenciais", title: "DRE", description: "Receita, custo, despesas e lucro liquido" },
  { id: "gerencial_abc", group: "Relatorios Gerenciais", title: "Curva ABC de produtos", description: "Classificacao A, B e C por relevancia" },
  { id: "gerencial_comparativo_mensal", group: "Relatorios Gerenciais", title: "Comparativo mensal", description: "Crescimento, queda e sazonalidade" },
  { id: "auditoria_log_usuarios", group: "Relatorios de Auditoria", title: "Log de usuarios", description: "Acoes operacionais de caixa e fiscal" },
  { id: "auditoria_alteracoes_cadastro", group: "Relatorios de Auditoria", title: "Alteracoes de cadastro", description: "Produtos, clientes e fornecedores cadastrados/atualizados" },
];
const CHART_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#84cc16", "#f97316"];

function parseDateSafe(value: string | null | undefined): Date | null {
  if (!value) return null;
  try {
    return parseISO(value);
  } catch {
    return null;
  }
}

function toNumber(value: unknown): number {
  const parsed = Number(String(value ?? "0").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

function money(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function fmtDate(value: string | Date | null | undefined): string {
  if (!value) return "-";
  const date = value instanceof Date ? value : parseDateSafe(value);
  if (!date) return "-";
  return format(date, "dd/MM/yyyy HH:mm", { locale: ptBR });
}

function buildChartModel(
  report: ReportOutput | null,
  rows: ReportRow[],
): {
  kind: ChartKind;
  data: Array<{ label: string; value: number }>;
  groupLabel: string;
} | null {
  if (!report || rows.length === 0) return null;

  const numericCol = report.columns.find((column) =>
    rows.some((row) => Number.isFinite(toNumber(row[column])) && toNumber(row[column]) !== 0),
  );
  if (!numericCol) return null;

  const labelCol = report.columns.find((column) => column !== numericCol) || report.columns[0];
  const data = rows
    .slice(0, 24)
    .map((row, index) => ({
      label: String(row[labelCol] ?? `Item ${index + 1}`),
      value: toNumber(row[numericCol]),
    }))
    .filter((item) => Number.isFinite(item.value));

  if (data.length === 0) return null;

  const definition = REPORT_DEFINITIONS.find((d) => d.id === report.id);
  const kindByGroup: Record<string, ChartKind> = {
    "Relatorios Fiscais": "bar",
    "Relatorios Financeiros": "line",
    "Relatorios de Estoque": "pie",
    "Relatorios de PDV": "bar",
    "Relatorios Gerenciais": "line",
    "Relatorios de Auditoria": "pie",
  };
  const kind = definition?.group ? kindByGroup[definition.group] || "bar" : "bar";

  return {
    kind,
    data: kind === "pie" ? data.slice(0, 8) : data,
    groupLabel: numericCol,
  };
}

async function fetchJsonOrFallback<T>(url: string, fallback: T): Promise<T> {
  try {
    const res = await fetch(url, { credentials: "include" });
    if (!res.ok) return fallback;
    return (await res.json()) as T;
  } catch {
    return fallback;
  }
}

export default function Reports() {
  const { toast } = useToast();
  const [dateFrom, setDateFrom] = useState(() => format(startOfMonth(subMonths(new Date(), 1)), "yyyy-MM-dd"));
  const [dateTo, setDateTo] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const [selectedReportId, setSelectedReportId] = useState<string>("fiscal_vendas_periodo");
  const [detailLevel, setDetailLevel] = useState<DetailLevel>("completo");
  const [preview, setPreview] = useState<ReportOutput | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const saleItemsCacheRef = useRef<Map<number, SaleItem[]>>(new Map());

  const { data: sales = [], isLoading: loadingSales } = useQuery<Sale[]>({
    queryKey: ["/api/sales"],
    queryFn: () => fetchJsonOrFallback<Sale[]>("/api/sales", []),
  });

  const { data: products = [], isLoading: loadingProducts } = useQuery<Product[]>({
    queryKey: ["/api/products"],
    queryFn: () => fetchJsonOrFallback<Product[]>("/api/products", []),
  });

  const { data: payables = [] } = useQuery<Payable[]>({
    queryKey: ["/api/payables"],
    queryFn: () => fetchJsonOrFallback<Payable[]>("/api/payables", []),
  });

  const { data: receivables = [] } = useQuery<Receivable[]>({
    queryKey: ["/api/receivables"],
    queryFn: () => fetchJsonOrFallback<Receivable[]>("/api/receivables", []),
  });

  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
    queryFn: () => fetchJsonOrFallback<Customer[]>("/api/customers", []),
  });

  const { data: suppliers = [] } = useQuery<Supplier[]>({
    queryKey: ["/api/suppliers"],
    queryFn: () => fetchJsonOrFallback<Supplier[]>("/api/suppliers", []),
  });

  const { data: cashHistory = { registers: [], movements: [] } } = useQuery<CashHistoryResponse>({
    queryKey: ["/api/cash-register/history"],
    queryFn: () =>
      fetchJsonOrFallback<CashHistoryResponse>("/api/cash-register/history", {
        registers: [],
        movements: [],
      }),
  });

  const { data: nfeHistory = [] } = useQuery<NfeHistoryRecord[]>({
    queryKey: ["/api/fiscal/nfe/history"],
    queryFn: () => fetchJsonOrFallback<NfeHistoryRecord[]>("/api/fiscal/nfe/history", []),
  });

  const { data: accessoryAudit = [] } = useQuery<AccessoryAuditRecord[]>({
    queryKey: ["/api/fiscal/accessory-provider/audit"],
    queryFn: () =>
      fetchJsonOrFallback<AccessoryAuditRecord[]>("/api/fiscal/accessory-provider/audit", []),
  });

  const fromDate = useMemo(() => parseDateSafe(`${dateFrom}T00:00:00`), [dateFrom]);
  const toDate = useMemo(() => parseDateSafe(`${dateTo}T23:59:59`), [dateTo]);

  const inRange = (value: string | null | undefined) => {
    const date = parseDateSafe(value || undefined);
    if (!date) return false;
    if (fromDate && date < fromDate) return false;
    if (toDate && date > toDate) return false;
    return true;
  };

  const filteredSales = useMemo(() => sales.filter((s) => inRange(s.createdAt)), [sales, fromDate, toDate]);
  const filteredPayables = useMemo(() => payables.filter((p) => inRange(p.dueDate)), [payables, fromDate, toDate]);
  const filteredReceivables = useMemo(
    () => receivables.filter((r) => inRange(r.dueDate)),
    [receivables, fromDate, toDate],
  );
  const filteredCashRegisters = useMemo(
    () => cashHistory.registers.filter((r) => inRange(r.openedAt)),
    [cashHistory.registers, fromDate, toDate],
  );
  const filteredCashMovements = useMemo(
    () => cashHistory.movements.filter((m) => inRange(m.createdAt)),
    [cashHistory.movements, fromDate, toDate],
  );

  const isLoading = loadingSales || loadingProducts;

  const loadSaleItemsForSales = async (targetSales: Sale[]): Promise<SaleItem[]> => {
    const idsToFetch = targetSales
      .map((sale) => sale.id)
      .filter((id) => !saleItemsCacheRef.current.has(id));

    await Promise.all(
      idsToFetch.map(async (id) => {
        try {
          const response = await fetch(`/api/sales/${id}`, { credentials: "include" });
          if (!response.ok) {
            saleItemsCacheRef.current.set(id, []);
            return;
          }
          const payload = (await response.json()) as { items?: SaleItem[] };
          saleItemsCacheRef.current.set(id, Array.isArray(payload.items) ? payload.items : []);
        } catch {
          saleItemsCacheRef.current.set(id, []);
        }
      }),
    );

    return targetSales.flatMap((sale) => saleItemsCacheRef.current.get(sale.id) || []);
  };

  const buildReport = async (reportId: string, context: ReportBuildContext): Promise<ReportOutput> => {
    switch (reportId) {
      case "fiscal_vendas_periodo": {
        const bruto = context.filteredSales.reduce((acc, sale) => acc + toNumber(sale.total), 0);
        const canceladas = context.filteredSales.filter((sale) =>
          String(sale.nfceStatus || sale.status).toLowerCase().includes("cancel"),
        );
        const devolucoes = context.filteredSales.filter((sale) =>
          String(sale.status || "").toLowerCase().includes("devol"),
        );
        const descontos = 0;
        const liquido = bruto - descontos;
        const rows = context.filteredSales
          .slice()
          .sort(
            (a, b) =>
              (parseDateSafe(b.createdAt)?.getTime() || 0) -
              (parseDateSafe(a.createdAt)?.getTime() || 0),
          )
          .map((sale) => ({
            DataHora: fmtDate(sale.createdAt),
            Venda: `#${sale.id}`,
            Cliente: sale.customerName || "Consumidor Final",
            FormaPagamento: sale.paymentMethod || "-",
            StatusVenda: sale.status || "-",
            StatusFiscal: sale.nfceStatus || "-",
            Itens: sale.itemsCount || 0,
            ValorTotal: money(toNumber(sale.total)),
          }));
        if (detailLevel === "resumo") {
          const grouped = rows.reduce<Record<string, { count: number; total: number }>>((acc, row) => {
            const status = String(row.StatusFiscal || row.StatusVenda || "-");
            const numeric = toNumber(String(row.ValorTotal).replace("R$", "").replace(/\./g, "").replace(",", "."));
            const current = acc[status] || { count: 0, total: 0 };
            current.count += 1;
            current.total += numeric;
            acc[status] = current;
            return acc;
          }, {});
          return {
            id: reportId,
            title: "Vendas por periodo",
            group: "Relatorios Fiscais",
            description: "Resumo consolidado por status fiscal",
            columns: ["StatusFiscal", "QtdVendas", "ValorTotal"],
            rows: Object.entries(grouped).map(([status, info]) => ({
              StatusFiscal: status,
              QtdVendas: info.count,
              ValorTotal: money(info.total),
            })),
            note: `Resumo: bruto ${money(bruto)} | liquido ${money(liquido)}.`,
          };
        }
        return {
          id: reportId,
          title: "Vendas por periodo",
          group: "Relatorios Fiscais",
          description: "Detalhamento de vendas no periodo selecionado",
          columns: [
            "DataHora",
            "Venda",
            "Cliente",
            "FormaPagamento",
            "StatusVenda",
            "StatusFiscal",
            "Itens",
            "ValorTotal",
          ],
          rows,
          note: `Resumo: bruto ${money(bruto)} | descontos ${money(descontos)} | cancelamentos ${canceladas.length} | devolucoes ${devolucoes.length} | liquido ${money(liquido)}.`,
        };
      }
      case "fiscal_notas_emitidas": {
        const nfceRows = context.filteredSales
          .filter(
            (sale) =>
              Boolean(sale.nfceKey) ||
              Boolean(sale.nfceProtocol) ||
              Boolean(sale.nfceStatus),
          )
          .map((sale) => ({
            Fonte: "NFC-e",
            Documento: `Venda #${sale.id}`,
            Status: sale.nfceStatus || sale.status || "-",
            Ambiente: "-",
            Chave: sale.nfceKey || "-",
            Protocolo: sale.nfceProtocol || "-",
            Cliente: sale.customerName || "Consumidor Final",
            Valor: money(toNumber(sale.total)),
            DataHora: fmtDate(sale.createdAt),
            sortKey: parseDateSafe(sale.createdAt)?.getTime() || 0,
          }));

        const nfeRows = context.nfeHistory
          .filter((r) => inRange(r.updatedAt || r.createdAt))
          .map((row) => ({
            Fonte: "NF-e",
            Documento:
              row.nfeNumber && row.nfeSeries
                ? `${row.nfeNumber}/${row.nfeSeries}`
                : row.documentKey || `NFE-${row.id}`,
            Status: row.status,
            Ambiente: row.environment,
            Chave: row.documentKey || "-",
            Protocolo: row.protocol || "-",
            Cliente: "-",
            Valor: "-",
            DataHora: fmtDate(row.updatedAt || row.createdAt),
            sortKey:
              parseDateSafe(row.updatedAt || row.createdAt)?.getTime() || 0,
          }));

        const rows = [...nfceRows, ...nfeRows]
          .sort((a, b) => b.sortKey - a.sortKey)
          .map(({ sortKey, ...rest }) => rest);

        if (detailLevel === "resumo") {
          const grouped = rows.reduce<Record<string, number>>((acc, row) => {
            const key = `${row.Fonte} - ${row.Status}`;
            acc[key] = (acc[key] || 0) + 1;
            return acc;
          }, {});
          return {
            id: reportId,
            title: "Notas fiscais emitidas",
            group: "Relatorios Fiscais",
            description: "Resumo por fonte e status",
            columns: ["FonteStatus", "Quantidade"],
            rows: Object.entries(grouped).map(([k, v]) => ({ FonteStatus: k, Quantidade: v })),
            note: `Total de registros: ${rows.length}.`,
          };
        }
        return {
          id: reportId,
          title: "Notas fiscais emitidas",
          group: "Relatorios Fiscais",
          description: "Detalhamento de NF-e e NFC-e do periodo",
          columns: [
            "Fonte",
            "Documento",
            "Status",
            "Ambiente",
            "Chave",
            "Protocolo",
            "Cliente",
            "Valor",
            "DataHora",
          ],
          rows,
          note: `Total de registros: ${rows.length}. NFC-e: ${nfceRows.length} | NF-e: ${nfeRows.length}.`,
        };
      }
      case "fiscal_cancelamentos": {
        const rows = context.filteredSales
          .filter((sale) =>
            String(sale.nfceStatus || sale.status || "").toLowerCase().includes("cancel") ||
            String(sale.status || "").toLowerCase().includes("devol"),
          )
          .map((sale) => ({
            Documento: `Venda #${sale.id}`,
            Tipo: String(sale.status || "").toLowerCase().includes("devol") ? "Devolucao" : "Cancelamento",
            Motivo: sale.nfceStatus || sale.status || "Nao informado",
            Usuario: sale.userName || sale.userId || "-",
            DataHora: fmtDate(sale.createdAt),
          }));

        return {
          id: reportId,
          title: "Cancelamentos e devolucoes",
          group: "Relatorios Fiscais",
          description: "Motivo, usuario e data/hora",
          columns: ["Documento", "Tipo", "Motivo", "Usuario", "DataHora"],
          rows,
          note: rows.length === 0 ? "Sem cancelamentos/devolucoes no periodo." : undefined,
        };
      }
      case "fiscal_impostos": {
        const saleItems = await context.loadSaleItemsForSales(context.filteredSales);
        const totals = saleItems.reduce(
          (acc, item) => {
            acc.icms += toNumber(item.icmsValue);
            acc.pis += toNumber(item.pisValue);
            acc.cofins += toNumber(item.cofinsValue);
            acc.ipi += toNumber(item.ipiValue);
            acc.iss += toNumber(item.issValue);
            return acc;
          },
          { icms: 0, icmsSt: 0, pis: 0, cofins: 0, ipi: 0, iss: 0 },
        );

        return {
          id: reportId,
          title: "Impostos apurados",
          group: "Relatorios Fiscais",
          description: "Apuracao por item de venda no periodo selecionado",
          columns: ["Imposto", "Valor"],
          rows: [
            { Imposto: "ICMS", Valor: money(totals.icms) },
            { Imposto: "ICMS-ST", Valor: money(totals.icmsSt) },
            { Imposto: "PIS", Valor: money(totals.pis) },
            { Imposto: "COFINS", Valor: money(totals.cofins) },
            { Imposto: "IPI", Valor: money(totals.ipi) },
            { Imposto: "ISS", Valor: money(totals.iss) },
          ],
        };
      }
      case "fiscal_livro": {
        const entradas = context.filteredPayables.map((p) => ({
          Data: fmtDate(p.dueDate),
          Tipo: "Entrada (Compra)",
          Documento: `PAG-${p.id}`,
          Parceiro: p.supplierName || "-",
          Valor: money(toNumber(p.amount)),
        }));
        const saidas = context.filteredSales.map((s) => ({
          Data: fmtDate(s.createdAt),
          Tipo: "Saida (Venda)",
          Documento: s.nfceKey || `VENDA-${s.id}`,
          Parceiro: s.customerName || "Consumidor Final",
          Valor: money(toNumber(s.total)),
        }));
        return {
          id: reportId,
          title: "Livro de entradas e saidas",
          group: "Relatorios Fiscais",
          description: "Conferencia fiscal de compras x vendas",
          columns: ["Data", "Tipo", "Documento", "Parceiro", "Valor"],
          rows: [...entradas, ...saidas].sort((a, b) => (String(a.Data) > String(b.Data) ? 1 : -1)),
        };
      }
      case "financeiro_fluxo_caixa": {
        const dayMap = new Map<
          string,
          { entradas: number; saidas: number; qtdEntradas: number; qtdSaidas: number }
        >();

        context.filteredSales.forEach((sale) => {
          const key = format(parseDateSafe(sale.createdAt) || new Date(), "yyyy-MM-dd");
          const existing = dayMap.get(key) || {
            entradas: 0,
            saidas: 0,
            qtdEntradas: 0,
            qtdSaidas: 0,
          };
          existing.entradas += toNumber(sale.total);
          existing.qtdEntradas += 1;
          dayMap.set(key, existing);
        });

        context.filteredPayables
          .filter((p) => String(p.status).toLowerCase().includes("pago"))
          .forEach((payable) => {
            const date = payable.paidDate || payable.dueDate;
            const key = format(parseDateSafe(date) || new Date(), "yyyy-MM-dd");
            const existing = dayMap.get(key) || {
              entradas: 0,
              saidas: 0,
              qtdEntradas: 0,
              qtdSaidas: 0,
            };
            existing.saidas += toNumber(payable.amount);
            existing.qtdSaidas += 1;
            dayMap.set(key, existing);
          });

        const rows = Array.from(dayMap.entries())
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([day, values]) => ({
            Data: fmtDate(`${day}T00:00:00`),
            QtdEntradas: values.qtdEntradas,
            Entradas: money(values.entradas),
            QtdSaidas: values.qtdSaidas,
            Saidas: money(values.saidas),
            SaldoDiario: values.entradas - values.saidas,
          }));

        let acumulado = 0;
        const rowsWithAccum = rows.map((row) => {
          acumulado += toNumber(row.SaldoDiario);
          return { ...row, SaldoDiario: money(toNumber(row.SaldoDiario)), SaldoAcumulado: money(acumulado) };
        });

        return {
          id: reportId,
          title: "Fluxo de caixa",
          group: "Relatorios Financeiros",
          description: "Entradas, saídas e saldo com detalhamento diário",
          columns: [
            "Data",
            "QtdEntradas",
            "Entradas",
            "QtdSaidas",
            "Saidas",
            "SaldoDiario",
            "SaldoAcumulado",
          ],
          rows: rowsWithAccum,
        };
      }
      case "financeiro_pagar": {
        const now = new Date();
        return {
          id: reportId,
          title: "Contas a pagar",
          group: "Relatorios Financeiros",
          description: "Por vencimento, fornecedor e situacao",
          columns: ["Descricao", "Fornecedor", "Vencimento", "Valor", "Status", "EmAtraso"],
          rows: context.filteredPayables.map((p) => {
            const due = parseDateSafe(p.dueDate);
            const overdue = due ? due < now && !String(p.status).toLowerCase().includes("pago") : false;
            return {
              Descricao: p.description,
              Fornecedor: p.supplierName || "-",
              Vencimento: fmtDate(p.dueDate),
              Valor: money(toNumber(p.amount)),
              Status: p.status,
              EmAtraso: overdue ? "Sim" : "Nao",
            };
          }),
        };
      }
      case "financeiro_receber": {
        const now = new Date();
        return {
          id: reportId,
          title: "Contas a receber",
          group: "Relatorios Financeiros",
          description: "Por cliente, em aberto, recebidas e inadimplentes",
          columns: ["Descricao", "Cliente", "Vencimento", "Valor", "Status", "Inadimplente"],
          rows: context.filteredReceivables.map((r) => {
            const due = parseDateSafe(r.dueDate);
            const received = String(r.status).toLowerCase().includes("receb");
            const inadimplente = due ? due < now && !received : false;
            return {
              Descricao: r.description,
              Cliente: r.customerName || "-",
              Vencimento: fmtDate(r.dueDate),
              Valor: money(toNumber(r.amount)),
              Status: r.status,
              Inadimplente: inadimplente ? "Sim" : "Nao",
            };
          }),
        };
      }
      case "financeiro_forma_pagamento": {
        const grouped = context.filteredSales.reduce<
          Record<string, { total: number; count: number }>
        >((acc, sale) => {
          const method = sale.paymentMethod || "Outros";
          const current = acc[method] || { total: 0, count: 0 };
          current.total += toNumber(sale.total);
          current.count += 1;
          acc[method] = current;
          return acc;
        }, {});

        const rows = context.filteredSales
          .slice()
          .sort(
            (a, b) =>
              (parseDateSafe(b.createdAt)?.getTime() || 0) -
              (parseDateSafe(a.createdAt)?.getTime() || 0),
          )
          .map((sale) => ({
            FormaPagamento: sale.paymentMethod || "Outros",
            Venda: `#${sale.id}`,
            Cliente: sale.customerName || "Consumidor Final",
            DataHora: fmtDate(sale.createdAt),
            Status: sale.status || "-",
            Valor: money(toNumber(sale.total)),
          }));
        if (detailLevel === "resumo") {
          return {
            id: reportId,
            title: "Recebimentos por forma de pagamento",
            group: "Relatorios Financeiros",
            description: "Resumo por forma de pagamento",
            columns: ["FormaPagamento", "QtdVendas", "ValorTotal"],
            rows: Object.entries(grouped).map(([method, data]) => ({
              FormaPagamento: method,
              QtdVendas: data.count,
              ValorTotal: money(data.total),
            })),
          };
        }
        return {
          id: reportId,
          title: "Recebimentos por forma de pagamento",
          group: "Relatorios Financeiros",
          description: "Detalhamento por venda e forma de pagamento",
          columns: ["FormaPagamento", "Venda", "Cliente", "DataHora", "Status", "Valor"],
          rows,
          note: Object.entries(grouped)
            .map(([method, data]) => `${method}: ${data.count} venda(s) | ${money(data.total)}`)
            .join(" | "),
        };
      }
      case "financeiro_conciliacao_cartoes": {
        const methods = context.filteredSales.filter((sale) =>
          /(cart|credit|debito|credito)/i.test(String(sale.paymentMethod || "")),
        );
        const rows = methods
          .slice()
          .sort(
            (a, b) =>
              (parseDateSafe(b.createdAt)?.getTime() || 0) -
              (parseDateSafe(a.createdAt)?.getTime() || 0),
          )
          .map((sale) => {
            const method = sale.paymentMethod || "Cartao";
            const gross = toNumber(sale.total);
            const fee = /debito/i.test(method) ? 0.02 : 0.035;
            const feeValue = gross * fee;
            const liquid = gross - feeValue;
            return {
              Venda: `#${sale.id}`,
              Metodo: method,
              DataHora: fmtDate(sale.createdAt),
              Bruto: money(gross),
              TaxaEstimada: `${(fee * 100).toFixed(2)}% (${money(feeValue)})`,
              LiquidoEstimado: money(liquid),
              Status: sale.status || "-",
            };
          });
        if (detailLevel === "resumo") {
          const grouped = rows.reduce<
            Record<string, { count: number; bruto: number; liquido: number }>
          >((acc, row) => {
            const method = String(row.Metodo || "Cartao");
            const bruto = toNumber(String(row.Bruto).replace("R$", "").replace(/\./g, "").replace(",", "."));
            const liquido = toNumber(
              String(row.LiquidoEstimado).replace("R$", "").replace(/\./g, "").replace(",", "."),
            );
            const current = acc[method] || { count: 0, bruto: 0, liquido: 0 };
            current.count += 1;
            current.bruto += bruto;
            current.liquido += liquido;
            acc[method] = current;
            return acc;
          }, {});
          return {
            id: reportId,
            title: "Conciliacao de cartoes",
            group: "Relatorios Financeiros",
            description: "Resumo estimado por metodo",
            columns: ["Metodo", "QtdVendas", "Bruto", "LiquidoEstimado"],
            rows: Object.entries(grouped).map(([method, info]) => ({
              Metodo: method,
              QtdVendas: info.count,
              Bruto: money(info.bruto),
              LiquidoEstimado: money(info.liquido),
            })),
            note: "Taxas exibidas como estimativa.",
          };
        }
        return {
          id: reportId,
          title: "Conciliacao de cartoes",
          group: "Relatorios Financeiros",
          description: "Detalhamento estimado por venda com cartao",
          columns: ["Venda", "Metodo", "DataHora", "Bruto", "TaxaEstimada", "LiquidoEstimado", "Status"],
          rows,
          note: "Taxas e parcelas exibidas como estimativa. Integre com TEF/adquirente para conciliacao oficial.",
        };
      }
      case "estoque_atual": {
        return {
          id: reportId,
          title: "Estoque atual",
          group: "Relatorios de Estoque",
          description: "Quantidade, custo medio e valor total em estoque",
          columns: ["Produto", "Quantidade", "CustoMedio", "ValorTotalEstoque"],
          rows: context.products.map((product) => {
            const cost = toNumber(product.purchasePrice || product.price);
            return {
              Produto: product.name,
              Quantidade: product.stock,
              CustoMedio: money(cost),
              ValorTotalEstoque: money(cost * product.stock),
            };
          }),
        };
      }
      case "estoque_movimentacao": {
        const fromSalesItems = await context.loadSaleItemsForSales(context.filteredSales);
        const salesById = new Map(context.filteredSales.map((sale) => [sale.id, sale]));
        const grouped = fromSalesItems.reduce<
          Record<string, { qty: number; revenue: number; lastAt: string }>
        >((acc, item) => {
          const key = item.productName || `Produto ${item.productId}`;
          const sale = salesById.get(item.saleId);
          const saleDate = sale?.createdAt || "";
          const current = acc[key] || { qty: 0, revenue: 0, lastAt: "" };
          current.qty += item.quantity;
          current.revenue += toNumber(item.subtotal);
          if (!current.lastAt || saleDate > current.lastAt) {
            current.lastAt = saleDate;
          }
          acc[key] = current;
          return acc;
        }, {});

        const rows = Object.entries(grouped)
          .sort((a, b) => b[1].qty - a[1].qty)
          .map(([name, info]) => ({
            Produto: name,
            TipoMovimento: "Saida (venda)",
            Quantidade: info.qty,
            ValorMovimentado: money(info.revenue),
            UltimaMovimentacao: fmtDate(info.lastAt),
            Origem: "Venda PDV/caixa",
          }));
        if (detailLevel === "resumo") {
          const totalQty = rows.reduce((acc, row) => acc + toNumber(row.Quantidade), 0);
          return {
            id: reportId,
            title: "Movimentacao de estoque",
            group: "Relatorios de Estoque",
            description: "Resumo de saídas no período",
            columns: ["Indicador", "Valor"],
            rows: [
              { Indicador: "Produtos com movimentacao", Valor: rows.length },
              { Indicador: "Quantidade total movimentada", Valor: totalQty },
            ],
            note: "Entradas/ajustes/perdas exigem ajuste de estoque para rastreio completo.",
          };
        }
        return {
          id: reportId,
          title: "Movimentacao de estoque",
          group: "Relatorios de Estoque",
          description: "Detalhamento por produto das movimentacoes registradas no periodo",
          columns: [
            "Produto",
            "TipoMovimento",
            "Quantidade",
            "ValorMovimentado",
            "UltimaMovimentacao",
            "Origem",
          ],
          rows,
          note: "Entradas/ajustes/perdas exigem uso do ajuste de estoque para rastreio completo.",
        };
      }
      case "estoque_minimo": {
        const low = context.products.filter((p) => p.stock <= toNumber(p.minStock ?? 0));
        return {
          id: reportId,
          title: "Produtos com estoque minimo",
          group: "Relatorios de Estoque",
          description: "Itens abaixo ou no limite minimo",
          columns: ["Produto", "EstoqueAtual", "EstoqueMinimo", "AlertaReposicao"],
          rows: low.map((product) => ({
            Produto: product.name,
            EstoqueAtual: product.stock,
            EstoqueMinimo: toNumber(product.minStock ?? 0),
            AlertaReposicao: "Repor",
          })),
        };
      }
      case "estoque_giro": {
        const saleItems = await context.loadSaleItemsForSales(context.filteredSales);
        const byProduct = saleItems.reduce<Record<string, { qty: number; revenue: number }>>((acc, item) => {
          const key = item.productName || `Produto ${item.productId}`;
          const current = acc[key] || { qty: 0, revenue: 0 };
          current.qty += item.quantity;
          current.revenue += toNumber(item.subtotal);
          acc[key] = current;
          return acc;
        }, {});

        const moving = Object.entries(byProduct)
          .sort((a, b) => b[1].qty - a[1].qty)
          .slice(0, 10)
          .map(([name, info]) => ({
            Produto: name,
            Tipo: "Mais vendido",
            Quantidade: info.qty,
            Faturamento: money(info.revenue),
          }));

        const soldNames = new Set(Object.keys(byProduct));
        const stagnant = context.products
          .filter((p) => !soldNames.has(p.name))
          .slice(0, 10)
          .map((p) => ({
            Produto: p.name,
            Tipo: "Parado",
            Quantidade: 0,
            Faturamento: money(0),
          }));

        return {
          id: reportId,
          title: "Giro de estoque",
          group: "Relatorios de Estoque",
          description: "Produtos mais vendidos e produtos parados",
          columns: ["Produto", "Tipo", "Quantidade", "Faturamento"],
          rows: [...moving, ...stagnant],
        };
      }
      case "estoque_promocoes": {
        const rows = context.products.map((product) => {
          const regularPrice = toNumber(product.price);
          const promoPrice = toNumber(product.promoPrice);
          const hasPromotion = promoPrice > 0;
          const start = parseDateSafe(product.promoStart || undefined);
          const end = parseDateSafe(product.promoEnd || undefined);

          let duration = "-";
          if (start && end) {
            const days = Math.max(
              1,
              Math.floor((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)) + 1,
            );
            duration = `${days} dia(s)`;
          }

          const period = start || end ? `${fmtDate(start)} ate ${fmtDate(end)}` : "-";

          return {
            Produto: product.name,
            EmPromocao: hasPromotion ? "Sim" : "Nao",
            PeriodoPromocao: period,
            DuracaoPromocao: duration,
            PrecoAntes: money(regularPrice),
            PrecoPromocao: hasPromotion ? money(promoPrice) : "-",
          };
        });

        return {
          id: reportId,
          title: "Produtos em promocao",
          group: "Relatorios de Estoque",
          description: "Situacao da promocao por produto",
          columns: [
            "Produto",
            "EmPromocao",
            "PeriodoPromocao",
            "DuracaoPromocao",
            "PrecoAntes",
            "PrecoPromocao",
          ],
          rows,
        };
      }
      case "estoque_inventario": {
        return {
          id: reportId,
          title: "Inventario fisico",
          group: "Relatorios de Estoque",
          description: "Comparativo entre saldo no sistema e contagem real",
          columns: ["Produto", "Sistema", "ContagemReal", "Divergencia"],
          rows: context.products.map((p) => ({
            Produto: p.name,
            Sistema: p.stock,
            ContagemReal: "",
            Divergencia: "",
          })),
          note: "Preencha a coluna ContagemReal apos inventario fisico e reimporte para conciliacao.",
        };
      }
      case "pdv_fechamento": {
        return {
          id: reportId,
          title: "Fechamento de caixa (X e Z)",
          group: "Relatorios de PDV",
          description: "Abertura, suprimentos, sangrias, vendas e diferenca",
          columns: ["Caixa", "Operador", "Abertura", "Suprimentos", "Sangrias", "Fechamento", "Diferenca"],
          rows: context.filteredCashRegisters.map((register) => {
            const moves = context.filteredCashMovements.filter((m) => m.cashRegisterId === register.id);
            const suprimentos = moves
              .filter((m) => String(m.type).toLowerCase().includes("supr"))
              .reduce((acc, m) => acc + toNumber(m.amount), 0);
            const sangrias = moves
              .filter((m) => String(m.type).toLowerCase().includes("sang"))
              .reduce((acc, m) => acc + toNumber(m.amount), 0);
            return {
              Caixa: register.id,
              Operador: register.userName,
              Abertura: money(toNumber(register.openingAmount)),
              Suprimentos: money(suprimentos),
              Sangrias: money(sangrias),
              Fechamento: money(toNumber(register.closingAmount)),
              Diferenca: money(toNumber(register.difference)),
            };
          }),
        };
      }
      case "pdv_vendas_vendedor": {
        const grouped = context.filteredSales.reduce<Record<string, { qty: number; total: number }>>((acc, sale) => {
          const key = sale.userName || sale.userId || "Sem identificacao";
          const current = acc[key] || { qty: 0, total: 0 };
          current.qty += 1;
          current.total += toNumber(sale.total);
          acc[key] = current;
          return acc;
        }, {});

        return {
          id: reportId,
          title: "Vendas por vendedor",
          group: "Relatorios de PDV",
          description: "Quantidade, faturamento, ticket medio e comissao estimada",
          columns: ["Vendedor", "QtdVendas", "Faturamento", "TicketMedio", "Meta", "ComissaoEstimada"],
          rows: Object.entries(grouped).map(([seller, data]) => {
            const ticket = data.qty > 0 ? data.total / data.qty : 0;
            const comissao = data.total * 0.01;
            return {
              Vendedor: seller,
              QtdVendas: data.qty,
              Faturamento: money(data.total),
              TicketMedio: money(ticket),
              Meta: "Nao configurada",
              ComissaoEstimada: money(comissao),
            };
          }),
          note: "Comissao exibida com regra padrao de 1%. Ajuste conforme politica comercial.",
        };
      }
      case "pdv_ticket_medio": {
        const total = context.filteredSales.reduce((acc, sale) => acc + toNumber(sale.total), 0);
        const qty = context.filteredSales.length;
        const ticket = qty > 0 ? total / qty : 0;
        return {
          id: reportId,
          title: "Ticket medio",
          group: "Relatorios de PDV",
          description: "Valor medio por venda",
          columns: ["Indicador", "Valor"],
          rows: [
            { Indicador: "Quantidade de vendas", Valor: qty },
            { Indicador: "Faturamento total", Valor: money(total) },
            { Indicador: "Ticket medio", Valor: money(ticket) },
          ],
        };
      }
      case "pdv_produtos_vendidos": {
        const items = await context.loadSaleItemsForSales(context.filteredSales);
        const salesById = new Map(context.filteredSales.map((sale) => [sale.id, sale]));
        const grouped = items.reduce<
          Record<string, { qty: number; revenue: number; countSales: number; lastSaleAt: string }>
        >((acc, item) => {
          const key = item.productName || `Produto ${item.productId}`;
          const current = acc[key] || { qty: 0, revenue: 0, countSales: 0, lastSaleAt: "" };
          const sale = salesById.get(item.saleId);
          current.qty += item.quantity;
          current.revenue += toNumber(item.subtotal);
          current.countSales += 1;
          const createdAt = sale?.createdAt || "";
          if (!current.lastSaleAt || createdAt > current.lastSaleAt) {
            current.lastSaleAt = createdAt;
          }
          acc[key] = current;
          return acc;
        }, {});
        if (detailLevel === "resumo") {
          return {
            id: reportId,
            title: "Produtos mais vendidos",
            group: "Relatorios de PDV",
            description: "Ranking resumido por quantidade e faturamento",
            columns: ["Produto", "Quantidade", "Faturamento"],
            rows: Object.entries(grouped)
              .sort((a, b) => b[1].qty - a[1].qty)
              .slice(0, 20)
              .map(([name, data]) => ({
                Produto: name,
                Quantidade: data.qty,
                Faturamento: money(data.revenue),
              })),
          };
        }
        return {
          id: reportId,
          title: "Produtos mais vendidos",
          group: "Relatorios de PDV",
          description: "Ranking detalhado por quantidade, faturamento e ultima venda",
          columns: ["Produto", "Quantidade", "Faturamento", "Vendas", "TicketMedioPorVenda", "UltimaVenda"],
          rows: Object.entries(grouped)
            .sort((a, b) => b[1].qty - a[1].qty)
            .slice(0, 50)
            .map(([name, data]) => ({
              Produto: name,
              Quantidade: data.qty,
              Faturamento: money(data.revenue),
              Vendas: data.countSales,
              TicketMedioPorVenda: money(data.countSales > 0 ? data.revenue / data.countSales : 0),
              UltimaVenda: fmtDate(data.lastSaleAt),
            })),
        };
      }
      case "gerencial_margem": {
        return {
          id: reportId,
          title: "Margem de lucro por produto",
          group: "Relatorios Gerenciais",
          description: "Preco de custo, venda e lucro bruto",
          columns: ["Produto", "PrecoCusto", "PrecoVenda", "LucroBruto", "Margem"],
          rows: context.products.map((product) => {
            const cost = toNumber(product.purchasePrice || product.price);
            const price = toNumber(product.price);
            const lucro = price - cost;
            const margem = cost > 0 ? (lucro / cost) * 100 : 0;
            return {
              Produto: product.name,
              PrecoCusto: money(cost),
              PrecoVenda: money(price),
              LucroBruto: money(lucro),
              Margem: `${margem.toFixed(2)}%`,
            };
          }),
        };
      }
      case "gerencial_dre": {
        const receita = context.filteredSales.reduce((acc, sale) => acc + toNumber(sale.total), 0);
        const custo = context.products.reduce((acc, product) => {
          const cost = toNumber(product.purchasePrice || product.price);
          return acc + cost * Math.max(0, product.stock);
        }, 0);
        const despesas = context.filteredPayables.reduce((acc, p) => acc + toNumber(p.amount), 0);
        const lucro = receita - despesas;
        return {
          id: reportId,
          title: "DRE",
          group: "Relatorios Gerenciais",
          description: "Demonstrativo de resultado do periodo",
          columns: ["Conta", "Valor"],
          rows: [
            { Conta: "Receita", Valor: money(receita) },
            { Conta: "Custo (estoque atual)", Valor: money(custo) },
            { Conta: "Despesas", Valor: money(despesas) },
            { Conta: "Lucro liquido", Valor: money(lucro) },
          ],
        };
      }
      case "gerencial_abc": {
        const items = await context.loadSaleItemsForSales(context.filteredSales);
        const grouped = items.reduce<Record<string, number>>((acc, item) => {
          const key = item.productName || `Produto ${item.productId}`;
          acc[key] = (acc[key] || 0) + toNumber(item.subtotal);
          return acc;
        }, {});
        const ordered = Object.entries(grouped).sort((a, b) => b[1] - a[1]);
        const total = ordered.reduce((acc, [, v]) => acc + v, 0);
        let cumulative = 0;

        const rows = ordered.map(([name, value]) => {
          cumulative += value;
          const share = total > 0 ? (value / total) * 100 : 0;
          const cumShare = total > 0 ? (cumulative / total) * 100 : 0;
          let classe = "C";
          if (cumShare <= 80) classe = "A";
          else if (cumShare <= 95) classe = "B";
          return {
            Produto: name,
            Faturamento: money(value),
            Participacao: `${share.toFixed(2)}%`,
            Acumulado: `${cumShare.toFixed(2)}%`,
            Classe: classe,
          };
        });

        return {
          id: reportId,
          title: "Curva ABC de produtos",
          group: "Relatorios Gerenciais",
          description: "Classificacao por participacao no faturamento",
          columns: ["Produto", "Faturamento", "Participacao", "Acumulado", "Classe"],
          rows,
        };
      }
      case "gerencial_comparativo_mensal": {
        const months = Array.from({ length: 6 }, (_, i) => subMonths(new Date(), 5 - i));
        const monthly = months.map((monthDate) => {
          const key = format(monthDate, "yyyy-MM");
          const total = context.allSales
            .filter((sale) => {
              const saleDate = parseDateSafe(sale.createdAt);
              return saleDate ? format(saleDate, "yyyy-MM") === key : false;
            })
            .reduce((acc, sale) => acc + toNumber(sale.total), 0);
          return { month: format(monthDate, "MMM/yyyy", { locale: ptBR }), total };
        });

        return {
          id: reportId,
          title: "Comparativo mensal",
          group: "Relatorios Gerenciais",
          description: "Evolucao de faturamento e sazonalidade",
          columns: ["Mes", "Faturamento", "VariacaoVsMesAnterior"],
          rows: monthly.map((m, index) => {
            const prev = monthly[index - 1]?.total || 0;
            const variation = prev > 0 ? ((m.total - prev) / prev) * 100 : 0;
            return {
              Mes: m.month,
              Faturamento: money(m.total),
              VariacaoVsMesAnterior: index === 0 ? "-" : `${variation.toFixed(2)}%`,
            };
          }),
        };
      }
      case "auditoria_log_usuarios": {
        const cashRows = context.filteredCashMovements.map((movement) => ({
          DataHora: fmtDate(movement.createdAt),
          Usuario: movement.userName,
          Acao: `Movimento de caixa (${movement.type})`,
          Detalhe: movement.reason || `Valor ${money(toNumber(movement.amount))}`,
        }));
        const fiscalRows = context.accessoryAudit
          .filter((audit) => inRange(audit.createdAt))
          .map((audit) => ({
            DataHora: fmtDate(audit.createdAt),
            Usuario: "Sistema",
            Acao: audit.action,
            Detalhe: audit.success ? "Sucesso" : "Falha",
          }));
        return {
          id: reportId,
          title: "Log de usuarios",
          group: "Relatorios de Auditoria",
          description: "Acoes operacionais e fiscais registradas",
          columns: ["DataHora", "Usuario", "Acao", "Detalhe"],
          rows: [...cashRows, ...fiscalRows].sort((a, b) => String(b.DataHora).localeCompare(String(a.DataHora))),
        };
      }
      case "auditoria_alteracoes_cadastro": {
        const productRows = context.products.map((p) => ({
          TipoCadastro: "Produto",
          Nome: p.name,
          Referencia: `ID ${p.id}`,
          Data: fmtDate(p.createdAt),
        }));
        const customerRows = context.customers.map((c) => ({
          TipoCadastro: "Cliente",
          Nome: c.name,
          Referencia: `ID ${c.id}`,
          Data: fmtDate(c.createdAt),
        }));
        const supplierRows = context.suppliers.map((s) => ({
          TipoCadastro: "Fornecedor",
          Nome: s.name,
          Referencia: `ID ${s.id}`,
          Data: fmtDate(s.createdAt),
        }));
        return {
          id: reportId,
          title: "Alteracoes de cadastro",
          group: "Relatorios de Auditoria",
          description: "Historico de cadastros (produto, cliente, fornecedor)",
          columns: ["TipoCadastro", "Nome", "Referencia", "Data"],
          rows: [...productRows, ...customerRows, ...supplierRows].sort((a, b) =>
            String(b.Data).localeCompare(String(a.Data)),
          ),
          note: "Historico de alteracoes exige trilha de auditoria dedicada. Aqui exibimos os registros cadastrados.",
        };
      }
      default:
        return {
          id: reportId,
          title: "Relatorio",
          group: "Outros",
          description: "Nao implementado",
          columns: ["Mensagem"],
          rows: [{ Mensagem: "Relatorio nao implementado." }],
        };
    }
  };

  const buildContext = (): ReportBuildContext => ({
    filteredSales,
    filteredPayables,
    filteredReceivables,
    filteredCashRegisters,
    filteredCashMovements,
    products,
    customers,
    suppliers,
    nfeHistory,
    accessoryAudit,
    allSales: sales,
    loadSaleItemsForSales,
  });

  const generateReport = async (reportId: string): Promise<ReportOutput> => {
    const definition = REPORT_DEFINITIONS.find((r) => r.id === reportId);
    if (!definition) {
      throw new Error("Relatorio nao encontrado.");
    }
    return buildReport(reportId, buildContext());
  };

  const [activeReportId, setActiveReportId] = useState<string | null>(null);
  const [rawReport, setRawReport] = useState<ReportOutput | null>(null);
  const [filteredRows, setFilteredRows] = useState<ReportRow[]>([]);
  const [hasAppliedFilter, setHasAppliedFilter] = useState(false);
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});
  const [catalogGroupFilter, setCatalogGroupFilter] = useState<string>("all");

  const exportCsv = (report: ReportOutput, rows: ReportRow[]) => {
    const escapeCsv = (value: CsvValue) => `"${String(value ?? "").replace(/"/g, '""')}"`;
    const csv = [
      report.columns.map(escapeCsv).join(";"),
      ...rows.map((row) => report.columns.map((column) => escapeCsv(row[column] ?? "")).join(";")),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${report.id}_${dateFrom}_${dateTo}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const exportExcel = (report: ReportOutput, rows: ReportRow[]) => {
    const tableHead = `<tr>${report.columns.map((col) => `<th>${col}</th>`).join("")}</tr>`;
    const tableBody = rows
      .map((row) => `<tr>${report.columns.map((col) => `<td>${String(row[col] ?? "")}</td>`).join("")}</tr>`)
      .join("");
    const html = `
      <html>
        <head><meta charset="utf-8" /></head>
        <body>
          <table border="1">
            <thead>${tableHead}</thead>
            <tbody>${tableBody}</tbody>
          </table>
        </body>
      </html>
    `;
    const blob = new Blob([html], { type: "application/vnd.ms-excel;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${report.id}_${dateFrom}_${dateTo}.xls`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const exportPdf = (report: ReportOutput, rows: ReportRow[]) => {
    const printWindow = window.open("", "_blank", "width=1200,height=800");
    if (!printWindow) {
      toast({
        title: "Erro ao exportar PDF",
        description: "Habilite pop-ups para gerar PDF.",
        variant: "destructive",
      });
      return;
    }
    const header = report.columns.map((col) => `<th>${col}</th>`).join("");
    const body = rows
      .map(
        (row) =>
          `<tr>${report.columns
            .map((col) => `<td>${String(row[col] ?? "").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</td>`)
            .join("")}</tr>`,
      )
      .join("");
    printWindow.document.write(`
      <html>
        <head>
          <meta charset="utf-8" />
          <title>${report.title}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 16px; }
            h1 { margin: 0 0 6px 0; font-size: 18px; }
            p { margin: 0 0 16px 0; color: #555; font-size: 12px; }
            table { width: 100%; border-collapse: collapse; font-size: 12px; }
            th, td { border: 1px solid #ccc; padding: 6px; text-align: left; }
            th { background: #f4f4f4; }
          </style>
        </head>
        <body>
          <h1>${report.title}</h1>
          <p>Periodo: ${dateFrom} a ${dateTo}</p>
          <table>
            <thead><tr>${header}</tr></thead>
            <tbody>${body}</tbody>
          </table>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  const handleOpenReport = async (reportId: string) => {
    try {
      setIsGenerating(true);
      const report = await generateReport(reportId);
      setSelectedReportId(reportId);
      setActiveReportId(reportId);
      setRawReport(report);
      setHasAppliedFilter(false);
      setFilteredRows([]);
      const initialFilters = report.columns.reduce<Record<string, string>>((acc, col) => {
        acc[col] = "";
        return acc;
      }, {});
      setColumnFilters(initialFilters);
    } catch (error) {
      toast({
        title: "Erro ao gerar relatorio",
        description: error instanceof Error ? error.message : "Falha ao montar relatorio.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleBackToList = () => {
    setActiveReportId(null);
    setRawReport(null);
    setHasAppliedFilter(false);
    setFilteredRows([]);
    setColumnFilters({});
  };

  useEffect(() => {
    if (!activeReportId) return;
    void handleOpenReport(activeReportId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detailLevel]);

  const groupedDefinitions = useMemo(() => {
    const groups = new Map<string, ReportDefinition[]>();
    REPORT_DEFINITIONS.forEach((def) => {
      const current = groups.get(def.group) || [];
      current.push(def);
      groups.set(def.group, current);
    });
    return Array.from(groups.entries());
  }, []);
  const visibleGroups = useMemo(
    () =>
      groupedDefinitions.filter(([groupName]) =>
        catalogGroupFilter === "all" ? true : groupName === catalogGroupFilter,
      ),
    [groupedDefinitions, catalogGroupFilter],
  );
  const recentReports = useMemo(() => REPORT_DEFINITIONS.slice(0, 3), []);
  const visibleFilterColumns = useMemo(() => {
    if (!rawReport) return [];
    if (rawReport.id === "fiscal_vendas_periodo") {
      return rawReport.columns.filter((column) => column.toLowerCase() !== "valor");
    }
    return rawReport.columns;
  }, [rawReport]);

  const filterConfigByColumn = useMemo(() => {
    const config = new Map<string, { type: FilterControlType; options: string[] }>();
    if (!rawReport) return config;

    rawReport.columns.forEach((column) => {
      const rawValues = rawReport.rows
        .map((row) => String(row[column] ?? "").trim())
        .filter((value) => value.length > 0);
      const uniqueValues = Array.from(new Set(rawValues));
      const normalizedName = column.toLowerCase();
      const isPresetColumn =
        normalizedName.includes("status") ||
        normalizedName.includes("tipo") ||
        normalizedName.includes("classe") ||
        normalizedName.includes("inadimplente") ||
        normalizedName.includes("ematraso") ||
        normalizedName.includes("sucesso");

      const isSmallControlledList =
        uniqueValues.length > 0 &&
        uniqueValues.length <= 12 &&
        uniqueValues.every((value) => value.length <= 40);

      if (isPresetColumn || isSmallControlledList) {
        config.set(column, { type: "select", options: uniqueValues.sort((a, b) => a.localeCompare(b)) });
      } else {
        config.set(column, { type: "text", options: [] });
      }
    });

    return config;
  }, [rawReport]);

  const applyColumnFilters = () => {
    if (!rawReport) return;
    const normalizedFilters = Object.entries(columnFilters)
      .filter(([, value]) => value.trim() !== "")
      .map(([column, value]) => [column, value.toLowerCase().trim()] as const);

    const result =
      normalizedFilters.length === 0
        ? rawReport.rows
        : rawReport.rows.filter((row) =>
            normalizedFilters.every(([column, value]) => {
              const cellValue = String(row[column] ?? "").toLowerCase().trim();
              const filterType = filterConfigByColumn.get(column)?.type || "text";
              if (filterType === "select") {
                return cellValue === value;
              }
              return cellValue.includes(value);
            }),
          );

    setFilteredRows(result);
    setHasAppliedFilter(true);
  };

  const canExport = rawReport && hasAppliedFilter;
  const reportRowsPagination = useTablePagination(filteredRows);
  const chartModel = useMemo(
    () => (hasAppliedFilter ? buildChartModel(rawReport, filteredRows) : null),
    [hasAppliedFilter, rawReport, filteredRows],
  );

  if (isLoading) {
    return (
      <Layout>
        <div className="flex h-96 items-center justify-center">
          <div className="text-center">
            <Loader2 className="mx-auto mb-4 h-12 w-12 animate-spin text-primary" />
            <p className="text-muted-foreground">Carregando central de relatorios...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-3xl font-heading font-bold tracking-tight text-foreground">
            Relatorios
          </h1>
          <p className="text-muted-foreground">
            Selecione um relatorio, aplique os filtros por coluna e exporte em Excel, CSV ou PDF.
          </p>
        </div>

        {!activeReportId ? (
          <div className="space-y-4">
            <Card className="border-slate-200 bg-slate-50/50">
              <CardContent className="pt-4">
                <div className="max-w-sm">
                  <p className="mb-1 text-xs font-medium text-muted-foreground">Tipo de Relatorio</p>
                  <Select value={catalogGroupFilter} onValueChange={setCatalogGroupFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      {groupedDefinitions.map(([groupName]) => (
                        <SelectItem key={groupName} value={groupName}>
                          {groupName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {visibleGroups.map(([groupName, defs]) => (
              <div key={groupName} className="space-y-2">
                <h3 className="text-lg font-semibold text-foreground">{groupName}</h3>
                <div className="grid gap-3 md:grid-cols-2">
                  {defs.map((report) => {
                    const Icon = REPORT_ICON_BY_ID[report.id] || FileText;
                    const iconStyle =
                      REPORT_ICON_STYLE_BY_ID[report.id] ||
                      REPORT_ICON_STYLE_BY_GROUP[report.group] ||
                      "bg-slate-100 text-slate-600";
                    return (
                    <button
                      key={report.id}
                      type="button"
                      className="w-full rounded-xl border bg-white p-3 text-left shadow-sm transition-colors hover:bg-muted/40"
                      onClick={() => handleOpenReport(report.id)}
                      disabled={isGenerating}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0 flex items-center gap-2">
                          <span className={`h-8 w-8 shrink-0 rounded-md flex items-center justify-center ${iconStyle}`}>
                            <Icon className="h-4 w-4" />
                          </span>
                          <div className="min-w-0">
                            <p className="font-semibold line-clamp-1">{report.title}</p>
                            <p className="text-sm text-muted-foreground line-clamp-1">{report.description}</p>
                          </div>
                        </div>
                        <Eye className="h-4 w-4 shrink-0 text-muted-foreground" />
                      </div>
                    </button>
                    );
                  })}
                </div>
              </div>
            ))}

            <Card className="border-slate-200">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Relatorios Recentes</CardTitle>
                  <Button variant="link" className="h-auto p-0 text-sm">Ver todos</Button>
                </div>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {recentReports.map((r) => (
                  <Badge key={r.id} variant="outline" className="rounded-md bg-slate-50">
                    {r.id}.csv
                  </Badge>
                ))}
              </CardContent>
            </Card>
          </div>
        ) : (
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <CardTitle>{rawReport?.title || "Relatorio"}</CardTitle>
                  <CardDescription>{rawReport?.description}</CardDescription>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="min-w-[180px]">
                    <Select
                      value={detailLevel}
                      onValueChange={(value: DetailLevel) => setDetailLevel(value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Nível de detalhe" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="resumo">Nível: Resumo</SelectItem>
                        <SelectItem value="completo">Nível: Completo</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button variant="outline" onClick={handleBackToList}>
                    Voltar para lista
                  </Button>
                  <Button onClick={applyColumnFilters} disabled={isGenerating || !rawReport}>
                    {isGenerating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Filtrar
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {!rawReport ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <>
                  <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                    {visibleFilterColumns.map((column) => (
                      <div key={column}>
                        <p className="mb-2 text-sm font-medium">{column}</p>
                        {filterConfigByColumn.get(column)?.type === "select" ? (
                          <Select
                            value={columnFilters[column] || "__all__"}
                            onValueChange={(value) =>
                              setColumnFilters((prev) => ({
                                ...prev,
                                [column]: value === "__all__" ? "" : value,
                              }))
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder={`Selecione ${column}`} />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__all__">Todos</SelectItem>
                              {(filterConfigByColumn.get(column)?.options || []).map((option) => (
                                <SelectItem key={`${column}-${option}`} value={option}>
                                  {option}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Input
                            value={columnFilters[column] || ""}
                            onChange={(e) =>
                              setColumnFilters((prev) => ({ ...prev, [column]: e.target.value }))
                            }
                            placeholder={`Filtrar por ${column}`}
                          />
                        )}
                      </div>
                    ))}
                  </div>

                  {hasAppliedFilter ? (
                    <>
                      {chartModel && (
                        <div className="rounded-md border p-3">
                          <p className="mb-2 text-sm font-medium">Grafico do Relatorio</p>
                          <div className="h-[280px]">
                            <ResponsiveContainer width="100%" height="100%">
                              {chartModel.kind === "bar" ? (
                                <BarChart data={chartModel.data}>
                                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                                  <YAxis />
                                  <Tooltip formatter={(value: number) => money(Number(value))} />
                                  <Legend />
                                  <Bar dataKey="value" name={chartModel.groupLabel} fill="#3b82f6" radius={[6, 6, 0, 0]} />
                                </BarChart>
                              ) : chartModel.kind === "line" ? (
                                <LineChart data={chartModel.data}>
                                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                                  <YAxis />
                                  <Tooltip formatter={(value: number) => money(Number(value))} />
                                  <Legend />
                                  <Line type="monotone" dataKey="value" name={chartModel.groupLabel} stroke="#10b981" strokeWidth={2} dot={false} />
                                </LineChart>
                              ) : (
                                <PieChart>
                                  <Pie data={chartModel.data} dataKey="value" nameKey="label" outerRadius={95} innerRadius={45}>
                                    {chartModel.data.map((entry, index) => (
                                      <Cell key={`${entry.label}-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                                    ))}
                                  </Pie>
                                  <Tooltip formatter={(value: number) => money(Number(value))} />
                                  <Legend />
                                </PieChart>
                              )}
                            </ResponsiveContainer>
                          </div>
                        </div>
                      )}
                      {rawReport.note && (
                        <div className="rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-700">
                          {rawReport.note}
                        </div>
                      )}
                      <div className="max-h-[520px] overflow-auto rounded-md border">
                        <Table>
                          <TableHeader className="bg-muted/70">
                            <TableRow className="hover:bg-muted/70">
                              {rawReport.columns.map((col) => (
                                <TableHead key={col}>{col}</TableHead>
                              ))}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {filteredRows.length === 0 ? (
                              <TableRow>
                                <TableCell colSpan={rawReport.columns.length} className="text-center text-muted-foreground">
                                  Nenhum registro encontrado para os filtros informados.
                                </TableCell>
                              </TableRow>
                            ) : (
                              reportRowsPagination.paginatedItems.map((row, index) => (
                                <TableRow key={`${rawReport.id}-${index}`}>
                                  {rawReport.columns.map((col) => (
                                    <TableCell key={`${rawReport.id}-${index}-${col}`}>
                                      {String(row[col] ?? "-")}
                                    </TableCell>
                                  ))}
                                </TableRow>
                              ))
                            )}
                          </TableBody>
                        </Table>
                        <TablePaginationControls
                          page={reportRowsPagination.page}
                          pageSize={reportRowsPagination.pageSize}
                          totalItems={reportRowsPagination.totalItems}
                          totalPages={reportRowsPagination.totalPages}
                          startItem={reportRowsPagination.startItem}
                          endItem={reportRowsPagination.endItem}
                          onPageChange={reportRowsPagination.setPage}
                          onPageSizeChange={reportRowsPagination.setPageSize}
                        />
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="outline"
                          disabled={!canExport}
                          onClick={() => rawReport && exportExcel(rawReport, filteredRows)}
                        >
                          Exportar Excel
                        </Button>
                        <Button
                          variant="outline"
                          disabled={!canExport}
                          onClick={() => rawReport && exportCsv(rawReport, filteredRows)}
                        >
                          Exportar CSV
                        </Button>
                        <Button disabled={!canExport} onClick={() => rawReport && exportPdf(rawReport, filteredRows)}>
                          Exportar PDF
                        </Button>
                      </div>
                    </>
                  ) : (
                    <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                      Preencha os filtros (se quiser) e clique em <strong>Filtrar</strong> para exibir a tabela.
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}
