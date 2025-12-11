import Layout from "@/components/layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  ArrowUpRight, 
  ArrowDownRight, 
  DollarSign, 
  Users, 
  Package, 
  AlertCircle,
  TrendingUp,
  ShoppingCart
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
  AreaChart
} from "recharts";

const salesData = [
  { name: "Seg", total: 4500 },
  { name: "Ter", total: 3800 },
  { name: "Qua", total: 6200 },
  { name: "Qui", total: 5100 },
  { name: "Sex", total: 8400 },
  { name: "Sab", total: 9800 },
  { name: "Dom", total: 7200 },
];

const hourlyData = [
  { time: "08:00", sales: 120 },
  { time: "10:00", sales: 450 },
  { time: "12:00", sales: 980 },
  { time: "14:00", sales: 600 },
  { time: "16:00", sales: 850 },
  { time: "18:00", sales: 1200 },
  { time: "20:00", sales: 750 },
];

export default function Dashboard() {
  return (
    <Layout>
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-heading font-bold tracking-tight text-foreground">Dashboard</h1>
            <p className="text-muted-foreground">Visão geral da sua loja hoje, 11 de Dezembro.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline">Exportar</Button>
            <Button>
              <ShoppingCart className="mr-2 h-4 w-4" />
              Novo Pedido
            </Button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Vendas Totais (Hoje)</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">R$ 12.450,90</div>
              <p className="text-xs text-muted-foreground flex items-center mt-1">
                <span className="text-emerald-500 flex items-center font-medium">
                  <ArrowUpRight className="mr-1 h-3 w-3" />
                  +15%
                </span>
                vs. ontem
              </p>
            </CardContent>
          </Card>
          
          <Card className="hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Ticket Médio</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">R$ 84,32</div>
              <p className="text-xs text-muted-foreground flex items-center mt-1">
                <span className="text-emerald-500 flex items-center font-medium">
                  <ArrowUpRight className="mr-1 h-3 w-3" />
                  +2.1%
                </span>
                vs. média mensal
              </p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Produtos Críticos</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">12</div>
              <p className="text-xs text-muted-foreground flex items-center mt-1">
                <span className="text-destructive flex items-center font-medium">
                  <AlertCircle className="mr-1 h-3 w-3" />
                  Abaixo do min.
                </span>
                Requer atenção
              </p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Lucro Estimado</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">R$ 3.840,00</div>
              <p className="text-xs text-muted-foreground mt-1">
                Margem média de 32%
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Charts Section */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
          <Card className="col-span-4">
            <CardHeader>
              <CardTitle>Vendas da Semana</CardTitle>
              <CardDescription>Comparativo de faturamento diário.</CardDescription>
            </CardHeader>
            <CardContent className="pl-2">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={salesData}>
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
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    cursor={{ fill: 'transparent' }}
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
              <CardDescription>Fluxo de vendas ao longo do dia.</CardDescription>
            </CardHeader>
            <CardContent className="pl-2">
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={hourlyData}>
                  <defs>
                    <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                  <XAxis dataKey="time" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}/>
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

        {/* Recent Sales / Inventory Alerts */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Últimas Vendas</CardTitle>
              <CardDescription>Transações recentes no PDV.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[
                  { id: "1024", time: "10:42", amount: "R$ 156,00", items: "8 itens", method: "Cartão Crédito" },
                  { id: "1023", time: "10:38", amount: "R$ 42,50", items: "3 itens", method: "PIX" },
                  { id: "1022", time: "10:35", amount: "R$ 89,90", items: "5 itens", method: "Dinheiro" },
                  { id: "1021", time: "10:30", amount: "R$ 210,00", items: "12 itens", method: "Cartão Débito" },
                ].map((sale) => (
                  <div key={sale.id} className="flex items-center justify-between border-b border-border pb-2 last:border-0 last:pb-0">
                    <div>
                      <p className="font-medium text-sm">Venda #{sale.id}</p>
                      <p className="text-xs text-muted-foreground">{sale.time} • {sale.items}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-sm">{sale.amount}</p>
                      <p className="text-xs text-muted-foreground">{sale.method}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Alertas de Estoque</CardTitle>
              <CardDescription>Produtos precisando de reposição.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[
                  { name: "Arroz Tio João 5kg", stock: 5, min: 20, supplier: "Distribuidora A" },
                  { name: "Leite Integral Italac", stock: 12, min: 48, supplier: "Laticínios B" },
                  { name: "Coca-Cola 2L", stock: 8, min: 30, supplier: "Bebidas C" },
                  { name: "Óleo de Soja Liza", stock: 3, min: 24, supplier: "Distribuidora A" },
                ].map((item, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-destructive/10 flex items-center justify-center text-destructive">
                        <AlertCircle className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">{item.name}</p>
                        <p className="text-xs text-muted-foreground">Fornecedor: {item.supplier}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-sm text-destructive">{item.stock} un</p>
                      <p className="text-xs text-muted-foreground">Mínimo: {item.min}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
