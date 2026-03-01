import Layout from "@/components/layout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { Badge } from "@/components/ui/badge";
import {
  ArrowUpRight,
  ArrowDownRight,
  DollarSign,
  Calendar,
  Download,
  Plus,
  Loader2,
  Check,
  Trash2,
} from "lucide-react";
import {
  LineChart,
  Line,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  format,
  subDays,
  parseISO,
  startOfMonth,
  endOfMonth,
  subMonths,
  addMonths,
  isSameMonth,
  isSameYear,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

interface Sale {
  id: number;
  total: string;
  createdAt: string;
  paymentMethod: string;
}

interface Payable {
  id: number;
  description: string;
  supplierId: number | null;
  supplierName: string | null;
  category: string;
  amount: string;
  dueDate: string;
  paidDate: string | null;
  status: string;
  notes: string | null;
  createdAt: string;
}

interface Receivable {
  id: number;
  description: string;
  customerId: number | null;
  customerName: string | null;
  saleId: number | null;
  category: string;
  amount: string;
  dueDate: string;
  receivedDate: string | null;
  status: string;
  notes: string | null;
  createdAt: string;
}

interface Supplier {
  id: number;
  name: string;
}

interface Customer {
  id: number;
  name: string;
}

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884d8"];

const PAYABLE_CATEGORIES = [
  "Fornecedores",
  "Aluguel",
  "Energia",
  "ÃƒÂgua",
  "Internet",
  "Impostos",
  "SalÃƒÂ¡rios",
  "Marketing",
  "ManutenÃƒÂ§ÃƒÂ£o",
  "Outros",
];

const RECEIVABLE_CATEGORIES = ["Vendas", "ServiÃƒÂ§os", "EmprÃƒÂ©stimos", "Outros"];

export default function Finance() {
  const [location] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [payableDialogOpen, setPayableDialogOpen] = useState(false);
  const [receivableDialogOpen, setReceivableDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<
    "cashflow" | "payables" | "receivables" | "dre"
  >("cashflow");

  useEffect(() => {
    const queryString = location.includes("?")
      ? location.substring(location.indexOf("?"))
      : window.location.search;
    const tabParam = new URLSearchParams(queryString).get("tab");

    if (
      tabParam === "cashflow" ||
      tabParam === "payables" ||
      tabParam === "receivables" ||
      tabParam === "dre"
    ) {
      setActiveTab(tabParam);
    }
  }, [location]);

  const { data: sales = [], isLoading: salesLoading } = useQuery({
    queryKey: ["/api/sales"],
    queryFn: async () => {
      const res = await fetch("/api/sales");
      if (!res.ok) throw new Error("Failed to fetch sales");
      return res.json();
    },
  });

  const { data: payables = [], isLoading: payablesLoading } = useQuery({
    queryKey: ["/api/payables"],
    queryFn: async () => {
      const res = await fetch("/api/payables");
      if (!res.ok) throw new Error("Failed to fetch payables");
      return res.json();
    },
  });

  const { data: receivables = [], isLoading: receivablesLoading } = useQuery({
    queryKey: ["/api/receivables"],
    queryFn: async () => {
      const res = await fetch("/api/receivables");
      if (!res.ok) throw new Error("Failed to fetch receivables");
      return res.json();
    },
  });

  const { data: suppliers = [] } = useQuery<Supplier[]>({
    queryKey: ["/api/suppliers"],
    queryFn: async () => {
      const res = await fetch("/api/suppliers");
      if (!res.ok) throw new Error("Failed to fetch suppliers");
      return res.json();
    },
  });

  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
    queryFn: async () => {
      const res = await fetch("/api/customers");
      if (!res.ok) throw new Error("Failed to fetch customers");
      return res.json();
    },
  });

  const [selectedSupplierId, setSelectedSupplierId] = useState<string>("");
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");

  const createPayableMutation = useMutation({
    mutationFn: async (data: {
      description: string;
      category: string;
      amount: string;
      dueDate: string;
      supplierId?: number;
      supplierName?: string;
      notes?: string;
    }) => {
      const res = await fetch("/api/payables", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          amount: data.amount,
          dueDate: new Date(data.dueDate).toISOString(),
          status: "Pendente",
        }),
      });
      if (!res.ok) throw new Error("Failed to create payable");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payables"] });
      setPayableDialogOpen(false);
      setSelectedSupplierId("");
      toast({ title: "Conta a pagar criada com sucesso" });
    },
    onError: () => {
      toast({ title: "Erro ao criar conta a pagar", variant: "destructive" });
    },
  });

  const createReceivableMutation = useMutation({
    mutationFn: async (data: {
      description: string;
      category: string;
      amount: string;
      dueDate: string;
      customerId?: number;
      customerName?: string;
      notes?: string;
    }) => {
      const res = await fetch("/api/receivables", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          amount: data.amount,
          dueDate: new Date(data.dueDate).toISOString(),
          status: "Pendente",
        }),
      });
      if (!res.ok) throw new Error("Failed to create receivable");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/receivables"] });
      setReceivableDialogOpen(false);
      setSelectedCustomerId("");
      toast({ title: "Conta a receber criada com sucesso" });
    },
    onError: () => {
      toast({ title: "Erro ao criar conta a receber", variant: "destructive" });
    },
  });

  const markPayablePaidMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/payables/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "Pago",
          paidDate: new Date().toISOString(),
        }),
      });
      if (!res.ok) throw new Error("Failed to update payable");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payables"] });
      toast({ title: "Conta marcada como paga" });
    },
  });

  const markReceivableReceivedMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/receivables/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "Recebido",
          receivedDate: new Date().toISOString(),
        }),
      });
      if (!res.ok) throw new Error("Failed to update receivable");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/receivables"] });
      toast({ title: "Conta marcada como recebida" });
    },
  });

  const deletePayableMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/payables/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete payable");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payables"] });
      toast({ title: "Conta a pagar excluÃƒÂ­da" });
    },
  });

  const deleteReceivableMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/receivables/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete receivable");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/receivables"] });
      toast({ title: "Conta a receber excluÃƒÂ­da" });
    },
  });

  const now = new Date();
  const currentMonthStart = startOfMonth(now);
  const lastMonthStart = startOfMonth(subMonths(now, 1));
  const lastMonthEnd = endOfMonth(subMonths(now, 1));

  const filteredPayables = payables.filter((p: Payable) => {
    try {
      const dueDate = parseISO(p.dueDate);
      return (
        isSameMonth(dueDate, selectedMonth) &&
        isSameYear(dueDate, selectedMonth)
      );
    } catch {
      return false;
    }
  });

  const filteredReceivables = receivables.filter((r: Receivable) => {
    try {
      const dueDate = parseISO(r.dueDate);
      return (
        isSameMonth(dueDate, selectedMonth) &&
        isSameYear(dueDate, selectedMonth)
      );
    } catch {
      return false;
    }
  });
  const payablesPagination = useTablePagination<Payable>(filteredPayables as Payable[]);
  const receivablesPagination = useTablePagination<Receivable>(
    filteredReceivables as Receivable[],
  );

  const currentMonthSales = sales.filter((sale: Sale) => {
    try {
      const saleDate = parseISO(sale.createdAt);
      return saleDate >= currentMonthStart;
    } catch {
      return false;
    }
  });

  const lastMonthSales = sales.filter((sale: Sale) => {
    try {
      const saleDate = parseISO(sale.createdAt);
      return saleDate >= lastMonthStart && saleDate <= lastMonthEnd;
    } catch {
      return false;
    }
  });

  const currentMonthTotal = currentMonthSales.reduce(
    (acc: number, sale: Sale) => acc + parseFloat(sale.total),
    0
  );
  const lastMonthTotal = lastMonthSales.reduce(
    (acc: number, sale: Sale) => acc + parseFloat(sale.total),
    0
  );

  const totalPayables = payables
    .filter((p: Payable) => p.status === "Pendente")
    .reduce((acc: number, p: Payable) => acc + parseFloat(p.amount), 0);

  const totalReceivables = receivables
    .filter((r: Receivable) => r.status === "Pendente")
    .reduce((acc: number, r: Receivable) => acc + parseFloat(r.amount), 0);

  const netBalance = currentMonthTotal + totalReceivables - totalPayables;
  const marginPercent =
    currentMonthTotal > 0
      ? ((netBalance / currentMonthTotal) * 100).toFixed(0)
      : 0;

  const monthChange =
    lastMonthTotal > 0
      ? (((currentMonthTotal - lastMonthTotal) / lastMonthTotal) * 100).toFixed(
          0
        )
      : 0;

  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const date = subDays(now, 6 - i);
    const dayStr = format(date, "dd/MM");
    const daySales = sales.filter((sale: Sale) => {
      try {
        const saleDate = parseISO(sale.createdAt);
        return format(saleDate, "yyyy-MM-dd") === format(date, "yyyy-MM-dd");
      } catch {
        return false;
      }
    });
    const inTotal = daySales.reduce(
      (acc: number, sale: Sale) => acc + parseFloat(sale.total),
      0
    );
    const outTotal = inTotal * 0.4;
    return { name: dayStr, in: inTotal, out: outTotal };
  });

  const paymentMethodTotals = sales.reduce(
    (acc: Record<string, number>, sale: Sale) => {
      const method = sale.paymentMethod || "Outros";
      acc[method] = (acc[method] || 0) + parseFloat(sale.total);
      return acc;
    },
    {}
  );

  const expensesData = Object.entries(paymentMethodTotals).map(
    ([name, value]) => ({
      name,
      value: value as number,
    })
  );

  const handleDownloadReport = () => {
    const monthLabel = format(selectedMonth, "MMMM yyyy", { locale: ptBR });

    let content = `RELATÃƒâ€œRIO FINANCEIRO - ${monthLabel.toUpperCase()}\n`;
    content += "=".repeat(50) + "\n\n";

    content += "RESUMO\n";
    content += "-".repeat(30) + "\n";
    content += `Receitas do MÃƒÂªs: R$ ${currentMonthTotal.toFixed(2)}\n`;
    content += `Contas a Pagar Pendentes: R$ ${totalPayables.toFixed(2)}\n`;
    content += `Contas a Receber Pendentes: R$ ${totalReceivables.toFixed(
      2
    )}\n`;
    content += `Saldo Liquido: R$ ${netBalance.toFixed(2)}\n\n`;

    content += "CONTAS A PAGAR\n";
    content += "-".repeat(30) + "\n";
    filteredPayables.forEach((p: Payable) => {
      content += `${p.description} | ${p.category} | R$ ${parseFloat(
        p.amount
      ).toFixed(2)} | Venc: ${format(parseISO(p.dueDate), "dd/MM/yyyy")} | ${
        p.status
      }\n`;
    });
    content += "\n";

    content += "CONTAS A RECEBER\n";
    content += "-".repeat(30) + "\n";
    filteredReceivables.forEach((r: Receivable) => {
      content += `${r.description} | ${r.category} | R$ ${parseFloat(
        r.amount
      ).toFixed(2)} | Venc: ${format(parseISO(r.dueDate), "dd/MM/yyyy")} | ${
        r.status
      }\n`;
    });

    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `relatorio-financeiro-${format(
      selectedMonth,
      "yyyy-MM"
    )}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast({ title: "RelatÃƒÂ³rio baixado com sucesso" });
  };

  const handlePayableSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const selectedSupplier = suppliers.find(
      (s) => s.id.toString() === selectedSupplierId
    );
    createPayableMutation.mutate({
      description: formData.get("description") as string,
      category: formData.get("category") as string,
      amount: formData.get("amount") as string,
      dueDate: formData.get("dueDate") as string,
      supplierId: selectedSupplier ? selectedSupplier.id : undefined,
      supplierName: selectedSupplier ? selectedSupplier.name : undefined,
      notes: formData.get("notes") as string,
    });
  };

  const handleReceivableSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const selectedCustomer = customers.find(
      (c) => c.id.toString() === selectedCustomerId
    );
    createReceivableMutation.mutate({
      description: formData.get("description") as string,
      category: formData.get("category") as string,
      amount: formData.get("amount") as string,
      dueDate: formData.get("dueDate") as string,
      customerId: selectedCustomer ? selectedCustomer.id : undefined,
      customerName: selectedCustomer ? selectedCustomer.name : undefined,
      notes: formData.get("notes") as string,
    });
  };

  const isLoading = salesLoading || payablesLoading || receivablesLoading;

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
            <p className="text-muted-foreground">
              Carregando dados financeiros...
            </p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="flex flex-col gap-4">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-4xl font-heading font-bold tracking-tight text-foreground">
              Financeiro
            </h1>
            <p className="text-sm text-muted-foreground">Fluxo do caixa, contas a pagar e DRE.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" className="h-8 w-8 rounded-md" onClick={() => setSelectedMonth(subMonths(selectedMonth, 1))}>
              &lt;
            </Button>
            <Button variant="outline" className="h-8 min-w-[132px] rounded-md bg-white text-xs">
              <Calendar className="mr-1.5 h-3.5 w-3.5" />
              {format(selectedMonth, "MMMM yyyy", { locale: ptBR })}
            </Button>
            <Button variant="outline" size="icon" className="h-8 w-8 rounded-md" onClick={() => setSelectedMonth(addMonths(selectedMonth, 1))}>
              &gt;
            </Button>
            <Button variant="outline" className="h-8 rounded-md bg-[#2d4f86] text-white hover:bg-[#264577] hover:text-white" onClick={handleDownloadReport}><Download className="mr-1.5 h-3.5 w-3.5" /> Relatorios</Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card className="border-emerald-200 bg-emerald-50/60 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-medium text-emerald-700">
                Receitas (Mes)
              </CardTitle>
              <ArrowUpRight className="h-3.5 w-3.5 text-emerald-600" />
            </CardHeader>
            <CardContent>
              <div className="text-[30px] leading-none font-bold text-emerald-700">
                R${" "}
                {currentMonthTotal.toLocaleString("pt-BR", {
                  minimumFractionDigits: 2,
                })}
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                {Number(monthChange) >= 0 ? "+" : ""}
                {monthChange}% vs. mes anterior
              </p>
            </CardContent>
          </Card>

          <Card className="border-rose-200 bg-rose-50/60 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-medium text-rose-700">
                A Pagar (Pendente)
              </CardTitle>
              <ArrowDownRight className="h-3.5 w-3.5 text-rose-600" />
            </CardHeader>
            <CardContent>
              <div className="text-[30px] leading-none font-bold text-rose-700">
                R${" "}
                {totalPayables.toLocaleString("pt-BR", {
                  minimumFractionDigits: 2,
                })}
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                {
                  payables.filter((p: Payable) => p.status === "Pendente")
                    .length
                }{" "}
                contas pendentes
              </p>
            </CardContent>
          </Card>

          <Card className="border-slate-200 bg-slate-50/70 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-medium text-slate-700">
                Saldo Liquido
              </CardTitle>
              <DollarSign className="h-3.5 w-3.5 text-slate-600" />
            </CardHeader>
            <CardContent>
              <div className="text-[30px] leading-none font-bold text-slate-800">
                R${" "}
                {netBalance.toLocaleString("pt-BR", {
                  minimumFractionDigits: 2,
                })}
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                Margem: {marginPercent}%
              </p>
            </CardContent>
          </Card>
        </div>

        <Tabs
          value={activeTab}
          onValueChange={(value) =>
            setActiveTab(value as "cashflow" | "payables" | "receivables" | "dre")
          }
          className="space-y-4"
        >
          <TabsList className="h-9 rounded-lg bg-slate-100 p-1">
            <TabsTrigger value="cashflow">Fluxo de Caixa</TabsTrigger>
            <TabsTrigger value="payables">Contas a Pagar</TabsTrigger>
            <TabsTrigger value="receivables">Contas a Receber</TabsTrigger>
            <TabsTrigger value="dre">DRE Gerencial</TabsTrigger>
          </TabsList>

          <TabsContent value="cashflow" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-7">
              <Card className="col-span-4 border-slate-200 shadow-sm">
                <CardHeader>
                  <CardTitle>Fluxo Diario</CardTitle>
                  <CardDescription>
                    Entradas vs. Saidas nos ultimos 7 dias.
                  </CardDescription>
                </CardHeader>
                <CardContent className="pl-2">
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={last7Days}>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        vertical={false}
                        stroke="#eee"
                      />
                      <XAxis
                        dataKey="name"
                        stroke="#888888"
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        stroke="#888888"
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(value) =>
                          `R$${(value / 1000).toFixed(0)}k`
                        }
                      />
                      <Tooltip
                        formatter={(value: number) => [
                          `R$ ${value.toFixed(2)}`,
                          "",
                        ]}
                      />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="in"
                        name="Entradas"
                        stroke="#10b981"
                        strokeWidth={2}
                        dot={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="out"
                        name="SaÃƒÂ­das"
                        stroke="#ef4444"
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card className="col-span-3 border-slate-200 shadow-sm">
                <CardHeader>
                  <CardTitle>Vendas por Metodo</CardTitle>
                  <CardDescription>
                    Distribuicao por forma de pagamento.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {expensesData.length === 0 ? (
                    <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                      Nenhuma venda registrada
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={expensesData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          fill="#8884d8"
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {expensesData.map((entry, index) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={COLORS[index % COLORS.length]}
                            />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(value: number) => [
                            `R$ ${value.toFixed(2)}`,
                            "",
                          ]}
                        />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="payables">
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle>Contas a Pagar</CardTitle>
                    <CardDescription>
                      {format(selectedMonth, "MMMM yyyy", { locale: ptBR })} -{" "}
                      {filteredPayables.length} conta(s)
                    </CardDescription>
                  </div>
                  <Dialog
                    open={payableDialogOpen}
                    onOpenChange={setPayableDialogOpen}
                  >
                    <DialogTrigger asChild>
                      <Button>
                        <Plus className="h-4 w-4 mr-2" /> Nova Conta
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Nova Conta a Pagar</DialogTitle>
                        <DialogDescription>
                          Cadastre uma nova conta a pagar
                        </DialogDescription>
                      </DialogHeader>
                      <form onSubmit={handlePayableSubmit}>
                        <div className="grid gap-4 py-4">
                          <div className="grid gap-2">
                            <Label htmlFor="description">DescriÃƒÂ§ÃƒÂ£o *</Label>
                            <Input
                              id="description"
                              name="description"
                              required
                            />
                          </div>
                          <div className="grid gap-2">
                            <Label htmlFor="category">Categoria *</Label>
                            <Select
                              name="category"
                              required
                              defaultValue="Outros"
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione..." />
                              </SelectTrigger>
                              <SelectContent>
                                {PAYABLE_CATEGORIES.map((cat) => (
                                  <SelectItem key={cat} value={cat}>
                                    {cat}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="grid gap-2">
                            <Label htmlFor="amount">Valor *</Label>
                            <Input
                              id="amount"
                              name="amount"
                              type="number"
                              step="0.01"
                              required
                            />
                          </div>
                          <div className="grid gap-2">
                            <Label htmlFor="dueDate">
                              Data de Vencimento *
                            </Label>
                            <Input
                              id="dueDate"
                              name="dueDate"
                              type="date"
                              required
                            />
                          </div>
                          <div className="grid gap-2">
                            <Label htmlFor="supplierId">Fornecedor</Label>
                            <Select
                              value={selectedSupplierId}
                              onValueChange={setSelectedSupplierId}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione um fornecedor..." />
                              </SelectTrigger>
                              <SelectContent>
                                {suppliers.map((supplier) => (
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
                          <div className="grid gap-2">
                            <Label htmlFor="notes">ObservaÃƒÂ§ÃƒÂµes</Label>
                            <Input id="notes" name="notes" />
                          </div>
                        </div>
                        <DialogFooter>
                          <Button
                            type="submit"
                            disabled={createPayableMutation.isPending}
                          >
                            {createPayableMutation.isPending && (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            )}
                            Salvar
                          </Button>
                        </DialogFooter>
                      </form>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent>
                {filteredPayables.length === 0 ? (
                  <div className="text-center text-muted-foreground py-8">
                    <DollarSign className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Nenhuma conta a pagar para este mÃƒÂªs</p>
                    <p className="text-sm mt-2">
                      Clique em "Nova Conta" para adicionar
                    </p>
                  </div>
                ) : (
                  <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>DescriÃƒÂ§ÃƒÂ£o</TableHead>
                        <TableHead>Categoria</TableHead>
                        <TableHead>Fornecedor</TableHead>
                        <TableHead>Vencimento</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">AÃƒÂ§ÃƒÂµes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {payablesPagination.paginatedItems.map((payable: Payable) => (
                        <TableRow key={payable.id}>
                          <TableCell className="font-medium">
                            {payable.description}
                          </TableCell>
                          <TableCell>{payable.category}</TableCell>
                          <TableCell>{payable.supplierName || "-"}</TableCell>
                          <TableCell>
                            {format(parseISO(payable.dueDate), "dd/MM/yyyy")}
                          </TableCell>
                          <TableCell className="text-right">
                            R$ {parseFloat(payable.amount).toFixed(2)}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                payable.status === "Pago"
                                  ? "default"
                                  : "secondary"
                              }
                            >
                              {payable.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              {payable.status !== "Pago" && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() =>
                                    markPayablePaidMutation.mutate(payable.id)
                                  }
                                  disabled={markPayablePaidMutation.isPending}
                                >
                                  <Check className="h-4 w-4" />
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() =>
                                  deletePayableMutation.mutate(payable.id)
                                }
                                disabled={deletePayableMutation.isPending}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <TablePaginationControls
                    page={payablesPagination.page}
                    pageSize={payablesPagination.pageSize}
                    totalItems={payablesPagination.totalItems}
                    totalPages={payablesPagination.totalPages}
                    startItem={payablesPagination.startItem}
                    endItem={payablesPagination.endItem}
                    onPageChange={payablesPagination.setPage}
                    onPageSizeChange={payablesPagination.setPageSize}
                  />
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="receivables">
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle>Contas a Receber</CardTitle>
                    <CardDescription>
                      {format(selectedMonth, "MMMM yyyy", { locale: ptBR })} -{" "}
                      {filteredReceivables.length} conta(s)
                    </CardDescription>
                  </div>
                  <Dialog
                    open={receivableDialogOpen}
                    onOpenChange={setReceivableDialogOpen}
                  >
                    <DialogTrigger asChild>
                      <Button>
                        <Plus className="h-4 w-4 mr-2" /> Nova Conta
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Nova Conta a Receber</DialogTitle>
                        <DialogDescription>
                          Cadastre uma nova conta a receber
                        </DialogDescription>
                      </DialogHeader>
                      <form onSubmit={handleReceivableSubmit}>
                        <div className="grid gap-4 py-4">
                          <div className="grid gap-2">
                            <Label htmlFor="description">DescriÃƒÂ§ÃƒÂ£o *</Label>
                            <Input
                              id="description"
                              name="description"
                              required
                            />
                          </div>
                          <div className="grid gap-2">
                            <Label htmlFor="category">Categoria *</Label>
                            <Select
                              name="category"
                              required
                              defaultValue="Vendas"
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione..." />
                              </SelectTrigger>
                              <SelectContent>
                                {RECEIVABLE_CATEGORIES.map((cat) => (
                                  <SelectItem key={cat} value={cat}>
                                    {cat}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="grid gap-2">
                            <Label htmlFor="amount">Valor *</Label>
                            <Input
                              id="amount"
                              name="amount"
                              type="number"
                              step="0.01"
                              required
                            />
                          </div>
                          <div className="grid gap-2">
                            <Label htmlFor="dueDate">
                              Data de Vencimento *
                            </Label>
                            <Input
                              id="dueDate"
                              name="dueDate"
                              type="date"
                              required
                            />
                          </div>
                          <div className="grid gap-2">
                            <Label htmlFor="customerId">Cliente</Label>
                            <Select
                              value={selectedCustomerId}
                              onValueChange={setSelectedCustomerId}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione um cliente..." />
                              </SelectTrigger>
                              <SelectContent>
                                {customers.map((customer) => (
                                  <SelectItem
                                    key={customer.id}
                                    value={customer.id.toString()}
                                  >
                                    {customer.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="grid gap-2">
                            <Label htmlFor="notes">ObservaÃƒÂ§ÃƒÂµes</Label>
                            <Input id="notes" name="notes" />
                          </div>
                        </div>
                        <DialogFooter>
                          <Button
                            type="submit"
                            disabled={createReceivableMutation.isPending}
                          >
                            {createReceivableMutation.isPending && (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            )}
                            Salvar
                          </Button>
                        </DialogFooter>
                      </form>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent>
                {filteredReceivables.length === 0 ? (
                  <div className="text-center text-muted-foreground py-8">
                    <DollarSign className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Nenhuma conta a receber para este mÃƒÂªs</p>
                    <p className="text-sm mt-2">
                      Clique em "Nova Conta" para adicionar
                    </p>
                  </div>
                ) : (
                  <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>DescriÃƒÂ§ÃƒÂ£o</TableHead>
                        <TableHead>Categoria</TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Vencimento</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">AÃƒÂ§ÃƒÂµes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {receivablesPagination.paginatedItems.map((receivable: Receivable) => (
                        <TableRow key={receivable.id}>
                          <TableCell className="font-medium">
                            {receivable.description}
                          </TableCell>
                          <TableCell>{receivable.category}</TableCell>
                          <TableCell>
                            {receivable.customerName || "-"}
                          </TableCell>
                          <TableCell>
                            {format(parseISO(receivable.dueDate), "dd/MM/yyyy")}
                          </TableCell>
                          <TableCell className="text-right">
                            R$ {parseFloat(receivable.amount).toFixed(2)}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                receivable.status === "Recebido"
                                  ? "default"
                                  : "secondary"
                              }
                            >
                              {receivable.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              {receivable.status !== "Recebido" && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() =>
                                    markReceivableReceivedMutation.mutate(
                                      receivable.id
                                    )
                                  }
                                  disabled={
                                    markReceivableReceivedMutation.isPending
                                  }
                                >
                                  <Check className="h-4 w-4" />
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() =>
                                  deleteReceivableMutation.mutate(receivable.id)
                                }
                                disabled={deleteReceivableMutation.isPending}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <TablePaginationControls
                    page={receivablesPagination.page}
                    pageSize={receivablesPagination.pageSize}
                    totalItems={receivablesPagination.totalItems}
                    totalPages={receivablesPagination.totalPages}
                    startItem={receivablesPagination.startItem}
                    endItem={receivablesPagination.endItem}
                    onPageChange={receivablesPagination.setPage}
                    onPageSizeChange={receivablesPagination.setPageSize}
                  />
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="dre">
            <Card>
              <CardHeader>
                <CardTitle>DRE Gerencial</CardTitle>
                <CardDescription>
                  Demonstrativo de Resultado do ExercÃƒÂ­cio
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center border-b pb-2">
                    <span className="font-medium">Receita Bruta (Vendas)</span>
                    <span className="font-bold text-emerald-600">
                      R${" "}
                      {currentMonthTotal.toLocaleString("pt-BR", {
                        minimumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                  <div className="flex justify-between items-center border-b pb-2">
                    <span className="font-medium">
                      Contas a Receber (Pendentes)
                    </span>
                    <span className="font-bold text-emerald-600">
                      R${" "}
                      {totalReceivables.toLocaleString("pt-BR", {
                        minimumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                  <div className="flex justify-between items-center border-b pb-2">
                    <span className="text-muted-foreground">
                      (-) Contas a Pagar (Pendentes)
                    </span>
                    <span className="text-rose-600">
                      R${" "}
                      {totalPayables.toLocaleString("pt-BR", {
                        minimumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                  <div className="flex justify-between items-center pt-2">
                    <span className="font-bold text-lg">Resultado LÃƒÂ­quido</span>
                    <span
                      className={`font-bold text-lg ${
                        netBalance >= 0 ? "text-emerald-600" : "text-rose-600"
                      }`}
                    >
                      R${" "}
                      {netBalance.toLocaleString("pt-BR", {
                        minimumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
