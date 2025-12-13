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
  Users,
  Package,
  AlertCircle,
  TrendingUp,
  ShoppingCart,
  Loader2,
} from "lucide-react";
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Area,
  AreaChart,
} from "recharts";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { format, subDays, isToday, parseISO, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Sale {
  id: number;
  customerName: string;
  total: string;
  itemsCount: number;
  paymentMethod: string;
  status: string;
  createdAt: string;
}

interface Product {
  id: number;
  name: string;
  stock: number;
  minStock: number;
  price: string;
  category: string;
}

export default function Dashboard() {
  const { data: sales = [], isLoading: salesLoading } = useQuery({
    queryKey: ["/api/sales"],
    queryFn: async () => {
      const res = await fetch("/api/sales");
      if (!res.ok) throw new Error("Failed to fetch sales");
      return res.json();
    },
  });

  const { data: products = [], isLoading: productsLoading } = useQuery({
    queryKey: ["/api/products"],
    queryFn: async () => {
      const res = await fetch("/api/products");
      if (!res.ok) throw new Error("Failed to fetch products");
      return res.json();
    },
  });

  const isLoading = salesLoading || productsLoading;

  const todaySales = sales.filter((sale: Sale) => {
    try {
      return isToday(parseISO(sale.createdAt));
    } catch {
      return false;
    }
  });

  const todayTotal = todaySales.reduce(
    (acc: number, sale: Sale) => acc + parseFloat(sale.total),
    0
  );
  const todayItemsCount = todaySales.reduce(
    (acc: number, sale: Sale) => acc + sale.itemsCount,
    0
  );
  const avgTicket = todaySales.length > 0 ? todayTotal / todaySales.length : 0;

  const lowStockProducts = products.filter((product: Product) => {
    const minStock = product.minStock || 10;
    return product.stock <= minStock;
  });

  const estimatedProfit = todayTotal * 0.32;

  const weekDays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"];
  const salesByDay = weekDays.map((dayName, index) => {
    const daySales = sales.filter((sale: Sale) => {
      try {
        const saleDate = parseISO(sale.createdAt);
        return saleDate.getDay() === index;
      } catch {
        return false;
      }
    });
    const total = daySales.reduce(
      (acc: number, sale: Sale) => acc + parseFloat(sale.total),
      0
    );
    return { name: dayName, total };
  });

  const hourlyData = Array.from({ length: 12 }, (_, i) => {
    const hour = 8 + i;
    const hourSales = todaySales.filter((sale: Sale) => {
      try {
        const saleDate = parseISO(sale.createdAt);
        return saleDate.getHours() === hour;
      } catch {
        return false;
      }
    });
    const total = hourSales.reduce(
      (acc: number, sale: Sale) => acc + parseFloat(sale.total),
      0
    );
    return { time: `${hour.toString().padStart(2, "0")}:00`, sales: total };
  });

  const recentSales = [...sales]
    .sort(
      (a: Sale, b: Sale) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
    .slice(0, 4);

  const formatSaleTime = (dateString: string) => {
    try {
      return format(parseISO(dateString), "HH:mm", { locale: ptBR });
    } catch {
      return "-";
    }
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
            <p className="text-muted-foreground">Carregando dados...</p>
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
              Dashboard
            </h1>
            <p className="text-muted-foreground">
              Visão geral da sua loja hoje,{" "}
              {format(new Date(), "d 'de' MMMM", { locale: ptBR })}.
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              data-testid="button-export"
              onClick={() => {
                const csvContent = [
                  [
                    "ID",
                    "Cliente",
                    "Total",
                    "Itens",
                    "Pagamento",
                    "Status",
                    "Data",
                  ].join(","),
                  ...sales.map((sale: Sale) =>
                    [
                      sale.id,
                      sale.customerName,
                      sale.total,
                      sale.itemsCount,
                      sale.paymentMethod,
                      sale.status,
                      sale.createdAt,
                    ].join(",")
                  ),
                ].join("\n");

                const blob = new Blob([csvContent], {
                  type: "text/csv;charset=utf-8;",
                });
                const url = URL.createObjectURL(blob);
                const link = document.createElement("a");
                link.href = url;
                link.download = `vendas_${format(
                  new Date(),
                  "yyyy-MM-dd"
                )}.csv`;
                link.click();
                URL.revokeObjectURL(url);
              }}
            >
              Exportar
            </Button>
            <Link href="/pos">
              <Button>
                <ShoppingCart className="mr-2 h-4 w-4" />
                Novo Pedido
              </Button>
            </Link>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Vendas Totais (Hoje)
              </CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                R${" "}
                {todayTotal.toLocaleString("pt-BR", {
                  minimumFractionDigits: 2,
                })}
              </div>
              <p className="text-xs text-muted-foreground flex items-center mt-1">
                <span className="text-emerald-500 flex items-center font-medium">
                  {todaySales.length} vendas
                </span>{" "}
                realizadas hoje
              </p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Ticket Médio
              </CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                R${" "}
                {avgTicket.toLocaleString("pt-BR", {
                  minimumFractionDigits: 2,
                })}
              </div>
              <p className="text-xs text-muted-foreground flex items-center mt-1">
                {todayItemsCount} itens vendidos hoje
              </p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Produtos Críticos
              </CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {lowStockProducts.length}
              </div>
              <p className="text-xs text-muted-foreground flex items-center mt-1">
                {lowStockProducts.length > 0 ? (
                  <span className="text-destructive flex items-center font-medium">
                    <AlertCircle className="mr-1 h-3 w-3" />
                    Abaixo do min.
                  </span>
                ) : (
                  <span className="text-emerald-500">Estoque OK</span>
                )}
              </p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Lucro Estimado
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                R${" "}
                {estimatedProfit.toLocaleString("pt-BR", {
                  minimumFractionDigits: 2,
                })}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Margem média de 32%
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
          <Card className="col-span-4">
            <CardHeader>
              <CardTitle>Vendas da Semana</CardTitle>
              <CardDescription>
                Comparativo de faturamento por dia da semana.
              </CardDescription>
            </CardHeader>
            <CardContent className="pl-2">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={salesByDay}>
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
                    tickFormatter={(value) => `R$${value}`}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: "8px",
                      border: "none",
                      boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                    }}
                    cursor={{ fill: "transparent" }}
                    formatter={(value: number) => [
                      `R$ ${value.toFixed(2)}`,
                      "Total",
                    ]}
                  />
                  <Bar
                    dataKey="total"
                    fill="hsl(var(--primary))"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="col-span-3">
            <CardHeader>
              <CardTitle>Movimento por Hora</CardTitle>
              <CardDescription>
                Fluxo de vendas ao longo do dia (hoje).
              </CardDescription>
            </CardHeader>
            <CardContent className="pl-2">
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={hourlyData}>
                  <defs>
                    <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                      <stop
                        offset="5%"
                        stopColor="hsl(var(--primary))"
                        stopOpacity={0.3}
                      />
                      <stop
                        offset="95%"
                        stopColor="hsl(var(--primary))"
                        stopOpacity={0}
                      />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="#eee"
                  />
                  <XAxis
                    dataKey="time"
                    stroke="#888888"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: "8px",
                      border: "none",
                      boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                    }}
                    formatter={(value: number) => [
                      `R$ ${value.toFixed(2)}`,
                      "Vendas",
                    ]}
                  />
                  <Area
                    type="monotone"
                    dataKey="sales"
                    stroke="hsl(var(--primary))"
                    fillOpacity={1}
                    fill="url(#colorSales)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Últimas Vendas</CardTitle>
              <CardDescription>Transações recentes no PDV.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentSales.length === 0 ? (
                  <div className="text-center text-muted-foreground py-8">
                    <ShoppingCart className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>Nenhuma venda registrada</p>
                  </div>
                ) : (
                  recentSales.map((sale: Sale) => (
                    <div
                      key={sale.id}
                      className="flex items-center justify-between border-b border-border pb-2 last:border-0 last:pb-0"
                    >
                      <div>
                        <p className="font-medium text-sm">Venda #{sale.id}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatSaleTime(sale.createdAt)} • {sale.itemsCount}{" "}
                          itens
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-sm">
                          R$ {parseFloat(sale.total).toFixed(2)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {sale.paymentMethod}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Alertas de Estoque</CardTitle>
              <CardDescription>
                Produtos precisando de reposição.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {lowStockProducts.length === 0 ? (
                  <div className="text-center text-muted-foreground py-8">
                    <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>Todos os produtos estão com estoque adequado</p>
                  </div>
                ) : (
                  lowStockProducts.slice(0, 4).map((item: Product) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-destructive/10 flex items-center justify-center text-destructive">
                          <AlertCircle className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="font-medium text-sm">{item.name}</p>
                          <p className="text-xs text-muted-foreground">
                            Categoria: {item.category}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-sm text-destructive">
                          {item.stock} un
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Mínimo: {item.minStock || 10}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
