import { Router } from "express";
import bcrypt from "bcryptjs";
import "./types";
import { db } from "./db";
import {
  companies,
  users,
  roles,
  permissions,
  rolePermissions,
  companySettings,
  insertCompanySchema,
  insertUserSchema,
  type Company,
  type User,
  type Role,
  type Permission,
} from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";

const authRouter = Router();

const DEFAULT_PERMISSIONS = [
  // PDV - Ponto de Venda
  { module: "pos", action: "view", description: "Acessar tela do PDV" },
  { module: "pos", action: "sell", description: "Realizar vendas" },
  { module: "pos", action: "discount", description: "Aplicar descontos" },
  {
    module: "pos",
    action: "discount_limit",
    description: "Desconto acima do limite",
  },
  { module: "pos", action: "cancel", description: "Cancelar vendas" },
  { module: "pos", action: "reprint", description: "Reimprimir cupons" },
  { module: "pos", action: "open_drawer", description: "Abrir gaveta" },
  { module: "pos", action: "sangria", description: "Realizar sangria" },
  { module: "pos", action: "suprimento", description: "Realizar suprimento" },
  { module: "pos", action: "credit_sale", description: "Vender a prazo/fiado" },

  // Estoque - Inventário
  { module: "inventory", action: "view", description: "Visualizar estoque" },
  { module: "inventory", action: "create", description: "Cadastrar produtos" },
  { module: "inventory", action: "edit", description: "Editar produtos" },
  { module: "inventory", action: "delete", description: "Excluir produtos" },
  { module: "inventory", action: "adjust", description: "Ajustar estoque" },
  {
    module: "inventory",
    action: "transfer",
    description: "Transferir estoque",
  },
  { module: "inventory", action: "import", description: "Importar NFe/XML" },
  { module: "inventory", action: "export", description: "Exportar produtos" },
  {
    module: "inventory",
    action: "view_cost",
    description: "Ver preço de custo",
  },
  { module: "inventory", action: "edit_price", description: "Alterar preços" },
  {
    module: "inventory",
    action: "view_margin",
    description: "Ver margem de lucro",
  },

  // Clientes
  { module: "customers", action: "view", description: "Visualizar clientes" },
  { module: "customers", action: "create", description: "Cadastrar clientes" },
  { module: "customers", action: "edit", description: "Editar clientes" },
  { module: "customers", action: "delete", description: "Excluir clientes" },
  {
    module: "customers",
    action: "view_credit",
    description: "Ver limite de crédito",
  },
  {
    module: "customers",
    action: "edit_credit",
    description: "Alterar limite de crédito",
  },
  {
    module: "customers",
    action: "view_history",
    description: "Ver histórico de compras",
  },

  // Fornecedores
  {
    module: "suppliers",
    action: "view",
    description: "Visualizar fornecedores",
  },
  {
    module: "suppliers",
    action: "create",
    description: "Cadastrar fornecedores",
  },
  { module: "suppliers", action: "edit", description: "Editar fornecedores" },
  {
    module: "suppliers",
    action: "delete",
    description: "Excluir fornecedores",
  },
  {
    module: "suppliers",
    action: "view_orders",
    description: "Ver pedidos de compra",
  },
  {
    module: "suppliers",
    action: "create_order",
    description: "Criar pedido de compra",
  },

  // Financeiro
  { module: "finance", action: "view", description: "Visualizar financeiro" },
  {
    module: "finance",
    action: "view_payables",
    description: "Ver contas a pagar",
  },
  {
    module: "finance",
    action: "create_payable",
    description: "Lançar conta a pagar",
  },
  { module: "finance", action: "pay", description: "Baixar pagamento" },
  {
    module: "finance",
    action: "view_receivables",
    description: "Ver contas a receber",
  },
  {
    module: "finance",
    action: "create_receivable",
    description: "Lançar conta a receber",
  },
  { module: "finance", action: "receive", description: "Baixar recebimento" },
  {
    module: "finance",
    action: "view_cashflow",
    description: "Ver fluxo de caixa",
  },
  {
    module: "finance",
    action: "delete_transaction",
    description: "Excluir lançamento",
  },
  {
    module: "finance",
    action: "edit_transaction",
    description: "Editar lançamento",
  },

  // Relatórios
  { module: "reports", action: "view", description: "Acessar relatórios" },
  { module: "reports", action: "sales", description: "Relatório de vendas" },
  {
    module: "reports",
    action: "inventory",
    description: "Relatório de estoque",
  },
  {
    module: "reports",
    action: "financial",
    description: "Relatório financeiro",
  },
  {
    module: "reports",
    action: "customers",
    description: "Relatório de clientes",
  },
  {
    module: "reports",
    action: "products",
    description: "Relatório de produtos",
  },
  { module: "reports", action: "cashiers", description: "Relatório de caixas" },
  { module: "reports", action: "export", description: "Exportar relatórios" },

  // Configurações
  {
    module: "settings",
    action: "view",
    description: "Visualizar configurações",
  },
  {
    module: "settings",
    action: "company",
    description: "Editar dados da empresa",
  },
  {
    module: "settings",
    action: "payments",
    description: "Configurar pagamentos/TEF",
  },
  {
    module: "settings",
    action: "equipment",
    description: "Configurar equipamentos",
  },
  { module: "settings", action: "backup", description: "Gerenciar backups" },

  // Fiscal
  { module: "fiscal", action: "view", description: "Visualizar fiscal" },
  { module: "fiscal", action: "emit_nfce", description: "Emitir NFC-e" },
  { module: "fiscal", action: "cancel_nfce", description: "Cancelar NFC-e" },
  { module: "fiscal", action: "emit_nfe", description: "Emitir NF-e" },
  { module: "fiscal", action: "cancel_nfe", description: "Cancelar NF-e" },
  {
    module: "fiscal",
    action: "manage_certs",
    description: "Gerenciar certificados",
  },
  { module: "fiscal", action: "sped", description: "Gerar SPED" },
  { module: "fiscal", action: "sintegra", description: "Gerar Sintegra" },

  // Usuários e Acessos
  { module: "users", action: "view", description: "Visualizar usuários" },
  { module: "users", action: "create", description: "Criar usuários" },
  { module: "users", action: "edit", description: "Editar usuários" },
  { module: "users", action: "delete", description: "Excluir usuários" },
  {
    module: "users",
    action: "manage",
    description: "Gerenciar perfis/permissões",
  },
  {
    module: "users",
    action: "reset_password",
    description: "Resetar senha de usuários",
  },
  {
    module: "users",
    action: "view_logs",
    description: "Ver logs de auditoria",
  },
];

const ROLE_TEMPLATES = {
  admin: {
    name: "Administrador",
    description: "Acesso total ao sistema",
    permissions: DEFAULT_PERMISSIONS.map((p) => `${p.module}:${p.action}`),
  },
  manager: {
    name: "Gerente",
    description: "Gerencia operações, relatórios e equipe",
    permissions: [
      // PDV completo
      "pos:view",
      "pos:sell",
      "pos:discount",
      "pos:discount_limit",
      "pos:cancel",
      "pos:reprint",
      "pos:open_drawer",
      "pos:sangria",
      "pos:suprimento",
      "pos:credit_sale",
      // Estoque completo (sem excluir)
      "inventory:view",
      "inventory:create",
      "inventory:edit",
      "inventory:adjust",
      "inventory:import",
      "inventory:export",
      "inventory:view_cost",
      "inventory:edit_price",
      "inventory:view_margin",
      // Clientes completo
      "customers:view",
      "customers:create",
      "customers:edit",
      "customers:delete",
      "customers:view_credit",
      "customers:edit_credit",
      "customers:view_history",
      // Fornecedores completo
      "suppliers:view",
      "suppliers:create",
      "suppliers:edit",
      "suppliers:delete",
      "suppliers:view_orders",
      "suppliers:create_order",
      // Financeiro (sem excluir)
      "finance:view",
      "finance:view_payables",
      "finance:create_payable",
      "finance:pay",
      "finance:view_receivables",
      "finance:create_receivable",
      "finance:receive",
      "finance:view_cashflow",
      "finance:edit_transaction",
      // Relatórios completo
      "reports:view",
      "reports:sales",
      "reports:inventory",
      "reports:financial",
      "reports:customers",
      "reports:products",
      "reports:cashiers",
      "reports:export",
      // Configurações (sem certificados)
      "settings:view",
      "settings:company",
      "settings:payments",
      "settings:equipment",
      // Fiscal (emissão apenas)
      "fiscal:view",
      "fiscal:emit_nfce",
      "fiscal:emit_nfe",
      // Usuários (visualizar apenas)
      "users:view",
    ],
  },
  cashier: {
    name: "Caixa",
    description: "Operações de PDV e consultas básicas",
    permissions: [
      "pos:view",
      "pos:sell",
      "pos:reprint",
      "inventory:view",
      "customers:view",
      "customers:create",
    ],
  },
  cashier_senior: {
    name: "Caixa Sênior",
    description: "Caixa com permissões extras de desconto e sangria",
    permissions: [
      "pos:view",
      "pos:sell",
      "pos:discount",
      "pos:reprint",
      "pos:sangria",
      "pos:suprimento",
      "inventory:view",
      "customers:view",
      "customers:create",
      "customers:edit",
    ],
  },
  stockist: {
    name: "Estoquista",
    description: "Gerenciamento de estoque e produtos",
    permissions: [
      "inventory:view",
      "inventory:create",
      "inventory:edit",
      "inventory:adjust",
      "inventory:transfer",
      "inventory:import",
      "inventory:export",
      "suppliers:view",
      "suppliers:view_orders",
    ],
  },
  financial: {
    name: "Financeiro",
    description: "Gestão de contas a pagar e receber",
    permissions: [
      "finance:view",
      "finance:view_payables",
      "finance:create_payable",
      "finance:pay",
      "finance:view_receivables",
      "finance:create_receivable",
      "finance:receive",
      "finance:view_cashflow",
      "finance:edit_transaction",
      "reports:view",
      "reports:financial",
      "reports:export",
      "customers:view",
      "customers:view_credit",
      "suppliers:view",
    ],
  },
  viewer: {
    name: "Visualizador",
    description: "Apenas visualização de dados",
    permissions: [
      "pos:view",
      "inventory:view",
      "customers:view",
      "suppliers:view",
      "finance:view",
      "finance:view_payables",
      "finance:view_receivables",
      "finance:view_cashflow",
      "reports:view",
      "settings:view",
      "fiscal:view",
      "users:view",
    ],
  },
};

async function initializePermissions() {
  const existingPermissions = await db.select().from(permissions);
  const existingKeys = new Set(
    existingPermissions.map((p) => `${p.module}:${p.action}`)
  );

  for (const perm of DEFAULT_PERMISSIONS) {
    const key = `${perm.module}:${perm.action}`;
    if (!existingKeys.has(key)) {
      await db.insert(permissions).values(perm);
    }
  }
}

async function createDefaultRolesForCompany(companyId: number) {
  const allPermissions = await db.select().from(permissions);
  const permissionMap = new Map(
    allPermissions.map((p) => [`${p.module}:${p.action}`, p.id])
  );

  for (const [key, template] of Object.entries(ROLE_TEMPLATES)) {
    const [role] = await db
      .insert(roles)
      .values({
        companyId,
        name: template.name,
        description: template.description,
        isSystemRole: true,
      })
      .returning();

    for (const permKey of template.permissions) {
      const permId = permissionMap.get(permKey);
      if (permId) {
        await db.insert(rolePermissions).values({
          roleId: role.id,
          permissionId: permId,
        });
      }
    }
  }
}

async function getUserPermissions(userId: string): Promise<string[]> {
  const user = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!user.length) return [];

  const rolePerms = await db
    .select({
      module: permissions.module,
      action: permissions.action,
    })
    .from(rolePermissions)
    .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
    .where(eq(rolePermissions.roleId, user[0].roleId));

  return rolePerms.map((p) => `${p.module}:${p.action}`);
}

const registerCompanySchema = z.object({
  cnpj: z.string().min(14).max(18),
  ie: z.string().optional(),
  razaoSocial: z.string().min(3),
  nomeFantasia: z.string().optional(),
  email: z.string().email(),
  phone: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zipCode: z.string().optional(),
  adminName: z.string().min(3),
  adminEmail: z.string().email(),
  adminPassword: z.string().min(6),
});

authRouter.post("/register", async (req, res) => {
  try {
    const data = registerCompanySchema.parse(req.body);

    const existingCompany = await db
      .select()
      .from(companies)
      .where(eq(companies.cnpj, data.cnpj.replace(/\D/g, "")))
      .limit(1);

    if (existingCompany.length > 0) {
      return res.status(400).json({ error: "CNPJ já cadastrado" });
    }

    await initializePermissions();

    const [company] = await db
      .insert(companies)
      .values({
        cnpj: data.cnpj.replace(/\D/g, ""),
        razaoSocial: data.razaoSocial,
        nomeFantasia: data.nomeFantasia || data.razaoSocial,
        email: data.email,
        phone: data.phone,
        address: data.address,
        city: data.city,
        state: data.state,
        zipCode: data.zipCode,
      })
      .returning();

    await createDefaultRolesForCompany(company.id);

    await db.insert(companySettings).values({
      companyId: company.id,
      cnpj: company.cnpj,
      ie: data.ie || null,
      razaoSocial: company.razaoSocial,
      nomeFantasia: company.nomeFantasia,
    });

    const adminRole = await db
      .select()
      .from(roles)
      .where(
        and(eq(roles.companyId, company.id), eq(roles.name, "Administrador"))
      )
      .limit(1);

    const hashedPassword = await bcrypt.hash(data.adminPassword, 10);

    const [adminUser] = await db
      .insert(users)
      .values({
        companyId: company.id,
        roleId: adminRole[0].id,
        username: data.adminEmail.split("@")[0],
        email: data.adminEmail,
        password: hashedPassword,
        name: data.adminName,
      })
      .returning();

    const userPermissions = await getUserPermissions(adminUser.id);

    req.session.userId = adminUser.id;
    req.session.companyId = company.id;
    req.session.roleId = adminRole[0].id;

    res.json({
      message: "Empresa cadastrada com sucesso",
      user: {
        id: adminUser.id,
        name: adminUser.name,
        email: adminUser.email,
        role: adminRole[0],
        permissions: userPermissions,
      },
      company: {
        id: company.id,
        cnpj: company.cnpj,
        razaoSocial: company.razaoSocial,
        nomeFantasia: company.nomeFantasia,
      },
    });
  } catch (error) {
    console.error("Registration error:", error);
    if (error instanceof z.ZodError) {
      return res
        .status(400)
        .json({ error: "Dados inválidos", details: error.errors });
    }
    res.status(500).json({ error: "Erro ao cadastrar empresa" });
  }
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

authRouter.post("/login", async (req, res) => {
  try {
    const data = loginSchema.parse(req.body);

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, data.email))
      .limit(1);

    if (!user) {
      return res.status(401).json({ error: "Email ou senha inválidos" });
    }

    if (!user.isActive) {
      return res.status(401).json({ error: "Usuário desativado" });
    }

    const validPassword = await bcrypt.compare(data.password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: "Email ou senha inválidos" });
    }

    const [company] = await db
      .select()
      .from(companies)
      .where(eq(companies.id, user.companyId))
      .limit(1);

    if (!company || !company.isActive) {
      return res.status(401).json({ error: "Empresa desativada" });
    }

    const [role] = await db
      .select()
      .from(roles)
      .where(eq(roles.id, user.roleId))
      .limit(1);

    const userPermissions = await getUserPermissions(user.id);

    await db
      .update(users)
      .set({ lastLogin: new Date() })
      .where(eq(users.id, user.id));

    req.session.userId = user.id;
    req.session.companyId = user.companyId;
    req.session.roleId = user.roleId;

    res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role,
        permissions: userPermissions,
      },
      company: {
        id: company.id,
        cnpj: company.cnpj,
        razaoSocial: company.razaoSocial,
        nomeFantasia: company.nomeFantasia,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Dados inválidos" });
    }
    res.status(500).json({ error: "Erro ao fazer login" });
  }
});

authRouter.post("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: "Erro ao sair" });
    }
    res.json({ message: "Logout realizado com sucesso" });
  });
});

authRouter.get("/me", async (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: "Não autenticado" });
  }

  try {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, req.session.userId))
      .limit(1);

    if (!user) {
      return res.status(401).json({ error: "Usuário não encontrado" });
    }

    const [company] = await db
      .select()
      .from(companies)
      .where(eq(companies.id, user.companyId))
      .limit(1);

    const [role] = await db
      .select()
      .from(roles)
      .where(eq(roles.id, user.roleId))
      .limit(1);

    const userPermissions = await getUserPermissions(user.id);

    res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role,
        permissions: userPermissions,
      },
      company: {
        id: company.id,
        cnpj: company.cnpj,
        razaoSocial: company.razaoSocial,
        nomeFantasia: company.nomeFantasia,
      },
    });
  } catch (error) {
    console.error("Get user error:", error);
    res.status(500).json({ error: "Erro ao buscar usuário" });
  }
});

authRouter.get("/roles", async (req, res) => {
  if (!req.session.companyId) {
    return res.status(401).json({ error: "Não autenticado" });
  }

  try {
    const companyRoles = await db
      .select()
      .from(roles)
      .where(eq(roles.companyId, req.session.companyId));
    res.json(companyRoles);
  } catch (error) {
    res.status(500).json({ error: "Erro ao buscar perfis" });
  }
});

authRouter.get("/users", async (req, res) => {
  if (!req.session.companyId || !req.session.userId) {
    return res.status(401).json({ error: "Não autenticado" });
  }

  try {
    const userPerms = await getUserPermissions(req.session.userId);
    if (
      !userPerms.includes("users:view") &&
      !userPerms.includes("users:manage")
    ) {
      return res.status(403).json({ error: "Sem permissão para esta ação" });
    }

    const companyUsers = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        username: users.username,
        phone: users.phone,
        isActive: users.isActive,
        lastLogin: users.lastLogin,
        createdAt: users.createdAt,
        roleId: users.roleId,
        roleName: roles.name,
      })
      .from(users)
      .leftJoin(roles, eq(users.roleId, roles.id))
      .where(eq(users.companyId, req.session.companyId));

    res.json(companyUsers);
  } catch (error) {
    res.status(500).json({ error: "Erro ao buscar usuários" });
  }
});

const createUserSchema = z.object({
  name: z.string().min(3),
  email: z.string().email(),
  password: z.string().min(6),
  phone: z.string().optional(),
  roleId: z.number(),
});

authRouter.post("/users", async (req, res) => {
  if (!req.session.companyId || !req.session.userId) {
    return res.status(401).json({ error: "Não autenticado" });
  }

  try {
    const userPerms = await getUserPermissions(req.session.userId);
    if (!userPerms.includes("users:manage")) {
      return res.status(403).json({ error: "Sem permissão para esta ação" });
    }

    const data = createUserSchema.parse(req.body);

    const existingUser = await db
      .select()
      .from(users)
      .where(
        and(
          eq(users.email, data.email),
          eq(users.companyId, req.session.companyId)
        )
      )
      .limit(1);

    if (existingUser.length > 0) {
      return res
        .status(400)
        .json({ error: "Email já cadastrado nesta empresa" });
    }

    const hashedPassword = await bcrypt.hash(data.password, 10);

    const [newUser] = await db
      .insert(users)
      .values({
        companyId: req.session.companyId,
        roleId: data.roleId,
        username: data.email.split("@")[0],
        email: data.email,
        password: hashedPassword,
        name: data.name,
        phone: data.phone,
      })
      .returning();

    res.json({
      id: newUser.id,
      name: newUser.name,
      email: newUser.email,
    });
  } catch (error) {
    console.error("Create user error:", error);
    if (error instanceof z.ZodError) {
      return res
        .status(400)
        .json({ error: "Dados inválidos", details: error.errors });
    }
    res.status(500).json({ error: "Erro ao criar usuário" });
  }
});

authRouter.patch("/users/:id", async (req, res) => {
  if (!req.session.companyId || !req.session.userId) {
    return res.status(401).json({ error: "Não autenticado" });
  }

  try {
    const userPerms = await getUserPermissions(req.session.userId);
    if (!userPerms.includes("users:manage")) {
      return res.status(403).json({ error: "Sem permissão para esta ação" });
    }

    const userId = req.params.id;
    const { name, email, phone, roleId, isActive, password } = req.body;

    const updateData: any = {};
    if (name) updateData.name = name;
    if (email) updateData.email = email;
    if (phone !== undefined) updateData.phone = phone;
    if (roleId) updateData.roleId = roleId;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (password) updateData.password = await bcrypt.hash(password, 10);

    await db
      .update(users)
      .set(updateData)
      .where(
        and(eq(users.id, userId), eq(users.companyId, req.session.companyId))
      );

    res.json({ message: "Usuário atualizado com sucesso" });
  } catch (error) {
    res.status(500).json({ error: "Erro ao atualizar usuário" });
  }
});

authRouter.delete("/users/:id", async (req, res) => {
  if (!req.session.companyId || !req.session.userId) {
    return res.status(401).json({ error: "Não autenticado" });
  }

  try {
    const userPerms = await getUserPermissions(req.session.userId);
    if (!userPerms.includes("users:manage")) {
      return res.status(403).json({ error: "Sem permissão para esta ação" });
    }

    const userId = req.params.id;

    if (userId === req.session.userId) {
      return res
        .status(400)
        .json({ error: "Não é possível excluir o próprio usuário" });
    }

    await db
      .delete(users)
      .where(
        and(eq(users.id, userId), eq(users.companyId, req.session.companyId))
      );

    res.json({ message: "Usuário excluído com sucesso" });
  } catch (error) {
    res.status(500).json({ error: "Erro ao excluir usuário" });
  }
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(6),
});

authRouter.post("/change-password", async (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: "Não autenticado" });
  }

  try {
    const { currentPassword, newPassword } = changePasswordSchema.parse(
      req.body
    );

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, req.session.userId))
      .limit(1);

    if (!user) {
      return res.status(404).json({ error: "Usuário não encontrado" });
    }

    const validPassword = await bcrypt.compare(currentPassword, user.password);
    if (!validPassword) {
      return res.status(400).json({ error: "Senha atual incorreta" });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await db
      .update(users)
      .set({ password: hashedPassword })
      .where(eq(users.id, req.session.userId));

    res.json({ message: "Senha alterada com sucesso" });
  } catch (error) {
    console.error("Change password error:", error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Dados inválidos" });
    }
    res.status(500).json({ error: "Erro ao alterar senha" });
  }
});

authRouter.get("/permissions", async (req, res) => {
  try {
    const allPermissions = await db.select().from(permissions);
    res.json(allPermissions);
  } catch (error) {
    res.status(500).json({ error: "Erro ao buscar permissões" });
  }
});

authRouter.get("/roles/:id/permissions", async (req, res) => {
  if (!req.session.companyId || !req.session.userId) {
    return res.status(401).json({ error: "Não autenticado" });
  }

  try {
    const userPerms = await getUserPermissions(req.session.userId);
    if (
      !userPerms.includes("users:view") &&
      !userPerms.includes("users:manage")
    ) {
      return res.status(403).json({ error: "Sem permissão para esta ação" });
    }

    const roleId = parseInt(req.params.id);
    const rolePerms = await db
      .select({
        permissionId: rolePermissions.permissionId,
      })
      .from(rolePermissions)
      .where(eq(rolePermissions.roleId, roleId));

    res.json(rolePerms.map((p) => p.permissionId));
  } catch (error) {
    res.status(500).json({ error: "Erro ao buscar permissões do perfil" });
  }
});

authRouter.put("/roles/:id/permissions", async (req, res) => {
  if (!req.session.companyId || !req.session.userId) {
    return res.status(401).json({ error: "Não autenticado" });
  }

  try {
    const userPerms = await getUserPermissions(req.session.userId);
    if (!userPerms.includes("users:manage")) {
      return res.status(403).json({ error: "Sem permissão para esta ação" });
    }

    const roleId = parseInt(req.params.id);
    const { permissionIds } = req.body as { permissionIds: number[] };

    await db.delete(rolePermissions).where(eq(rolePermissions.roleId, roleId));

    for (const permissionId of permissionIds) {
      await db.insert(rolePermissions).values({ roleId, permissionId });
    }

    res.json({ message: "Permissões atualizadas com sucesso" });
  } catch (error) {
    res.status(500).json({ error: "Erro ao atualizar permissões" });
  }
});

export { authRouter, getUserPermissions, initializePermissions };
