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
  { module: "pos", action: "view", description: "Visualizar PDV" },
  { module: "pos", action: "sell", description: "Realizar vendas" },
  { module: "pos", action: "discount", description: "Aplicar descontos" },
  { module: "pos", action: "cancel", description: "Cancelar vendas" },
  { module: "inventory", action: "view", description: "Visualizar estoque" },
  { module: "inventory", action: "manage", description: "Gerenciar estoque" },
  { module: "inventory", action: "import", description: "Importar NFe" },
  { module: "customers", action: "view", description: "Visualizar clientes" },
  { module: "customers", action: "manage", description: "Gerenciar clientes" },
  {
    module: "suppliers",
    action: "view",
    description: "Visualizar fornecedores",
  },
  {
    module: "suppliers",
    action: "manage",
    description: "Gerenciar fornecedores",
  },
  { module: "finance", action: "view", description: "Visualizar financeiro" },
  { module: "finance", action: "manage", description: "Gerenciar contas" },
  { module: "reports", action: "view", description: "Visualizar relatórios" },
  {
    module: "settings",
    action: "view",
    description: "Visualizar configurações",
  },
  {
    module: "settings",
    action: "manage",
    description: "Gerenciar configurações",
  },
  { module: "fiscal", action: "view", description: "Visualizar fiscal" },
  {
    module: "fiscal",
    action: "manage",
    description: "Gerenciar fiscal (CSC, certificados)",
  },
  { module: "users", action: "view", description: "Visualizar usuários" },
  { module: "users", action: "manage", description: "Gerenciar usuários" },
];

const ROLE_TEMPLATES = {
  admin: {
    name: "Administrador",
    description: "Acesso total ao sistema",
    permissions: DEFAULT_PERMISSIONS.map((p) => `${p.module}:${p.action}`),
  },
  manager: {
    name: "Gerente",
    description:
      "Gerencia operações, sem acesso a configurações fiscais sensíveis",
    permissions: DEFAULT_PERMISSIONS.filter(
      (p) => !(p.module === "fiscal" && p.action === "manage")
    )
      .filter((p) => !(p.module === "users" && p.action === "manage"))
      .map((p) => `${p.module}:${p.action}`),
  },
  cashier: {
    name: "Caixa",
    description: "Apenas operações de PDV",
    permissions: ["pos:view", "pos:sell", "inventory:view", "customers:view"],
  },
  viewer: {
    name: "Visualizador",
    description: "Apenas visualização de dados",
    permissions: DEFAULT_PERMISSIONS.filter((p) => p.action === "view").map(
      (p) => `${p.module}:${p.action}`
    ),
  },
};

async function initializePermissions() {
  const existingPermissions = await db.select().from(permissions);
  if (existingPermissions.length === 0) {
    for (const perm of DEFAULT_PERMISSIONS) {
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
  if (!req.session.companyId) {
    return res.status(401).json({ error: "Não autenticado" });
  }

  try {
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
  if (!req.session.companyId) {
    return res.status(401).json({ error: "Não autenticado" });
  }

  try {
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
  if (!req.session.companyId) {
    return res.status(401).json({ error: "Não autenticado" });
  }

  try {
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
  if (!req.session.companyId) {
    return res.status(401).json({ error: "Não autenticado" });
  }

  try {
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

export { authRouter, getUserPermissions };
