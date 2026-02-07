import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";

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

export default function SefazTestPage() {
  const [environment, setEnvironment] = useState<"homologacao" | "producao">(
    "homologacao"
  );
  const [uf, setUf] = useState("SP");
  const [documentType, setDocumentType] = useState<"nfe" | "nfce">("nfe");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const testConnection = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch("/api/fiscal/sefaz/test-connection", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ environment, uf, documentType }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Erro ao testar conexão");
        return;
      }

      setResult(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Erro ao conectar com o servidor"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle data-testid="text-sefaz-test">
              Teste de Conexão SEFAZ
            </CardTitle>
            <CardDescription>
              Teste a conexão com os webservices da SEFAZ em homologação ou
              produção
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Environment Selection */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Ambiente</label>
              <div className="flex gap-4">
                <button
                  data-testid="button-homologacao"
                  onClick={() => setEnvironment("homologacao")}
                  className={`px-4 py-2 rounded border transition-colors ${
                    environment === "homologacao"
                      ? "bg-blue-500 text-white border-blue-500"
                      : "border-gray-300 hover:border-gray-400"
                  }`}
                >
                  Homologação
                </button>
                <button
                  data-testid="button-producao"
                  onClick={() => setEnvironment("producao")}
                  className={`px-4 py-2 rounded border transition-colors ${
                    environment === "producao"
                      ? "bg-red-500 text-white border-red-500"
                      : "border-gray-300 hover:border-gray-400"
                  }`}
                >
                  Produção
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">UF</label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={uf}
                onChange={(e) => setUf(e.target.value)}
              >
                {UFS.map((state) => (
                  <option key={state} value={state}>
                    {state}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Documento</label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={documentType}
                onChange={(e) =>
                  setDocumentType(e.target.value === "nfce" ? "nfce" : "nfe")
                }
              >
                <option value="nfe">NF-e</option>
                <option value="nfce">NFC-e</option>
              </select>
            </div>

            {/* Test Button */}
            <Button
              data-testid="button-test-connection"
              onClick={testConnection}
              disabled={loading}
              className="w-full"
              size="lg"
            >
              {loading ? "Testando..." : "Testar Conexão"}
            </Button>

            {/* Error Message */}
            {error && (
              <Alert variant="destructive">
                <AlertDescription data-testid="text-error">
                  {error}
                </AlertDescription>
              </Alert>
            )}

            {/* Success Result */}
            {result && (
              <div className="space-y-4">
                <Alert className="border-green-200 bg-green-50">
                  <AlertDescription
                    className="text-green-800"
                    data-testid="text-success"
                  >
                    Conexão estabelecida com sucesso!
                  </AlertDescription>
                </Alert>

                <div className="space-y-3 bg-gray-50 p-4 rounded border">
                  <div>
                    <label className="text-xs font-semibold text-gray-600">
                      Status
                    </label>
                    <p className="text-sm" data-testid="text-status">
                      <Badge variant="outline">{result.status || "OK"}</Badge>
                    </p>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-gray-600">
                      Mensagem
                    </label>
                    <p
                      className="text-sm text-gray-700"
                      data-testid="text-message"
                    >
                      {result.message}
                    </p>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-gray-600">
                      Tempo de Resposta
                    </label>
                    <p
                      className="text-sm text-gray-700"
                      data-testid="text-response-time"
                    >
                      {result.responseTime}ms
                    </p>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-gray-600">
                      Ambiente
                    </label>
                    <p
                      className="text-sm text-gray-700"
                      data-testid="text-environment"
                    >
                      {environment === "homologacao"
                        ? "Homologação"
                        : "Produção"}
                    </p>
                  </div>

                  {result.certificateRequired !== undefined && (
                    <div>
                      <label className="text-xs font-semibold text-gray-600">
                        Certificado Digital
                      </label>
                      <p className="text-sm" data-testid="text-certificate">
                        {result.certificateRequired ? (
                          <Badge variant="destructive">Obrigatório</Badge>
                        ) : (
                          <Badge variant="secondary">Opcional</Badge>
                        )}
                      </p>
                    </div>
                  )}
                </div>

                <div className="text-xs text-gray-600 bg-blue-50 p-3 rounded">
                  <p>
                    <strong>ℹ️ Dica:</strong> Em homologação, você pode testar
                    sem certificado digital. Em produção, um certificado e-CNPJ
                    válido é obrigatório.
                  </p>
                </div>
              </div>
            )}

            {/* Info Section */}
            <div className="bg-blue-50 border border-blue-200 rounded p-4 space-y-2">
              <h3 className="font-semibold text-sm text-blue-900">
                📋 Informações
              </h3>
              <ul className="text-xs text-blue-800 space-y-1 list-disc list-inside">
                <li>Teste a conexão com SEFAZ antes de emitir notas fiscais</li>
                <li>
                  Em <strong>homologação</strong>: use para testes sem riscos
                </li>
                <li>
                  Em <strong>produção</strong>: requer certificado e-CNPJ válido
                </li>
                <li>Tempo de resposta normal: 100-500ms</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
