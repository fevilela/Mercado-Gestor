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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

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

const UF_OPTIONS = [
  "AC",
  "AL",
  "AM",
  "AP",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MG",
  "MS",
  "MT",
  "PA",
  "PB",
  "PE",
  "PI",
  "PR",
  "RJ",
  "RN",
  "RO",
  "RR",
  "RS",
  "SC",
  "SE",
  "SP",
  "TO",
];

export default function NfeHistoryPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [uf, setUf] = useState("MG");
  const [sendingDocId, setSendingDocId] = useState<number | null>(null);
  const [cancelDialog, setCancelDialog] = useState<{
    open: boolean;
    doc: NFeHistoryRecord | null;
    reason: string;
  }>({ open: false, doc: null, reason: "" });
  const [editDialog, setEditDialog] = useState<{
    open: boolean;
    doc: NFeHistoryRecord | null;
    xmlContent: string;
    environment: "homologacao" | "producao";
  }>({
    open: false,
    doc: null,
    xmlContent: "",
    environment: "homologacao",
  });

  const { data: records = [], isLoading } = useQuery<NFeHistoryRecord[]>({
    queryKey: ["/api/fiscal/nfe/history"],
    queryFn: async () => {
      const res = await fetch("/api/fiscal/nfe/history");
      if (!res.ok) throw new Error("Falha ao carregar historico de NF-e");
      return res.json();
    },
  });

  const sendMutation = useMutation({
    mutationFn: async (doc: NFeHistoryRecord) => {
      const res = await fetch("/api/fiscal/sefaz/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nfeLogId: doc.id,
          environment: doc.environment,
          uf,
        }),
      });
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.error || "Falha ao enviar NF-e");
      }
      const payload = await res.json();
      if (payload?.success === false) {
        throw new Error(payload?.message || "Falha ao enviar NF-e");
      }
      return payload;
    },
    onSuccess: () => {
      toast({ title: "Sucesso", description: "NF-e enviada para processamento/autorizacao na SEFAZ." });
      queryClient.invalidateQueries({ queryKey: ["/api/fiscal/nfe/history"] });
    },
    onError: (error) => {
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Falha ao enviar NF-e",
        variant: "destructive",
      });
    },
    onMutate: (doc) => {
      setSendingDocId(doc.id);
    },
    onSettled: () => {
      setSendingDocId(null);
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async ({
      doc,
      reason,
    }: {
      doc: NFeHistoryRecord;
      reason: string;
    }) => {
      const res = await fetch("/api/fiscal/sefaz/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accessKey: doc.documentKey,
          protocol: doc.protocol,
          reason,
          environment: doc.environment,
          uf,
        }),
      });
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.error || "Falha ao cancelar NF-e");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Sucesso", description: "Cancelamento enviado para SEFAZ." });
      setCancelDialog({ open: false, doc: null, reason: "" });
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

  const reSignMutation = useMutation({
    mutationFn: async ({
      doc,
      xmlContent,
      environment,
    }: {
      doc: NFeHistoryRecord;
      xmlContent: string;
      environment: "homologacao" | "producao";
    }) => {
      const res = await fetch("/api/fiscal/nfe/re-sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nfeLogId: doc.id,
          xmlContent,
          environment,
        }),
      });
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.error || "Falha ao editar e reassinar NF-e");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Sucesso",
        description: "NF-e editada e reassinada. Agora voce pode enviar.",
      });
      setEditDialog({
        open: false,
        doc: null,
        xmlContent: "",
        environment: "homologacao",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/fiscal/nfe/history"] });
    },
    onError: (error) => {
      toast({
        title: "Erro",
        description:
          error instanceof Error
            ? error.message
            : "Falha ao editar e reassinar NF-e",
        variant: "destructive",
      });
    },
  });

  const orderedRecords = useMemo(
    () =>
      [...records].sort(
        (a, b) =>
          new Date(b.updatedAt || b.createdAt).getTime() -
          new Date(a.updatedAt || a.createdAt).getTime(),
      ),
    [records],
  );

  const statusBadge = (status: NFeHistoryRecord["status"]) => {
    if (status === "cancelada") {
      return <Badge variant="destructive">Cancelada</Badge>;
    }
    if (status === "autorizada") {
      return <Badge className="bg-green-600">Autorizada</Badge>;
    }
    if (status === "processando") {
      return <Badge className="bg-amber-500">Processando</Badge>;
    }
    return <Badge variant="secondary">Gerada</Badge>;
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">NF-e criadas</h1>
          <p className="text-muted-foreground">
            Gerencie envio e cancelamento das NF-e geradas
          </p>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-end justify-between gap-4">
            <div>
              <CardTitle>Historico de NF-e</CardTitle>
              <CardDescription>
                Use as acoes para enviar ou cancelar conforme o status.
              </CardDescription>
            </div>
            <div className="w-36">
              <Label>UF</Label>
              <Select value={uf} onValueChange={setUf}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {UF_OPTIONS.map((ufOption) => (
                    <SelectItem key={ufOption} value={ufOption}>
                      {ufOption}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Carregando historico...
              </div>
            ) : orderedRecords.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhuma NF-e gerada ainda.
              </p>
            ) : (
              orderedRecords.map((doc) => (
                <div
                  key={doc.id}
                  className="flex flex-col gap-3 rounded-lg border p-3 md:flex-row md:items-center md:justify-between"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      {statusBadge(doc.status)}
                      <span className="text-sm text-muted-foreground">
                        Ambiente: {doc.environment}
                      </span>
                    </div>
                    <p className="text-sm font-medium">
                      NF-e {doc.nfeNumber || "-"} | Serie {doc.nfeSeries || "-"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Chave: {doc.documentKey || "-"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Protocolo: {doc.protocol || "-"}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setEditDialog({
                          open: true,
                          doc,
                          xmlContent: doc.xmlContent || "",
                          environment: doc.environment,
                        })
                      }
                      disabled={!doc.canSend || reSignMutation.isPending}
                      data-testid={`button-edit-nfe-${doc.id}`}
                    >
                      Editar
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => sendMutation.mutate(doc)}
                      disabled={!doc.canSend || sendMutation.isPending}
                      data-testid={`button-send-nfe-${doc.id}`}
                    >
                      {sendMutation.isPending && sendingDocId === doc.id && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      Enviar
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() =>
                        setCancelDialog({ open: true, doc, reason: "" })
                      }
                      disabled={!doc.canCancel || cancelMutation.isPending}
                      data-testid={`button-cancel-nfe-${doc.id}`}
                    >
                      Cancelar
                    </Button>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog
        open={cancelDialog.open}
        onOpenChange={(open) =>
          setCancelDialog((prev) => ({ ...prev, open }))
        }
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancelar NF-e</DialogTitle>
            <DialogDescription>
              Informe a justificativa (minimo 15 caracteres).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Justificativa</Label>
            <Input
              value={cancelDialog.reason}
              onChange={(e) =>
                setCancelDialog((prev) => ({ ...prev, reason: e.target.value }))
              }
              placeholder="Motivo do cancelamento"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCancelDialog({ open: false, doc: null, reason: "" })}
            >
              Fechar
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (!cancelDialog.doc) return;
                cancelMutation.mutate({
                  doc: cancelDialog.doc,
                  reason: cancelDialog.reason,
                });
              }}
              disabled={
                cancelMutation.isPending || cancelDialog.reason.trim().length < 15
              }
            >
              {cancelMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Confirmar cancelamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={editDialog.open}
        onOpenChange={(open) =>
          setEditDialog((prev) => ({ ...prev, open }))
        }
      >
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Editar NF-e e Reassinar</DialogTitle>
            <DialogDescription>
              Edite o XML e salve para gerar uma nova assinatura. Disponivel
              apenas para NF-e ainda nao autorizada.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="w-44">
              <Label>Ambiente de assinatura</Label>
              <Select
                value={editDialog.environment}
                onValueChange={(value) =>
                  setEditDialog((prev) => ({
                    ...prev,
                    environment: value as "homologacao" | "producao",
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="homologacao">Homologacao</SelectItem>
                  <SelectItem value="producao">Producao</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>XML da NF-e</Label>
              <Textarea
                rows={18}
                value={editDialog.xmlContent}
                onChange={(e) =>
                  setEditDialog((prev) => ({
                    ...prev,
                    xmlContent: e.target.value,
                  }))
                }
                className="font-mono text-xs"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() =>
                setEditDialog({
                  open: false,
                  doc: null,
                  xmlContent: "",
                  environment: "homologacao",
                })
              }
            >
              Fechar
            </Button>
            <Button
              onClick={() => {
                if (!editDialog.doc) return;
                reSignMutation.mutate({
                  doc: editDialog.doc,
                  xmlContent: editDialog.xmlContent,
                  environment: editDialog.environment,
                });
              }}
              disabled={
                reSignMutation.isPending ||
                !editDialog.doc ||
                !editDialog.xmlContent.trim()
              }
            >
              {reSignMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Salvar e Reassinar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
