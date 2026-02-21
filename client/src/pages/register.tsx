import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, KeyRound, Building2 } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

export default function Register() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [form, setForm] = useState({
    email: "",
    code: "",
    password: "",
    confirmPassword: "",
  });

  const completeInviteMutation = useMutation({
    mutationFn: async (data: typeof form) => {
      const res = await fetch("/api/auth/complete-invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: data.email,
          code: data.code,
          password: data.password,
        }),
      });

      const body = await res.json();
      if (!res.ok) {
        throw new Error(body.error || "Nao foi possivel criar a senha");
      }

      return body;
    },
    onSuccess: () => {
      toast({ title: "Senha criada com sucesso" });
      setForm({ email: "", code: "", password: "", confirmPassword: "" });
      setLocation("/login");
    },
    onError: (error: any) => {
      toast({
        title: "Erro no novo acesso",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (form.code.replace(/\D/g, "").length !== 6) {
      toast({
        title: "Codigo invalido",
        description: "Informe o codigo de 6 digitos enviado por email",
        variant: "destructive",
      });
      return;
    }

    if (form.password.length < 6) {
      toast({
        title: "Senha invalida",
        description: "A senha deve ter no minimo 6 caracteres",
        variant: "destructive",
      });
      return;
    }

    if (form.password !== form.confirmPassword) {
      toast({
        title: "Senha invalida",
        description: "As senhas nao coincidem",
        variant: "destructive",
      });
      return;
    }

    completeInviteMutation.mutate(form);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-primary flex items-center justify-center">
            <Building2 className="h-6 w-6 text-primary-foreground" />
          </div>
          <CardTitle className="text-2xl">Novo acesso</CardTitle>
          <CardDescription>
            Use o codigo recebido no cadastro para criar sua senha
          </CardDescription>
        </CardHeader>

        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="code">Codigo</Label>
              <div className="relative">
                <KeyRound className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="code"
                  className="pl-10"
                  inputMode="numeric"
                  maxLength={6}
                  value={form.code}
                  onChange={(e) => {
                    const onlyDigits = e.target.value.replace(/\D/g, "").slice(0, 6);
                    setForm((prev) => ({ ...prev, code: onlyDigits }));
                  }}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Nova senha</Label>
              <Input
                id="password"
                type="password"
                value={form.password}
                onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmar senha</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={form.confirmPassword}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, confirmPassword: e.target.value }))
                }
                required
              />
            </div>
          </CardContent>

          <CardFooter className="flex flex-col gap-3">
            <Button className="w-full" type="submit" disabled={completeInviteMutation.isPending}>
              {completeInviteMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Validando...
                </>
              ) : (
                "Criar senha"
              )}
            </Button>

            <Button type="button" variant="outline" className="w-full" onClick={() => setLocation("/forgot-password")}>Esqueci minha senha</Button>
            <Button type="button" variant="outline" className="w-full" onClick={() => setLocation("/login")}>Voltar para login</Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
