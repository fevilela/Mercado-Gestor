import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import Layout from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";

type ReferenceType =
  | "classificacao_mercadologica"
  | "infos_adicionais"
  | "infos_complementares"
  | "infos_nutricionais"
  | "etiquetas";

type ReferenceRow = {
  id: number;
  type: ReferenceType;
  code?: string | null;
  name: string;
  description?: string | null;
  isActive?: boolean | null;
};

const tabItems: Array<{ value: ReferenceType; label: string }> = [
  {
    value: "classificacao_mercadologica",
    label: "Classificacao Mercadologica",
  },
  { value: "infos_adicionais", label: "Infos. Adicionais" },
  { value: "infos_complementares", label: "Infos. Complementares" },
  { value: "infos_nutricionais", label: "Infos. Nutricionais" },
  { value: "etiquetas", label: "Etiquetas" },
];

export default function ReferenceTablesPage() {
  const { toast } = useToast();
  const [activeType, setActiveType] = useState<ReferenceType>(
    "classificacao_mercadologica"
  );
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({
    code: "",
    name: "",
    description: "",
    isActive: true,
  });

  const listQuery = useQuery<ReferenceRow[]>({
    queryKey: ["/api/reference-tables", activeType],
    queryFn: async () => {
      const res = await fetch(`/api/reference-tables/${activeType}`);
      if (!res.ok) throw new Error("Falha ao carregar dados");
      return res.json();
    },
  });

  const refetchList = () => listQuery.refetch();

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        code: form.code.trim() || undefined,
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        isActive: form.isActive,
      };
      const isEditing = !!editingId;
      const endpoint = isEditing
        ? `/api/reference-tables/${activeType}/${editingId}`
        : `/api/reference-tables/${activeType}`;
      const res = await fetch(endpoint, {
        method: isEditing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.error || "Falha ao salvar");
      }
      return res.json();
    },
    onSuccess: () => {
      resetForm();
      refetchList();
      toast({
        title: "Salvo",
        description: "Cadastro salvo com sucesso.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/reference-tables/${activeType}/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.error || "Falha ao excluir");
      }
      return res.json();
    },
    onSuccess: () => {
      refetchList();
      toast({
        title: "Excluido",
        description: "Item removido com sucesso.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setEditingId(null);
    setForm({
      code: "",
      name: "",
      description: "",
      isActive: true,
    });
  };

  const handleTabChange = (value: string) => {
    setActiveType(value as ReferenceType);
    resetForm();
  };

  const rows = listQuery.data || [];

  return (
    <Layout>
      <div className="space-y-6 p-6">
        <div>
          <h1 className="text-3xl font-bold">Tabelas</h1>
          <p className="text-muted-foreground">
            Cadastre classificacoes e informacoes auxiliares de produtos.
          </p>
        </div>

        <Tabs value={activeType} onValueChange={handleTabChange}>
          <TabsList className="flex flex-wrap h-auto">
            {tabItems.map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value}>
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {tabItems.map((tab) => (
            <TabsContent key={tab.value} value={tab.value} className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>
                    {editingId ? "Editar item" : `Novo item - ${tab.label}`}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Codigo</label>
                      <Input
                        value={form.code}
                        onChange={(e) =>
                          setForm((prev) => ({ ...prev, code: e.target.value }))
                        }
                        placeholder="Opcional"
                      />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <label className="text-sm font-medium">Nome</label>
                      <Input
                        value={form.name}
                        onChange={(e) =>
                          setForm((prev) => ({ ...prev, name: e.target.value }))
                        }
                        placeholder="Nome do cadastro"
                      />
                    </div>
                    <div className="space-y-2 md:col-span-3">
                      <label className="text-sm font-medium">Descricao</label>
                      <Input
                        value={form.description}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            description: e.target.value,
                          }))
                        }
                        placeholder="Descricao opcional"
                      />
                    </div>
                    <div className="flex items-center gap-3 md:col-span-3">
                      <Switch
                        checked={form.isActive}
                        onCheckedChange={(checked) =>
                          setForm((prev) => ({ ...prev, isActive: checked }))
                        }
                      />
                      <span className="text-sm">Ativo</span>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      onClick={() => saveMutation.mutate()}
                      disabled={!form.name.trim() || saveMutation.isPending}
                    >
                      {editingId ? "Atualizar" : "Salvar"}
                    </Button>
                    <Button variant="outline" onClick={resetForm}>
                      Cancelar
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Itens cadastrados</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {rows.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      Nenhum item cadastrado.
                    </p>
                  )}
                  {rows.map((row) => (
                    <div
                      key={row.id}
                      className="flex flex-wrap items-center justify-between gap-3 border rounded p-3"
                    >
                      <div>
                        <p className="font-medium">{row.name}</p>
                        <p className="text-xs text-muted-foreground">
                          Cod: {row.code || "-"} | {row.description || "-"} |{" "}
                          {row.isActive === false ? "Inativo" : "Ativo"}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setEditingId(row.id);
                            setForm({
                              code: row.code || "",
                              name: row.name || "",
                              description: row.description || "",
                              isActive: row.isActive !== false,
                            });
                          }}
                        >
                          Editar
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => deleteMutation.mutate(row.id)}
                        >
                          Excluir
                        </Button>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </Layout>
  );
}
