import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Mail, Building2 } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

export default function ForgotPassword() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [form, setForm] = useState({
    cnpj: "",
    email: "",
    code: "",
    password: "",
    confirmPassword: "",
  });
  const [codeSent, setCodeSent] = useState(false);

  const requestMutation = useMutation({
    mutationFn: async (data: { cnpj: string; email: string }) => {
      const res = await fetch("/api/auth/forgot-password/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const body = await res.json();
      if (!res.ok) {
        throw new Error(body.error || "Nao foi possivel enviar o codigo");
      }
      return body;
    },
    onSuccess: (result) => {
      const emailSent = result?.passwordReset?.emailSent;
      const code = result?.passwordReset?.code;
      setCodeSent(true);
      toast({
        title: emailSent ? "Codigo enviado" : "Codigo gerado sem envio de email",
        description: emailSent
          ? "Verifique seu email"
          : code
            ? `Codigo gerado (dev): ${code}`
            : "Verifique configuracao SMTP no .env",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao solicitar codigo",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const resetMutation = useMutation({
    mutationFn: async (data: { email: string; code: string; password: string }) => {
      const res = await fetch("/api/auth/forgot-password/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const body = await res.json();
      if (!res.ok) {
        throw new Error(body.error || "Nao foi possivel redefinir a senha");
      }
      return body;
    },
    onSuccess: () => {
      toast({ title: "Senha redefinida com sucesso" });
      setLocation("/login");
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao redefinir senha",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const formatCNPJ = (value: string) => {
    const numbers = value.replace(/\D/g, "");
    return numbers
      .replace(/^(\d{2})(\d)/, "$1.$2")
      .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/\.(\d{3})(\d)/, ".$1/$2")
      .replace(/(\d{4})(\d)/, "$1-$2")
      .slice(0, 18);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-primary flex items-center justify-center">
            <Building2 className="h-6 w-6 text-primary-foreground" />
          </div>
          <CardTitle className="text-2xl">Esqueci minha senha</CardTitle>
          <CardDescription>
            Informe CNPJ e email para receber um codigo
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              requestMutation.mutate({ cnpj: form.cnpj, email: form.email });
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="cnpj">CNPJ</Label>
              <Input
                id="cnpj"
                value={form.cnpj}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, cnpj: formatCNPJ(e.target.value) }))
                }
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  className="pl-10"
                  value={form.email}
                  onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                  required
                />
              </div>
            </div>

            <Button className="w-full" type="submit" disabled={requestMutation.isPending}>
              {requestMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Enviando codigo...
                </>
              ) : (
                "Enviar codigo"
              )}
            </Button>
          </form>

          {codeSent && (
            <form
              className="space-y-3 border-t pt-3"
              onSubmit={(e) => {
                e.preventDefault();
                if (form.code.replace(/\D/g, "").length !== 6) {
                  toast({
                    title: "Codigo invalido",
                    description: "Informe o codigo de 6 digitos",
                    variant: "destructive",
                  });
                  return;
                }
                if (form.password.length < 6 || form.password !== form.confirmPassword) {
                  toast({
                    title: "Senha invalida",
                    description: "Confira a senha e confirmacao",
                    variant: "destructive",
                  });
                  return;
                }
                resetMutation.mutate({
                  email: form.email,
                  code: form.code,
                  password: form.password,
                });
              }}
            >
              <div className="space-y-2">
                <Label htmlFor="code">Codigo</Label>
                <Input
                  id="code"
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

              <Button className="w-full" type="submit" disabled={resetMutation.isPending}>
                {resetMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Redefinindo...
                  </>
                ) : (
                  "Redefinir senha"
                )}
              </Button>
            </form>
          )}
        </CardContent>

        <CardFooter className="flex flex-col gap-2">
          <Button type="button" variant="outline" className="w-full" onClick={() => setLocation("/access")}>Novo acesso</Button>
          <Button type="button" variant="outline" className="w-full" onClick={() => setLocation("/login")}>Voltar para login</Button>
        </CardFooter>
      </Card>
    </div>
  );
}
