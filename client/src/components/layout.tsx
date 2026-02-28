import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Store,
  BarChart3,
  Wallet,
  CreditCard,
  Settings,
  Users,
  LogOut,
  Search,
  Bell,
  Menu,
  X,
  Home,
  ChevronDown,
  ChevronRight,
  User,
  History,
  FileText,
  Shield,
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
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useQuery } from "@tanstack/react-query";

type SidebarItem = {
  icon: any;
  label: string;
  href: string;
  permissions: string[];
};

type SidebarSection = {
  title: string;
  items: SidebarItem[];
};

const sidebarSections: SidebarSection[] = [
  {
    title: "Operacoes",
    items: [
      { icon: LayoutDashboard, label: "Visao Executiva", href: "/", permissions: [] },
      {
        icon: ShoppingCart,
        label: "Frente de Caixa (PDV)",
        href: "/pos",
        permissions: ["pos:view", "pos:sell"],
      },
      {
        icon: Store,
        label: "Comercial (Vendas e Pedidos)",
        href: "/sales",
        permissions: ["reports:view"],
      },
      {
        icon: Wallet,
        label: "Gestao Financeira",
        href: "/finance",
        permissions: ["finance:view", "finance:manage"],
      },
      {
        icon: History,
        label: "Conferencia de Caixa",
        href: "/cash-history",
        permissions: ["pos:cash_history"],
      },
      {
        icon: BarChart3,
        label: "Relatorios Gerenciais",
        href: "/reports",
        permissions: ["reports:view"],
      },
    ],
  },
  {
    title: "Cadastros",
    items: [
      {
        icon: Package,
        label: "Catalogo e Estoque",
        href: "/inventory",
        permissions: ["inventory:view", "inventory:manage"],
      },
      {
        icon: Users,
        label: "Clientes / Fornecedores / Transportadoras",
        href: "/contacts",
        permissions: [
          "customers:view",
          "customers:manage",
          "suppliers:view",
          "suppliers:manage",
        ],
      },
      {
        icon: CreditCard,
        label: "Meios de Pagamento",
        href: "/payment-methods",
        permissions: ["settings:payments"],
      },
      {
        icon: FileText,
        label: "Tabelas de Apoio",
        href: "/tables",
        permissions: ["inventory:view", "settings:view"],
      },
      {
        icon: User,
        label: "Usuarios e Permissoes",
        href: "/users",
        permissions: ["users:view", "users:manage"],
      },
    ],
  },
  {
    title: "Compliance Fiscal",
    items: [
      {
        icon: FileText,
        label: "Operacoes Fiscais",
        href: "/fiscal-central",
        permissions: ["fiscal:view", "fiscal:manage"],
      },
      {
        icon: FileText,
        label: "Emissao Fiscal (NF-e)",
        href: "/fiscal-documents",
        permissions: ["fiscal:view", "fiscal:manage"],
      },
      {
        icon: Shield,
        label: "Certificado Digital",
        href: "/certificates",
        permissions: ["fiscal:view", "fiscal:manage"],
      },
      {
        icon: FileText,
        label: "Controle de Numeracao (NSA)",
        href: "/sequential-numbering",
        permissions: ["fiscal:view", "fiscal:manage"],
      },
      {
        icon: FileText,
        label: "Parametros Fiscais",
        href: "/fiscal-config",
        permissions: ["fiscal:view", "fiscal:manage"],
      },
    ],
  },
  {
    title: "Administracao",
    items: [
      {
        icon: Settings,
        label: "Preferencias do Sistema",
        href: "/settings",
        permissions: ["settings:view", "settings:manage"],
      },
    ],
  },
];

const sidebarQuickSections = [
  { title: "OPERACOES", sectionTitle: "Operacoes", href: "/", icon: LayoutDashboard },
  { title: "CADASTROS", sectionTitle: "Cadastros", href: "/inventory", icon: FileText },
  { title: "COMPLIANCE FISCAL", sectionTitle: "Compliance Fiscal", href: "/fiscal-central", icon: Shield },
  { title: "ADMINISTRACAO", sectionTitle: "Administracao", href: "/settings", icon: Settings },
];

interface Notification {
  id: number;
  type: string;
  title: string;
  message: string;
  referenceType?: string | null;
  isRead: boolean;
  createdAt: string;
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const SIDEBAR_VISIBILITY_KEY = "arqis_sidebar_visible";
  const [location, setLocation] = useLocation();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [activeSidebarSection, setActiveSidebarSection] = useState<string | null>("Operacoes");
  const [isDesktopSidebarOpen, setIsDesktopSidebarOpen] = useState<boolean>(() => {
    try {
      const raw = window.localStorage.getItem(SIDEBAR_VISIBILITY_KEY);
      return raw === null ? true : raw === "true";
    } catch {
      return true;
    }
  });
  const { user, company, logout, hasAnyPermission } = useAuth();

  useEffect(() => {
    try {
      window.localStorage.setItem(
        SIDEBAR_VISIBILITY_KEY,
        String(isDesktopSidebarOpen),
      );
    } catch {
      // ignore localStorage write errors
    }
  }, [isDesktopSidebarOpen]);

  useEffect(() => {
    const matched = sidebarSections.find((section) =>
      section.items.some((item) => item.href === location)
    );
    if (matched) {
      setActiveSidebarSection(matched.title);
    }
  }, [location]);

  const { data: notifications = [] } = useQuery<Notification[]>({
    queryKey: ["/api/notifications"],
    queryFn: async () => {
      const res = await fetch("/api/notifications?unread=true");
      if (!res.ok) return [];
      return res.json();
    },
    refetchInterval: 50000,
  });

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const getNotificationTarget = (notification: Notification) => {
    const type = String(notification.type || "").toLowerCase();
    const referenceType = String(notification.referenceType || "").toLowerCase();

    if (type.includes("fiscal") || referenceType === "sales") {
      return "/fiscal-documents";
    }
    if (type.includes("payables") || referenceType === "payables") {
      return "/finance?tab=payables";
    }
    if (type.includes("receivables") || referenceType === "receivables") {
      return "/finance?tab=receivables";
    }
    if (type.includes("expiration") || referenceType === "products") {
      return "/inventory";
    }
    return "/notifications";
  };

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
    <div className="flex h-full flex-col bg-[linear-gradient(180deg,#3b3f49_0%,#252a33_100%)] text-[#f2f2f2]">
      <div className="flex h-16 items-center px-6 border-b border-white/10">
        <div className="flex w-full items-center justify-center">
          <Link href="/">
            <img
              src="/images/Arqis-branco.png"
              alt="Arqis"
              className="block h-9 w-auto cursor-pointer object-contain"
              data-testid="image-sidebar-brand"
            />
          </Link>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto overflow-x-hidden py-4">
                <nav className="grid gap-2 px-3">
          {sidebarQuickSections.map((section) => {
            const isActive = activeSidebarSection === section.sectionTitle;
            const subItems =
              sidebarSections
                .find((group) => group.title === section.sectionTitle)
                ?.items.filter((item) => {
                  if (item.permissions.length === 0) return true;
                  return hasAnyPermission(...item.permissions);
                }) || [];

            return (
              <div key={section.title} className="space-y-1">
                <button
                  type="button"
                  onClick={() =>
                    setActiveSidebarSection((prev) =>
                      prev === section.sectionTitle ? null : section.sectionTitle
                    )
                  }
                  className={`flex w-full items-center justify-between rounded-xl px-4 py-3 text-[13px] font-semibold tracking-wide text-[#d7dcec] transition-colors ${
                    isActive
                      ? "bg-[linear-gradient(90deg,#405a88_0%,#354867_100%)] text-white"
                      : "hover:bg-white/8 hover:text-white"
                  }`}
                  data-testid={`button-section-${section.title.toLowerCase().replace(/\s+/g, "-")}`}
                >
                  <span className="flex items-center gap-3">
                    <section.icon className="h-4 w-4" />
                    {section.title}
                  </span>
                  <ChevronRight
                    className={`h-3.5 w-3.5 opacity-80 transition-transform ${
                      isActive ? "rotate-90" : ""
                    }`}
                  />
                </button>

                {isActive && subItems.length > 0 && (
                  <div className="ml-2 space-y-1 border-l border-white/15 pl-2">
                    {subItems.map((item) => {
                      const isSubActive = location === item.href;
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          className={`flex items-start gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors ${
                            isSubActive
                              ? "bg-black/40 text-white shadow-sm"
                              : "text-white/80 hover:bg-white/10 hover:text-white"
                          }`}
                        >
                          <item.icon className="mt-0.5 h-4 w-4 shrink-0" />
                          <span className="min-w-0 whitespace-normal break-words leading-snug">
                            {item.label}
                          </span>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
      </div>
      <div className="border-t border-white/10 p-4">
        <Link href="/profile">
          <div className="flex items-center gap-3 rounded-lg bg-white/5 p-3 text-sm cursor-pointer hover:bg-white/10 transition-colors">
            <Avatar className="h-9 w-9 border border-white/20">
              <AvatarFallback className="bg-black/20 text-white font-semibold tracking-wide">
                {user ? getInitials(user.name) : "?"}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col overflow-hidden">
              <span className="truncate font-semibold text-white">
                {user?.name || "Usuário"}
              </span>
              <span className="truncate text-xs text-white/70">
                {user?.role?.name || "Carregando..."}
              </span>
            </div>
          </div>
        </Link>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#e8eaf1] flex">
      {/* Desktop Sidebar */}
      <aside
        className={`hidden border-r border-white/10 bg-[#2f2f31] md:block fixed inset-y-0 z-50 transition-transform duration-200 ${
          isDesktopSidebarOpen ? "w-[270px] translate-x-0" : "w-[270px] -translate-x-full"
        }`}
      >
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-2 top-2 z-[60] hidden md:inline-flex text-white/80 hover:bg-white/10 hover:text-white"
          onClick={() => setIsDesktopSidebarOpen(false)}
          data-testid="button-close-desktop-sidebar"
          title="Fechar menu"
        >
          <X className="h-4 w-4" />
        </Button>
        <SidebarContent />
      </aside>

      {!isDesktopSidebarOpen && (
        <>
          <Button
            variant="ghost"
            size="icon"
            className="fixed left-2 top-2 z-50 hidden md:inline-flex bg-transparent shadow-none hover:bg-transparent"
            onClick={() => setLocation("/")}
            data-testid="button-home-desktop-sidebar-collapsed"
            title="Ir para Dashboard"
          >
            <Home className="h-5 w-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="fixed left-12 top-2 z-50 hidden md:inline-flex bg-transparent shadow-none hover:bg-transparent"
            onClick={() => setIsDesktopSidebarOpen(true)}
            data-testid="button-open-desktop-sidebar"
            title="Abrir menu"
          >
            <Menu className="h-5 w-5" />
          </Button>
        </>
      )}

      {/* Main Content */}
      <main
        className={`flex-1 flex flex-col min-h-screen transition-[margin] duration-200 ${
          isDesktopSidebarOpen ? "md:ml-[270px]" : "md:ml-0"
        }`}
      >
        {/* Top Header */}
        <header className="sticky top-0 z-40 flex h-16 items-center gap-4 border-b border-[#d8d8de] bg-[#f7f7f8] px-6 shadow-sm">
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
                      className="flex flex-col items-start gap-1 rounded-md border border-transparent p-3 text-foreground focus:bg-transparent focus:text-foreground data-[highlighted]:bg-transparent data-[highlighted]:border-border data-[highlighted]:text-foreground"
                      onClick={() => setLocation(getNotificationTarget(notification))}
                    >
                      <span className="font-medium text-sm text-foreground data-[highlighted]:text-foreground">
                        {notification.title}
                      </span>
                      <span className="text-xs text-muted-foreground line-clamp-2 data-[highlighted]:text-muted-foreground">
                        {notification.message}
                      </span>
                    </DropdownMenuItem>
                  ))
                )}
                {notifications.length > 0 && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="justify-center rounded-md border border-transparent text-primary focus:bg-transparent focus:text-primary data-[highlighted]:bg-transparent data-[highlighted]:border-border data-[highlighted]:text-primary"
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
                  <Avatar className="h-8 w-8 border border-[#cfd5e4]">
                    <AvatarFallback className="bg-[#4f6b9a] text-white text-xs">
                      {user ? getInitials(user.name) : "?"}
                    </AvatarFallback>
                  </Avatar>
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
        <div className="flex-1 overflow-auto p-6">{children}</div>
      </main>
    </div>
  );
}
