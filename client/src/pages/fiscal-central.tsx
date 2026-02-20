import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Loader2, MoreHorizontal } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface NFeHistoryRecord {
  id: number;
  documentKey: string;
  nfeNumber: string | null;
  nfeSeries: string | null;
  environment: "homologacao" | "producao";
  xmlContent: string;
  protocol: string;
  status: "gerada" | "processando" | "autorizada" | "cancelada";
  canSend: boolean;
  canCancel: boolean;
  createdAt: string;
  updatedAt: string;
}

interface SaleRecord {
  id: number;
  customerName: string;
  total: string;
  nfceStatus: string;
  nfceProtocol: string | null;
  nfceKey: string | null;
  createdAt: string;
}

interface AccessoryHistoryRecord {
  id: number;
  action: string;
  success: boolean;
  requestPayload?: any;
  responsePayload?: any;
  createdAt: string;
}

export default function FiscalCentralPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [nfeCancelDialog, setNfeCancelDialog] = useState<{
    open: boolean;
    doc: NFeHistoryRecord | null;
    reason: string;
  }>({ open: false, doc: null, reason: "" });
  const [nfeSearch, setNfeSearch] = useState("");
  const [nfeStatusFilter, setNfeStatusFilter] = useState("all");
  const [nfeDateFrom, setNfeDateFrom] = useState("");
  const [nfeDateTo, setNfeDateTo] = useState("");
  const [selectedNfeIds, setSelectedNfeIds] = useState<number[]>([]);
  const [nfceCancelDialog, setNfceCancelDialog] = useState<{
    open: boolean;
    sale: SaleRecord | null;
    reason: string;
  }>({ open: false, sale: null, reason: "" });
  const [nfceSearch, setNfceSearch] = useState("");
  const [nfceStatusFilter, setNfceStatusFilter] = useState("all");
  const [nfceDateFrom, setNfceDateFrom] = useState("");
  const [nfceDateTo, setNfceDateTo] = useState("");
  const [selectedNfceIds, setSelectedNfceIds] = useState<number[]>([]);
  const [accessoryPeriod, setAccessoryPeriod] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [lastSpedFile, setLastSpedFile] = useState<{
    period: string;
    fileName: string;
    content: string;
  } | null>(null);
  const [lastSintegraFile, setLastSintegraFile] = useState<{
    period: string;
    fileName: string;
    content: string;
  } | null>(null);
  const [accessoryDeliveryUrl, setAccessoryDeliveryUrl] = useState("");
  const [accessoryDeliveryToken, setAccessoryDeliveryToken] = useState("");
  const [accessoryDeliveryApiKey, setAccessoryDeliveryApiKey] = useState("");
  const [confirmProductionDelivery, setConfirmProductionDelivery] =
    useState(false);

  const { data: nfeHistory = [], isLoading: loadingNfe } = useQuery<
    NFeHistoryRecord[]
  >({
    queryKey: ["/api/fiscal/nfe/history"],
    queryFn: async () => {
      const res = await fetch("/api/fiscal/nfe/history");
      if (!res.ok) throw new Error("Falha ao carregar historico de NF-e");
      return res.json();
    },
  });

  const { data: sales = [], isLoading: loadingNfce } = useQuery<SaleRecord[]>({
    queryKey: ["/api/sales"],
    queryFn: async () => {
      const res = await fetch("/api/sales");
      if (!res.ok) throw new Error("Falha ao carregar vendas");
      return res.json();
    },
  });

  const { data: settings } = useQuery<any>({
    queryKey: ["/api/settings"],
    queryFn: async () => {
      const res = await fetch("/api/settings");
      if (!res.ok) return null;
      return res.json();
    },
  });

  const sefazUf = String(settings?.sefazUf || settings?.state || "MG").toUpperCase();

  const { data: accessoryHistory = [], isLoading: loadingAccessoryHistory } = useQuery<
    AccessoryHistoryRecord[]
  >({
    queryKey: ["/api/fiscal/accessory-obligations/history"],
    queryFn: async () => {
      const res = await fetch("/api/fiscal/accessory-obligations/history");
      if (!res.ok) throw new Error("Falha ao carregar histórico acessório");
      return res.json();
    },
  });

  const submitNfe = async (doc: NFeHistoryRecord) => {
    const res = await fetch("/api/fiscal/sefaz/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nfeLogId: doc.id, uf: sefazUf }),
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok || payload?.success === false) {
      throw new Error(payload?.error || payload?.message || "Falha ao enviar NF-e");
    }
    return payload;
  };

  const sendNfeMutation = useMutation({
    mutationFn: submitNfe,
    onSuccess: () => {
      toast({ title: "Sucesso", description: "NF-e enviada para SEFAZ." });
      queryClient.invalidateQueries({ queryKey: ["/api/fiscal/nfe/history"] });
    },
    onError: (error) => {
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Falha ao enviar NF-e",
        variant: "destructive",
      });
    },
  });

  const sendNfeBatchMutation = useMutation({
    mutationFn: async (docs: NFeHistoryRecord[]) => {
      let successCount = 0;
      const errors: string[] = [];

      for (const doc of docs) {
        try {
          await submitNfe(doc);
          successCount += 1;
        } catch (error) {
          const label = doc.nfeNumber ? `NF-e ${doc.nfeNumber}` : `Registro ${doc.id}`;
          const message =
            error instanceof Error ? error.message : "Falha ao enviar NF-e";
          errors.push(`${label}: ${message}`);
        }
      }

      return { successCount, errors, total: docs.length };
    },
    onSuccess: (result) => {
      const hasErrors = result.errors.length > 0;
      toast({
        title: hasErrors ? "Envio em lote concluído com ressalvas" : "Sucesso",
        description: hasErrors
          ? `${result.successCount} de ${result.total} NF-e enviadas.`
          : `${result.successCount} NF-e enviadas com sucesso.`,
        variant: hasErrors ? "destructive" : "default",
      });
      if (hasErrors) {
        console.error("Falhas no envio em lote de NF-e:", result.errors);
      }
      setSelectedNfeIds([]);
      queryClient.invalidateQueries({ queryKey: ["/api/fiscal/nfe/history"] });
    },
    onError: (error) => {
      toast({
        title: "Erro",
        description:
          error instanceof Error ? error.message : "Falha ao enviar lote de NF-e",
        variant: "destructive",
      });
    },
  });

  const cancelNfeMutation = useMutation({
    mutationFn: async (doc: NFeHistoryRecord) => {
      const res = await fetch("/api/fiscal/sefaz/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accessKey: doc.documentKey,
          protocol: doc.protocol,
          reason: nfeCancelDialog.reason,
          uf: sefazUf,
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload?.error || "Falha ao cancelar NF-e");
      }
      return payload;
    },
    onSuccess: () => {
      toast({ title: "Sucesso", description: "NF-e cancelada." });
      setNfeCancelDialog({ open: false, doc: null, reason: "" });
      queryClient.invalidateQueries({ queryKey: ["/api/fiscal/nfe/history"] });
    },
    onError: (error) => {
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Falha ao cancelar NF-e",
        variant: "destructive",
      });
    },
  });

  const submitNfce = async (saleIds: number[]) => {
    const res = await fetch("/api/fiscal/nfce/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ saleIds }),
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(payload?.error || "Falha ao enviar NFC-e");
    }
    return payload;
  };

  const sendNfceMutation = useMutation({
    mutationFn: submitNfce,
    onSuccess: (_, saleIds) => {
      toast({
        title: "Sucesso",
        description:
          saleIds.length > 1
            ? `${saleIds.length} NFC-e enviadas para SEFAZ.`
            : "NFC-e enviada para SEFAZ.",
      });
      setSelectedNfceIds([]);
      queryClient.invalidateQueries({ queryKey: ["/api/sales"] });
    },
    onError: (error) => {
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Falha ao enviar NFC-e",
        variant: "destructive",
      });
    },
  });

  const cancelNfceMutation = useMutation({
    mutationFn: async (sale: SaleRecord) => {
      const res = await fetch("/api/fiscal/nfce/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          saleId: sale.id,
          reason: nfceCancelDialog.reason,
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload?.error || "Falha ao cancelar NFC-e");
      }
      return payload;
    },
    onSuccess: () => {
      toast({ title: "Sucesso", description: "NFC-e cancelada." });
      setNfceCancelDialog({ open: false, sale: null, reason: "" });
      queryClient.invalidateQueries({ queryKey: ["/api/sales"] });
    },
    onError: (error) => {
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Falha ao cancelar NFC-e",
        variant: "destructive",
      });
    },
  });

  const downloadTextFile = (fileName: string, content: string) => {
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const href = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = href;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(href);
  };

  const generateSpedMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/fiscal/sped/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ period: accessoryPeriod }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error || "Falha ao gerar SPED");
      return payload;
    },
    onSuccess: (data) => {
      setLastSpedFile({
        period: accessoryPeriod,
        fileName: data.fileName,
        content: String(data.content || ""),
      });
      downloadTextFile(data.fileName, data.content || "");
      toast({ title: "Sucesso", description: "SPED gerado e baixado." });
      queryClient.invalidateQueries({ queryKey: ["/api/fiscal/accessory-obligations/history"] });
    },
    onError: (error) => {
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Falha ao gerar SPED",
        variant: "destructive",
      });
    },
  });

  const deliverSpedMutation = useMutation({
    mutationFn: async () => {
      if (!lastSpedFile) throw new Error("Gere o arquivo SPED antes da entrega");
      const res = await fetch("/api/fiscal/sped/deliver", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...lastSpedFile,
          deliveryUrl: accessoryDeliveryUrl.trim() || undefined,
          deliveryToken: accessoryDeliveryToken.trim() || undefined,
          deliveryApiKey: accessoryDeliveryApiKey.trim() || undefined,
          confirmProduction: confirmProductionDelivery,
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error || "Falha ao entregar SPED");
      return payload;
    },
    onSuccess: () => {
      toast({ title: "Sucesso", description: "Entrega do SPED registrada." });
      queryClient.invalidateQueries({ queryKey: ["/api/fiscal/accessory-obligations/history"] });
    },
    onError: (error) => {
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Falha ao entregar SPED",
        variant: "destructive",
      });
    },
  });

  const generateSintegraMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/fiscal/sintegra/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ period: accessoryPeriod }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error || "Falha ao gerar Sintegra");
      return payload;
    },
    onSuccess: (data) => {
      setLastSintegraFile({
        period: accessoryPeriod,
        fileName: data.fileName,
        content: String(data.content || ""),
      });
      downloadTextFile(data.fileName, data.content || "");
      toast({ title: "Sucesso", description: "Sintegra gerado e baixado." });
      queryClient.invalidateQueries({ queryKey: ["/api/fiscal/accessory-obligations/history"] });
    },
    onError: (error) => {
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Falha ao gerar Sintegra",
        variant: "destructive",
      });
    },
  });

  const deliverSintegraMutation = useMutation({
    mutationFn: async () => {
      if (!lastSintegraFile) throw new Error("Gere o arquivo Sintegra antes da entrega");
      const res = await fetch("/api/fiscal/sintegra/deliver", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...lastSintegraFile,
          deliveryUrl: accessoryDeliveryUrl.trim() || undefined,
          deliveryToken: accessoryDeliveryToken.trim() || undefined,
          deliveryApiKey: accessoryDeliveryApiKey.trim() || undefined,
          confirmProduction: confirmProductionDelivery,
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error || "Falha ao entregar Sintegra");
      return payload;
    },
    onSuccess: () => {
      toast({ title: "Sucesso", description: "Entrega do Sintegra registrada." });
      queryClient.invalidateQueries({ queryKey: ["/api/fiscal/accessory-obligations/history"] });
    },
    onError: (error) => {
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Falha ao entregar Sintegra",
        variant: "destructive",
      });
    },
  });

  const orderedNfe = useMemo(
    () =>
      [...nfeHistory].sort(
        (a, b) =>
          new Date(b.updatedAt || b.createdAt).getTime() -
          new Date(a.updatedAt || a.createdAt).getTime(),
      ),
    [nfeHistory],
  );

  const orderedSales = useMemo(
    () =>
      [...sales].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      ),
    [sales],
  );

  const parseDateRangeStart = (value: string) =>
    value ? new Date(`${value}T00:00:00`).getTime() : null;
  const parseDateRangeEnd = (value: string) =>
    value ? new Date(`${value}T23:59:59.999`).getTime() : null;

  const formatDateTime = (value: string) =>
    value ? new Date(value).toLocaleString("pt-BR") : "-";

  const formatCurrency = (value: string) => {
    const numericValue = Number(value);
    if (Number.isNaN(numericValue)) return value;
    return numericValue.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  };

  const badgeForStatus = (status: string) => {
    const normalized = String(status || "").toLowerCase();
    if (normalized.includes("cancel")) {
      return <Badge variant="destructive">Cancelada</Badge>;
    }
    if (normalized.includes("autoriz")) {
      return <Badge className="bg-green-600">Autorizada</Badge>;
    }
    if (normalized.includes("process")) {
      return <Badge className="bg-amber-500">Processando</Badge>;
    }
    return <Badge variant="secondary">{status || "Pendente"}</Badge>;
  };

  const canSendNfce = (status: string) => {
    const normalized = String(status || "").toLowerCase();
    return !normalized.includes("autoriz") && !normalized.includes("cancel");
  };

  const canCancelNfce = (status: string, key: string | null, protocol: string | null) => {
    const normalized = String(status || "").toLowerCase();
    return normalized.includes("autoriz") && Boolean(key) && Boolean(protocol);
  };

  const filteredNfe = useMemo(() => {
    const query = nfeSearch.trim().toLowerCase();
    const dateFrom = parseDateRangeStart(nfeDateFrom);
    const dateTo = parseDateRangeEnd(nfeDateTo);

    return orderedNfe.filter((doc) => {
      const normalizedStatus = String(doc.status || "").toLowerCase();
      const docDate = new Date(doc.updatedAt || doc.createdAt).getTime();
      const matchesQuery =
        !query ||
        String(doc.nfeNumber || "").toLowerCase().includes(query) ||
        String(doc.nfeSeries || "").toLowerCase().includes(query) ||
        String(doc.documentKey || "").toLowerCase().includes(query) ||
        String(doc.protocol || "").toLowerCase().includes(query);
      const matchesStatus =
        nfeStatusFilter === "all" || normalizedStatus.includes(nfeStatusFilter);
      const matchesDateFrom = dateFrom === null || docDate >= dateFrom;
      const matchesDateTo = dateTo === null || docDate <= dateTo;
      return matchesQuery && matchesStatus && matchesDateFrom && matchesDateTo;
    });
  }, [orderedNfe, nfeSearch, nfeStatusFilter, nfeDateFrom, nfeDateTo]);

  const filteredNfce = useMemo(() => {
    const query = nfceSearch.trim().toLowerCase();
    const dateFrom = parseDateRangeStart(nfceDateFrom);
    const dateTo = parseDateRangeEnd(nfceDateTo);

    return orderedSales.filter((sale) => {
      const normalizedStatus = String(sale.nfceStatus || "").toLowerCase();
      const saleDate = new Date(sale.createdAt).getTime();
      const matchesQuery =
        !query ||
        String(sale.id).includes(query) ||
        String(sale.customerName || "").toLowerCase().includes(query) ||
        String(sale.nfceKey || "").toLowerCase().includes(query) ||
        String(sale.nfceProtocol || "").toLowerCase().includes(query);
      const matchesStatus =
        nfceStatusFilter === "all" || normalizedStatus.includes(nfceStatusFilter);
      const matchesDateFrom = dateFrom === null || saleDate >= dateFrom;
      const matchesDateTo = dateTo === null || saleDate <= dateTo;
      return matchesQuery && matchesStatus && matchesDateFrom && matchesDateTo;
    });
  }, [orderedSales, nfceSearch, nfceStatusFilter, nfceDateFrom, nfceDateTo]);

  const selectableNfe = filteredNfe.filter((doc) => doc.canSend);
  const selectableNfce = filteredNfce.filter((sale) => canSendNfce(sale.nfceStatus));

  const allNfeSelected =
    selectableNfe.length > 0 &&
    selectableNfe.every((doc) => selectedNfeIds.includes(doc.id));
  const allNfceSelected =
    selectableNfce.length > 0 &&
    selectableNfce.every((sale) => selectedNfceIds.includes(sale.id));

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Central Fiscal</h1>
          <p className="text-muted-foreground">
            Emissão, consulta de status e cancelamento de NF-e e NFC-e em uma tela única.
          </p>
        </div>

        <Tabs defaultValue="nfe" className="space-y-4">
          <TabsList>
            <TabsTrigger value="nfe">NF-e</TabsTrigger>
            <TabsTrigger value="nfce">NFC-e</TabsTrigger>
            <TabsTrigger value="accessory">Obrigações</TabsTrigger>
          </TabsList>

          <TabsContent value="nfe" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>NF-e em Tabela</CardTitle>
                <CardDescription>
                  Filtre por numero, chave, protocolo, status e data. Envie individualmente ou em lote.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  UF automatica do cadastro da empresa: <strong>{sefazUf}</strong>
                </p>
                <div className="grid gap-3 md:grid-cols-4">
                  <Input
                    placeholder="Buscar por numero/chave/protocolo"
                    value={nfeSearch}
                    onChange={(e) => setNfeSearch(e.target.value)}
                  />
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={nfeStatusFilter}
                    onChange={(e) => setNfeStatusFilter(e.target.value)}
                  >
                    <option value="all">Todos os status</option>
                    <option value="gerada">Gerada</option>
                    <option value="processando">Processando</option>
                    <option value="autorizada">Autorizada</option>
                    <option value="cancelada">Cancelada</option>
                  </select>
                  <Input
                    type="date"
                    value={nfeDateFrom}
                    onChange={(e) => setNfeDateFrom(e.target.value)}
                  />
                  <Input
                    type="date"
                    value={nfeDateTo}
                    onChange={(e) => setNfeDateTo(e.target.value)}
                  />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setNfeSearch("");
                      setNfeStatusFilter("all");
                      setNfeDateFrom("");
                      setNfeDateTo("");
                    }}
                  >
                    Limpar filtros
                  </Button>
                  <Button
                    onClick={() =>
                      sendNfeBatchMutation.mutate(
                        selectableNfe.filter((doc) => selectedNfeIds.includes(doc.id)),
                      )
                    }
                    disabled={
                      sendNfeBatchMutation.isPending ||
                      selectedNfeIds.length === 0
                    }
                  >
                    {sendNfeBatchMutation.isPending && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Enviar selecionadas ({selectedNfeIds.length})
                  </Button>
                </div>

                {loadingNfe ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Carregando NF-e...
                  </div>
                ) : filteredNfe.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Nenhuma NF-e encontrada para os filtros aplicados.
                  </p>
                ) : (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-10">
                            <Checkbox
                              checked={allNfeSelected}
                              onCheckedChange={(checked) => {
                                if (checked === true) {
                                  setSelectedNfeIds(selectableNfe.map((doc) => doc.id));
                                  return;
                                }
                                setSelectedNfeIds([]);
                              }}
                              disabled={selectableNfe.length === 0}
                            />
                          </TableHead>
                          <TableHead>Numero</TableHead>
                          <TableHead>Serie</TableHead>
                          <TableHead>Chave</TableHead>
                          <TableHead>Protocolo</TableHead>
                          <TableHead>Ambiente</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Atualizado em</TableHead>
                          <TableHead className="text-right">Acoes</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredNfe.map((doc) => {
                          const rowCanSend = doc.canSend;
                          const rowCanCancel = doc.canCancel;
                          return (
                            <TableRow key={doc.id}>
                              <TableCell>
                                <Checkbox
                                  checked={selectedNfeIds.includes(doc.id)}
                                  disabled={!rowCanSend}
                                  onCheckedChange={(checked) => {
                                    if (checked === true) {
                                      setSelectedNfeIds((prev) => [...prev, doc.id]);
                                    } else {
                                      setSelectedNfeIds((prev) =>
                                        prev.filter((id) => id !== doc.id),
                                      );
                                    }
                                  }}
                                />
                              </TableCell>
                              <TableCell className="font-medium">
                                {doc.nfeNumber || "-"}
                              </TableCell>
                              <TableCell>{doc.nfeSeries || "-"}</TableCell>
                              <TableCell className="max-w-[220px] truncate">
                                {doc.documentKey || "-"}
                              </TableCell>
                              <TableCell className="max-w-[150px] truncate">
                                {doc.protocol || "-"}
                              </TableCell>
                              <TableCell>
                                {doc.environment === "producao"
                                  ? "Producao"
                                  : "Homologacao"}
                              </TableCell>
                              <TableCell>{badgeForStatus(doc.status)}</TableCell>
                              <TableCell>
                                {formatDateTime(doc.updatedAt || doc.createdAt)}
                              </TableCell>
                              <TableCell className="text-right">
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon">
                                      <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuLabel>Acoes</DropdownMenuLabel>
                                    <DropdownMenuItem
                                      onClick={() => sendNfeMutation.mutate(doc)}
                                      disabled={!rowCanSend || sendNfeMutation.isPending}
                                    >
                                      Enviar para SEFAZ
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={() =>
                                        setNfeCancelDialog({
                                          open: true,
                                          doc,
                                          reason: "",
                                        })
                                      }
                                      disabled={
                                        !rowCanCancel || cancelNfeMutation.isPending
                                      }
                                    >
                                      Cancelar NF-e
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="nfce" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>NFC-e em Tabela</CardTitle>
                <CardDescription>
                  Use filtros de pesquisa, status e data. Acoes por linha ficam no menu de 3 pontos.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  UF automatica do cadastro da empresa: <strong>{sefazUf}</strong>
                </p>
                <div className="grid gap-3 md:grid-cols-4">
                  <Input
                    placeholder="Buscar por venda, cliente, chave ou protocolo"
                    value={nfceSearch}
                    onChange={(e) => setNfceSearch(e.target.value)}
                  />
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={nfceStatusFilter}
                    onChange={(e) => setNfceStatusFilter(e.target.value)}
                  >
                    <option value="all">Todos os status</option>
                    <option value="pendente">Pendente</option>
                    <option value="autorizada">Autorizada</option>
                    <option value="cancelada">Cancelada</option>
                  </select>
                  <Input
                    type="date"
                    value={nfceDateFrom}
                    onChange={(e) => setNfceDateFrom(e.target.value)}
                  />
                  <Input
                    type="date"
                    value={nfceDateTo}
                    onChange={(e) => setNfceDateTo(e.target.value)}
                  />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setNfceSearch("");
                      setNfceStatusFilter("all");
                      setNfceDateFrom("");
                      setNfceDateTo("");
                    }}
                  >
                    Limpar filtros
                  </Button>
                  <Button
                    onClick={() =>
                      sendNfceMutation.mutate(
                        selectableNfce
                          .filter((sale) => selectedNfceIds.includes(sale.id))
                          .map((sale) => sale.id),
                      )
                    }
                    disabled={sendNfceMutation.isPending || selectedNfceIds.length === 0}
                  >
                    {sendNfceMutation.isPending && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Enviar selecionadas ({selectedNfceIds.length})
                  </Button>
                </div>

                {loadingNfce ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Carregando vendas...
                  </div>
                ) : filteredNfce.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Nenhuma venda encontrada para os filtros aplicados.
                  </p>
                ) : (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-10">
                            <Checkbox
                              checked={allNfceSelected}
                              onCheckedChange={(checked) => {
                                if (checked === true) {
                                  setSelectedNfceIds(
                                    selectableNfce.map((sale) => sale.id),
                                  );
                                  return;
                                }
                                setSelectedNfceIds([]);
                              }}
                              disabled={selectableNfce.length === 0}
                            />
                          </TableHead>
                          <TableHead>Venda</TableHead>
                          <TableHead>Cliente</TableHead>
                          <TableHead>Total</TableHead>
                          <TableHead>Chave</TableHead>
                          <TableHead>Protocolo</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Data/Hora</TableHead>
                          <TableHead className="text-right">Acoes</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredNfce.map((sale) => {
                          const rowCanSend = canSendNfce(sale.nfceStatus);
                          const rowCanCancel = canCancelNfce(
                            sale.nfceStatus,
                            sale.nfceKey,
                            sale.nfceProtocol,
                          );
                          return (
                            <TableRow key={sale.id}>
                              <TableCell>
                                <Checkbox
                                  checked={selectedNfceIds.includes(sale.id)}
                                  disabled={!rowCanSend}
                                  onCheckedChange={(checked) => {
                                    if (checked === true) {
                                      setSelectedNfceIds((prev) => [...prev, sale.id]);
                                    } else {
                                      setSelectedNfceIds((prev) =>
                                        prev.filter((id) => id !== sale.id),
                                      );
                                    }
                                  }}
                                />
                              </TableCell>
                              <TableCell className="font-medium">
                                #{sale.id}
                              </TableCell>
                              <TableCell>{sale.customerName || "Consumidor"}</TableCell>
                              <TableCell>{formatCurrency(sale.total)}</TableCell>
                              <TableCell className="max-w-[220px] truncate">
                                {sale.nfceKey || "-"}
                              </TableCell>
                              <TableCell className="max-w-[150px] truncate">
                                {sale.nfceProtocol || "-"}
                              </TableCell>
                              <TableCell>{badgeForStatus(sale.nfceStatus)}</TableCell>
                              <TableCell>{formatDateTime(sale.createdAt)}</TableCell>
                              <TableCell className="text-right">
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon">
                                      <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuLabel>Acoes</DropdownMenuLabel>
                                    <DropdownMenuItem
                                      onClick={() => sendNfceMutation.mutate([sale.id])}
                                      disabled={!rowCanSend || sendNfceMutation.isPending}
                                    >
                                      Enviar para SEFAZ
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={() =>
                                        setNfceCancelDialog({
                                          open: true,
                                          sale,
                                          reason: "",
                                        })
                                      }
                                      disabled={
                                        !rowCanCancel ||
                                        cancelNfceMutation.isPending
                                      }
                                    >
                                      Cancelar NFC-e
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="accessory" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Obrigações Acessórias</CardTitle>
                <CardDescription>
                  Geração e entrega operacional de SPED Fiscal e Sintegra.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="max-w-xs">
                  <Label>Período (YYYY-MM)</Label>
                  <Input
                    value={accessoryPeriod}
                    onChange={(e) => setAccessoryPeriod(e.target.value)}
                    placeholder="2026-02"
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label>URL de entrega (opcional)</Label>
                    <Input
                      value={accessoryDeliveryUrl}
                      onChange={(e) => setAccessoryDeliveryUrl(e.target.value)}
                      placeholder="https://provedor.exemplo.com/obrigacoes"
                    />
                  </div>
                  <div>
                    <Label>Token Bearer (opcional)</Label>
                    <Input
                      value={accessoryDeliveryToken}
                      onChange={(e) => setAccessoryDeliveryToken(e.target.value)}
                      placeholder="token"
                    />
                  </div>
                  <div>
                    <Label>API Key (opcional)</Label>
                    <Input
                      value={accessoryDeliveryApiKey}
                      onChange={(e) => setAccessoryDeliveryApiKey(e.target.value)}
                      placeholder="x-api-key"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="confirm-production-delivery"
                    checked={confirmProductionDelivery}
                    onCheckedChange={(value) =>
                      setConfirmProductionDelivery(value === true)
                    }
                  />
                  <Label htmlFor="confirm-production-delivery">
                    Confirmo entrega em ambiente de produção
                  </Label>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>SPED Fiscal</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <Button onClick={() => generateSpedMutation.mutate()} disabled={generateSpedMutation.isPending}>
                        {generateSpedMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Gerar e baixar
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => deliverSpedMutation.mutate()}
                        disabled={deliverSpedMutation.isPending || !lastSpedFile}
                      >
                        {deliverSpedMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Registrar entrega
                      </Button>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader>
                      <CardTitle>Sintegra</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <Button
                        onClick={() => generateSintegraMutation.mutate()}
                        disabled={generateSintegraMutation.isPending}
                      >
                        {generateSintegraMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Gerar e baixar
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => deliverSintegraMutation.mutate()}
                        disabled={deliverSintegraMutation.isPending || !lastSintegraFile}
                      >
                        {deliverSintegraMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Registrar entrega
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Histórico de Geração/Entrega</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {loadingAccessoryHistory ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Carregando histórico...
                  </div>
                ) : accessoryHistory.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhum registro encontrado.</p>
                ) : (
                  accessoryHistory.slice(0, 30).map((record) => (
                    <div key={record.id} className="rounded border p-3 text-sm space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge variant={record.success ? "default" : "destructive"}>
                          {record.success ? "Sucesso" : "Falha"}
                        </Badge>
                        <span className="font-medium">{record.action}</span>
                      </div>
                      <p className="text-muted-foreground">
                        {new Date(record.createdAt).toLocaleString()}
                      </p>
                      <p>
                        Arquivo: {String(record.responsePayload?.fileName || record.requestPayload?.fileName || "-")}
                      </p>
                      <p>
                        Protocolo: {String(record.responsePayload?.protocol || "-")}
                      </p>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog
        open={nfeCancelDialog.open}
        onOpenChange={(open) =>
          setNfeCancelDialog((prev) => ({ ...prev, open }))
        }
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancelar NF-e</DialogTitle>
            <DialogDescription>
              Informe a justificativa de cancelamento (mínimo 15 caracteres).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Justificativa</Label>
            <Input
              value={nfeCancelDialog.reason}
              onChange={(e) =>
                setNfeCancelDialog((prev) => ({ ...prev, reason: e.target.value }))
              }
              placeholder="Motivo do cancelamento"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setNfeCancelDialog({ open: false, doc: null, reason: "" })}
            >
              Fechar
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (!nfeCancelDialog.doc) return;
                cancelNfeMutation.mutate(nfeCancelDialog.doc);
              }}
              disabled={
                cancelNfeMutation.isPending || nfeCancelDialog.reason.trim().length < 15
              }
            >
              {cancelNfeMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Confirmar cancelamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={nfceCancelDialog.open}
        onOpenChange={(open) =>
          setNfceCancelDialog((prev) => ({ ...prev, open }))
        }
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancelar NFC-e</DialogTitle>
            <DialogDescription>
              Informe a justificativa de cancelamento (mínimo 15 caracteres).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Justificativa</Label>
            <Input
              value={nfceCancelDialog.reason}
              onChange={(e) =>
                setNfceCancelDialog((prev) => ({ ...prev, reason: e.target.value }))
              }
              placeholder="Motivo do cancelamento"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setNfceCancelDialog({ open: false, sale: null, reason: "" })}
            >
              Fechar
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (!nfceCancelDialog.sale) return;
                cancelNfceMutation.mutate(nfceCancelDialog.sale);
              }}
              disabled={
                cancelNfceMutation.isPending || nfceCancelDialog.reason.trim().length < 15
              }
            >
              {cancelNfceMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Confirmar cancelamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
