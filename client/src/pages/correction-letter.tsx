import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
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
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { AlertCircle, Loader2, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface FiscalDocumentOption {
  id: number;
  customerName: string;
  total: string;
  nfceStatus?: string | null;
  nfceProtocol?: string | null;
  nfceKey?: string | null;
  createdAt: string;
}

export default function CorrectionLetterPage() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const [searchOpen, setSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDocument, setSelectedDocument] =
    useState<FiscalDocumentOption | null>(null);
  const [correctionText, setCorrectionText] = useState("");
  const [sequence, setSequence] = useState("1");

  const { data: sales = [] } = useQuery<FiscalDocumentOption[]>({
    queryKey: ["/api/sales"],
    queryFn: async () => {
      const res = await fetch("/api/sales");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const documents = useMemo(
    () =>
      sales.filter((sale) => {
        const key = String(sale.nfceKey || "").replace(/\D/g, "");
        return key.length === 44;
      }),
    [sales]
  );

  const filteredDocuments = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return documents.slice(0, 40);
    return documents
      .filter((doc) => {
        const customerMatch = String(doc.customerName || "")
          .toLowerCase()
          .includes(term);
        const keyMatch = String(doc.nfceKey || "")
          .toLowerCase()
          .includes(term);
        return customerMatch || keyMatch;
      })
      .slice(0, 40);
  }, [documents, searchTerm]);

  const submitMutation = useMutation({
    mutationFn: async ({
      accessKey,
      correctedContent,
      seq,
    }: {
      accessKey: string;
      correctedContent: string;
      seq: number;
    }) => {
      const res = await fetch("/api/fiscal/sefaz/correction-letter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accessKey,
          correctedContent,
          correctionReason: correctedContent,
          sequence: seq,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Falha ao enviar carta de correcao");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Sucesso",
        description: "Carta de correcao enviada com sucesso.",
      });
    },
    onError: (error) => {
      toast({
        title: "Erro",
        description:
          error instanceof Error ? error.message : "Falha ao enviar carta de correcao.",
        variant: "destructive",
      });
    },
  });

  const isCorrectionInvalid = correctionText.trim().length < 15;
  const missingRequired = !selectedDocument || isCorrectionInvalid;

  const handleSave = (resetAfterSave: boolean) => {
    if (!selectedDocument) {
      toast({
        title: "Erro",
        description: "Selecione um documento fiscal.",
        variant: "destructive",
      });
      return;
    }

    if (isCorrectionInvalid) {
      toast({
        title: "Erro",
        description: "A correcao precisa ter no minimo 15 caracteres.",
        variant: "destructive",
      });
      return;
    }

    submitMutation.mutate(
      {
        accessKey: String(selectedDocument.nfceKey || ""),
        correctedContent: correctionText.trim(),
        seq: Number(sequence || "1"),
      },
      {
        onSuccess: () => {
          if (resetAfterSave) {
            setCorrectionText("");
            setSequence("1");
          }
        },
      }
    );
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Carta de Correcao</h1>
          <p className="text-muted-foreground">
            Preencha os dados da carta de correcao eletronica
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Dados da Carta de Correcao</CardTitle>
            <CardDescription>
              Preencha os dados da carta de correcao eletronica
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Documento Fiscal *</Label>
              <Popover open={searchOpen} onOpenChange={setSearchOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal"
                    data-testid="button-select-fiscal-document"
                  >
                    <Search className="mr-2 h-4 w-4 text-muted-foreground" />
                    {selectedDocument
                      ? `${selectedDocument.customerName} - ${selectedDocument.nfceKey}`
                      : "Nenhum registro..."}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[700px] p-0" align="start">
                  <div className="space-y-2 p-3">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        className="pl-8"
                        placeholder="Buscar por cliente ou chave"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                      />
                    </div>
                    <div className="max-h-64 space-y-1 overflow-y-auto">
                      {filteredDocuments.length === 0 && (
                        <p className="px-2 py-3 text-sm text-muted-foreground">
                          Nenhum documento fiscal encontrado.
                        </p>
                      )}
                      {filteredDocuments.map((doc) => (
                        <button
                          key={doc.id}
                          type="button"
                          onClick={() => {
                            setSelectedDocument(doc);
                            setSearchOpen(false);
                            setSearchTerm("");
                          }}
                          className="w-full rounded-md border px-3 py-2 text-left hover:bg-accent"
                          data-testid={`option-fiscal-document-${doc.id}`}
                        >
                          <p className="text-sm font-medium">{doc.customerName}</p>
                          <p className="text-xs text-muted-foreground">
                            Chave: {doc.nfceKey}
                          </p>
                          <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                            <span>Total: R$ {doc.total}</span>
                            <span>{new Date(doc.createdAt).toLocaleString("pt-BR")}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>Correcao *</Label>
              <Textarea
                value={correctionText}
                onChange={(e) => setCorrectionText(e.target.value)}
                placeholder="Descreva a correcao a ser realizada..."
                className="min-h-[120px]"
                data-testid="textarea-correction-letter"
              />
              <p className="text-xs text-muted-foreground">
                Minimo de 15 caracteres. Descreva detalhadamente a correcao necessaria.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Sequencia do evento</Label>
                <Input
                  type="number"
                  min={1}
                  max={20}
                  value={sequence}
                  onChange={(e) => setSequence(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Status do documento</Label>
                <div className="h-10 rounded-md border px-3 py-2 text-sm">
                  {selectedDocument?.nfceStatus || "-"}
                </div>
              </div>
            </div>

            <Card className="bg-muted/30">
              <CardContent className="pt-6 text-sm">
                <p className="mb-3 font-semibold">Informacoes Importantes</p>
                <p className="font-medium">A Carta de Correcao pode ser utilizada para:</p>
                <ul className="mb-4 list-disc pl-6">
                  <li>Corrigir erros em dados cadastrais</li>
                  <li>Corrigir dados do transportador</li>
                  <li>Corrigir dados de cobranca</li>
                  <li>Corrigir observacoes e informacoes complementares</li>
                </ul>
                <p className="font-medium">A Carta de Correcao NAO pode ser utilizada para:</p>
                <ul className="list-disc pl-6">
                  <li>Alterar valores (produtos, impostos, totais)</li>
                  <li>Alterar dados de produtos ou servicos</li>
                  <li>Modificar a natureza da operacao</li>
                  <li>Alterar o destinatario</li>
                  <li>Alterar data de emissao ou saida</li>
                </ul>
              </CardContent>
            </Card>
          </CardContent>
        </Card>

        <div className="sticky bottom-0 flex items-center justify-between rounded-md border bg-background/95 p-3 backdrop-blur">
          <Button variant="outline" onClick={() => setLocation("/sefaz")}>
            Fechar
          </Button>

          <div className="flex items-center gap-2">
            {missingRequired && (
              <div className="flex items-center gap-1 text-sm text-red-600">
                <AlertCircle className="h-4 w-4" />
                <span>(*) Campos obrigatorios</span>
              </div>
            )}
            <Button
              variant="outline"
              onClick={() => handleSave(false)}
              disabled={submitMutation.isPending}
              data-testid="button-save-correction-letter"
            >
              {submitMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Salvar
            </Button>
            <Button
              onClick={() => handleSave(true)}
              disabled={submitMutation.isPending}
              data-testid="button-save-and-insert-correction-letter"
            >
              {submitMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Salvar e inserir
            </Button>
          </div>
        </div>

        {selectedDocument?.nfceProtocol && (
          <div className="flex justify-end">
            <Badge variant="outline">Protocolo: {selectedDocument.nfceProtocol}</Badge>
          </div>
        )}
      </div>
    </Layout>
  );
}

