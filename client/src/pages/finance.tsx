import Layout from "@/components/layout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ArrowUpRight,
  ArrowDownRight,
  DollarSign,
  Calendar,
  Download,
  Filter,
  Loader2,
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
import { useQuery } from "@tanstack/react-query";
import {
  format,
  subDays,
  parseISO,
  startOfMonth,
  endOfMonth,
  subMonths,
} from "date-fns";
import { ptBR } from "date-fns/locale";

interface Sale {
  id: number;
  total: string;
  createdAt: string;
  paymentMethod: string;
}

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884d8"];

export default function Finance() {
  const { data: sales = [], isLoading } = useQuery({
    queryKey: ["/api/sales"],
    queryFn: async () => {
      const res = await fetch("/api/sales");
      if (!res.ok) throw new Error("Failed to fetch sales");
      return res.json();
    },
  });

  const now = new Date();
  const currentMonthStart = startOfMonth(now);
  const lastMonthStart = startOfMonth(subMonths(now, 1));
  const lastMonthEnd = endOfMonth(subMonths(now, 1));

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

  const estimatedExpenses = currentMonthTotal * 0.63;
  const netBalance = currentMonthTotal - estimatedExpenses;
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
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-heading font-bold tracking-tight text-foreground">
              Financeiro
            </h1>
            <p className="text-muted-foreground">
              Fluxo de caixa, contas a pagar e DRE.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline">
              <Calendar className="mr-2 h-4 w-4" />{" "}
              {format(now, "MMMM yyyy", { locale: ptBR })}
            </Button>
            <Button variant="outline">
              <Download className="mr-2 h-4 w-4" /> Relatórios
            </Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card className="bg-emerald-500/10 border-emerald-500/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
                Receitas (Mês)
              </CardTitle>
              <ArrowUpRight className="h-4 w-4 text-emerald-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">
                R${" "}
                {currentMonthTotal.toLocaleString("pt-BR", {
                  minimumFractionDigits: 2,
                })}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {Number(monthChange) >= 0 ? "+" : ""}
                {monthChange}% vs. mês anterior
              </p>
            </CardContent>
          </Card>

          <Card className="bg-rose-500/10 border-rose-500/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-rose-700 dark:text-rose-400">
                Despesas Est. (Mês)
              </CardTitle>
              <ArrowDownRight className="h-4 w-4 text-rose-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-rose-700 dark:text-rose-400">
                R${" "}
                {estimatedExpenses.toLocaleString("pt-BR", {
                  minimumFractionDigits: 2,
                })}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                ~63% das receitas (estimativa)
              </p>
            </CardContent>
          </Card>

          <Card className="bg-primary/10 border-primary/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-primary">
                Saldo Líquido
              </CardTitle>
              <DollarSign className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">
                R${" "}
                {netBalance.toLocaleString("pt-BR", {
                  minimumFractionDigits: 2,
                })}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Margem: {marginPercent}%
              </p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="cashflow" className="space-y-4">
          <TabsList>
            <TabsTrigger value="cashflow">Fluxo de Caixa</TabsTrigger>
            <TabsTrigger value="payables">Contas a Pagar</TabsTrigger>
            <TabsTrigger value="receivables">Contas a Receber</TabsTrigger>
            <TabsTrigger value="dre">DRE Gerencial</TabsTrigger>
          </TabsList>

          <TabsContent value="cashflow" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-7">
              <Card className="col-span-4">
                <CardHeader>
                  <CardTitle>Fluxo Diário</CardTitle>
                  <CardDescription>
                    Entradas vs. Saídas nos últimos 7 dias.
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
                        name="Saídas"
                        stroke="#ef4444"
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card className="col-span-3">
                <CardHeader>
                  <CardTitle>Vendas por Método</CardTitle>
                  <CardDescription>
                    Distribuição por forma de pagamento.
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
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Contas a Pagar</CardTitle>
                    <CardDescription>Vencimentos próximos.</CardDescription>
                  </div>
                  <Button variant="outline">
                    <Filter className="h-4 w-4 mr-2" /> Filtrar
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-center text-muted-foreground py-8">
                  <DollarSign className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhuma conta a pagar cadastrada</p>
                  <p className="text-sm mt-2">
                    As contas a pagar aparecerão aqui quando forem registradas
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="receivables">
            <Card>
              <CardHeader>
                <CardTitle>Contas a Receber</CardTitle>
                <CardDescription>
                  Valores pendentes de recebimento.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center text-muted-foreground py-8">
                  <DollarSign className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhuma conta a receber pendente</p>
                  <p className="text-sm mt-2">Vendas a prazo aparecerão aqui</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="dre">
            <Card>
              <CardHeader>
                <CardTitle>DRE Gerencial</CardTitle>
                <CardDescription>
                  Demonstrativo de Resultado do Exercício
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center border-b pb-2">
                    <span className="font-medium">Receita Bruta</span>
                    <span className="font-bold text-emerald-600">
                      R${" "}
                      {currentMonthTotal.toLocaleString("pt-BR", {
                        minimumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                  <div className="flex justify-between items-center border-b pb-2">
                    <span className="text-muted-foreground">
                      (-) Custos Estimados (63%)
                    </span>
                    <span className="text-rose-600">
                      R${" "}
                      {estimatedExpenses.toLocaleString("pt-BR", {
                        minimumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                  <div className="flex justify-between items-center pt-2">
                    <span className="font-bold text-lg">Resultado Líquido</span>
                    <span className="font-bold text-lg text-primary">
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
