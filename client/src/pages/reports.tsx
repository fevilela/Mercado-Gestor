import Layout from "@/components/layout";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Package, TrendingUp } from "lucide-react";
import { format, parseISO, subMonths, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Sale {
  id: number;
  total: string;
  itemsCount: number;
  createdAt: string;
}

interface SaleItem {
  productId: number;
  productName: string;
  quantity: number;
  subtotal: string;
}

interface Product {
  id: number;
  name: string;
  price: string;
  stock: number;
  category: string;
}

export default function Reports() {
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

  const monthlyData = Array.from({ length: 6 }, (_, i) => {
    const monthDate = subMonths(new Date(), 5 - i);
    const monthStart = startOfMonth(monthDate);
    const monthName = format(monthDate, "MMM", { locale: ptBR });

    const monthSales = sales.filter((sale: Sale) => {
      try {
        const saleDate = parseISO(sale.createdAt);
        return format(saleDate, "yyyy-MM") === format(monthDate, "yyyy-MM");
      } catch {
        return false;
      }
    });

    const total = monthSales.reduce(
      (acc: number, sale: Sale) => acc + parseFloat(sale.total),
      0
    );

    return {
      name: monthName.charAt(0).toUpperCase() + monthName.slice(1),
      vendas: total,
    };
  });

  const productSalesMap: Record<
    number,
    { name: string; quantity: number; total: number }
  > = {};

  products.forEach((product: Product) => {
    productSalesMap[product.id] = {
      name: product.name,
      quantity: 0,
      total: 0,
    };
  });

  const topProducts = Object.values(productSalesMap)
    .filter((p) => p.quantity > 0 || products.length > 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  const displayProducts =
    topProducts.length > 0
      ? topProducts
      : products.slice(0, 3).map((p: Product) => ({
          name: p.name,
          quantity: p.stock,
          total: parseFloat(p.price) * p.stock,
        }));

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
            <p className="text-muted-foreground">Carregando relatórios...</p>
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
            Relatórios
          </h1>
          <p className="text-muted-foreground">
            Análise detalhada do desempenho da loja.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Vendas Semestrais</CardTitle>
              <CardDescription>
                Performance de vendas nos últimos 6 meses
              </CardDescription>
            </CardHeader>
            <CardContent>
              {monthlyData.every((d) => d.vendas === 0) ? (
                <div className="flex flex-col items-center justify-center h-[300px] text-muted-foreground">
                  <TrendingUp className="h-12 w-12 mb-4 opacity-50" />
                  <p>Nenhuma venda registrada nos últimos 6 meses</p>
                  <p className="text-sm mt-2">
                    Realize vendas no PDV para ver o gráfico
                  </p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={monthlyData}>
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
                      tickFormatter={(value) => `R$${value}`}
                    />
                    <Tooltip
                      cursor={{ fill: "transparent" }}
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
                    <Bar
                      dataKey="vendas"
                      fill="hsl(var(--primary))"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Produtos em Estoque</CardTitle>
              <CardDescription>Principais produtos cadastrados</CardDescription>
            </CardHeader>
            <CardContent>
              {products.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-[300px] text-muted-foreground">
                  <Package className="h-12 w-12 mb-4 opacity-50" />
                  <p>Nenhum produto cadastrado</p>
                  <p className="text-sm mt-2">
                    Cadastre produtos no estoque para vê-los aqui
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {products.slice(0, 5).map((product: Product) => (
                    <div
                      key={product.id}
                      className="flex items-center justify-between border-b border-border pb-2 last:border-0"
                    >
                      <div>
                        <p className="font-medium">{product.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {product.stock} unidades em estoque
                        </p>
                      </div>
                      <div className="font-bold">
                        R$ {parseFloat(product.price).toFixed(2)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Total de Vendas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-primary">
                {sales.length}
              </div>
              <p className="text-sm text-muted-foreground">
                vendas registradas
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Faturamento Total</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-emerald-600">
                R${" "}
                {sales
                  .reduce(
                    (acc: number, sale: Sale) => acc + parseFloat(sale.total),
                    0
                  )
                  .toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </div>
              <p className="text-sm text-muted-foreground">acumulado</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Produtos Cadastrados</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-600">
                {products.length}
              </div>
              <p className="text-sm text-muted-foreground">no catálogo</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
