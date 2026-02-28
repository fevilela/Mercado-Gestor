import Layout from "@/components/layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Plus,
  Search,
  Phone,
  Mail,
  MapPin,
  Pencil,
  Trash2,
  Loader2,
  X,
  Users,
  Building2,
  Truck,
  AlertTriangle,
  ChevronRight,
} from "lucide-react";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Customer {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  cpfCnpj: string | null;
  type: string;
  address: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  creditLimit: string | null;
  loyaltyPoints: number | null;
  notes: string | null;
  createdAt: string;
}

interface Supplier {
  id: number;
  name: string;
  contact: string | null;
  phone: string | null;
  email: string | null;
  cnpj: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  paymentTerms: string | null;
  leadTime: number | null;
  rating: number | null;
  notes: string | null;
  createdAt: string;
}

interface Transporter {
  id: number;
  name: string;
  contact: string | null;
  phone: string | null;
  email: string | null;
  cnpjCpf: string | null;
  ie: string | null;
  rntc: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  notes: string | null;
  createdAt: string;
}

export default function Contacts() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [supplierSearchQuery, setSupplierSearchQuery] = useState("");
  const [transporterSearchQuery, setTransporterSearchQuery] = useState("");

  const [isCustomerDialogOpen, setIsCustomerDialogOpen] = useState(false);
  const [isSupplierDialogOpen, setIsSupplierDialogOpen] = useState(false);
  const [isTransporterDialogOpen, setIsTransporterDialogOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [editingTransporter, setEditingTransporter] = useState<Transporter | null>(null);
  const [deleteCustomerId, setDeleteCustomerId] = useState<number | null>(null);
  const [deleteSupplierId, setDeleteSupplierId] = useState<number | null>(null);
  const [deleteTransporterId, setDeleteTransporterId] = useState<number | null>(null);

  const [customerForm, setCustomerForm] = useState({
    name: "",
    email: "",
    phone: "",
    cpfCnpj: "",
    type: "Regular",
    address: "",
    city: "",
    state: "",
    zipCode: "",
  });

  const [supplierForm, setSupplierForm] = useState({
    name: "",
    contact: "",
    phone: "",
    email: "",
    cnpj: "",
    address: "",
    city: "",
    state: "",
    zipCode: "",
    paymentTerms: "",
  });
  const [transporterForm, setTransporterForm] = useState({
    name: "",
    contact: "",
    phone: "",
    email: "",
    cnpjCpf: "",
    ie: "",
    rntc: "",
    address: "",
    city: "",
    state: "",
    zipCode: "",
    notes: "",
  });

  const { data: customers = [], isLoading: isLoadingCustomers } = useQuery<
    Customer[]
  >({
    queryKey: ["/api/customers"],
    queryFn: async () => {
      const res = await fetch("/api/customers");
      if (!res.ok) throw new Error("Failed to fetch customers");
      return res.json();
    },
  });

  const { data: suppliers = [], isLoading: isLoadingSuppliers } = useQuery<
    Supplier[]
  >({
    queryKey: ["/api/suppliers"],
    queryFn: async () => {
      const res = await fetch("/api/suppliers");
      if (!res.ok) throw new Error("Failed to fetch suppliers");
      return res.json();
    },
  });
  const { data: transporters = [], isLoading: isLoadingTransporters } = useQuery<
    Transporter[]
  >({
    queryKey: ["/api/transporters"],
    queryFn: async () => {
      const res = await fetch("/api/transporters");
      if (!res.ok) throw new Error("Failed to fetch transporters");
      return res.json();
    },
  });

  const createCustomerMutation = useMutation({
    mutationFn: async (data: typeof customerForm) => {
      const res = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create customer");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      setIsCustomerDialogOpen(false);
      resetCustomerForm();
      toast({ title: "Cliente criado com sucesso!" });
    },
    onError: () => {
      toast({ title: "Erro ao criar cliente", variant: "destructive" });
    },
  });

  const updateCustomerMutation = useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: number;
      data: typeof customerForm;
    }) => {
      const res = await fetch(`/api/customers/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update customer");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      setIsCustomerDialogOpen(false);
      setEditingCustomer(null);
      resetCustomerForm();
      toast({ title: "Cliente atualizado com sucesso!" });
    },
    onError: () => {
      toast({ title: "Erro ao atualizar cliente", variant: "destructive" });
    },
  });

  const deleteCustomerMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/customers/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete customer");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      setDeleteCustomerId(null);
      toast({ title: "Cliente excluído com sucesso!" });
    },
    onError: () => {
      toast({ title: "Erro ao excluir cliente", variant: "destructive" });
    },
  });

  const createSupplierMutation = useMutation({
    mutationFn: async (data: typeof supplierForm) => {
      const res = await fetch("/api/suppliers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create supplier");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/suppliers"] });
      setIsSupplierDialogOpen(false);
      resetSupplierForm();
      toast({ title: "Fornecedor criado com sucesso!" });
    },
    onError: () => {
      toast({ title: "Erro ao criar fornecedor", variant: "destructive" });
    },
  });

  const updateSupplierMutation = useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: number;
      data: typeof supplierForm;
    }) => {
      const res = await fetch(`/api/suppliers/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update supplier");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/suppliers"] });
      setIsSupplierDialogOpen(false);
      setEditingSupplier(null);
      resetSupplierForm();
      toast({ title: "Fornecedor atualizado com sucesso!" });
    },
    onError: () => {
      toast({ title: "Erro ao atualizar fornecedor", variant: "destructive" });
    },
  });

  const deleteSupplierMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/suppliers/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete supplier");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/suppliers"] });
      setDeleteSupplierId(null);
      toast({ title: "Fornecedor excluído com sucesso!" });
    },
    onError: () => {
      toast({ title: "Erro ao excluir fornecedor", variant: "destructive" });
    },
  });

  const createTransporterMutation = useMutation({
    mutationFn: async (data: typeof transporterForm) => {
      const res = await fetch("/api/transporters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create transporter");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/transporters"] });
      setIsTransporterDialogOpen(false);
      resetTransporterForm();
      toast({ title: "Transportadora criada com sucesso!" });
    },
    onError: () => {
      toast({ title: "Erro ao criar transportadora", variant: "destructive" });
    },
  });

  const updateTransporterMutation = useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: number;
      data: typeof transporterForm;
    }) => {
      const res = await fetch(`/api/transporters/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update transporter");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/transporters"] });
      setIsTransporterDialogOpen(false);
      setEditingTransporter(null);
      resetTransporterForm();
      toast({ title: "Transportadora atualizada com sucesso!" });
    },
    onError: () => {
      toast({ title: "Erro ao atualizar transportadora", variant: "destructive" });
    },
  });

  const deleteTransporterMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/transporters/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete transporter");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/transporters"] });
      setDeleteTransporterId(null);
      toast({ title: "Transportadora excluida com sucesso!" });
    },
    onError: () => {
      toast({ title: "Erro ao excluir transportadora", variant: "destructive" });
    },
  });

  const resetCustomerForm = () => {
    setCustomerForm({
      name: "",
      email: "",
      phone: "",
      cpfCnpj: "",
      type: "Regular",
      address: "",
      city: "",
      state: "",
      zipCode: "",
    });
  };

  const resetSupplierForm = () => {
    setSupplierForm({
      name: "",
      contact: "",
      phone: "",
      email: "",
      cnpj: "",
      address: "",
      city: "",
      state: "",
      zipCode: "",
      paymentTerms: "",
    });
  };

  const resetTransporterForm = () => {
    setTransporterForm({
      name: "",
      contact: "",
      phone: "",
      email: "",
      cnpjCpf: "",
      ie: "",
      rntc: "",
      address: "",
      city: "",
      state: "",
      zipCode: "",
      notes: "",
    });
  };

  const openEditCustomer = (customer: Customer) => {
    setEditingCustomer(customer);
    setCustomerForm({
      name: customer.name,
      email: customer.email || "",
      phone: customer.phone || "",
      cpfCnpj: customer.cpfCnpj || "",
      type: customer.type,
      address: customer.address || "",
      city: customer.city || "",
      state: customer.state || "",
      zipCode: customer.zipCode || "",
    });
    setIsCustomerDialogOpen(true);
  };

  const openEditSupplier = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    setSupplierForm({
      name: supplier.name,
      contact: supplier.contact || "",
      phone: supplier.phone || "",
      email: supplier.email || "",
      cnpj: supplier.cnpj || "",
      address: supplier.address || "",
      city: supplier.city || "",
      state: supplier.state || "",
      zipCode: supplier.zipCode || "",
      paymentTerms: supplier.paymentTerms || "",
    });
    setIsSupplierDialogOpen(true);
  };

  const openEditTransporter = (transporter: Transporter) => {
    setEditingTransporter(transporter);
    setTransporterForm({
      name: transporter.name,
      contact: transporter.contact || "",
      phone: transporter.phone || "",
      email: transporter.email || "",
      cnpjCpf: transporter.cnpjCpf || "",
      ie: transporter.ie || "",
      rntc: transporter.rntc || "",
      address: transporter.address || "",
      city: transporter.city || "",
      state: transporter.state || "",
      zipCode: transporter.zipCode || "",
      notes: transporter.notes || "",
    });
    setIsTransporterDialogOpen(true);
  };

  const handleCustomerSubmit = () => {
    if (!customerForm.name.trim()) {
      toast({ title: "Nome é obrigatório", variant: "destructive" });
      return;
    }
    if (editingCustomer) {
      updateCustomerMutation.mutate({
        id: editingCustomer.id,
        data: customerForm,
      });
    } else {
      createCustomerMutation.mutate(customerForm);
    }
  };

  const handleSupplierSubmit = () => {
    if (!supplierForm.name.trim()) {
      toast({ title: "Nome é obrigatório", variant: "destructive" });
      return;
    }
    if (editingSupplier) {
      updateSupplierMutation.mutate({
        id: editingSupplier.id,
        data: supplierForm,
      });
    } else {
      createSupplierMutation.mutate(supplierForm);
    }
  };

  const handleTransporterSubmit = () => {
    if (!transporterForm.name.trim()) {
      toast({ title: "Nome e obrigatorio", variant: "destructive" });
      return;
    }
    if (editingTransporter) {
      updateTransporterMutation.mutate({
        id: editingTransporter.id,
        data: transporterForm,
      });
    } else {
      createTransporterMutation.mutate(transporterForm);
    }
  };

  const filteredCustomers = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.email && c.email.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (c.phone && c.phone.includes(searchQuery))
  );

  const filteredSuppliers = suppliers.filter(
    (s) =>
      s.name.toLowerCase().includes(supplierSearchQuery.toLowerCase()) ||
      (s.contact &&
        s.contact.toLowerCase().includes(supplierSearchQuery.toLowerCase())) ||
      (s.email &&
        s.email.toLowerCase().includes(supplierSearchQuery.toLowerCase()))
  );
  const filteredTransporters = transporters.filter(
    (t) =>
      t.name.toLowerCase().includes(transporterSearchQuery.toLowerCase()) ||
      (t.contact &&
        t.contact.toLowerCase().includes(transporterSearchQuery.toLowerCase())) ||
      (t.email &&
        t.email.toLowerCase().includes(transporterSearchQuery.toLowerCase())) ||
      (t.cnpjCpf && t.cnpjCpf.includes(transporterSearchQuery)) ||
      (t.rntc && t.rntc.includes(transporterSearchQuery))
  );

  const delinquentCustomers = customers.filter((customer) =>
    String(customer.type || "").toLowerCase().includes("inadimpl")
  );

  const formatMoney = (value: string | null | undefined) => {
    const parsed = Number(String(value ?? "0").replace(",", "."));
    return Number.isFinite(parsed)
      ? parsed.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
      : "R$ 0,00";
  };

  const getInitials = (name: string) =>
    String(name || "")
      .split(" ")
      .map((part) => part.charAt(0))
      .join("")
      .slice(0, 2)
      .toUpperCase();

  return (
    <Layout>
      <div className="space-y-5">
        <div>
          <h1 className="text-3xl font-heading font-bold tracking-tight text-foreground">
            Clientes, Fornecedores e Transportadoras
          </h1>
          <p className="text-muted-foreground">Gerencie sua base de contatos.</p>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Card className="border-blue-100 bg-blue-50/60">
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <p className="text-xs text-blue-700">Clientes</p>
                <p className="text-2xl font-semibold text-blue-900">{customers.length}</p>
              </div>
              <div className="rounded-lg bg-white/70 p-2 text-blue-700">
                <Users className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>
          <Card className="border-indigo-100 bg-indigo-50/60">
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <p className="text-xs text-indigo-700">Fornecedores</p>
                <p className="text-2xl font-semibold text-indigo-900">{suppliers.length}</p>
              </div>
              <div className="rounded-lg bg-white/70 p-2 text-indigo-700">
                <Building2 className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>
          <Card className="border-amber-100 bg-amber-50/60">
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <p className="text-xs text-amber-700">Transportadoras</p>
                <p className="text-2xl font-semibold text-amber-900">{transporters.length}</p>
              </div>
              <div className="rounded-lg bg-white/70 p-2 text-amber-700">
                <Truck className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>
          <Card className="border-rose-100 bg-rose-50/60">
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <p className="text-xs text-rose-700">Inadimplentes</p>
                <p className="text-2xl font-semibold text-rose-900">{delinquentCustomers.length}</p>
              </div>
              <div className="rounded-lg bg-white/70 p-2 text-rose-700">
                <AlertTriangle className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="clients" className="space-y-4">
          <TabsList className="h-auto w-full justify-start gap-2 rounded-xl border bg-muted/40 p-1">
            <TabsTrigger value="clients" className="rounded-lg px-4">
              Clientes ({customers.length})
            </TabsTrigger>
            <TabsTrigger value="suppliers" className="rounded-lg px-4">
              Fornecedores ({suppliers.length})
            </TabsTrigger>
            <TabsTrigger value="transporters" className="rounded-lg px-4">
              Transportadoras ({transporters.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="clients" className="space-y-4">
            <div className="flex flex-col gap-3 rounded-xl border bg-card p-3 md:flex-row md:items-center md:justify-between">
              <div className="relative w-full md:max-w-md">
                <Search className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome, telefone ou e-mail..."
                  className="pl-9"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <Button
                onClick={() => {
                  setEditingCustomer(null);
                  resetCustomerForm();
                  setIsCustomerDialogOpen(true);
                }}
              >
                <Plus className="mr-2 h-4 w-4" /> Novo Cliente
              </Button>
            </div>

            {isLoadingCustomers ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredCustomers.length === 0 ? (
              <div className="rounded-xl border border-dashed py-14 text-center text-muted-foreground">
                {searchQuery
                  ? "Nenhum cliente encontrado para esta busca."
                  : "Nenhum cliente cadastrado ainda."}
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {filteredCustomers.map((customer) => (
                  <Card key={customer.id} className="overflow-hidden rounded-xl border shadow-sm">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10">
                            <AvatarFallback className="bg-emerald-100 text-emerald-700">
                              {getInitials(customer.name)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <CardTitle className="text-base">{customer.name}</CardTitle>
                            <CardDescription>{customer.type || "Cliente Regular"}</CardDescription>
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openEditCustomer(customer)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => setDeleteCustomerId(customer.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      {customer.phone && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Phone className="h-4 w-4" /> {customer.phone}
                        </div>
                      )}
                      {customer.email && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Mail className="h-4 w-4" /> {customer.email}
                        </div>
                      )}
                      {(customer.address || customer.city || customer.state) && (
                        <div className="flex items-start gap-2 text-muted-foreground">
                          <MapPin className="mt-0.5 h-4 w-4" />
                          <span>
                            {customer.address || "-"}
                            {customer.city ? `, ${customer.city}` : ""}
                            {customer.state ? ` - ${customer.state}` : ""}
                          </span>
                        </div>
                      )}
                      <div className="mt-2 border-t pt-2 text-xs text-muted-foreground">
                        <p>CPF/CNPJ: {customer.cpfCnpj || "-"}</p>
                      </div>
                      <div className="flex items-center justify-between rounded-lg bg-muted/40 p-2 text-xs">
                        <span>Limite de crédito</span>
                        <span className="font-semibold text-foreground">
                          {formatMoney(customer.creditLimit)}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="suppliers" className="space-y-4">
            <div className="flex flex-col gap-3 rounded-xl border bg-card p-3 md:flex-row md:items-center md:justify-between">
              <div className="relative w-full md:max-w-md">
                <Search className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por empresa, contato ou e-mail..."
                  className="pl-9"
                  value={supplierSearchQuery}
                  onChange={(e) => setSupplierSearchQuery(e.target.value)}
                />
              </div>
              <Button
                onClick={() => {
                  setEditingSupplier(null);
                  resetSupplierForm();
                  setIsSupplierDialogOpen(true);
                }}
              >
                <Plus className="mr-2 h-4 w-4" /> Novo Fornecedor
              </Button>
            </div>

            {isLoadingSuppliers ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredSuppliers.length === 0 ? (
              <div className="rounded-xl border border-dashed py-14 text-center text-muted-foreground">
                {supplierSearchQuery
                  ? "Nenhum fornecedor encontrado para esta busca."
                  : "Nenhum fornecedor cadastrado ainda."}
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {filteredSuppliers.map((supplier) => (
                  <Card key={supplier.id} className="overflow-hidden rounded-xl border shadow-sm">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <CardTitle className="text-base">{supplier.name}</CardTitle>
                          <CardDescription>{supplier.contact || "Sem contato principal"}</CardDescription>
                        </div>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openEditSupplier(supplier)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => setDeleteSupplierId(supplier.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      {supplier.phone && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Phone className="h-4 w-4" /> {supplier.phone}
                        </div>
                      )}
                      {supplier.email && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Mail className="h-4 w-4" /> {supplier.email}
                        </div>
                      )}
                      {(supplier.address || supplier.city || supplier.state) && (
                        <div className="flex items-start gap-2 text-muted-foreground">
                          <MapPin className="mt-0.5 h-4 w-4" />
                          <span>
                            {supplier.address || "-"}
                            {supplier.city ? `, ${supplier.city}` : ""}
                            {supplier.state ? ` - ${supplier.state}` : ""}
                          </span>
                        </div>
                      )}
                      <div className="mt-2 border-t pt-2 text-xs text-muted-foreground">
                        <p>CNPJ: {supplier.cnpj || "-"}</p>
                        <p>Condição pagamento: {supplier.paymentTerms || "-"}</p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="transporters" className="space-y-4">
            <div className="flex flex-col gap-3 rounded-xl border bg-card p-3 md:flex-row md:items-center md:justify-between">
              <div className="relative w-full md:max-w-md">
                <Search className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome, contato, CNPJ/CPF ou RNTC..."
                  className="pl-9"
                  value={transporterSearchQuery}
                  onChange={(e) => setTransporterSearchQuery(e.target.value)}
                />
              </div>
              <Button
                onClick={() => {
                  setEditingTransporter(null);
                  resetTransporterForm();
                  setIsTransporterDialogOpen(true);
                }}
              >
                <Plus className="mr-2 h-4 w-4" /> Nova Transportadora
              </Button>
            </div>

            {isLoadingTransporters ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredTransporters.length === 0 ? (
              <div className="rounded-xl border border-dashed py-14 text-center text-muted-foreground">
                {transporterSearchQuery
                  ? "Nenhuma transportadora encontrada para esta busca."
                  : "Nenhuma transportadora cadastrada ainda."}
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {filteredTransporters.map((transporter) => (
                  <Card key={transporter.id} className="overflow-hidden rounded-xl border shadow-sm">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="rounded-lg bg-amber-100 p-2 text-amber-700">
                            <Truck className="h-4 w-4" />
                          </div>
                          <div>
                            <CardTitle className="text-base">{transporter.name}</CardTitle>
                            <CardDescription>{transporter.contact || "Sem contato principal"}</CardDescription>
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openEditTransporter(transporter)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => setDeleteTransporterId(transporter.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      {transporter.phone && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Phone className="h-4 w-4" /> {transporter.phone}
                        </div>
                      )}
                      {transporter.email && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Mail className="h-4 w-4" /> {transporter.email}
                        </div>
                      )}
                      {(transporter.address || transporter.city || transporter.state) && (
                        <div className="flex items-start gap-2 text-muted-foreground">
                          <MapPin className="mt-0.5 h-4 w-4" />
                          <span>
                            {transporter.address || "-"}
                            {transporter.city ? `, ${transporter.city}` : ""}
                            {transporter.state ? ` - ${transporter.state}` : ""}
                          </span>
                        </div>
                      )}
                      <div className="mt-2 border-t pt-2 text-xs text-muted-foreground">
                        <p>CNPJ/CPF: {transporter.cnpjCpf || "-"}</p>
                        <p>IE: {transporter.ie || "-"}</p>
                        <p>RNTC: {transporter.rntc || "-"}</p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <Dialog
        open={isCustomerDialogOpen}
        onOpenChange={(open) => {
          setIsCustomerDialogOpen(open);
          if (!open) {
            setEditingCustomer(null);
            resetCustomerForm();
          }
        }}
      >
        <DialogContent className="max-h-[85vh] max-w-md overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingCustomer ? "Editar Cliente" : "Novo Cliente"}
            </DialogTitle>
            <DialogDescription>
              {editingCustomer
                ? "Atualize os dados do cliente."
                : "Preencha os dados do novo cliente."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Nome *</Label>
              <Input
                id="name"
                value={customerForm.name}
                onChange={(e) =>
                  setCustomerForm({ ...customerForm, name: e.target.value })
                }
                placeholder="Nome do cliente"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="phone">Telefone</Label>
                <Input
                  id="phone"
                  value={customerForm.phone}
                  onChange={(e) =>
                    setCustomerForm({ ...customerForm, phone: e.target.value })
                  }
                  placeholder="(00) 00000-0000"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="type">Tipo</Label>
                <Select
                  value={customerForm.type}
                  onValueChange={(value) =>
                    setCustomerForm({ ...customerForm, type: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Regular">Regular</SelectItem>
                    <SelectItem value="VIP">VIP</SelectItem>
                    <SelectItem value="Novo">Novo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                value={customerForm.email}
                onChange={(e) =>
                  setCustomerForm({ ...customerForm, email: e.target.value })
                }
                placeholder="email@exemplo.com"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="cpfCnpj">CPF/CNPJ</Label>
              <Input
                id="cpfCnpj"
                value={customerForm.cpfCnpj}
                onChange={(e) =>
                  setCustomerForm({ ...customerForm, cpfCnpj: e.target.value })
                }
                placeholder="000.000.000-00"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="address">Endereço</Label>
              <Input
                id="address"
                value={customerForm.address}
                onChange={(e) =>
                  setCustomerForm({ ...customerForm, address: e.target.value })
                }
                placeholder="Rua, número, bairro"
              />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="city">Cidade</Label>
                <Input
                  id="city"
                  value={customerForm.city}
                  onChange={(e) =>
                    setCustomerForm({ ...customerForm, city: e.target.value })
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="state">Estado</Label>
                <Input
                  id="state"
                  value={customerForm.state}
                  onChange={(e) =>
                    setCustomerForm({ ...customerForm, state: e.target.value })
                  }
                  maxLength={2}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="zipCode">CEP</Label>
                <Input
                  id="zipCode"
                  value={customerForm.zipCode}
                  onChange={(e) =>
                    setCustomerForm({
                      ...customerForm,
                      zipCode: e.target.value,
                    })
                  }
                  placeholder="00000-000"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsCustomerDialogOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleCustomerSubmit}
              disabled={
                createCustomerMutation.isPending ||
                updateCustomerMutation.isPending
              }
            >
              {(createCustomerMutation.isPending ||
                updateCustomerMutation.isPending) && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {editingCustomer ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isSupplierDialogOpen}
        onOpenChange={(open) => {
          setIsSupplierDialogOpen(open);
          if (!open) {
            setEditingSupplier(null);
            resetSupplierForm();
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingSupplier ? "Editar Fornecedor" : "Novo Fornecedor"}
            </DialogTitle>
            <DialogDescription>
              {editingSupplier
                ? "Atualize os dados do fornecedor."
                : "Preencha os dados do novo fornecedor."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="supplierName">Nome da Empresa *</Label>
              <Input
                id="supplierName"
                value={supplierForm.name}
                onChange={(e) =>
                  setSupplierForm({ ...supplierForm, name: e.target.value })
                }
                placeholder="Nome do fornecedor"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="contact">Contato</Label>
                <Input
                  id="contact"
                  value={supplierForm.contact}
                  onChange={(e) =>
                    setSupplierForm({
                      ...supplierForm,
                      contact: e.target.value,
                    })
                  }
                  placeholder="Nome do contato"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="supplierPhone">Telefone</Label>
                <Input
                  id="supplierPhone"
                  value={supplierForm.phone}
                  onChange={(e) =>
                    setSupplierForm({ ...supplierForm, phone: e.target.value })
                  }
                  placeholder="(00) 0000-0000"
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="supplierEmail">E-mail</Label>
              <Input
                id="supplierEmail"
                type="email"
                value={supplierForm.email}
                onChange={(e) =>
                  setSupplierForm({ ...supplierForm, email: e.target.value })
                }
                placeholder="contato@fornecedor.com"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="cnpj">CNPJ</Label>
                <Input
                  id="cnpj"
                  value={supplierForm.cnpj}
                  onChange={(e) =>
                    setSupplierForm({ ...supplierForm, cnpj: e.target.value })
                  }
                  placeholder="00.000.000/0000-00"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="paymentTerms">Prazo Pagamento</Label>
                <Input
                  id="paymentTerms"
                  value={supplierForm.paymentTerms}
                  onChange={(e) =>
                    setSupplierForm({
                      ...supplierForm,
                      paymentTerms: e.target.value,
                    })
                  }
                  placeholder="30/60/90 dias"
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="supplierAddress">Endereço</Label>
              <Input
                id="supplierAddress"
                value={supplierForm.address}
                onChange={(e) =>
                  setSupplierForm({ ...supplierForm, address: e.target.value })
                }
                placeholder="Rua, número, bairro"
              />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="supplierCity">Cidade</Label>
                <Input
                  id="supplierCity"
                  value={supplierForm.city}
                  onChange={(e) =>
                    setSupplierForm({ ...supplierForm, city: e.target.value })
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="supplierState">Estado</Label>
                <Input
                  id="supplierState"
                  value={supplierForm.state}
                  onChange={(e) =>
                    setSupplierForm({ ...supplierForm, state: e.target.value })
                  }
                  maxLength={2}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="supplierZipCode">CEP</Label>
                <Input
                  id="supplierZipCode"
                  value={supplierForm.zipCode}
                  onChange={(e) =>
                    setSupplierForm({
                      ...supplierForm,
                      zipCode: e.target.value,
                    })
                  }
                  placeholder="00000-000"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsSupplierDialogOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSupplierSubmit}
              disabled={
                createSupplierMutation.isPending ||
                updateSupplierMutation.isPending
              }
            >
              {(createSupplierMutation.isPending ||
                updateSupplierMutation.isPending) && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {editingSupplier ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isTransporterDialogOpen}
        onOpenChange={(open) => {
          setIsTransporterDialogOpen(open);
          if (!open) {
            setEditingTransporter(null);
            resetTransporterForm();
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingTransporter ? "Editar Transportadora" : "Nova Transportadora"}
            </DialogTitle>
            <DialogDescription>
              {editingTransporter
                ? "Atualize os dados da transportadora."
                : "Preencha os dados da nova transportadora."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="transporterName">Razao social / Nome *</Label>
              <Input
                id="transporterName"
                value={transporterForm.name}
                onChange={(e) => setTransporterForm({ ...transporterForm, name: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="transporterContact">Contato</Label>
                <Input
                  id="transporterContact"
                  value={transporterForm.contact}
                  onChange={(e) => setTransporterForm({ ...transporterForm, contact: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="transporterPhone">Telefone</Label>
                <Input
                  id="transporterPhone"
                  value={transporterForm.phone}
                  onChange={(e) => setTransporterForm({ ...transporterForm, phone: e.target.value })}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="transporterEmail">E-mail</Label>
              <Input
                id="transporterEmail"
                type="email"
                value={transporterForm.email}
                onChange={(e) => setTransporterForm({ ...transporterForm, email: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="transporterDoc">CNPJ/CPF</Label>
                <Input
                  id="transporterDoc"
                  value={transporterForm.cnpjCpf}
                  onChange={(e) => setTransporterForm({ ...transporterForm, cnpjCpf: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="transporterIe">IE</Label>
                <Input
                  id="transporterIe"
                  value={transporterForm.ie}
                  onChange={(e) => setTransporterForm({ ...transporterForm, ie: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="transporterRntc">RNTC</Label>
                <Input
                  id="transporterRntc"
                  value={transporterForm.rntc}
                  onChange={(e) => setTransporterForm({ ...transporterForm, rntc: e.target.value })}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="transporterAddress">Endereco</Label>
              <Input
                id="transporterAddress"
                value={transporterForm.address}
                onChange={(e) => setTransporterForm({ ...transporterForm, address: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="transporterCity">Cidade</Label>
                <Input
                  id="transporterCity"
                  value={transporterForm.city}
                  onChange={(e) => setTransporterForm({ ...transporterForm, city: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="transporterState">UF</Label>
                <Input
                  id="transporterState"
                  value={transporterForm.state}
                  maxLength={2}
                  onChange={(e) => setTransporterForm({ ...transporterForm, state: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="transporterZip">CEP</Label>
                <Input
                  id="transporterZip"
                  value={transporterForm.zipCode}
                  onChange={(e) => setTransporterForm({ ...transporterForm, zipCode: e.target.value })}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="transporterNotes">Observacoes</Label>
              <Input
                id="transporterNotes"
                value={transporterForm.notes}
                onChange={(e) => setTransporterForm({ ...transporterForm, notes: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsTransporterDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleTransporterSubmit}
              disabled={createTransporterMutation.isPending || updateTransporterMutation.isPending}
            >
              {(createTransporterMutation.isPending || updateTransporterMutation.isPending) && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {editingTransporter ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={deleteCustomerId !== null}
        onOpenChange={(open) => !open && setDeleteCustomerId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Cliente</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este cliente? Esta ação não pode
              ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                deleteCustomerId &&
                deleteCustomerMutation.mutate(deleteCustomerId)
              }
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={deleteSupplierId !== null}
        onOpenChange={(open) => !open && setDeleteSupplierId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Fornecedor</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este fornecedor? Esta ação não pode
              ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                deleteSupplierId &&
                deleteSupplierMutation.mutate(deleteSupplierId)
              }
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={deleteTransporterId !== null}
        onOpenChange={(open) => !open && setDeleteTransporterId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Transportadora</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta transportadora? Esta acao nao pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                deleteTransporterId && deleteTransporterMutation.mutate(deleteTransporterId)
              }
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}
