import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  Check,
  UploadCloud,
  Trash2,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import Layout from "@/components/layout";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface CertificateInfo {
  installed: boolean;
  cnpj?: string;
  subjectName?: string;
  issuer?: string;
  validFrom?: string;
  validUntil?: string;
  certificateType?: string;
  isValid?: boolean;
  message?: string;
  daysUntilExpiration?: number;
}

export function CertificateConfig() {
  const [certificateFile, setCertificateFile] = useState<File | null>(null);
  const [certificatePassword, setCertificatePassword] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  const {
    data: certificate,
    isLoading,
    refetch,
  } = useQuery<CertificateInfo>({
    queryKey: ["/api/digital-certificate"],
  });

  const uploadMutation = useMutation({
    mutationFn: async (payload: {
      certificateData: string;
      certificatePassword: string;
    }) => {
      const response = await fetch("/api/digital-certificate/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Erro ao upload do certificado");
      }

      return response.json();
    },
    onSuccess: () => {
      toast.success("Certificado digital instalado com sucesso!");
      setCertificateFile(null);
      setCertificatePassword("");
      refetch();
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Erro ao instalar certificado"
      );
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/digital-certificate", {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Erro ao remover certificado");
      }

      return response.json();
    },
    onSuccess: () => {
      toast.success("Certificado removido com sucesso");
      refetch();
    },
    onError: () => {
      toast.error("Erro ao remover certificado");
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      setCertificateFile(files[0]);
    }
  };

  const handleUpload = async () => {
    if (!certificateFile || !certificatePassword) {
      toast.error("Arquivo de certificado e senha são obrigatórios");
      return;
    }

    setIsUploading(true);
    const fileContent = await certificateFile.arrayBuffer();
    const bytes = new Uint8Array(fileContent);
    let binary = "";
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64Content = btoa(binary);

    try {
      await uploadMutation.mutateAsync({
        certificateData: base64Content,
        certificatePassword,
      });
    } finally {
      setIsUploading(false);
    }
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="space-y-4 p-4">
          <div className="h-40 animate-pulse rounded-lg bg-gray-200" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6 p-6">
        <div>
          <h1 className="text-3xl font-bold">Certificado Digital e-CNPJ</h1>
          <p className="mt-2 text-gray-600">
            Gerenciar certificado digital para assinatura de documentos fiscais
          </p>
        </div>

        {certificate?.installed ? (
          <Card className="border-blue-200 bg-blue-50">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <Check className="h-5 w-5 text-green-600" />
                  <CardTitle>Certificado Instalado</CardTitle>
                </div>
                {certificate.isValid ? (
                  <span className="rounded bg-green-100 px-3 py-1 text-sm font-medium text-green-700">
                    Válido
                  </span>
                ) : (
                  <span className="rounded bg-red-100 px-3 py-1 text-sm font-medium text-red-700">
                    Inválido
                  </span>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-600">CNPJ</p>
                  <p className="text-lg font-semibold">
                    {certificate.cnpj || "N/A"}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">Tipo</p>
                  <p className="text-lg font-semibold">
                    {certificate.certificateType || "e-CNPJ"}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 border-t pt-4">
                <div>
                  <p className="text-sm font-medium text-gray-600">
                    Válido até
                  </p>
                  <p className="text-lg font-semibold">
                    {certificate.validUntil
                      ? new Date(certificate.validUntil).toLocaleDateString(
                          "pt-BR"
                        )
                      : "N/A"}
                  </p>
                  {certificate.daysUntilExpiration && (
                    <p className="text-sm text-gray-500">
                      {certificate.daysUntilExpiration > 0
                        ? `Faltam ${certificate.daysUntilExpiration} dias`
                        : "Expirado"}
                    </p>
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">Status</p>
                  <p className="text-lg font-semibold text-gray-700">
                    {certificate.message}
                  </p>
                </div>
              </div>

              {certificate.daysUntilExpiration &&
                certificate.daysUntilExpiration < 30 && (
                  <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-3 flex gap-2">
                    <AlertTriangle className="h-5 w-5 shrink-0 text-yellow-600" />
                    <div>
                      <p className="font-medium text-yellow-900">
                        Certificado próximo do vencimento
                      </p>
                      <p className="text-sm text-yellow-700">
                        Solicite um novo certificado à autoridade certificadora
                      </p>
                    </div>
                  </div>
                )}

              <div className="flex gap-2 pt-4">
                <Button
                  variant="outline"
                  onClick={() => refetch()}
                  className="flex-1"
                  data-testid="button-refresh-certificate"
                >
                  Verificar Status
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => deleteMutation.mutate()}
                  disabled={deleteMutation.isPending}
                  className="flex-1"
                  data-testid="button-delete-certificate"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Remover
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Nenhum Certificado Instalado</CardTitle>
              <CardDescription>
                Você precisa instalar um certificado digital e-CNPJ para assinar
                documentos fiscais
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border-2 border-dashed border-gray-300 p-8 text-center">
                <UploadCloud className="mx-auto h-12 w-12 text-gray-400" />
                <p className="mt-2 font-medium text-gray-900">
                  Nenhum certificado carregado
                </p>
                <p className="text-sm text-gray-500">
                  Arraste um arquivo .p12 ou .pfx ou clique para selecionar
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {!certificate?.installed && (
          <Card>
            <CardHeader>
              <CardTitle>Instalar Certificado Digital</CardTitle>
              <CardDescription>
                Faça upload de seu certificado digital e-CNPJ em formato .p12 ou
                .pfx
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Arquivo de Certificado (.p12 ou .pfx)
                  </label>
                  <input
                    type="file"
                    accept=".p12,.pfx,.pem"
                    onChange={handleFileChange}
                    className="block w-full text-sm text-gray-500
                      file:mr-4 file:py-2 file:px-4
                      file:rounded-md file:border-0
                      file:text-sm file:font-semibold
                      file:bg-blue-50 file:text-blue-700
                      hover:file:bg-blue-100"
                    data-testid="input-certificate-file"
                  />
                  {certificateFile && (
                    <p className="mt-2 text-sm text-green-600 flex items-center gap-1">
                      <Check className="h-4 w-4" />
                      {certificateFile.name}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Senha do Certificado
                  </label>
                  <input
                    type="password"
                    value={certificatePassword}
                    onChange={(e) => setCertificatePassword(e.target.value)}
                    placeholder="Digite a senha do certificado"
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    data-testid="input-certificate-password"
                  />
                </div>

                <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 flex gap-2">
                  <AlertCircle className="h-5 w-5 flex-shrink-0 text-blue-600" />
                  <div className="text-sm text-blue-700">
                    <p className="font-medium">Informação de Segurança</p>
                    <p>
                      Seu certificado será criptografado e armazenado com
                      segurança no servidor
                    </p>
                  </div>
                </div>

                <Button
                  onClick={handleUpload}
                  disabled={
                    !certificateFile || !certificatePassword || isUploading
                  }
                  className="w-full"
                  data-testid="button-upload-certificate"
                >
                  {isUploading ? "Enviando..." : "Instalar Certificado"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="border-yellow-200 bg-yellow-50">
          <CardHeader>
            <CardTitle className="text-base">
              Sobre Certificados Digitais e-CNPJ
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-gray-700 space-y-2">
            <p>
              • O certificado digital e-CNPJ é obrigatório para assinar
              documentos fiscais (NF-e, NFC-e)
            </p>
            <p>
              • Pode ser obtido em autoridades certificadoras como Certisign,
              Serasa, AC Raiz e outras
            </p>
            <p>• O certificado deve estar em formato PKCS#12 (.p12 ou .pfx)</p>
            <p>
              • Cada empresa deve ter seu próprio certificado associado ao CNPJ
            </p>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
