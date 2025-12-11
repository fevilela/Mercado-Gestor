import Layout from "@/components/layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";

export default function Settings() {
  return (
    <Layout>
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-3xl font-heading font-bold tracking-tight text-foreground">Configurações</h1>
          <p className="text-muted-foreground">Gerencie dados da empresa, fiscal e usuários.</p>
        </div>

        <Tabs defaultValue="company" className="space-y-4">
          <TabsList>
            <TabsTrigger value="company">Dados da Empresa</TabsTrigger>
            <TabsTrigger value="fiscal">Fiscal & Tributário</TabsTrigger>
            <TabsTrigger value="users">Usuários</TabsTrigger>
            <TabsTrigger value="backup">Backup & Segurança</TabsTrigger>
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
        </Tabs>
      </div>
    </Layout>
  );
}
