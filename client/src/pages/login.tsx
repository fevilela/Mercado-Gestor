import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardFooter } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import {
  Lock,
  Mail,
  Loader2,
  BriefcaseBusiness,
  Store,
  Lightbulb,
} from "lucide-react";

export default function Login() {
  const [, setLocation] = useLocation();
  const { login } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      await login(email, password);
      toast({ title: "Login realizado com sucesso!" });
      setLocation("/");
    } catch (error: any) {
      toast({
        title: "Erro ao fazer login",
        description: error.message || "Verifique suas credenciais",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white p-2 sm:p-3">
      <div className="mx-auto grid min-h-[calc(100vh-1rem)] w-full max-w-[1270px] overflow-hidden rounded-md border border-slate-300/80 bg-[#eef0ff] sm:min-h-[calc(100vh-1.5rem)] md:grid-cols-[1.03fr_0.97fr]">
        <section className="relative hidden overflow-hidden bg-[radial-gradient(circle_at_24%_8%,#223d74_0%,#0f1d44_42%,#060b1f_100%)] p-12 text-slate-100 md:flex md:flex-col">
          <div className="pointer-events-none absolute -right-32 -bottom-32 h-[420px] w-[420px] rounded-full bg-blue-400/20 blur-3xl" />
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(130deg,transparent_62%,rgba(114,159,255,0.16)_76%,transparent_90%)]" />
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(160deg,transparent_70%,rgba(148,183,255,0.2)_80%,transparent_90%)]" />

          <img
            src="/images/Arqis.png"
            alt="Arqis"
            className="relative mb-14 h-8 w-auto object-contain brightness-0 invert"
          />

          <h2 className="relative text-[40px] font-semibold tracking-tight">A Solucao ARQIS</h2>

          <div className="relative mt-12 space-y-8 text-slate-200">
            <div className="flex gap-4">
              <BriefcaseBusiness className="mt-0.5 h-5 w-5 text-slate-200" />
              <div>
                <p className="font-medium text-[31px] leading-none text-white">Arquitetura Centralizada</p>
                <p className="mt-1.5 text-[19px] text-slate-300">Um unico ponto de verdade para toda operacao.</p>
              </div>
            </div>
            <div className="flex gap-4">
              <Store className="mt-0.5 h-5 w-5 text-slate-200" />
              <div>
                <p className="font-medium text-[31px] leading-none text-white">Controle em Tempo Real</p>
                <p className="mt-1.5 text-[19px] text-slate-300">Estoque, vendas e metricas com visibilidade total.</p>
              </div>
            </div>
            <div className="flex gap-4">
              <Lightbulb className="mt-0.5 h-5 w-5 text-slate-200" />
              <div>
                <p className="font-medium text-[31px] leading-none text-white">Inteligencia Operacional</p>
                <p className="mt-1.5 text-[19px] text-slate-300">Analises preditivas e decisoes baseadas em dados.</p>
              </div>
            </div>
          </div>

          <p className="relative mt-auto max-w-md text-[28px] text-slate-300">
            Controle total e decisoes inteligentes para operacoes modernas.
          </p>
        </section>

        <section className="flex items-center justify-center p-4 md:p-10">
          <Card className="w-full max-w-[468px] rounded-xl border border-slate-300/90 bg-white shadow-sm">
            <CardHeader className="pb-3 pt-8 text-center">
              <div className="mb-1 flex justify-center">
                <img
                  src="/images/Arqis.png"
                  alt="Arqis"
                  className="block h-10 w-auto object-contain"
                  data-testid="image-login-brand"
                />
              </div>
            </CardHeader>

            <form onSubmit={handleSubmit}>
              <CardContent className="space-y-4 px-8">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-[13px] text-slate-700">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="seu@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="h-[35px] border-slate-300 pl-10 text-[13px]"
                      required
                      data-testid="input-email"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password" className="text-[13px] text-slate-700">Senha</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                    <Input
                      id="password"
                      type="password"
                      placeholder="Sua senha"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="h-[35px] border-slate-300 pl-10 text-[13px]"
                      required
                      data-testid="input-password"
                    />
                  </div>
                </div>
              </CardContent>

              <CardFooter className="flex flex-col gap-3 px-8 pb-8">
                <Button
                  type="submit"
                  className="h-[35px] w-full bg-slate-950 text-[13px] text-white hover:bg-slate-800"
                  disabled={isLoading}
                  data-testid="button-login"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Entrando...
                    </>
                  ) : (
                    "Entrar"
                  )}
                </Button>

                <p className="text-[12px] text-muted-foreground text-center">
                  <a
                    href="/forgot-password"
                    onClick={(e) => {
                      e.preventDefault();
                      setLocation("/forgot-password");
                    }}
                    className="text-slate-700 hover:underline"
                    data-testid="link-forgot-password"
                  >
                    Esqueci minha senha
                  </a>
                  {" | "}
                  <a
                    href="/access"
                    onClick={(e) => {
                      e.preventDefault();
                      setLocation("/access");
                    }}
                    className="text-slate-700 hover:underline"
                    data-testid="link-new-access"
                  >
                    Novo acesso
                  </a>
                </p>

                <Button
                  type="button"
                  variant="outline"
                  className="h-[35px] w-full border-slate-500 text-[13px] text-slate-700 hover:bg-slate-50"
                  onClick={() => setLocation("/manager-onboarding")}
                  data-testid="button-manager-onboarding"
                >
                  Cadastro interno de empresa
                </Button>
              </CardFooter>
            </form>
          </Card>
        </section>
      </div>
    </div>
  );
}
