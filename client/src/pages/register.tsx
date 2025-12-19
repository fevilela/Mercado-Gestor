import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Building2, User, Mail, Lock, Phone, MapPin } from "lucide-react";

export default function Register() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [loadingCNPJ, setLoadingCNPJ] = useState(false);
  const [formData, setFormData] = useState({
    cnpj: "",
    razaoSocial: "",
    nomeFantasia: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    state: "",
    zipCode: "",
    adminName: "",
    adminEmail: "",
    adminPassword: "",
    confirmPassword: "",
  });

  const registerMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Erro ao cadastrar empresa");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Empresa cadastrada com sucesso!" });
      setLocation("/");
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao cadastrar",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const formatCNPJ = (value: string) => {
    const numbers = value.replace(/\D/g, "");
    return numbers
      .replace(/^(\d{2})(\d)/, "$1.$2")
      .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/\.(\d{3})(\d)/, ".$1/$2")
      .replace(/(\d{4})(\d)/, "$1-$2")
      .slice(0, 18);
  };

  const handleCNPJChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCNPJ(e.target.value);
    setFormData((prev) => ({ ...prev, cnpj: formatted }));
  };

  const fetchCNPJData = async (e: React.FocusEvent<HTMLInputElement>) => {
    const cnpj = e.target.value.replace(/\D/g, "");

    if (cnpj.length !== 14) {
      return;
    }

    setLoadingCNPJ(true);
    try {
      const response = await fetch(
        `https://www.receitaws.com.br/v1/cnpj/${cnpj}`
      );
      if (response.ok) {
        const data = await response.json();
        if (data.status === "OK") {
          setFormData((prev) => ({
            ...prev,
            razaoSocial: data.nome || "",
            nomeFantasia: data.fantasia || "",
            email: data.email || prev.email,
            phone: data.telefone || prev.phone,
            address: data.logradouro || "",
            city: data.municipio || "",
            state: data.uf || "",
            zipCode: data.cep || "",
          }));
          toast({
            title: "Dados encontrados!",
            description: "Informações do CNPJ preenchidas automaticamente.",
          });
        }
      }
    } catch (error) {
      console.error("Erro ao buscar CNPJ:", error);
    } finally {
      setLoadingCNPJ(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (formData.adminPassword !== formData.confirmPassword) {
      toast({
        title: "Erro",
        description: "As senhas nao coincidem",
        variant: "destructive",
      });
      return;
    }

    if (formData.adminPassword.length < 6) {
      toast({
        title: "Erro",
        description: "A senha deve ter no minimo 6 caracteres",
        variant: "destructive",
      });
      return;
    }

    registerMutation.mutate(formData);
  };

  const nextStep = () => {
    if (step === 1 && (!formData.cnpj || !formData.razaoSocial)) {
      toast({
        title: "Preencha os campos obrigatorios",
        description: "CNPJ e Razao Social sao obrigatorios",
        variant: "destructive",
      });
      return;
    }
    if (
      step === 2 &&
      (!formData.adminName || !formData.adminEmail || !formData.adminPassword)
    ) {
      toast({
        title: "Preencha os campos obrigatorios",
        description: "Nome, Email e Senha sao obrigatorios",
        variant: "destructive",
      });
      return;
    }
    setStep((prev) => prev + 1);
  };

  const prevStep = () => setStep((prev) => prev - 1);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-primary flex items-center justify-center">
            <Building2 className="h-6 w-6 text-primary-foreground" />
          </div>
          <CardTitle className="text-2xl" data-testid="text-register-title">
            Cadastrar Empresa
          </CardTitle>
          <CardDescription>
            {step === 1 && "Dados da empresa"}
            {step === 2 && "Dados do administrador"}
            {step === 3 && "Endereco (opcional)"}
          </CardDescription>
          <div className="flex justify-center gap-2 mt-4">
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                className={`h-2 w-8 rounded-full ${
                  s <= step ? "bg-primary" : "bg-muted"
                }`}
              />
            ))}
          </div>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {step === 1 && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="cnpj">CNPJ *</Label>
                  <div className="relative">
                    <Input
                      id="cnpj"
                      name="cnpj"
                      placeholder="00.000.000/0000-00"
                      value={formData.cnpj}
                      onChange={handleCNPJChange}
                      onBlur={fetchCNPJData}
                      required
                      data-testid="input-cnpj"
                    />
                    {loadingCNPJ && (
                      <div className="absolute right-3 top-3">
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      </div>
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="razaoSocial">Razao Social *</Label>
                  <Input
                    id="razaoSocial"
                    name="razaoSocial"
                    placeholder="Nome oficial da empresa"
                    value={formData.razaoSocial}
                    onChange={handleChange}
                    required
                    data-testid="input-razao-social"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="nomeFantasia">Nome Fantasia</Label>
                  <Input
                    id="nomeFantasia"
                    name="nomeFantasia"
                    placeholder="Nome comercial"
                    value={formData.nomeFantasia}
                    onChange={handleChange}
                    data-testid="input-nome-fantasia"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email da Empresa</Label>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      placeholder="empresa@email.com"
                      value={formData.email}
                      onChange={handleChange}
                      data-testid="input-company-email"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Telefone</Label>
                    <Input
                      id="phone"
                      name="phone"
                      placeholder="(11) 99999-9999"
                      value={formData.phone}
                      onChange={handleChange}
                      data-testid="input-phone"
                    />
                  </div>
                </div>
              </>
            )}

            {step === 2 && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="adminName">Nome do Administrador *</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="adminName"
                      name="adminName"
                      placeholder="Seu nome completo"
                      value={formData.adminName}
                      onChange={handleChange}
                      className="pl-10"
                      required
                      data-testid="input-admin-name"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="adminEmail">Email do Administrador *</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="adminEmail"
                      name="adminEmail"
                      type="email"
                      placeholder="admin@email.com"
                      value={formData.adminEmail}
                      onChange={handleChange}
                      className="pl-10"
                      required
                      data-testid="input-admin-email"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="adminPassword">Senha *</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="adminPassword"
                      name="adminPassword"
                      type="password"
                      placeholder="Minimo 6 caracteres"
                      value={formData.adminPassword}
                      onChange={handleChange}
                      className="pl-10"
                      required
                      data-testid="input-admin-password"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirmar Senha *</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="confirmPassword"
                      name="confirmPassword"
                      type="password"
                      placeholder="Repita a senha"
                      value={formData.confirmPassword}
                      onChange={handleChange}
                      className="pl-10"
                      required
                      data-testid="input-confirm-password"
                    />
                  </div>
                </div>
              </>
            )}

            {step === 3 && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="address">Endereco</Label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="address"
                      name="address"
                      placeholder="Rua, numero"
                      value={formData.address}
                      onChange={handleChange}
                      className="pl-10"
                      data-testid="input-address"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="city">Cidade</Label>
                    <Input
                      id="city"
                      name="city"
                      placeholder="Cidade"
                      value={formData.city}
                      onChange={handleChange}
                      data-testid="input-city"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="state">Estado</Label>
                    <Input
                      id="state"
                      name="state"
                      placeholder="UF"
                      maxLength={2}
                      value={formData.state}
                      onChange={handleChange}
                      data-testid="input-state"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="zipCode">CEP</Label>
                  <Input
                    id="zipCode"
                    name="zipCode"
                    placeholder="00000-000"
                    value={formData.zipCode}
                    onChange={handleChange}
                    data-testid="input-zipcode"
                  />
                </div>
              </>
            )}
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <div className="flex w-full gap-2">
              {step > 1 && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={prevStep}
                  className="flex-1"
                  data-testid="button-prev"
                >
                  Voltar
                </Button>
              )}
              {step < 3 ? (
                <Button
                  type="button"
                  onClick={nextStep}
                  className="flex-1"
                  data-testid="button-next"
                >
                  Proximo
                </Button>
              ) : (
                <Button
                  type="submit"
                  className="flex-1"
                  disabled={registerMutation.isPending}
                  data-testid="button-register"
                >
                  {registerMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Cadastrando...
                    </>
                  ) : (
                    "Cadastrar Empresa"
                  )}
                </Button>
              )}
            </div>
            <p className="text-sm text-muted-foreground text-center">
              Ja tem uma conta?{" "}
              <a
                href="/login"
                onClick={(e) => {
                  e.preventDefault();
                  setLocation("/login");
                }}
                className="text-primary hover:underline"
                data-testid="link-login"
              >
                Fazer login
              </a>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
