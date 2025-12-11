import Layout from "@/components/layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Plus, Search, Phone, Mail, MapPin } from "lucide-react";

const CLIENTS = [
  { name: "Maria Oliveira", type: "VIP", phone: "(11) 99999-9999", email: "maria@email.com", lastPurchase: "11/12/2025" },
  { name: "José Silva", type: "Regular", phone: "(11) 98888-8888", email: "jose@email.com", lastPurchase: "10/12/2025" },
  { name: "Ana Santos", type: "Novo", phone: "(11) 97777-7777", email: "ana@email.com", lastPurchase: "05/12/2025" },
];

const SUPPLIERS = [
  { name: "Distribuidora Alimentos S.A.", contact: "Carlos", phone: "(11) 3333-3333", email: "pedidos@distribuidora.com" },
  { name: "Bebidas Premium Ltda", contact: "Fernanda", phone: "(11) 3333-4444", email: "vendas@bebidas.com" },
  { name: "Hortifruti Frescor", contact: "Roberto", phone: "(11) 3333-5555", email: "roberto@hortifruti.com" },
];

export default function Contacts() {
  return (
    <Layout>
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-heading font-bold tracking-tight text-foreground">Clientes & Fornecedores</h1>
            <p className="text-muted-foreground">Gerencie sua base de contatos.</p>
          </div>
        </div>

        <Tabs defaultValue="clients" className="space-y-4">
          <TabsList>
            <TabsTrigger value="clients">Clientes</TabsTrigger>
            <TabsTrigger value="suppliers">Fornecedores</TabsTrigger>
          </TabsList>

          <TabsContent value="clients" className="space-y-4">
            <div className="flex justify-between items-center bg-card p-4 rounded-lg border border-border">
              <div className="relative w-full max-w-sm">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Buscar clientes..." className="pl-9" />
              </div>
              <Button>
                <Plus className="mr-2 h-4 w-4" /> Novo Cliente
              </Button>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {CLIENTS.map((client, i) => (
                <Card key={i}>
                  <CardHeader className="flex flex-row items-center gap-4">
                    <Avatar>
                      <AvatarFallback>{client.name.substring(0,2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div>
                      <CardTitle className="text-base">{client.name}</CardTitle>
                      <CardDescription>{client.type}</CardDescription>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Phone className="h-4 w-4" /> {client.phone}
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Mail className="h-4 w-4" /> {client.email}
                    </div>
                    <div className="pt-2 border-t border-border mt-2">
                      <p className="text-xs text-muted-foreground">Última compra: {client.lastPurchase}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="suppliers" className="space-y-4">
            <div className="flex justify-between items-center bg-card p-4 rounded-lg border border-border">
              <div className="relative w-full max-w-sm">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Buscar fornecedores..." className="pl-9" />
              </div>
              <Button>
                <Plus className="mr-2 h-4 w-4" /> Novo Fornecedor
              </Button>
            </div>

             <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {SUPPLIERS.map((supplier, i) => (
                <Card key={i}>
                  <CardHeader>
                    <CardTitle className="text-base">{supplier.name}</CardTitle>
                    <CardDescription>Contato: {supplier.contact}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Phone className="h-4 w-4" /> {supplier.phone}
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Mail className="h-4 w-4" /> {supplier.email}
                    </div>
                    <div className="pt-2 border-t border-border mt-2">
                      <Button variant="outline" size="sm" className="w-full">Ver Pedidos</Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
