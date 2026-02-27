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
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { format, isToday, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useState } from "react";

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

type CriticalRange = "geral" | "semanal" | "mensal";

export default function Dashboard() {
  const weekBarColors = [
    "#3B82F6",
    "#14B8A6",
    "#22C55E",
    "#F59E0B",
    "#EF4444",
    "#8B5CF6",
    "#0EA5E9",
  ];
  const chartAxisColor = "#6B7280";
  const chartGridColor = "#E5E7EB";
  const areaStrokeColor = "#0F1E2E";
  const areaGradientStart = "#3B82F6";
  const [criticalRange, setCriticalRange] = useState<CriticalRange>("geral");

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

  const rangeFactorByFilter: Record<CriticalRange, number> = {
    geral: 1,
    semanal: 1.15,
    mensal: 1.3,
  };
  const selectedFactor = rangeFactorByFilter[criticalRange];

  const criticalCount = products.filter((p: Product) => {
    const min = (p.minStock || 10) * selectedFactor;
    return p.stock <= min;
  }).length;
  const inStockCount = products.filter((p: Product) => {
    const min = (p.minStock || 10) * selectedFactor;
    return p.stock > min && p.stock <= min * 2;
  }).length;
  const aboveCount = products.filter((p: Product) => {
    const min = (p.minStock || 10) * selectedFactor;
    return p.stock > min * 2;
  }).length;

  const donutTotal = Math.max(1, criticalCount + inStockCount + aboveCount);
  const criticalPct = (criticalCount / donutTotal) * 100;
  const donutData = [
    { name: "Abaixo do min.", value: criticalCount, color: "#ff4c4c" },
    { name: "Em Estoque", value: inStockCount, color: "#ffb020" },
    { name: "Acima do mín.", value: aboveCount, color: "#2f8fff" },
  ];
  const heatmapRows = 6;
  const heatmapCols = 14;
  const heatmapValue = (row: number, col: number) => {
    const intensity =
      Math.max(0, 1 - Math.abs(col - 8) / 8) * (row + 1) * 0.2;
    return Math.max(0, Math.round(Math.min(0.55, intensity) * 100));
  };
  const hourlyTotals: number[] = Array.from({ length: heatmapCols }, (_, col) => {
    let totalForCol = 0;
    for (let row = 0; row < heatmapRows; row += 1) {
      totalForCol += heatmapValue(row, col);
    }
    return totalForCol;
  });
  const peakCol = hourlyTotals.indexOf(Math.max(...hourlyTotals));
  const peakStartHour = (peakCol * 2).toString().padStart(2, "0");
  const peakEndHour = (peakCol * 2 + 2).toString().padStart(2, "0");
  const heatmapTotal: number = hourlyTotals.reduce(
    (acc: number, v: number) => acc + v,
    0
  );
  const heatmapAverage = Math.round(heatmapTotal / heatmapCols);

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
      <div className="rounded-md border border-[#d8dbe3] bg-[#f5f6fa] p-6">
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
              className="h-11 border-[#bfc4d1] bg-[#f7f7f9] px-6 text-[#101217] hover:bg-[#eef1f7]"
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
              <Button className="h-11 bg-[#1f2736] px-6 text-white hover:bg-[#161d2b]">
                <ShoppingCart className="mr-2 h-4 w-4" />
                Novo Pedido
              </Button>
            </Link>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="rounded-2xl border-[#d5d9e3] bg-[#f8f9fc] shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 px-5 pb-1 pt-4">
              <div className="-ml-0.5 flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#40a9ff] text-white">
                  <ShoppingCart className="h-4 w-4" />
                </span>
                <CardTitle className="text-[15px] font-semibold leading-tight">Vendas Totais</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="px-5 pt-4">
              <div className="text-2xl font-bold">
                R${" "}
                {todayTotal.toLocaleString("pt-BR", {
                  minimumFractionDigits: 2,
                })}
              </div>
              <p className="text-xs text-muted-foreground flex items-center mt-1">
                <span className="text-emerald-500 flex items-center font-medium">
                  {todaySales.length} vendas 
                </span>{"  "}
                 realizadas hoje
              </p>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-[#d5d9e3] bg-[#f8f9fc] shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 px-5 pb-1 pt-4">
              <div className="-ml-0.5 flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#4f6cff] text-white">
                  <Users className="h-4 w-4" />
                </span>
                <CardTitle className="text-[15px] font-semibold leading-tight">Ticket Médio</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="px-5 pt-4">
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

          <Card className="rounded-2xl border-[#d5d9e3] bg-[#f8f9fc] shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 px-5 pb-1 pt-4">
              <div className="-ml-0.5 flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#ffa51a] text-white">
                  <Package className="h-4 w-4" />
                </span>
                <CardTitle className="text-[15px] font-semibold leading-tight">Produtos Criticos</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="px-5 pt-4">
              <div className="text-2xl font-bold">
                {criticalCount}
              </div>
              <p className="text-xs text-muted-foreground flex items-center mt-1">
                {criticalCount > 0 ? (
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

          <Card className="rounded-2xl border-[#d5d9e3] bg-[#f8f9fc] shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 px-5 pb-1 pt-4">
              <div className="-ml-0.5 flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#1ac293] text-white">
                  <TrendingUp className="h-4 w-4" />
                </span>
                <CardTitle className="text-[15px] font-semibold leading-tight">Lucro Estimado</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="px-5 pt-4">
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
          <Card className="col-span-4 rounded-2xl border-[#d5d9e3] bg-[#f8f9fc] shadow-sm">
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
                    stroke={chartAxisColor}
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    stroke={chartAxisColor}
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
                    radius={[4, 4, 0, 0]}
                  >
                    {salesByDay.map((_, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={weekBarColors[index % weekBarColors.length]}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="col-span-3 rounded-2xl border-[#d5d9e3] bg-[#f8f9fc] shadow-sm">
            <CardHeader>
              <CardTitle>Movimento por Hora</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2.5">
                {Array.from({ length: heatmapRows }).map((_, row) => (
                  <div key={row} className="flex gap-1">
                    {Array.from({ length: heatmapCols }).map((__, col) => {
                      const value = heatmapValue(row, col);
                      return (
                        <span
                          key={`${row}-${col}`}
                          className="h-8 flex-1 rounded-sm"
                          style={{ backgroundColor: `rgba(58,136,255,${(value / 100).toFixed(2)})` }}
                          title={`${(col * 2).toString().padStart(2, "0")}h - ${(col * 2 + 2).toString().padStart(2, "0")}h: ${value} pontos`}
                        />
                      );
                    })}
                  </div>
                ))}
              </div>
              <div className="mt-6 flex justify-between text-xs text-muted-foreground">
                <span>00h</span><span>06h</span><span>12h</span><span>18h</span><span>24h</span>
              </div>
              <div className="mt-5 grid grid-cols-3 gap-3 border-t border-[#dce1ea] pt-4">
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Hora de pico</p>
                  <p className="text-sm font-semibold text-[#1e2431]">{peakStartHour}h-{peakEndHour}h</p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Média</p>
                  <p className="text-sm font-semibold text-[#1e2431]">{heatmapAverage} pts/h</p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Total</p>
                  <p className="text-sm font-semibold text-[#1e2431]">{heatmapTotal} pts</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4">
          <Card className="rounded-2xl border-[#d5d9e3] bg-[#f8f9fc] shadow-sm">
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>Produtos Criticos</CardTitle>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className={`h-9 border-[#c9ced8] bg-[#f4f6fa] text-sm ${criticalRange === "geral" ? "bg-[#e8edf8] text-[#1f2a44]" : ""}`}
                  onClick={() => setCriticalRange("geral")}
                >
                  Geral
                </Button>
                <Button
                  variant="outline"
                  className={`h-9 border-[#c9ced8] bg-[#f4f6fa] text-sm ${criticalRange === "semanal" ? "bg-[#e8edf8] text-[#1f2a44]" : ""}`}
                  onClick={() => setCriticalRange("semanal")}
                >
                  Semanal
                </Button>
                <Button
                  variant="outline"
                  className={`h-9 border-[#c9ced8] bg-[#f4f6fa] text-sm ${criticalRange === "mensal" ? "bg-[#e8edf8] text-[#1f2a44]" : ""}`}
                  onClick={() => setCriticalRange("mensal")}
                >
                  Mensal
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-6">
                <div className="space-y-3 text-[18px] leading-tight">
                  <p className="text-[#3c4454]"><span className="mr-2 inline-block h-3 w-3 rounded-full bg-[#ff4c4c]" />Abaixo do min. <b>{criticalCount}</b></p>
                  <p className="text-[#3c4454]"><span className="mr-2 inline-block h-3 w-3 rounded-full bg-[#ffb020]" />Em Estoque. <b>{inStockCount}</b></p>
                  <p className="text-[#3c4454]"><span className="mr-2 inline-block h-3 w-3 rounded-full bg-[#2f8fff]" />Acima do min. <b>{aboveCount}</b></p>
                </div>
                <div className="mx-auto h-48 w-48 justify-self-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={donutData}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={54}
                        outerRadius={92}
                        stroke="#f8f9fc"
                        strokeWidth={2}
                      >
                        {donutData.map((entry, index) => (
                          <Cell key={`donut-bottom-cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number, name: string) => [`${value} itens`, name]} />
                      <text x="50%" y="50%" dy="-8" textAnchor="middle" dominantBaseline="central" className="fill-[#1d2330] text-5xl font-bold">
                        {criticalCount}
                      </text>
                      <text x="50%" y="50%" dy="20" textAnchor="middle" dominantBaseline="central" className="fill-[#6b7280] text-xs">
                        {Math.round(criticalPct)}%
                      </text>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      </div>
    </Layout>
  );
}
