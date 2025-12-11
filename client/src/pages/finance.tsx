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

const cashFlowData = [
  { name: "01/12", in: 4500, out: 2000 },
  { name: "02/12", in: 3800, out: 1500 },
  { name: "03/12", in: 6200, out: 4800 },
  { name: "04/12", in: 5100, out: 2100 },
  { name: "05/12", in: 8400, out: 3200 },
  { name: "06/12", in: 9800, out: 2400 },
  { name: "07/12", in: 7200, out: 1800 },
];

const expensesData = [
  { name: "Fornecedores", value: 43000 },
  { name: "Pessoal", value: 13000 },
  { name: "Energia/Água", value: 3500 },
  { name: "Impostos", value: 8200 },
  { name: "Manutenção", value: 1200 },
];

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884d8"];

export default function Finance() {
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
              <Calendar className="mr-2 h-4 w-4" /> Dezembro 2025
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
                R$ 142.350,00
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                +12% vs. mês anterior
              </p>
            </CardContent>
          </Card>

          <Card className="bg-rose-500/10 border-rose-500/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-rose-700 dark:text-rose-400">
                Despesas (Mês)
              </CardTitle>
              <ArrowDownRight className="h-4 w-4 text-rose-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-rose-700 dark:text-rose-400">
                R$ 89.420,00
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                +5% vs. mês anterior
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
                R$ 52.930,00
              </div>
              <p className="text-xs text-muted-foreground mt-1">Margem: 37%</p>
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
                    <LineChart data={cashFlowData}>
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
                        tickFormatter={(value) => `R$${value / 1000}k`}
                      />
                      <Tooltip />
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
                  <CardTitle>Composição de Despesas</CardTitle>
                  <CardDescription>
                    Distribuição dos custos operacionais.
                  </CardDescription>
                </CardHeader>
                <CardContent>
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
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
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
                <div className="space-y-4">
                  {[
                    {
                      id: 1,
                      desc: "Fornecedor Atacadista A",
                      due: "Hoje",
                      value: "R$ 4.500,00",
                      status: "Pendente",
                    },
                    {
                      id: 2,
                      desc: "Conta de Energia (Enel)",
                      due: "Amanhã",
                      value: "R$ 1.250,00",
                      status: "Agendado",
                    },
                    {
                      id: 3,
                      desc: "Aluguel Loja",
                      due: "15/12",
                      value: "R$ 3.000,00",
                      status: "Pendente",
                    },
                    {
                      id: 4,
                      desc: "Internet Fibra",
                      due: "15/12",
                      value: "R$ 150,00",
                      status: "Pendente",
                    },
                  ].map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between border-b border-border pb-4 last:border-0 last:pb-0"
                    >
                      <div>
                        <p className="font-medium">{item.desc}</p>
                        <p className="text-sm text-muted-foreground">
                          Vence: {item.due}
                        </p>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="font-bold">{item.value}</span>
                        <Button
                          size="sm"
                          variant={
                            item.status === "Agendado" ? "secondary" : "default"
                          }
                        >
                          {item.status === "Agendado" ? "Agendado" : "Pagar"}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
