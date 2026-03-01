import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface Role {
  id: number;
  name: string;
  description: string | null;
}

interface Company {
  id: number;
  cnpj: string;
  razaoSocial: string;
  nomeFantasia: string | null;
  email?: string | null;
  phone?: string | null;
}

interface Unit {
  id: number;
  code: string;
  name: string;
}

interface User {
  id: string;
  displayCode?: string;
  name: string;
  email: string;
  role: Role;
  permissions: string[];
}

interface ContextUnit {
  unitId: number;
  unitName: string;
  unitCode: string;
  roleId: number;
  roleName: string;
}

interface CompanyContext {
  companyId: number;
  isDefault: boolean;
  company: Company & { isActive?: boolean | null };
  units: ContextUnit[];
}

interface AuthContextType {
  user: User | null;
  company: Company | null;
  unit: Unit | null;
  contexts: CompanyContext[];
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshContexts: () => Promise<void>;
  selectContext: (companyId: number, unitId?: number) => Promise<void>;
  hasPermission: (permission: string) => boolean;
  hasAnyPermission: (...permissions: string[]) => boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [isInitialized, setIsInitialized] = useState(false);
  const [contexts, setContexts] = useState<CompanyContext[]>([]);

  const {
    data: authData,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["/api/auth/me"],
    queryFn: async () => {
      const res = await fetch("/api/auth/me");
      if (!res.ok) {
        if (res.status === 401) {
          return null;
        }
        throw new Error("Failed to fetch user");
      }
      const body = await res.json();
      setContexts(Array.isArray(body?.contexts) ? body.contexts : []);
      return body;
    },
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (!isLoading) {
      setIsInitialized(true);
    }
  }, [isLoading]);

  const loginMutation = useMutation({
    mutationFn: async ({
      email,
      password,
    }: {
      email: string;
      password: string;
    }) => {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Erro ao fazer login");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/auth/logout", { method: "POST" });
      if (!res.ok) throw new Error("Erro ao sair");
      return res.json();
    },
    onSuccess: () => {
      queryClient.clear();
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    },
  });

  const login = async (email: string, password: string) => {
    await loginMutation.mutateAsync({ email, password });
  };

  const logout = async () => {
    await logoutMutation.mutateAsync();
    setContexts([]);
  };

  const refreshContexts = async () => {
    const res = await fetch("/api/auth/contexts");
    if (!res.ok) {
      if (res.status === 401) {
        setContexts([]);
        return;
      }
      throw new Error("Erro ao atualizar contextos");
    }
    const body = await res.json();
    setContexts(Array.isArray(body?.contexts) ? body.contexts : []);
  };

  const selectContext = async (companyId: number, unitId?: number) => {
    const res = await fetch("/api/auth/context/select", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyId, unitId }),
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || "Erro ao selecionar contexto");
    }
    await queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    await refreshContexts();
  };

  const hasPermission = (permission: string): boolean => {
    if (!authData?.user?.permissions) return false;
    return authData.user.permissions.includes(permission);
  };

  const hasAnyPermission = (...permissions: string[]): boolean => {
    if (!authData?.user?.permissions) return false;
    return permissions.some((p) => authData.user.permissions.includes(p));
  };

  const value: AuthContextType = {
    user: authData?.user || null,
    company: authData?.company || null,
    unit: authData?.unit || null,
    contexts,
    isLoading: isLoading || !isInitialized,
    isAuthenticated: !!authData?.user,
    login,
    logout,
    refreshContexts,
    selectContext,
    hasPermission,
    hasAnyPermission,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
