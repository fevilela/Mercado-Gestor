import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { useQuery, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import Layout from "@/components/layout";

interface SequentialNumbering {
  id: number;
  documentType: string;
  series: number;
  rangeStart: number;
  rangeEnd: number;
  currentNumber: number;
  authorization?: string;
  authorizedAt?: string;
  expiresAt?: string;
  environment: string;
  isActive: boolean;
}

export default function SequentialNumberingConfig() {
  const [formData, setFormData] = useState({
    documentType: "NF-e",
    series: 1,
    rangeStart: 1,
    rangeEnd: 999999,
    authorization: "",
    authorizedAt: "",
    expiresAt: "",
    environment: "homologacao",
  });

  const { data: numberings = [], refetch } = useQuery({
    queryKey: ["/api/sequential-numbering"],
    queryFn: async () => {
      const res = await fetch("/api/sequential-numbering");
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/sequential-numbering", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to create");
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success("Numeração criada com sucesso!");
      refetch();
      setFormData({
        documentType: "NF-e",
        series: 1,
        rangeStart: 1,
        rangeEnd: 999999,
        authorization: "",
        authorizedAt: "",
        expiresAt: "",
        environment: "homologacao",
      });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(formData);
  };

  const getStatusColor = (numbering: SequentialNumbering) => {
    const used = numbering.currentNumber - numbering.rangeStart;
    const total = numbering.rangeEnd - numbering.rangeStart + 1;
    const percentage = (used / total) * 100;

    if (percentage >= 90) return "text-red-600";
    if (percentage >= 70) return "text-yellow-600";
    return "text-green-600";
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">
            Numeração Sequencial Autorizada (NSA)
          </h1>
          <p className="text-gray-600 mt-2">
            Gerencie os ranges de numeração para documentos fiscais (NF-e,
            NFC-e, NFS-e, etc.)
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Form */}
          <Card>
            <CardHeader>
              <CardTitle>Nova Numeração</CardTitle>
              <CardDescription>
                Configure um novo range de numeração
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="documentType">Tipo de Documento</Label>
                  <Select
                    value={formData.documentType}
                    onValueChange={(value) =>
                      setFormData({ ...formData, documentType: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NF-e">
                        NF-e (Nota Fiscal Eletrônica)
                      </SelectItem>
                      <SelectItem value="NFC-e">
                        NFC-e (Nota Fiscal de Consumidor)
                      </SelectItem>
                      <SelectItem value="NFS-e">
                        NFS-e (Nota Fiscal de Serviço)
                      </SelectItem>
                      <SelectItem value="CT-e">
                        CT-e (Conhecimento de Transporte)
                      </SelectItem>
                      <SelectItem value="MDF-e">
                        MDF-e (Manifesto de Documento Fiscal)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="series">Série</Label>
                  <Input
                    id="series"
                    type="number"
                    min="1"
                    max="999"
                    value={formData.series}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        series: parseInt(e.target.value),
                      })
                    }
                    data-testid="input-series"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="rangeStart">Número Inicial</Label>
                    <Input
                      id="rangeStart"
                      type="number"
                      min="1"
                      value={formData.rangeStart}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          rangeStart: parseInt(e.target.value),
                        })
                      }
                      data-testid="input-range-start"
                    />
                  </div>
                  <div>
                    <Label htmlFor="rangeEnd">Número Final</Label>
                    <Input
                      id="rangeEnd"
                      type="number"
                      value={formData.rangeEnd}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          rangeEnd: parseInt(e.target.value),
                        })
                      }
                      data-testid="input-range-end"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="authorization">
                    Protocolo de Autorização (SEFAZ)
                  </Label>
                  <Input
                    id="authorization"
                    placeholder="Ex: 123456789012345"
                    value={formData.authorization}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        authorization: e.target.value,
                      })
                    }
                    data-testid="input-authorization"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="authorizedAt">Data de Autorização</Label>
                    <Input
                      id="authorizedAt"
                      type="datetime-local"
                      value={formData.authorizedAt}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          authorizedAt: e.target.value,
                        })
                      }
                      data-testid="input-authorized-at"
                    />
                  </div>
                  <div>
                    <Label htmlFor="expiresAt">Data de Expiração</Label>
                    <Input
                      id="expiresAt"
                      type="datetime-local"
                      value={formData.expiresAt}
                      onChange={(e) =>
                        setFormData({ ...formData, expiresAt: e.target.value })
                      }
                      data-testid="input-expires-at"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="environment">Ambiente</Label>
                  <Select
                    value={formData.environment}
                    onValueChange={(value) =>
                      setFormData({ ...formData, environment: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="homologacao">
                        Homologação (Testes)
                      </SelectItem>
                      <SelectItem value="producao">Produção</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="w-full"
                  data-testid="button-create-numbering"
                >
                  {createMutation.isPending ? "Criando..." : "Criar Numeração"}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Stats */}
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Resumo</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div>
                  <span className="text-sm text-gray-600">
                    Total de Numerações:{" "}
                  </span>
                  <span
                    className="text-2xl font-bold"
                    data-testid="text-total-numbering"
                  >
                    {numberings.length}
                  </span>
                </div>
                <div>
                  <span className="text-sm text-gray-600">Ativas: </span>
                  <span
                    className="text-xl font-semibold"
                    data-testid="text-active-count"
                  >
                    {
                      numberings.filter((n: SequentialNumbering) => n.isActive)
                        .length
                    }
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Table */}
        <Card>
          <CardHeader>
            <CardTitle>Numerações Cadastradas</CardTitle>
            <CardDescription>
              Ranged de números autorizados pelo SEFAZ
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Série</TableHead>
                    <TableHead>Intervalo</TableHead>
                    <TableHead>Uso</TableHead>
                    <TableHead>Protocolo</TableHead>
                    <TableHead>Ambiente</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {numberings.map((n: SequentialNumbering) => {
                    const used = n.currentNumber - n.rangeStart;
                    const total = n.rangeEnd - n.rangeStart + 1;
                    const percentage = ((used / total) * 100).toFixed(1);

                    return (
                      <TableRow
                        key={n.id}
                        data-testid={`row-numbering-${n.id}`}
                      >
                        <TableCell className="font-medium">
                          {n.documentType}
                        </TableCell>
                        <TableCell>{n.series}</TableCell>
                        <TableCell>
                          {n.rangeStart.toLocaleString()} -{" "}
                          {n.rangeEnd.toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="text-sm">
                              {used}/{total} ({percentage}%)
                            </div>
                            <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                              <div
                                className={`h-full ${
                                  parseFloat(percentage) >= 90
                                    ? "bg-red-500"
                                    : parseFloat(percentage) >= 70
                                    ? "bg-yellow-500"
                                    : "bg-green-500"
                                }`}
                                style={{ width: `${percentage}%` }}
                              />
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs">
                          {n.authorization || "-"}
                        </TableCell>
                        <TableCell>
                          <span className="text-xs bg-gray-100 px-2 py-1 rounded">
                            {n.environment === "homologacao"
                              ? "Homolog."
                              : "Prod."}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span
                            className={`text-sm font-medium ${getStatusColor(
                              n
                            )}`}
                          >
                            {n.isActive ? "✓ Ativa" : "✗ Inativa"}
                          </span>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {numberings.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={7}
                        className="text-center py-4 text-gray-500"
                      >
                        Nenhuma numeração configurada
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
