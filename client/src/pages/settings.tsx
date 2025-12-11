import Layout from "@/components/layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { CreditCard, Smartphone } from "lucide-react";

export default function Settings() {
  return (
    <Layout>
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-3xl font-heading font-bold tracking-tight text-foreground">Configurações</h1>
          <p className="text-muted-foreground">Gerencie dados da empresa, fiscal e usuários.</p>
        </div>

        <Tabs defaultValue="payments" className="space-y-4">
          <TabsList>
            <TabsTrigger value="company">Dados da Empresa</TabsTrigger>
            <TabsTrigger value="fiscal">Fiscal & Tributário</TabsTrigger>
            <TabsTrigger value="payments">Pagamentos & TEF</TabsTrigger>
            <TabsTrigger value="users">Usuários</TabsTrigger>
          </TabsList>

          <TabsContent value="company">
            <Card>
              <CardHeader>
                <CardTitle>Informações do Estabelecimento</CardTitle>
                <CardDescription>Dados que aparecerão nos relatórios e cupons.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="cnpj">CNPJ</Label>
                    <Input id="cnpj" placeholder="00.000.000/0000-00" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ie">Inscrição Estadual</Label>
                    <Input id="ie" placeholder="000.000.000.000" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="name">Razão Social</Label>
                  <Input id="name" placeholder="Minha Empresa LTDA" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fantasy">Nome Fantasia</Label>
                  <Input id="fantasy" placeholder="Mercado Modelo" />
                </div>
                <Button>Salvar Alterações</Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="fiscal">
            <Card>
              <CardHeader>
                <CardTitle>Configuração Fiscal (NFC-e / SAT)</CardTitle>
                <CardDescription>Parâmetros para emissão de documentos fiscais.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between space-x-2">
                  <div className="space-y-0.5">
                    <Label className="text-base">Ambiente de Produção</Label>
                    <p className="text-sm text-muted-foreground">
                      Ativar emissão real de notas (com valor fiscal).
                    </p>
                  </div>
                  <Switch />
                </div>
                <Separator />
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Token CSC (Código de Segurança do Contribuinte)</Label>
                    <Input type="password" value="••••••••••••••••" />
                  </div>
                  <div className="space-y-2">
                    <Label>ID do Token</Label>
                    <Input value="000001" className="w-24" />
                  </div>
                </div>
                <div className="space-y-2">
                   <Label>Certificado Digital (A1)</Label>
                   <div className="flex gap-2">
                     <Input type="file" className="cursor-pointer" />
                     <Button variant="outline">Carregar</Button>
                   </div>
                   <p className="text-xs text-muted-foreground">Válido até: 15/08/2026</p>
                </div>
                <Button>Testar Comunicação SEFAZ</Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="payments">
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader className="flex flex-row items-center gap-4 space-y-0">
                  <div className="h-10 w-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
                    <CreditCard className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle>Integração Stone</CardTitle>
                    <CardDescription>Configuração de Maquininha (TEF/POS)</CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between space-x-2">
                    <Label>Ativar Integração</Label>
                    <Switch />
                  </div>
                  <div className="space-y-2">
                    <Label>Stone Code / ID da Loja</Label>
                    <Input placeholder="123456789" />
                  </div>
                  <div className="space-y-2">
                    <Label>Tipo de Conexão</Label>
                    <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50">
                      <option>Integrado (TEF - Valor vai automático)</option>
                      <option>Manual (POS - Digitar valor na máquina)</option>
                    </select>
                  </div>
                  <Button className="w-full bg-emerald-600 hover:bg-emerald-700">Testar Conexão Stone</Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center gap-4 space-y-0">
                  <div className="h-10 w-10 rounded-full bg-sky-100 flex items-center justify-center text-sky-600">
                    <Smartphone className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle>Mercado Pago</CardTitle>
                    <CardDescription>Point Smart & QR Code</CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between space-x-2">
                    <Label>Ativar Integração</Label>
                    <Switch />
                  </div>
                  <div className="space-y-2">
                    <Label>Access Token (Integração)</Label>
                    <Input type="password" placeholder="APP_USR-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" />
                  </div>
                  <div className="space-y-2">
                    <Label>ID do Terminal (Point)</Label>
                    <Input placeholder="POINT-123456" />
                  </div>
                  <Button className="w-full bg-sky-500 hover:bg-sky-600">Vincular Maquininha</Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
