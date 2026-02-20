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
import { Loader2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
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
  const [nfeStatusSearch, setNfeStatusSearch] = useState("");
  const [nfceCancelReason, setNfceCancelReason] = useState("");
  const [nfceStatusSearch, setNfceStatusSearch] = useState("");
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

  const sendNfeMutation = useMutation({
    mutationFn: async (doc: NFeHistoryRecord) => {
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
    },
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

  const sendNfceMutation = useMutation({
    mutationFn: async (sale: SaleRecord) => {
      const res = await fetch("/api/fiscal/nfce/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ saleIds: [sale.id] }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload?.error || "Falha ao enviar NFC-e");
      }
      return payload;
    },
    onSuccess: () => {
      toast({ title: "Sucesso", description: "NFC-e enviada para SEFAZ." });
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
          reason: nfceCancelReason,
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
      setNfceCancelReason("");
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

  const nfeStatusResult = useMemo(() => {
    const key = nfeStatusSearch.trim();
    if (!key) return null;
    return orderedNfe.find((doc) => doc.documentKey === key) || null;
  }, [nfeStatusSearch, orderedNfe]);

  const nfceStatusResult = useMemo(() => {
    const query = nfceStatusSearch.trim();
    if (!query) return null;
    return (
      orderedSales.find(
        (sale) => sale.nfceKey === query || String(sale.id) === query,
      ) || null
    );
  }, [nfceStatusSearch, orderedSales]);

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
                <CardTitle>Status NF-e</CardTitle>
                <CardDescription>Consulte pelo número da chave da NF-e.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Input
                  placeholder="Cole a chave de acesso da NF-e (44 dígitos)"
                  value={nfeStatusSearch}
                  onChange={(e) => setNfeStatusSearch(e.target.value)}
                />
                {nfeStatusSearch.trim() && (
                  <div className="rounded-md border p-3 text-sm">
                    {nfeStatusResult ? (
                      <div className="space-y-1">
                        <div>{badgeForStatus(nfeStatusResult.status)}</div>
                        <p>NF-e: {nfeStatusResult.nfeNumber || "-"}</p>
                        <p>Série: {nfeStatusResult.nfeSeries || "-"}</p>
                        <p>Protocolo: {nfeStatusResult.protocol || "-"}</p>
                      </div>
                    ) : (
                      <p className="text-muted-foreground">
                        Chave não encontrada no histórico.
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Emitir / Cancelar NF-e</CardTitle>
                <CardDescription>
                  Lista de NF-e geradas. Envie para SEFAZ ou cancele as autorizadas.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  UF automática do cadastro da empresa: <strong>{sefazUf}</strong>
                </p>

                {loadingNfe ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Carregando NF-e...
                  </div>
                ) : orderedNfe.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhuma NF-e gerada.</p>
                ) : (
                  orderedNfe.slice(0, 20).map((doc) => (
                    <div
                      key={doc.id}
                      className="rounded-lg border p-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between"
                    >
                      <div className="space-y-1 text-sm">
                        <div>{badgeForStatus(doc.status)}</div>
                        <p>NF-e {doc.nfeNumber || "-"} | Série {doc.nfeSeries || "-"}</p>
                        <p className="text-muted-foreground">Chave: {doc.documentKey || "-"}</p>
                        <p className="text-muted-foreground">Protocolo: {doc.protocol || "-"}</p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          onClick={() => sendNfeMutation.mutate(doc)}
                          disabled={!doc.canSend || sendNfeMutation.isPending}
                        >
                          {sendNfeMutation.isPending && (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          )}
                          Emitir
                        </Button>
                        <Button
                          variant="destructive"
                          onClick={() =>
                            setNfeCancelDialog({ open: true, doc, reason: "" })
                          }
                          disabled={!doc.canCancel || cancelNfeMutation.isPending}
                        >
                          {cancelNfeMutation.isPending && (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          )}
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="nfce" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Status NFC-e</CardTitle>
                <CardDescription>Consulte por chave da NFC-e ou ID da venda.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Input
                  placeholder="Cole a chave da NFC-e ou ID da venda"
                  value={nfceStatusSearch}
                  onChange={(e) => setNfceStatusSearch(e.target.value)}
                />
                {nfceStatusSearch.trim() && (
                  <div className="rounded-md border p-3 text-sm">
                    {nfceStatusResult ? (
                      <div className="space-y-1">
                        <div>{badgeForStatus(nfceStatusResult.nfceStatus)}</div>
                        <p>Venda ID: {nfceStatusResult.id}</p>
                        <p>Chave: {nfceStatusResult.nfceKey || "-"}</p>
                        <p>Protocolo: {nfceStatusResult.nfceProtocol || "-"}</p>
                      </div>
                    ) : (
                      <p className="text-muted-foreground">
                        Venda/NFC-e não encontrada.
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Emitir / Cancelar NFC-e</CardTitle>
                <CardDescription>
                  Selecione a venda para enviar NFC-e ou cancelar quando autorizada.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label>Justificativa de cancelamento (mín. 15)</Label>
                  <Input
                    value={nfceCancelReason}
                    onChange={(e) => setNfceCancelReason(e.target.value)}
                    placeholder="Motivo do cancelamento"
                  />
                </div>

                {loadingNfce ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Carregando vendas...
                  </div>
                ) : orderedSales.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhuma venda encontrada.</p>
                ) : (
                  orderedSales.slice(0, 20).map((sale) => (
                    <div
                      key={sale.id}
                      className="rounded-lg border p-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between"
                    >
                      <div className="space-y-1 text-sm">
                        <div>{badgeForStatus(sale.nfceStatus)}</div>
                        <p>Venda #{sale.id} | Cliente: {sale.customerName || "Consumidor"}</p>
                        <p className="text-muted-foreground">Chave: {sale.nfceKey || "-"}</p>
                        <p className="text-muted-foreground">
                          Protocolo: {sale.nfceProtocol || "-"}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          onClick={() => sendNfceMutation.mutate(sale)}
                          disabled={sendNfceMutation.isPending || !canSendNfce(sale.nfceStatus)}
                        >
                          {sendNfceMutation.isPending && (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          )}
                          Emitir
                        </Button>
                        <Button
                          variant="destructive"
                          onClick={() => cancelNfceMutation.mutate(sale)}
                          disabled={
                            cancelNfceMutation.isPending ||
                            !canCancelNfce(
                              sale.nfceStatus,
                              sale.nfceKey,
                              sale.nfceProtocol,
                            ) ||
                            nfceCancelReason.trim().length < 15
                          }
                        >
                          {cancelNfceMutation.isPending && (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          )}
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  ))
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
    </Layout>
  );
}
