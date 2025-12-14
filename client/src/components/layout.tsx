import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Store,
  BarChart3,
  Wallet,
  Settings,
  Users,
  LogOut,
  Search,
  Bell,
  Menu,
  ChevronDown,
  User,
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { useQuery } from "@tanstack/react-query";

const sidebarItems = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/", permissions: [] },
  {
    icon: ShoppingCart,
    label: "PDV (Frente de Caixa)",
    href: "/pos",
    permissions: ["pos:view", "pos:sell"],
  },
  {
    icon: Package,
    label: "Produtos & Estoque",
    href: "/inventory",
    permissions: ["inventory:view", "inventory:manage"],
  },
  {
    icon: Store,
    label: "Vendas & Pedidos",
    href: "/sales",
    permissions: ["pos:view", "reports:view"],
  },
  {
    icon: Wallet,
    label: "Financeiro",
    href: "/finance",
    permissions: ["finance:view", "finance:manage"],
  },
  {
    icon: Users,
    label: "Clientes & Fornecedores",
    href: "/contacts",
    permissions: [
      "customers:view",
      "customers:manage",
      "suppliers:view",
      "suppliers:manage",
    ],
  },
  {
    icon: BarChart3,
    label: "Relatórios",
    href: "/reports",
    permissions: ["reports:view"],
  },
  {
    icon: User,
    label: "Usuários",
    href: "/users",
    permissions: ["users:view", "users:manage"],
  },
  {
    icon: Settings,
    label: "Configurações",
    href: "/settings",
    permissions: ["settings:view", "settings:manage"],
  },
];

interface Notification {
  id: number;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const { user, company, logout, hasAnyPermission } = useAuth();

  const { data: notifications = [] } = useQuery<Notification[]>({
    queryKey: ["/api/notifications"],
    queryFn: async () => {
      const res = await fetch("/api/notifications?unread=true");
      if (!res.ok) return [];
      return res.json();
    },
    refetchInterval: 30000,
  });

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const handleLogout = async () => {
    await logout();
    setLocation("/login");
  };

  const SidebarContent = () => (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex h-16 items-center px-6 border-b border-sidebar-border">
        <div className="flex items-center gap-2 font-heading font-bold text-xl tracking-tight">
          <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground">
            M
          </div>
          MarketMaster
        </div>
      </div>
      <div className="flex-1 overflow-auto py-4">
        <nav className="grid gap-1 px-2">
          {sidebarItems
            .filter((item) => {
              if (item.permissions.length === 0) return true;
              return hasAnyPermission(...item.permissions);
            })
            .map((item) => {
              const isActive = location === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  }`}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
        </nav>
      </div>
      <div className="border-t border-sidebar-border p-4">
        <Link href="/profile">
          <div className="flex items-center gap-3 rounded-lg bg-sidebar-accent/50 p-3 text-sm cursor-pointer hover:bg-sidebar-accent transition-colors">
            <Avatar className="h-9 w-9 border border-sidebar-border">
              <AvatarFallback>
                {user ? getInitials(user.name) : "?"}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col overflow-hidden">
              <span className="truncate font-semibold text-sidebar-foreground">
                {user?.name || "Usuário"}
              </span>
              <span className="truncate text-xs text-sidebar-foreground/70">
                {user?.role?.name || "Carregando..."}
              </span>
            </div>
          </div>
        </Link>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background flex">
      {/* Desktop Sidebar */}
      <aside className="hidden w-64 border-r border-border bg-sidebar md:block fixed inset-y-0 z-50">
        <SidebarContent />
      </aside>

      {/* Main Content */}
      <main className="flex-1 md:ml-64 flex flex-col min-h-screen">
        {/* Top Header */}
        <header className="sticky top-0 z-40 flex h-16 items-center gap-4 border-b border-border bg-background/80 px-6 backdrop-blur-sm shadow-sm">
          <Sheet open={isMobileOpen} onOpenChange={setIsMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-64 border-r-0">
              <SidebarContent />
            </SheetContent>
          </Sheet>

          <div className="flex-1 flex items-center gap-4">
            <div className="relative w-full max-w-sm hidden sm:block">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Buscar produtos, pedidos, clientes..."
                className="w-full bg-background pl-9 md:w-[300px] lg:w-[400px]"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="relative"
                  data-testid="button-notifications"
                >
                  <Bell className="h-5 w-5 text-muted-foreground" />
                  {unreadCount > 0 && (
                    <Badge
                      variant="destructive"
                      className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
                    >
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </Badge>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80">
                <DropdownMenuLabel>Notificações</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {notifications.length === 0 ? (
                  <div className="p-4 text-center text-sm text-muted-foreground">
                    Nenhuma notificação
                  </div>
                ) : (
                  notifications.slice(0, 5).map((notification) => (
                    <DropdownMenuItem
                      key={notification.id}
                      className="flex flex-col items-start gap-1 p-3"
                    >
                      <span className="font-medium text-sm">
                        {notification.title}
                      </span>
                      <span className="text-xs text-muted-foreground line-clamp-2">
                        {notification.message}
                      </span>
                    </DropdownMenuItem>
                  ))
                )}
                {notifications.length > 0 && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="justify-center text-primary"
                      onClick={() => setLocation("/notifications")}
                    >
                      Ver todas as notificações
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="gap-2 pl-2"
                  data-testid="button-user-menu"
                >
                  <span className="hidden sm:inline-block text-sm font-medium">
                    {company?.nomeFantasia ||
                      company?.razaoSocial ||
                      "Minha Loja"}
                  </span>
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>{user?.name || "Conta"}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => setLocation("/profile")}
                  data-testid="menu-profile"
                >
                  <User className="mr-2 h-4 w-4" /> Perfil
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setLocation("/settings")}
                  data-testid="menu-settings"
                >
                  <Settings className="mr-2 h-4 w-4" /> Configurações
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive"
                  onClick={handleLogout}
                  data-testid="menu-logout"
                >
                  <LogOut className="mr-2 h-4 w-4" /> Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 p-6 overflow-auto">{children}</div>
      </main>
    </div>
  );
}
