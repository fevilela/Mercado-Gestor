import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import Layout from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Plus,
  UserCog,
  Mail,
  Phone,
  Shield,
  Loader2,
  Pencil,
  Trash2,
  Settings,
} from "lucide-react";

interface Role {
  id: number;
  name: string;
  description: string | null;
}

interface Permission {
  id: number;
  module: string;
  action: string;
  description: string | null;
}

interface UserData {
  id: string;
  name: string;
  email: string;
  username: string;
  phone: string | null;
  isActive: boolean | null;
  lastLogin: string | null;
  createdAt: string | null;
  roleId: number;
  roleName: string | null;
}

export default function Users() {
  const { hasPermission } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserData | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    roleId: "",
  });
  const [permDialogOpen, setPermDialogOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [selectedPermissions, setSelectedPermissions] = useState<number[]>([]);

  const { data: users = [], isLoading: usersLoading } = useQuery<UserData[]>({
    queryKey: ["/api/auth/users"],
    queryFn: async () => {
      const res = await fetch("/api/auth/users");
      if (!res.ok) throw new Error("Failed to fetch users");
      return res.json();
    },
  });

  const { data: roles = [] } = useQuery<Role[]>({
    queryKey: ["/api/auth/roles"],
    queryFn: async () => {
      const res = await fetch("/api/auth/roles");
      if (!res.ok) throw new Error("Failed to fetch roles");
      return res.json();
    },
  });

  const { data: allPermissions = [] } = useQuery<Permission[]>({
    queryKey: ["/api/auth/permissions"],
    queryFn: async () => {
      const res = await fetch("/api/auth/permissions");
      if (!res.ok) throw new Error("Failed to fetch permissions");
      return res.json();
    },
  });

  const {
    data: rolePermissions = [],
    refetch: refetchRolePermissions,
    isFetching: isLoadingRolePerms,
  } = useQuery<number[]>({
    queryKey: ["/api/auth/roles", selectedRole?.id, "permissions"],
    queryFn: async () => {
      if (!selectedRole) return [];
      const res = await fetch(`/api/auth/roles/${selectedRole.id}/permissions`);
      if (!res.ok) throw new Error("Failed to fetch role permissions");
      return res.json();
    },
    enabled: !!selectedRole,
  });

  const updatePermissionsMutation = useMutation({
    mutationFn: async ({
      roleId,
      permissionIds,
    }: {
      roleId: number;
      permissionIds: number[];
    }) => {
      const res = await fetch(`/api/auth/roles/${roleId}/permissions`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ permissionIds }),
      });
      if (!res.ok) throw new Error("Erro ao atualizar permissoes");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/roles"] });
      toast({ title: "Permissoes atualizadas com sucesso!" });
      setPermDialogOpen(false);
      setSelectedRole(null);
    },
    onError: () => {
      toast({ title: "Erro ao atualizar permissoes", variant: "destructive" });
    },
  });

  const createUserMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const res = await fetch("/api/auth/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          roleId: parseInt(data.roleId),
        }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Erro ao criar usuario");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/users"] });
      setIsDialogOpen(false);
      resetForm();
      toast({ title: "Usuario criado com sucesso!" });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao criar usuario",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateUserMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: string; [key: string]: any }) => {
      const res = await fetch(`/api/auth/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Erro ao atualizar usuario");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/users"] });
      setIsDialogOpen(false);
      setEditingUser(null);
      resetForm();
      toast({ title: "Usuario atualizado com sucesso!" });
    },
    onError: () => {
      toast({
        title: "Erro ao atualizar usuario",
        variant: "destructive",
      });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/auth/users/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Erro ao excluir usuario");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/users"] });
      toast({ title: "Usuario excluido com sucesso!" });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao excluir usuario",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const toggleUserStatus = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const res = await fetch(`/api/auth/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive }),
      });
      if (!res.ok) throw new Error("Erro ao atualizar status");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/users"] });
      toast({ title: "Status atualizado com sucesso!" });
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      email: "",
      phone: "",
      password: "",
      roleId: "",
    });
  };

  const handleEdit = (user: UserData) => {
    setEditingUser(user);
    setFormData({
      name: user.name,
      email: user.email,
      phone: user.phone || "",
      password: "",
      roleId: user.roleId.toString(),
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingUser) {
      const updateData: any = {
        id: editingUser.id,
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        roleId: parseInt(formData.roleId),
      };
      if (formData.password) {
        updateData.password = formData.password;
      }
      updateUserMutation.mutate(updateData);
    } else {
      createUserMutation.mutate(formData);
    }
  };

  const canManageUsers = hasPermission("users:manage");

  useEffect(() => {
    if (selectedRole && !isLoadingRolePerms) {
      setSelectedPermissions(rolePermissions);
    }
  }, [selectedRole?.id, isLoadingRolePerms]);

  const openPermissionDialog = async (role: Role) => {
    setSelectedRole(role);
    setSelectedPermissions([]);
    setPermDialogOpen(true);
    setTimeout(() => refetchRolePermissions(), 100);
  };

  const handlePermissionToggle = (permId: number) => {
    setSelectedPermissions((prev) =>
      prev.includes(permId)
        ? prev.filter((id) => id !== permId)
        : [...prev, permId]
    );
  };

  const handleSavePermissions = () => {
    if (selectedRole) {
      updatePermissionsMutation.mutate({
        roleId: selectedRole.id,
        permissionIds: selectedPermissions,
      });
    }
  };

  const groupPermissionsByModule = (perms: Permission[]) => {
    const grouped: Record<string, Permission[]> = {};
    for (const perm of perms) {
      if (!grouped[perm.module]) grouped[perm.module] = [];
      grouped[perm.module].push(perm);
    }
    return grouped;
  };

  const moduleLabels: Record<string, string> = {
    pos: "PDV",
    inventory: "Estoque",
    customers: "Clientes",
    suppliers: "Fornecedores",
    finance: "Financeiro",
    reports: "Relatorios",
    settings: "Configuracoes",
    fiscal: "Fiscal",
    users: "Usuarios",
  };

  return (
    <Layout>
      <div className="flex-1 p-6 overflow-auto">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold" data-testid="text-users-title">
                Usuarios
              </h1>
              <p className="text-muted-foreground">
                Gerencie os usuarios da sua empresa
              </p>
            </div>
            {canManageUsers && (
              <Dialog
                open={isDialogOpen}
                onOpenChange={(open) => {
                  setIsDialogOpen(open);
                  if (!open) {
                    setEditingUser(null);
                    resetForm();
                  }
                }}
              >
                <DialogTrigger asChild>
                  <Button data-testid="button-new-user">
                    <Plus className="mr-2 h-4 w-4" />
                    Novo Usuario
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>
                      {editingUser ? "Editar Usuario" : "Novo Usuario"}
                    </DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Nome *</Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) =>
                          setFormData({ ...formData, name: e.target.value })
                        }
                        required
                        data-testid="input-user-name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email *</Label>
                      <Input
                        id="email"
                        type="email"
                        value={formData.email}
                        onChange={(e) =>
                          setFormData({ ...formData, email: e.target.value })
                        }
                        required
                        data-testid="input-user-email"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">Telefone</Label>
                      <Input
                        id="phone"
                        value={formData.phone}
                        onChange={(e) =>
                          setFormData({ ...formData, phone: e.target.value })
                        }
                        data-testid="input-user-phone"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="password">
                        {editingUser
                          ? "Nova Senha (deixe em branco para manter)"
                          : "Senha *"}
                      </Label>
                      <Input
                        id="password"
                        type="password"
                        value={formData.password}
                        onChange={(e) =>
                          setFormData({ ...formData, password: e.target.value })
                        }
                        required={!editingUser}
                        data-testid="input-user-password"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="roleId">Perfil *</Label>
                      <Select
                        value={formData.roleId}
                        onValueChange={(value) =>
                          setFormData({ ...formData, roleId: value })
                        }
                      >
                        <SelectTrigger data-testid="select-user-role">
                          <SelectValue placeholder="Selecione um perfil" />
                        </SelectTrigger>
                        <SelectContent>
                          {roles.map((role) => (
                            <SelectItem
                              key={role.id}
                              value={role.id.toString()}
                            >
                              {role.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button
                      type="submit"
                      className="w-full"
                      disabled={
                        createUserMutation.isPending ||
                        updateUserMutation.isPending
                      }
                      data-testid="button-submit-user"
                    >
                      {createUserMutation.isPending ||
                      updateUserMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : editingUser ? (
                        "Atualizar"
                      ) : (
                        "Criar Usuario"
                      )}
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            )}
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserCog className="h-5 w-5" />
                Lista de Usuarios
              </CardTitle>
              <CardDescription>
                {users.length} usuario(s) cadastrado(s)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {usersLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : users.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhum usuario cadastrado
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Perfil</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Ultimo Acesso</TableHead>
                      {canManageUsers && (
                        <TableHead className="text-right">Acoes</TableHead>
                      )}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((user) => (
                      <TableRow
                        key={user.id}
                        data-testid={`row-user-${user.id}`}
                      >
                        <TableCell className="font-medium">
                          {user.name}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Mail className="h-4 w-4 text-muted-foreground" />
                            {user.email}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">
                            <Shield className="h-3 w-3 mr-1" />
                            {user.roleName || "Sem perfil"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {canManageUsers ? (
                            <Switch
                              checked={user.isActive ?? true}
                              onCheckedChange={(checked) =>
                                toggleUserStatus.mutate({
                                  id: user.id,
                                  isActive: checked,
                                })
                              }
                              data-testid={`switch-user-status-${user.id}`}
                            />
                          ) : (
                            <Badge
                              variant={user.isActive ? "default" : "secondary"}
                            >
                              {user.isActive ? "Ativo" : "Inativo"}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {user.lastLogin
                            ? new Date(user.lastLogin).toLocaleString("pt-BR")
                            : "Nunca acessou"}
                        </TableCell>
                        {canManageUsers && (
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleEdit(user)}
                                data-testid={`button-edit-user-${user.id}`}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  if (
                                    confirm(
                                      "Tem certeza que deseja excluir este usuario?"
                                    )
                                  ) {
                                    deleteUserMutation.mutate(user.id);
                                  }
                                }}
                                data-testid={`button-delete-user-${user.id}`}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {canManageUsers && (
            <Card className="mt-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Perfis e Permissoes
                </CardTitle>
                <CardDescription>
                  Gerencie as permissoes de cada perfil
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Perfil</TableHead>
                      <TableHead>Descricao</TableHead>
                      <TableHead className="text-right">Acoes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {roles.map((role) => (
                      <TableRow
                        key={role.id}
                        data-testid={`row-role-${role.id}`}
                      >
                        <TableCell className="font-medium">
                          {role.name}
                        </TableCell>
                        <TableCell>{role.description || "-"}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openPermissionDialog(role)}
                            data-testid={`button-edit-permissions-${role.id}`}
                          >
                            <Settings className="h-4 w-4 mr-2" />
                            Permissoes
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          <Dialog
            open={permDialogOpen}
            onOpenChange={(open) => {
              setPermDialogOpen(open);
              if (!open) setSelectedRole(null);
            }}
          >
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Permissoes - {selectedRole?.name}</DialogTitle>
              </DialogHeader>
              {isLoadingRolePerms ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : (
                <div className="space-y-6">
                  {Object.entries(groupPermissionsByModule(allPermissions)).map(
                    ([module, perms]) => (
                      <div key={module} className="space-y-2">
                        <h4 className="font-semibold text-sm uppercase text-muted-foreground">
                          {moduleLabels[module] || module}
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {perms.map((perm) => (
                            <div
                              key={perm.id}
                              className="flex items-center space-x-2 p-2 rounded border"
                              data-testid={`perm-item-${perm.id}`}
                            >
                              <Checkbox
                                id={`perm-${perm.id}`}
                                checked={selectedPermissions.includes(perm.id)}
                                onCheckedChange={() =>
                                  handlePermissionToggle(perm.id)
                                }
                                data-testid={`checkbox-perm-${perm.id}`}
                              />
                              <label
                                htmlFor={`perm-${perm.id}`}
                                className="text-sm cursor-pointer flex-1"
                              >
                                {perm.description ||
                                  `${perm.module}:${perm.action}`}
                              </label>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  )}
                </div>
              )}
              <div className="flex justify-end gap-2 mt-4">
                <Button
                  variant="outline"
                  onClick={() => setPermDialogOpen(false)}
                  data-testid="button-cancel-permissions"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleSavePermissions}
                  disabled={
                    updatePermissionsMutation.isPending || isLoadingRolePerms
                  }
                  data-testid="button-save-permissions"
                >
                  {updatePermissionsMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Salvar Permissoes"
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </Layout>
  );
}
