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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
  Download,
  Loader2,
  Search,
  Wallet,
  DollarSign,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import {
  format,
  parseISO,
  startOfMonth,
  endOfMonth,
  subMonths,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { useState, useMemo } from "react";

interface CashMovement {
  id: number;
  cashRegisterId: number;
  type: string;
  amount: string;
  previousBalance: string;
  newBalance: string;
  description: string;
  saleId: number | null;
  userId: string;
  userName: string;
  createdAt: string;
}

interface CashRegister {
  id: number;
  userId: string;
  userName: string;
  openingBalance: string;
  currentBalance: string;
  expectedBalance: string;
  status: string;
  openedAt: string;
  closedAt: string | null;
  closingNotes: string | null;
  terminalId: number | null;
  terminalName: string | null;
}

export default function CashHistory() {
  const [dateFrom, setDateFrom] = useState(() => {
    const date = startOfMonth(subMonths(new Date(), 1));
    return format(date, "yyyy-MM-dd");
  });
  const [dateTo, setDateTo] = useState(() => {
    const date = endOfMonth(new Date());
    return format(date, "yyyy-MM-dd");
  });
  const [filterType, setFilterType] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");

  interface HistoryResponse {
    registers: CashRegister[];
    movements: CashMovement[];
  }

  const { data: historyData, isLoading } = useQuery<HistoryResponse>({
    queryKey: ["/api/cash-register/history"],
    queryFn: async () => {
      const response = await fetch(`/api/cash-register/history`);
      if (!response.ok) throw new Error("Failed to fetch history");
      return response.json();
    },
  });

  const movements = historyData?.movements || [];
  const registers = historyData?.registers || [];

  const filteredMovements = useMemo(() => {
    return movements.filter((m) => {
      if (filterType !== "all" && m.type !== filterType) return false;
      if (
        searchTerm &&
        !m.description.toLowerCase().includes(searchTerm.toLowerCase())
      ) {
        return false;
      }
      return true;
    });
  }, [movements, filterType, searchTerm]);

  const summary = useMemo(() => {
    const result = {
      totalIn: 0,
      totalOut: 0,
      sangrias: 0,
      suprimentos: 0,
      sales: 0,
    };

    filteredMovements.forEach((m) => {
      const amount = parseFloat(m.amount);
      if (m.type === "sangria") {
        result.sangrias += amount;
        result.totalOut += amount;
      } else if (m.type === "suprimento") {
        result.suprimentos += amount;
        result.totalIn += amount;
      } else if (m.type === "sale") {
        result.sales += amount;
        result.totalIn += amount;
      }
    });

    return result;
  }, [filteredMovements]);

  const formatCurrency = (value: string | number) => {
    const num = typeof value === "string" ? parseFloat(value) : value;
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(num);
  };

  const getMovementTypeLabel = (type: string) => {
    switch (type) {
      case "opening":
        return "Abertura";
      case "sale":
        return "Venda";
      case "sangria":
        return "Sangria";
      case "suprimento":
        return "Suprimento";
      case "closing":
        return "Fechamento";
      default:
        return type;
    }
  };

  const getMovementTypeBadge = (type: string) => {
    switch (type) {
      case "opening":
        return (
          <Badge
            variant="outline"
            className="bg-blue-50 text-blue-700 border-blue-200"
          >
            Abertura
          </Badge>
        );
      case "sale":
        return (
          <Badge
            variant="outline"
            className="bg-green-50 text-green-700 border-green-200"
          >
            Venda
          </Badge>
        );
      case "sangria":
        return (
          <Badge
            variant="outline"
            className="bg-red-50 text-red-700 border-red-200"
          >
            Sangria
          </Badge>
        );
      case "suprimento":
        return (
          <Badge
            variant="outline"
            className="bg-emerald-50 text-emerald-700 border-emerald-200"
          >
            Suprimento
          </Badge>
        );
      case "closing":
        return (
          <Badge
            variant="outline"
            className="bg-purple-50 text-purple-700 border-purple-200"
          >
            Fechamento
          </Badge>
        );
      default:
        return <Badge variant="outline">{type}</Badge>;
    }
  };

  const getRegisterStatusBadge = (status: string) => {
    switch (status) {
      case "open":
        return <Badge className="bg-green-500">Aberto</Badge>;
      case "closed":
        return <Badge variant="secondary">Fechado</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <Layout>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-heading font-bold tracking-tight text-foreground">
              Histórico de Caixa
            </h1>
            <p className="text-muted-foreground">
              Acompanhe todas as movimentações de caixa
            </p>
          </div>
          <Button variant="outline" data-testid="button-export-history">
            <Download className="mr-2 h-4 w-4" />
            Exportar
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Total Entradas
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div
                className="text-2xl font-bold text-green-600"
                data-testid="text-total-in"
              >
                {formatCurrency(summary.totalIn)}
              </div>
              <p className="text-xs text-muted-foreground">
                Vendas + Suprimentos
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Total Saídas
              </CardTitle>
              <TrendingDown className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div
                className="text-2xl font-bold text-red-600"
                data-testid="text-total-out"
              >
                {formatCurrency(summary.totalOut)}
              </div>
              <p className="text-xs text-muted-foreground">
                Sangrias realizadas
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Vendas em Dinheiro
              </CardTitle>
              <DollarSign className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div
                className="text-2xl font-bold"
                data-testid="text-total-sales"
              >
                {formatCurrency(summary.sales)}
              </div>
              <p className="text-xs text-muted-foreground">
                No período selecionado
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Movimentações
              </CardTitle>
              <Wallet className="h-4 w-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div
                className="text-2xl font-bold"
                data-testid="text-movement-count"
              >
                {filteredMovements.length}
              </div>
              <p className="text-xs text-muted-foreground">
                Registros no período
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Filtros</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-40"
                  data-testid="input-date-from"
                />
                <span className="text-muted-foreground">até</span>
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-40"
                  data-testid="input-date-to"
                />
              </div>
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger
                  className="w-40"
                  data-testid="select-movement-type"
                >
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="opening">Abertura</SelectItem>
                  <SelectItem value="sale">Venda</SelectItem>
                  <SelectItem value="sangria">Sangria</SelectItem>
                  <SelectItem value="suprimento">Suprimento</SelectItem>
                  <SelectItem value="closing">Fechamento</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex-1 relative min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por descrição..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                  data-testid="input-search-movements"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Movimentações</CardTitle>
              <CardDescription>
                Histórico detalhado de todas as operações de caixa
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : filteredMovements.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Wallet className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhuma movimentação encontrada</p>
                  <p className="text-sm">
                    Ajuste os filtros ou selecione outro período
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data/Hora</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Descrição</TableHead>
                        <TableHead>Operador</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                        <TableHead className="text-right">Saldo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredMovements.map((movement) => (
                        <TableRow
                          key={movement.id}
                          data-testid={`movement-row-${movement.id}`}
                        >
                          <TableCell className="whitespace-nowrap">
                            {format(
                              parseISO(movement.createdAt),
                              "dd/MM/yyyy HH:mm",
                              {
                                locale: ptBR,
                              }
                            )}
                          </TableCell>
                          <TableCell>
                            {getMovementTypeBadge(movement.type)}
                          </TableCell>
                          <TableCell className="max-w-xs truncate">
                            {movement.description}
                          </TableCell>
                          <TableCell>{movement.userName}</TableCell>
                          <TableCell className="text-right">
                            <span
                              className={
                                movement.type === "sangria"
                                  ? "text-red-600"
                                  : movement.type === "sale" ||
                                    movement.type === "suprimento"
                                  ? "text-green-600"
                                  : ""
                              }
                            >
                              {movement.type === "sangria" ? "-" : "+"}
                              {formatCurrency(movement.amount)}
                            </span>
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(movement.newBalance)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Caixas Recentes</CardTitle>
              <CardDescription>
                Resumo dos últimos caixas abertos/fechados
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : registers.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>Nenhum caixa no período</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {registers.slice(0, 10).map((register) => (
                    <div
                      key={register.id}
                      className="border rounded-lg p-3 space-y-2"
                      data-testid={`register-item-${register.id}`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{register.userName}</span>
                        {getRegisterStatusBadge(register.status)}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {format(
                          parseISO(register.openedAt),
                          "dd/MM/yyyy HH:mm",
                          {
                            locale: ptBR,
                          }
                        )}
                        {register.closedAt && (
                          <>
                            {" - "}
                            {format(parseISO(register.closedAt), "HH:mm", {
                              locale: ptBR,
                            })}
                          </>
                        )}
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Abertura:</span>
                        <span>{formatCurrency(register.openingBalance)}</span>
                      </div>
                      <div className="flex justify-between text-sm font-medium">
                        <span>Saldo Final:</span>
                        <span>{formatCurrency(register.currentBalance)}</span>
                      </div>
                      {register.terminalName && (
                        <div className="text-xs text-muted-foreground">
                          Terminal: {register.terminalName}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
