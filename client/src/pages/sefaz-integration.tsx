import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertCircle, CheckCircle, Loader, Copy, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import Layout from "@/components/layout";

const UFS = [
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

interface PendingNFe {
  id: number;
  nfeNumber?: string;
  nfeSeries?: string;
  saleId?: number;
  status: string;
  environment: string;
  createdAt: string;
}

export default function SefazIntegration() {
  const { toast } = useToast();
  const [environment, setEnvironment] = useState("homologacao");
  const [uf, setUf] = useState("SP");
  const [documentType, setDocumentType] = useState<"nfe" | "nfce">("nfe");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [selectedNFe, setSelectedNFe] = useState<number | null>(null);
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const response = await fetch("/api/settings");
        if (!response.ok) return;
        const data = await response.json();
        if (data?.fiscalEnvironment) {
          setEnvironment(data.fiscalEnvironment);
        }
      } catch {
        return;
      }
    };
    loadSettings();
  }, []);

  // Cancelar NF-e
  const [cancelNumber, setCancelNumber] = useState("");
  const [cancelSeries, setCancelSeries] = useState("");
  const [cancelReason, setCancelReason] = useState("");

  // Carta de Correção
  const [correctionNumber, setCorrectionNumber] = useState("");
  const [correctionSeries, setCorrectionSeries] = useState("");
  const [correctionReason, setCorrectionReason] = useState("");
  const [correctedContent, setCorrectedContent] = useState("");

  // Inutilizar
  const [inutilSeries, setInutilSeries] = useState("");
  const [inutilStart, setInutilStart] = useState("");
  const [inutilEnd, setInutilEnd] = useState("");
  const [inutilReason, setInutilReason] = useState("");

  // Contingência
  const [contingencyMode, setContingencyMode] = useState("offline");

  // Status
  const [statusProtocol, setStatusProtocol] = useState("");

  // Fetch pending NFes
  const { data: pendingNFes = [], refetch: refetchNFes } = useQuery<
    PendingNFe[]
  >({
    queryKey: ["pending-nfes"],
    queryFn: async () => {
      const res = await fetch("/api/fiscal/nfe/pending");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const apiCall = async (endpoint: string, body: any) => {
    setLoading(true);
    setResult(null);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      setResult(data);
      if (data.success || data.message) {
        toast({
          title: "Sucesso",
          description: data.message || "Operação realizada com sucesso",
        });
        refetchNFes();
      } else {
        toast({
          title: "Erro",
          description: data.error || "Erro ao processar solicitação",
          variant: "destructive",
        });
      }
    } catch (error) {
      const errorMsg =
        error instanceof Error ? error.message : "Erro desconhecido";
      setResult({ error: errorMsg });
      toast({
        title: "Erro",
        description: errorMsg,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const submitNFe = () => {
    if (!selectedNFe) {
      toast({
        title: "Erro",
        description: "Selecione uma NF-e para enviar",
        variant: "destructive",
      });
      return;
    }
    apiCall("/api/fiscal/sefaz/submit", { nfeId: selectedNFe, environment });
  };

  const cancelNFe = () => {
    if (!cancelNumber || !cancelSeries || !cancelReason.trim()) {
      toast({
        title: "Erro",
        description: "Preencha todos os campos obrigatórios",
        variant: "destructive",
      });
      return;
    }
    apiCall("/api/fiscal/sefaz/cancel", {
      nfeNumber: cancelNumber,
      nfeSeries: cancelSeries,
      reason: cancelReason,
      environment,
    });
  };

  const sendCorrectionLetter = () => {
    if (
      !correctionNumber ||
      !correctionSeries ||
      !correctionReason.trim() ||
      !correctedContent.trim()
    ) {
      toast({
        title: "Erro",
        description: "Preencha todos os campos obrigatórios",
        variant: "destructive",
      });
      return;
    }
    apiCall("/api/fiscal/sefaz/correction-letter", {
      nfeNumber: correctionNumber,
      nfeSeries: correctionSeries,
      correctionReason,
      correctedContent,
      environment,
    });
  };

  const inutilizeNumbers = () => {
    if (!inutilSeries || !inutilStart || !inutilEnd || !inutilReason.trim()) {
      toast({
        title: "Erro",
        description: "Preencha todos os campos obrigatórios",
        variant: "destructive",
      });
      return;
    }
    apiCall("/api/fiscal/sefaz/inutilize", {
      series: inutilSeries,
      startNumber: inutilStart,
      endNumber: inutilEnd,
      reason: inutilReason,
      environment,
    });
  };

  const activateContingency = () => {
    apiCall("/api/fiscal/sefaz/contingency", { mode: contingencyMode });
  };

  const testConnection = async () => {
    setLoading(true);
    setResult(null);
    try {
      const response = await fetch("/api/fiscal/sefaz/test-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ environment, uf, documentType }),
      });
      const data = await response.json();
      setResult(data);
      toast({
        title: data.success ? "Conexão OK" : "Erro",
        description: `${data.message} (${data.responseTime}ms)`,
      });
    } catch (error) {
      const errorMsg =
        error instanceof Error ? error.message : "Erro na conexão";
      setResult({ error: errorMsg });
      toast({ title: "Erro", description: errorMsg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const checkStatus = async () => {
    if (!statusProtocol.trim()) {
      toast({
        title: "Erro",
        description: "Protocolo é obrigatório",
        variant: "destructive",
      });
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const response = await fetch(
        `/api/fiscal/sefaz/status/${statusProtocol}`,
        { method: "GET" }
      );
      const data = await response.json();
      setResult(data);
      toast({
        title: data.success ? "Status OK" : "Erro",
        description: data.message || "Status consultado",
      });
    } catch (error) {
      const errorMsg =
        error instanceof Error ? error.message : "Erro ao consultar";
      setResult({ error: errorMsg });
      toast({ title: "Erro", description: errorMsg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const ResultCard = () => {
    if (!result) return null;

    return (
      <Card className="mt-4 border-blue-200 bg-blue-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {result.success ? (
              <>
                <CheckCircle className="text-green-600" size={20} />
                Sucesso
              </>
            ) : (
              <>
                <AlertCircle className="text-red-600" size={20} />
                Erro
              </>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="overflow-auto rounded bg-slate-100 p-3 text-sm">
            {JSON.stringify(result, null, 2)}
          </pre>
          {result.protocol && (
            <Button
              size="sm"
              variant="outline"
              className="mt-2"
              onClick={() => {
                navigator.clipboard.writeText(result.protocol);
                toast({
                  title: "Copiado",
                  description: "Protocolo copiado para a área de transferência",
                });
              }}
              data-testid="button-copy-protocol"
            >
              <Copy size={16} className="mr-2" /> Copiar Protocolo
            </Button>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <Layout>
      <div className="space-y-6 p-6">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-sefaz-title">
            Integração SEFAZ
          </h1>
          <p className="text-gray-600">
            Gerenciar envio e autorização de notas fiscais
          </p>
        </div>

        <div className="flex gap-2">
          <Select value={environment} onValueChange={setEnvironment}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="homologacao">Homologação</SelectItem>
              <SelectItem value="producao">Produção</SelectItem>
            </SelectContent>
          </Select>
          <Select value={uf} onValueChange={setUf}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {UFS.map((state) => (
                <SelectItem key={state} value={state}>
                  {state}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={documentType}
            onValueChange={(value) =>
              setDocumentType(value === "nfce" ? "nfce" : "nfe")
            }
          >
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="nfe">NF-e</SelectItem>
              <SelectItem value="nfce">NFC-e</SelectItem>
            </SelectContent>
          </Select>
          <Button
            onClick={testConnection}
            disabled={loading}
            variant="outline"
            data-testid="button-test-connection"
          >
            {loading ? (
              <Loader className="mr-2 animate-spin" size={16} />
            ) : null}
            Testar Conexão
          </Button>
        </div>

        <Tabs defaultValue="submit" className="w-full">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="submit">Enviar</TabsTrigger>
            <TabsTrigger value="cancel">Cancelar</TabsTrigger>
            <TabsTrigger value="correction">Correção</TabsTrigger>
            <TabsTrigger value="inutilize">Inutilizar</TabsTrigger>
            <TabsTrigger value="contingency">Contingência</TabsTrigger>
            <TabsTrigger value="status">Status</TabsTrigger>
          </TabsList>

          {/* Submeter NF-e */}
          <TabsContent value="submit">
            <Card>
              <CardHeader>
                <CardTitle>Submeter NF-e para SEFAZ</CardTitle>
                <CardDescription>
                  Selecione e envie notas fiscais criadas
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {pendingNFes.length === 0 ? (
                  <div className="rounded-lg border-2 border-dashed border-gray-300 p-8 text-center">
                    <FileText
                      className="mx-auto mb-2 text-gray-400"
                      size={40}
                    />
                    <p className="text-gray-600">
                      Nenhuma NF-e pendente de envio
                    </p>
                    <p className="text-sm text-gray-500">
                      Crie uma nota fiscal em "Documentos Fiscais" para ver aqui
                    </p>
                  </div>
                ) : (
                  <>
                    <div>
                      <label className="block text-sm font-medium mb-2">
                        Notas Fiscais Pendentes ({pendingNFes.length})
                      </label>
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {pendingNFes.map((nfe) => (
                          <div
                            key={nfe.id}
                            onClick={() => setSelectedNFe(nfe.id)}
                            className={`p-3 rounded-lg border-2 cursor-pointer transition-colors ${
                              selectedNFe === nfe.id
                                ? "border-blue-500 bg-blue-50"
                                : "border-gray-200 hover:border-gray-300"
                            }`}
                            data-testid={`nfe-card-${nfe.id}`}
                          >
                            <div className="flex justify-between items-start">
                              <div>
                                <p className="font-medium">
                                  {nfe.nfeSeries && nfe.nfeNumber
                                    ? `${nfe.nfeSeries}-${nfe.nfeNumber}`
                                    : `Venda #${nfe.saleId}`}
                                </p>
                                <p className="text-sm text-gray-600">
                                  {new Date(nfe.createdAt).toLocaleDateString(
                                    "pt-BR"
                                  )}
                                </p>
                              </div>
                              <Badge variant="outline">{nfe.status}</Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    <Button
                      onClick={submitNFe}
                      disabled={loading || !selectedNFe}
                      className="w-full"
                      data-testid="button-submit-nfe"
                    >
                      {loading ? (
                        <Loader className="mr-2 animate-spin" size={16} />
                      ) : null}
                      Enviar NF-e Selecionada
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Cancelar NF-e */}
          <TabsContent value="cancel">
            <Card>
              <CardHeader>
                <CardTitle>Cancelar NF-e</CardTitle>
                <CardDescription>
                  Cancele uma NF-e já autorizada
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Input
                  placeholder="Número da NF-e"
                  value={cancelNumber}
                  onChange={(e) => setCancelNumber(e.target.value)}
                  data-testid="input-cancel-number"
                />
                <Input
                  placeholder="Série"
                  value={cancelSeries}
                  onChange={(e) => setCancelSeries(e.target.value)}
                  data-testid="input-cancel-series"
                />
                <Textarea
                  placeholder="Motivo do cancelamento"
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  rows={4}
                  data-testid="textarea-cancel-reason"
                />
                <Button
                  onClick={cancelNFe}
                  disabled={loading}
                  className="w-full"
                  data-testid="button-cancel-nfe"
                >
                  {loading ? (
                    <Loader className="mr-2 animate-spin" size={16} />
                  ) : null}
                  Cancelar NF-e
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Carta de Correção */}
          <TabsContent value="correction">
            <Card>
              <CardHeader>
                <CardTitle>Carta de Correção</CardTitle>
                <CardDescription>
                  Envie uma carta de correção para uma NF-e
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Input
                  placeholder="Número da NF-e"
                  value={correctionNumber}
                  onChange={(e) => setCorrectionNumber(e.target.value)}
                  data-testid="input-correction-number"
                />
                <Input
                  placeholder="Série"
                  value={correctionSeries}
                  onChange={(e) => setCorrectionSeries(e.target.value)}
                  data-testid="input-correction-series"
                />
                <Textarea
                  placeholder="Motivo da correção"
                  value={correctionReason}
                  onChange={(e) => setCorrectionReason(e.target.value)}
                  rows={3}
                  data-testid="textarea-correction-reason"
                />
                <Textarea
                  placeholder="Conteúdo corrigido"
                  value={correctedContent}
                  onChange={(e) => setCorrectedContent(e.target.value)}
                  rows={5}
                  data-testid="textarea-corrected-content"
                />
                <Button
                  onClick={sendCorrectionLetter}
                  disabled={loading}
                  className="w-full"
                  data-testid="button-send-correction"
                >
                  {loading ? (
                    <Loader className="mr-2 animate-spin" size={16} />
                  ) : null}
                  Enviar Carta de Correção
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Inutilizar Numeração */}
          <TabsContent value="inutilize">
            <Card>
              <CardHeader>
                <CardTitle>Inutilizar Numeração</CardTitle>
                <CardDescription>
                  Inutilize um intervalo de números de NF-e
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Input
                  placeholder="Série"
                  value={inutilSeries}
                  onChange={(e) => setInutilSeries(e.target.value)}
                  data-testid="input-inutilize-series"
                />
                <Input
                  placeholder="Número inicial"
                  type="number"
                  value={inutilStart}
                  onChange={(e) => setInutilStart(e.target.value)}
                  data-testid="input-inutilize-start"
                />
                <Input
                  placeholder="Número final"
                  type="number"
                  value={inutilEnd}
                  onChange={(e) => setInutilEnd(e.target.value)}
                  data-testid="input-inutilize-end"
                />
                <Textarea
                  placeholder="Motivo da inutilização"
                  value={inutilReason}
                  onChange={(e) => setInutilReason(e.target.value)}
                  rows={4}
                  data-testid="textarea-inutilize-reason"
                />
                <Button
                  onClick={inutilizeNumbers}
                  disabled={loading}
                  className="w-full"
                  data-testid="button-inutilize"
                >
                  {loading ? (
                    <Loader className="mr-2 animate-spin" size={16} />
                  ) : null}
                  Inutilizar Numeração
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Contingência */}
          <TabsContent value="contingency">
            <Card>
              <CardHeader>
                <CardTitle>Modo Contingência</CardTitle>
                <CardDescription>
                  Ative o modo contingência em caso de indisponibilidade da
                  SEFAZ
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Select
                  value={contingencyMode}
                  onValueChange={setContingencyMode}
                >
                  <SelectTrigger data-testid="select-contingency-mode">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="offline">Offline (Local)</SelectItem>
                    <SelectItem value="svc">
                      SVC (Servidor Virtual Nacional)
                    </SelectItem>
                    <SelectItem value="svc_rs">SVC RS</SelectItem>
                    <SelectItem value="svc_an">
                      SVC Ambiente Nacional
                    </SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  onClick={activateContingency}
                  disabled={loading}
                  className="w-full"
                  data-testid="button-activate-contingency"
                >
                  {loading ? (
                    <Loader className="mr-2 animate-spin" size={16} />
                  ) : null}
                  Ativar Contingência
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Consultar Status */}
          <TabsContent value="status">
            <Card>
              <CardHeader>
                <CardTitle>Consultar Status</CardTitle>
                <CardDescription>
                  Consulte o status de autorização de uma NF-e
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Input
                  placeholder="Número do protocolo"
                  value={statusProtocol}
                  onChange={(e) => setStatusProtocol(e.target.value)}
                  data-testid="input-status-protocol"
                />
                <Button
                  onClick={checkStatus}
                  disabled={loading}
                  className="w-full"
                  data-testid="button-check-status"
                >
                  {loading ? (
                    <Loader className="mr-2 animate-spin" size={16} />
                  ) : null}
                  Consultar Status
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <ResultCard />
      </div>
    </Layout>
  );
}
