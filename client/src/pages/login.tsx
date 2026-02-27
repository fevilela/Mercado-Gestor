import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Lock, Mail, Loader2, BriefcaseBusiness, Store, Lightbulb } from "lucide-react";

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
    <div className="h-screen overflow-hidden bg-white p-0 font-['Plus_Jakarta_Sans']">
      <div className="mx-auto grid h-full max-w-[1600px] overflow-hidden rounded-sm border border-[#d7d9e2] bg-[#efeff8] md:grid-cols-2">
        <section className="relative hidden overflow-hidden bg-[#000000] px-16 py-12 text-white md:flex md:flex-col md:justify-center">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_78%_35%,rgba(95,180,188,0.34)_0%,rgba(22,86,94,0.16)_22%,rgba(4,28,33,0.03)_54%)]" />
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(165deg,transparent_62%,rgba(83,158,168,0.18)_76%,transparent_90%)]" />
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(156deg,transparent_66%,rgba(72,142,151,0.15)_78%,transparent_90%)]" />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_10%_15%,rgba(20,76,88,0.32)_0%,rgba(5,31,36,0.2)_24%,transparent_52%)]" />

          <img
            src="/images/Arqis-branco.png"
            alt="Arqis"
            className="relative mb-8 h-12 w-auto object-contain"
          />

          <h2 className="relative text-center text-[52px] font-['Sora'] font-semibold leading-[1.06] tracking-[-0.02em]">
            A Solução Arqis
          </h2>

          <div className="relative mt-10 space-y-10">
            <div className="flex items-start gap-5">
              <div className="flex w-[58px] items-center justify-center border-r border-white/20 pr-5 pt-1">
                <BriefcaseBusiness className="h-10 w-10 stroke-[1.8] text-[#d9e4ff]" />
              </div>
              <div>
                <p className="text-[18px] font-['Sora'] font-semibold leading-none text-white">Arquitetura Centralizada</p>
                <p className="mt-2 text-[12px] leading-tight text-[#dbe3f8]">
                  Um unico ponto de verdade <span className="font-semibold text-white">para toda</span> operacao.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-5">
              <div className="flex w-[58px] items-center justify-center border-r border-white/20 pr-5 pt-1">
                <Store className="h-10 w-10 stroke-[1.8] text-[#d9e4ff]" />
              </div>
              <div>
                <p className="text-[18px] font-['Sora'] font-semibold leading-none text-white">Controle em Tempo Real</p>
                <p className="mt-2 text-[12px] leading-tight text-[#dbe3f8]">
                  Estoque, vendas e metricas com visibilidade total.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-5">
              <div className="flex w-[58px] items-center justify-center border-r border-white/20 pr-5 pt-1">
                <Lightbulb className="h-10 w-10 stroke-[1.8] text-[#d9e4ff]" />
              </div>
              <div>
                <p className="text-[18px] font-['Sora'] font-semibold leading-none text-white">Inteligencia Operacional</p>
                <p className="mt-2 text-[12px] leading-tight text-[#dbe3f8]">
                  Analises preditivas e decisoes baseadas em dados.
                </p>
              </div>
            </div>
          </div>

          <p className="relative mt-10 max-w-none whitespace-nowrap text-[18px] leading-tight text-[#dbe3f8]">
            Controle total e decisoes inteligentes para operacoes modernas.
          </p>
        </section>

        <section className="grid h-full place-items-center px-8 md:px-10">
          <div className="w-full max-w-[700px] rounded-3xl border border-[#cfd1db] bg-[#f4f4f6] px-10 py-8 shadow-[0_10px_30px_rgba(32,36,67,0.12)] md:px-14 md:py-8">
            <div className="mb-10 flex justify-center">
              <img
                src="/images/Arqis.png"
                alt="Arqis"
                className="h-14 w-auto object-contain"
                data-testid="image-login-brand"
              />
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-[14px] font-['Sora'] font-semibold text-[#151515]">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#717171]" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="seu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-12 rounded-lg border-[#c7c8cf] bg-[#f8f8f8] pl-12 text-[14px] text-[#1e1e1e] placeholder:text-[#717171]"
                    required
                    data-testid="input-email"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-[14px] font-['Sora'] font-semibold text-[#151515]">Senha</Label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#717171]" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="Sua senha"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-12 rounded-lg border-[#c7c8cf] bg-[#f8f8f8] pl-12 text-[14px] text-[#1e1e1e] placeholder:text-[#717171]"
                    required
                    data-testid="input-password"
                  />
                </div>
              </div>

              <Button
                type="submit"
                className="mt-2 h-[50px] w-full rounded-lg bg-black text-[16px] font-medium text-white hover:bg-[#111111]"
                disabled={isLoading}
                data-testid="button-login"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Entrando...
                  </>
                ) : (
                  "Entrar"
                )}
              </Button>

              <p className="text-center text-[14px] text-[#171717]">
                <a
                  href="/forgot-password"
                  onClick={(e) => {
                    e.preventDefault();
                    setLocation("/forgot-password");
                  }}
                  className="hover:underline"
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
                  className="hover:underline"
                  data-testid="link-new-access"
                >
                  Novo acesso
                </a>
              </p>

              <Button
                type="button"
                variant="outline"
                className="h-[50px] w-full rounded-lg border-[#101010] bg-transparent text-[16px] font-normal text-[#101010] hover:bg-white"
                onClick={() => setLocation("/manager-onboarding")}
                data-testid="button-manager-onboarding"
              >
                Cadastro interno de empresa
              </Button>
            </form>
          </div>
        </section>
      </div>
    </div>
  );
}


