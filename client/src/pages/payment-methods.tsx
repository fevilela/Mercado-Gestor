import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import Layout from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

type PaymentMethodType = "pix" | "credito" | "debito" | "dinheiro" | "outros";
type TefMethod = "pix" | "credito" | "debito";

type PaymentMethod = {
  id: number;
  name: string;
  type: PaymentMethodType;
  nfceCode?: string | null;
  tefMethod?: TefMethod | null;
  isActive?: boolean | null;
  sortOrder?: number | null;
};

const inferTefByType = (
  type: PaymentMethodType
): TefMethod | undefined => {
  if (type === "pix" || type === "credito" || type === "debito") {
    return type;
  }
  return undefined;
};

const typeLabels: Record<PaymentMethodType, string> = {
  pix: "PIX",
  credito: "Cartao de Credito",
  debito: "Cartao de Debito",
  dinheiro: "Dinheiro",
  outros: "Outros",
};

export default function PaymentMethodsPage() {
  const { toast } = useToast();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({
    name: "",
    type: "pix" as PaymentMethodType,
    tefMethod: "pix" as TefMethod | "",
    nfceCode: "",
    sortOrder: 0,
    isActive: true,
  });

  const { data: methods = [], refetch } = useQuery<PaymentMethod[]>({
    queryKey: ["/api/payment-methods"],
    queryFn: async () => {
      const res = await fetch("/api/payment-methods");
      if (!res.ok) throw new Error("Falha ao carregar formas de pagamento");
      return res.json();
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const inferredTefMethod = inferTefByType(form.type);
      const payload = {
        name: form.name.trim(),
        type: form.type,
        tefMethod: tefEnabled
          ? ((form.tefMethod as TefMethod) || inferredTefMethod)
          : undefined,
        nfceCode: form.nfceCode.trim() || undefined,
        sortOrder: Number(form.sortOrder) || 0,
        isActive: form.isActive,
      };
      const res = await fetch(
        editingId ? `/api/payment-methods/${editingId}` : "/api/payment-methods",
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.error || "Falha ao salvar");
      }
      return res.json();
    },
    onSuccess: () => {
      refetch();
      setEditingId(null);
      setForm({
        name: "",
        type: "pix",
        tefMethod: "pix",
        nfceCode: "",
        sortOrder: 0,
        isActive: true,
      });
      toast({
        title: "Salvo",
        description: "Forma de pagamento salva com sucesso.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error?.message || "Falha ao salvar",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/payment-methods/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.error || "Falha ao excluir");
      }
      return res.json();
    },
    onSuccess: () => {
      refetch();
      toast({ title: "Excluido", description: "Forma de pagamento removida." });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error?.message || "Falha ao excluir",
        variant: "destructive",
      });
    },
  });

  const startEdit = (method: PaymentMethod) => {
    const inferredTefMethod = inferTefByType(method.type);
    setEditingId(method.id);
    setForm({
      name: method.name || "",
      type: method.type,
      tefMethod: (method.tefMethod as TefMethod) || inferredTefMethod || "",
      nfceCode: method.nfceCode || "",
      sortOrder: method.sortOrder || 0,
      isActive: method.isActive !== false,
    });
  };

  const resetForm = () => {
    setEditingId(null);
    setForm({
      name: "",
      type: "pix",
      tefMethod: "pix",
      nfceCode: "",
      sortOrder: 0,
      isActive: true,
    });
  };

  const tefEnabled = ["pix", "credito", "debito"].includes(form.type);

  return (
    <Layout>
      <div className="space-y-6 p-6">
        <div>
          <h1 className="text-3xl font-bold">Formas de Pagamento</h1>
          <p className="text-muted-foreground">
            Cadastre as formas de pagamento exibidas no PDV.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{editingId ? "Editar" : "Nova"} forma</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Nome</label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Ex: Dinheiro, PIX, Credito"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Tipo</label>
                <Select
                  value={form.type}
                  onValueChange={(value) =>
                    setForm((prev) => {
                      const nextType = value as PaymentMethodType;
                      const inferredTefMethod = inferTefByType(nextType);
                      return {
                        ...prev,
                        type: nextType,
                        tefMethod: inferredTefMethod || "",
                      };
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(typeLabels).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Codigo NFC-e</label>
                <Input
                  value={form.nfceCode}
                  onChange={(e) => setForm({ ...form, nfceCode: e.target.value })}
                  placeholder="Ex: 01"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Metodo TEF</label>
                <Select
                  value={form.tefMethod}
                  onValueChange={(value) =>
                    setForm({ ...form, tefMethod: value as TefMethod })
                  }
                  disabled={!tefEnabled}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Nao usa TEF" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pix">PIX</SelectItem>
                    <SelectItem value="credito">Credito</SelectItem>
                    <SelectItem value="debito">Debito</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Ordem</label>
                <Input
                  type="number"
                  value={form.sortOrder}
                  onChange={(e) =>
                    setForm({ ...form, sortOrder: Number(e.target.value) })
                  }
                />
              </div>
              <div className="flex items-center gap-3 pt-6">
                <Switch
                  checked={form.isActive}
                  onCheckedChange={(checked) =>
                    setForm({ ...form, isActive: checked })
                  }
                />
                <span className="text-sm">Ativo no PDV</span>
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={() => saveMutation.mutate()}
                disabled={!form.name.trim()}
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
            <CardTitle>Formas cadastradas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {methods.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhuma forma cadastrada.
              </p>
            ) : (
              <div className="space-y-2">
                {methods.map((method) => (
                  <div
                    key={method.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded border p-3"
                  >
                    <div>
                      <div className="font-medium">{method.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {typeLabels[method.type]} • NFC-e:{" "}
                        {method.nfceCode || "-"} • TEF:{" "}
                        {method.tefMethod || "Nao"}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => startEdit(method)}
                      >
                        Editar
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => deleteMutation.mutate(method.id)}
                      >
                        Excluir
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
