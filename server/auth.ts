import { Router } from "express";
import bcrypt from "bcryptjs";
import { createHash, randomInt } from "crypto";
import "./types";
import { db } from "./db";
import {
  companies,
  users,
  roles,
  permissions,
  rolePermissions,
  companySettings,
  paymentMachines,
  companyOnboardingCodes,
  passwordResetCodes,
  posTerminals,
  insertCompanySchema,
  insertUserSchema,
  type Company,
  type User,
  type Role,
  type Permission,
} from "@shared/schema";
import { eq, and, isNull, desc, ilike, or, ne, inArray, asc, sql } from "drizzle-orm";
import { z } from "zod";
import { validateMercadoPagoSettings } from "./payment-service";
import { validateStoneSettings } from "./stone-connect";

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
  { module: "pos", action: "cash_open", description: "Abrir caixa" },
  { module: "pos", action: "cash_close", description: "Fechar caixa" },
  {
    module: "pos",
    action: "cash_history",
    description: "Ver histórico de caixa",
  },
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
    action: "edit",
    description: "Editar configurações gerais",
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
  { module: "fiscal", action: "manage", description: "Gerenciar fiscal" },
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

async function createDefaultRolesForCompany(tx: any, companyId: number) {
  const allPermissions = await tx.select().from(permissions);
  const permissionMap = new Map(
    allPermissions.map((p: Permission) => [`${p.module}:${p.action}`, p.id])
  );

  for (const [key, template] of Object.entries(ROLE_TEMPLATES)) {
    const [role] = await tx
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
        await tx.insert(rolePermissions).values({
          roleId: role.id,
          permissionId: permId,
          companyId,
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

const managerCreateCompanySchema = z.object({
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
  adminPassword: z.string().min(6).optional(),
  stoneEnabled: z.boolean().optional(),
  stoneClientId: z.string().optional(),
  stoneClientSecret: z.string().optional(),
  stoneTerminalId: z.string().optional(),
  stoneEnvironment: z.enum(["producao", "homologacao"]).optional(),
  mpEnabled: z.boolean().optional(),
  mpAccessToken: z.string().optional(),
  mpTerminalId: z.string().optional(),
  printerEnabled: z.boolean().optional(),
  printerModel: z.string().optional(),
  printerPort: z.string().optional(),
  printerBaudRate: z.coerce.number().int().optional(),
  printerColumns: z.coerce.number().int().optional(),
  printerCutCommand: z.boolean().optional(),
  printerBeepOnSale: z.boolean().optional(),
  receiptHeaderText: z.string().optional(),
  receiptFooterText: z.string().optional(),
  receiptShowSeller: z.boolean().optional(),
  nfcePrintLayout: z
    .object({
      paperWidth: z.enum(["auto", "58mm", "80mm"]).optional(),
      fontSize: z.enum(["auto", "small", "normal"]).optional(),
      lineSpacing: z.enum(["compact", "normal", "comfortable"]).optional(),
      compactItems: z.boolean().optional(),
      itemDescriptionLines: z.coerce.number().int().min(1).max(3).optional(),
      showProtocol: z.boolean().optional(),
      showAccessKey: z.boolean().optional(),
      showPayments: z.boolean().optional(),
      showQrCode: z.boolean().optional(),
      showCustomer: z.boolean().optional(),
      showCustomerDocument: z.boolean().optional(),
      showTaxes: z.boolean().optional(),
    })
    .optional(),
  nfeDanfeLayout: z
    .object({
      fontSize: z.enum(["small", "normal"]).optional(),
      lineSpacing: z.enum(["compact", "normal", "comfortable"]).optional(),
      itemDescriptionLines: z.coerce.number().int().min(1).max(4).optional(),
      logoFit: z.enum(["contain", "cover", "pad"]).optional(),
      showAccessKey: z.boolean().optional(),
      showCustomerDocument: z.boolean().optional(),
      showTaxes: z.boolean().optional(),
      headerText: z.string().optional(),
      footerText: z.string().optional(),
    })
    .optional(),
  danfeLogoUrl: z.string().optional(),
  initialMachines: z
    .array(
      z.object({
        key: z.string().min(1),
        name: z.string().min(1),
        provider: z.enum(["mercadopago", "stone"]),
        mpTerminalId: z.string().optional(),
        stoneTerminalId: z.string().optional(),
      }),
    )
    .max(20)
    .optional(),
  initialTerminals: z
    .array(
      z.object({
        name: z.string().min(1),
        code: z.string().optional(),
        paymentProvider: z
          .enum(["company_default", "mercadopago", "stone"])
          .optional(),
        paymentMachineKey: z.string().optional(),
        mpTerminalId: z.string().optional(),
        stoneTerminalId: z.string().optional(),
      }),
    )
    .max(10)
    .optional(),
});

const managerResendInviteSchema = z.object({
  cnpj: z.string().min(14).max(18),
  adminEmail: z.string().email(),
});

const managerCreateCompanyUserSchema = z.object({
  companyId: z.number().int().positive(),
  name: z.string().min(3),
  email: z.string().email(),
  roleName: z.string().min(2),
  password: z.string().min(6).optional(),
});

const managerUpdateCompanySchema = z.object({
  companyId: z.number().int().positive(),
  userId: z.string().min(1),
  cnpj: z.string().min(14).max(18),
  razaoSocial: z.string().min(3),
  nomeFantasia: z.string().optional(),
  companyEmail: z.string().email().optional().or(z.literal("")),
  companyPhone: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zipCode: z.string().optional(),
  adminName: z.string().min(3),
  adminEmail: z.string().email(),
  adminPassword: z.string().min(6).optional(),
  stoneEnabled: z.boolean().optional(),
  stoneClientId: z.string().optional(),
  stoneClientSecret: z.string().optional(),
  stoneTerminalId: z.string().optional(),
  stoneEnvironment: z.enum(["producao", "homologacao"]).optional(),
  mpEnabled: z.boolean().optional(),
  mpAccessToken: z.string().optional(),
  mpTerminalId: z.string().optional(),
  printerEnabled: z.boolean().optional(),
  printerModel: z.string().optional(),
  printerPort: z.string().optional(),
  printerBaudRate: z.coerce.number().int().optional(),
  printerColumns: z.coerce.number().int().optional(),
  printerCutCommand: z.boolean().optional(),
  printerBeepOnSale: z.boolean().optional(),
  receiptHeaderText: z.string().optional(),
  receiptFooterText: z.string().optional(),
  receiptShowSeller: z.boolean().optional(),
  nfcePrintLayout: z
    .object({
      paperWidth: z.enum(["auto", "58mm", "80mm"]).optional(),
      fontSize: z.enum(["auto", "small", "normal"]).optional(),
      lineSpacing: z.enum(["compact", "normal", "comfortable"]).optional(),
      compactItems: z.boolean().optional(),
      itemDescriptionLines: z.coerce.number().int().min(1).max(3).optional(),
      showProtocol: z.boolean().optional(),
      showAccessKey: z.boolean().optional(),
      showPayments: z.boolean().optional(),
      showQrCode: z.boolean().optional(),
      showCustomer: z.boolean().optional(),
      showCustomerDocument: z.boolean().optional(),
      showTaxes: z.boolean().optional(),
    })
    .optional(),
  nfeDanfeLayout: z
    .object({
      fontSize: z.enum(["small", "normal"]).optional(),
      lineSpacing: z.enum(["compact", "normal", "comfortable"]).optional(),
      itemDescriptionLines: z.coerce.number().int().min(1).max(4).optional(),
      logoFit: z.enum(["contain", "cover", "pad"]).optional(),
      showAccessKey: z.boolean().optional(),
      showCustomerDocument: z.boolean().optional(),
      showTaxes: z.boolean().optional(),
      headerText: z.string().optional(),
      footerText: z.string().optional(),
    })
    .optional(),
  danfeLogoUrl: z.string().optional(),
});

const managerSetCompanyActiveSchema = z.object({
  companyId: z.number().int().positive(),
  isActive: z.boolean(),
});

const managerDeleteCompanySchema = z.object({
  companyId: z.number().int().positive(),
});

const completeInviteSchema = z.object({
  email: z.string().email(),
  code: z.string().regex(/^\d{6}$/),
  password: z.string().min(6),
});

const forgotPasswordRequestSchema = z.object({
  cnpj: z.string().min(14).max(18),
  email: z.string().email(),
});

const forgotPasswordResetSchema = z.object({
  email: z.string().email(),
  code: z.string().regex(/^\d{6}$/),
  password: z.string().min(6),
});

const managerLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const managerMpValidationSchema = z.object({
  accessToken: z.string().min(1),
  terminalId: z.string().min(1),
});

const managerStoneValidationSchema = z.object({
  clientId: z.string().min(1),
  clientSecret: z.string().min(1),
  terminalId: z.string().min(1),
  environment: z.enum(["homologacao", "producao"]).optional(),
});

const dynamicImport = new Function(
  "modulePath",
  "return import(modulePath);",
) as (modulePath: string) => Promise<any>;

function getManagerCredentials() {
  const managerEmail = String(
    process.env.MANAGER_EMAIL || process.env.SMTP_USER || "",
  ).trim();
  const managerPassword = String(process.env.MANAGER_PASSWORD || "").trim();

  return { managerEmail, managerPassword };
}

async function getCompanyUserCodeMap(companyId: number) {
  const companyUsers = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.companyId, companyId))
    .orderBy(asc(users.createdAt), asc(users.name), asc(users.email));

  return new Map(
    companyUsers.map((u, index) => [u.id, String(index + 1).padStart(2, "0")]),
  );
}

function ensureManagerSession(req: any, res: any): boolean {
  if (!req.session?.managerAuthenticated) {
    res.status(401).json({ error: "Manager nao autenticado" });
    return false;
  }
  return true;
}

function generateOnboardingCode() {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

function hashOnboardingCode(code: string) {
  return createHash("sha256").update(code).digest("hex");
}

function normalizeTerminalCode(value?: string, fallback = "CX01") {
  const normalized = String(value || "")
    .trim()
    .toUpperCase();
  return normalized || fallback;
}

async function sendOnboardingCodeEmail(params: {
  to: string;
  userName: string;
  companyName: string;
  code: string;
}) {
  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = Number(process.env.SMTP_PORT || 587);
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const smtpFrom = process.env.SMTP_FROM;
  const onboardingUrl =
    process.env.ONBOARDING_URL || "http://localhost:5000/access";

  if (!smtpHost || !smtpUser || !smtpPass || !smtpFrom) {
    return { sent: false, reason: "smtp_not_configured" as const };
  }

  try {
    const nodemailerModule = await dynamicImport("nodemailer");
    const nodemailer = nodemailerModule.default || nodemailerModule;
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    });

    await transporter.sendMail({
      from: smtpFrom,
      to: params.to,
      subject: "Codigo para criar sua senha",
      text: [
        `Ola, ${params.userName}.`,
        "",
        `Voce foi convidado para acessar a empresa ${params.companyName}.`,
        `Seu codigo para criar a senha e: ${params.code}`,
        "",
        `Use este link para ativar a conta: ${onboardingUrl}`,
        "",
        "Se voce nao reconhece este acesso, ignore este email.",
      ].join("\n"),
    });

    return { sent: true as const };
  } catch (error) {
    console.error("Onboarding mail error:", error);
    return { sent: false, reason: "smtp_send_failed" as const };
  }
}

async function sendPasswordResetCodeEmail(params: {
  to: string;
  userName: string;
  companyName: string;
  code: string;
}) {
  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = Number(process.env.SMTP_PORT || 587);
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const smtpFrom = process.env.SMTP_FROM;
  const accessUrl = process.env.ONBOARDING_URL || "http://localhost:5000/access";

  if (!smtpHost || !smtpUser || !smtpPass || !smtpFrom) {
    return { sent: false, reason: "smtp_not_configured" as const };
  }

  try {
    const nodemailerModule = await dynamicImport("nodemailer");
    const nodemailer = nodemailerModule.default || nodemailerModule;
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    });

    await transporter.sendMail({
      from: smtpFrom,
      to: params.to,
      subject: "Codigo para redefinir sua senha",
      text: [
        `Ola, ${params.userName}.`,
        "",
        `Recebemos uma solicitacao para redefinir a senha da empresa ${params.companyName}.`,
        `Seu codigo e: ${params.code}`,
        "",
        `Use este link: ${accessUrl}`,
        "",
        "Se voce nao solicitou, ignore este email.",
      ].join("\n"),
    });

    return { sent: true as const };
  } catch (error) {
    console.error("Password reset mail error:", error);
    return { sent: false, reason: "smtp_send_failed" as const };
  }
}

authRouter.post("/register", (_req, res) => {
  return res.status(403).json({
    error:
      "Auto cadastro desativado. O cadastro da empresa deve ser feito pelo manager interno.",
  });
});

authRouter.post("/manager/login", async (req, res) => {
  try {
    const data = managerLoginSchema.parse(req.body);
    const { managerEmail, managerPassword } = getManagerCredentials();

    if (!managerEmail || !managerPassword) {
      return res.status(500).json({
        error: "Configure MANAGER_EMAIL e MANAGER_PASSWORD no .env",
      });
    }

    if (data.email !== managerEmail || data.password !== managerPassword) {
      return res.status(401).json({ error: "Email ou senha de manager invalidos" });
    }

    req.session.managerAuthenticated = true;
    req.session.managerEmail = managerEmail;

    res.json({ message: "Manager autenticado com sucesso", email: managerEmail });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Dados invalidos" });
    }
    res.status(500).json({ error: "Erro ao autenticar manager" });
  }
});

authRouter.get("/manager/session", (req, res) => {
  res.json({
    authenticated: Boolean(req.session?.managerAuthenticated),
    email: req.session?.managerEmail || null,
  });
});

authRouter.post("/manager/payments/mercadopago/validate", async (req, res) => {
  if (!ensureManagerSession(req, res)) {
    return;
  }

  try {
    const { accessToken, terminalId } = managerMpValidationSchema.parse(req.body);
    const result = await validateMercadoPagoSettings(accessToken, terminalId);
    res.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    res.status(500).json({
      error:
        error instanceof Error ? error.message : "Falha ao validar Mercado Pago",
    });
  }
});

authRouter.post("/manager/payments/stone/validate", async (req, res) => {
  if (!ensureManagerSession(req, res)) {
    return;
  }

  try {
    const { clientId, clientSecret, terminalId: _terminalId, environment } =
      managerStoneValidationSchema.parse(req.body);
    void _terminalId;
    const result = await validateStoneSettings({
      clientId,
      clientSecret,
      environment: environment === "homologacao" ? "homologacao" : "producao",
    });
    res.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    res.status(500).json({
      error: error instanceof Error ? error.message : "Falha ao validar Stone",
    });
  }
});

authRouter.get("/manager/onboarding-users", async (req, res) => {
  if (!ensureManagerSession(req, res)) {
    return;
  }

  try {
    const rawQuery = String(req.query.q || "").trim();
    const cnpjDigits = rawQuery.replace(/\D/g, "");
    const searchTerm = `%${rawQuery}%`;

    const filters: any[] = [];
    if (rawQuery) {
      filters.push(ilike(users.email, searchTerm));
      filters.push(ilike(users.name, searchTerm));
      filters.push(ilike(companies.razaoSocial, searchTerm));
      filters.push(ilike(companies.nomeFantasia, searchTerm));
      if (cnpjDigits.length > 0) {
        filters.push(ilike(companies.cnpj, `%${cnpjDigits}%`));
      }
    }

    const queryBuilder = db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        phone: users.phone,
        isActive: users.isActive,
        createdAt: users.createdAt,
        lastLogin: users.lastLogin,
        companyId: companies.id,
        cnpj: companies.cnpj,
        razaoSocial: companies.razaoSocial,
        nomeFantasia: companies.nomeFantasia,
        companyEmail: companies.email,
        companyPhone: companies.phone,
        address: companies.address,
        city: companies.city,
        state: companies.state,
        zipCode: companies.zipCode,
        companyIsActive: companies.isActive,
        roleName: roles.name,
        stoneEnabled: companySettings.stoneEnabled,
        stoneClientId: companySettings.stoneClientId,
        stoneClientSecret: companySettings.stoneClientSecret,
        stoneTerminalId: companySettings.stoneTerminalId,
        stoneEnvironment: companySettings.stoneEnvironment,
        mpEnabled: companySettings.mpEnabled,
        mpAccessToken: companySettings.mpAccessToken,
        mpTerminalId: companySettings.mpTerminalId,
        printerEnabled: companySettings.printerEnabled,
        printerModel: companySettings.printerModel,
        printerPort: companySettings.printerPort,
        printerBaudRate: companySettings.printerBaudRate,
        printerColumns: companySettings.printerColumns,
        printerCutCommand: companySettings.printerCutCommand,
        printerBeepOnSale: companySettings.printerBeepOnSale,
        receiptHeaderText: companySettings.receiptHeaderText,
        receiptFooterText: companySettings.receiptFooterText,
        receiptShowSeller: companySettings.receiptShowSeller,
        nfcePrintLayout: companySettings.nfcePrintLayout,
        nfeDanfeLayout: companySettings.nfeDanfeLayout,
        danfeLogoUrl: companySettings.danfeLogoUrl,
      })
      .from(users)
      .innerJoin(companies, eq(users.companyId, companies.id))
      .leftJoin(companySettings, eq(companySettings.companyId, companies.id))
      .leftJoin(roles, eq(users.roleId, roles.id))
      .orderBy(desc(users.createdAt))
      .limit(200);

    const rows =
      filters.length > 0
        ? await queryBuilder.where(or(...filters))
        : await queryBuilder;

    res.json(rows);
  } catch (error) {
    console.error("Manager onboarding users error:", error);
    res.status(500).json({ error: "Erro ao buscar usuarios para onboarding" });
  }
});

authRouter.post("/manager/logout", (req, res) => {
  req.session.managerAuthenticated = false;
  req.session.managerEmail = "";
  res.json({ message: "Sessao de manager encerrada" });
});

authRouter.post("/manager/companies", async (req, res) => {
  if (!ensureManagerSession(req, res)) {
    return;
  }

  try {
    const data = managerCreateCompanySchema.parse(req.body);

    const existingCompany = await db
      .select()
      .from(companies)
      .where(eq(companies.cnpj, data.cnpj.replace(/\D/g, "")))
      .limit(1);

    if (existingCompany.length > 0) {
      return res.status(400).json({ error: "CNPJ ja cadastrado" });
    }

    const existingAdminEmail = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, data.adminEmail))
      .limit(1);

    if (existingAdminEmail.length > 0) {
      return res.status(400).json({
        error: "Email do administrador ja cadastrado no sistema",
      });
    }

    await initializePermissions();

    const result = await db.transaction(async (tx) => {
      const [company] = await tx
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

      await tx.execute(
        sql`select set_config('request.jwt.claims', ${JSON.stringify({ company_id: company.id })}, true)`,
      );

      await createDefaultRolesForCompany(tx, company.id);

      const nfcePrintLayoutSql = data.nfcePrintLayout
        ? sql`${JSON.stringify(data.nfcePrintLayout)}::jsonb`
        : sql`null`;
      const nfeDanfeLayoutSql = data.nfeDanfeLayout
        ? sql`${JSON.stringify(data.nfeDanfeLayout)}::jsonb`
        : sql`null`;

      // Compat insert: some production databases may be missing newer columns
      // (e.g. manifest_last_nsu), and Drizzle can include them in INSERT targets.
      await tx.execute(sql`
        INSERT INTO company_settings (
          company_id,
          cnpj,
          ie,
          razao_social,
          nome_fantasia,
          stone_enabled,
          stone_client_id,
          stone_client_secret,
          stone_terminal_id,
          stone_environment,
          mp_enabled,
          mp_access_token,
          mp_terminal_id,
          printer_enabled,
          printer_model,
          printer_port,
          printer_baud_rate,
          printer_columns,
          printer_cut_command,
          printer_beep_on_sale,
          receipt_header_text,
          receipt_footer_text,
          receipt_show_seller,
          nfce_print_layout,
          nfe_danfe_layout,
          danfe_logo_url
        ) VALUES (
          ${company.id},
          ${company.cnpj},
          ${data.ie || null},
          ${company.razaoSocial},
          ${company.nomeFantasia},
          ${Boolean(data.stoneEnabled)},
          ${data.stoneClientId || null},
          ${data.stoneClientSecret || null},
          ${data.stoneTerminalId || null},
          ${data.stoneEnvironment || "producao"},
          ${Boolean(data.mpEnabled)},
          ${data.mpAccessToken || null},
          ${data.mpTerminalId || null},
          ${Boolean(data.printerEnabled)},
          ${data.printerModel || null},
          ${data.printerPort || null},
          ${data.printerBaudRate ?? 9600},
          ${data.printerColumns ?? 48},
          ${data.printerCutCommand === undefined ? true : Boolean(data.printerCutCommand)},
          ${data.printerBeepOnSale === undefined ? true : Boolean(data.printerBeepOnSale)},
          ${data.receiptHeaderText || null},
          ${data.receiptFooterText || null},
          ${data.receiptShowSeller === undefined ? true : Boolean(data.receiptShowSeller)},
          ${nfcePrintLayoutSql},
          ${nfeDanfeLayoutSql},
          ${data.danfeLogoUrl || null}
        )
      `);

      const initialMachineIdByKey = new Map<string, number>();
      if (Array.isArray(data.initialMachines) && data.initialMachines.length > 0) {
        const normalizedInitialMachines = data.initialMachines
          .filter((m) => String(m.name || "").trim())
          .map((m) => ({
            key: m.key,
            row: {
              companyId: company.id,
              name: String(m.name || "").trim(),
              provider: m.provider,
              mpTerminalId: m.provider === "mercadopago" ? m.mpTerminalId || null : null,
              stoneTerminalId:
                m.provider === "stone" ? m.stoneTerminalId || null : null,
              isActive: true,
            },
          }));

        if (normalizedInitialMachines.length > 0) {
          const insertedMachines = await tx
            .insert(paymentMachines)
            .values(normalizedInitialMachines.map((m) => m.row))
            .returning();
          insertedMachines.forEach((row, index) => {
            const source = normalizedInitialMachines[index];
            if (source?.key) initialMachineIdByKey.set(source.key, row.id);
          });
        }
      }

      if (Array.isArray(data.initialTerminals) && data.initialTerminals.length > 0) {
        const usedCodes = new Set<string>();
        const terminalRows = data.initialTerminals
          .filter((t) => String(t.name || "").trim())
          .map((t, index) => {
            let code = normalizeTerminalCode(t.code, `CX${String(index + 1).padStart(2, "0")}`);
            while (usedCodes.has(code)) {
              code = `${code}_${index + 1}`;
            }
            usedCodes.add(code);

            const linkedMachineId = t.paymentMachineKey
              ? initialMachineIdByKey.get(t.paymentMachineKey) || null
              : null;

            return {
              companyId: company.id,
              name: String(t.name || "").trim(),
              code,
              paymentMachineId: linkedMachineId,
              paymentProvider:
                linkedMachineId
                  ? "company_default"
                  : t.paymentProvider && t.paymentProvider !== "company_default"
                  ? t.paymentProvider
                  : "company_default",
              mpTerminalId: t.mpTerminalId || null,
              stoneTerminalId: t.stoneTerminalId || null,
              isAutonomous: false,
              requiresSangria: false,
              requiresSuprimento: false,
              requiresOpening: true,
              requiresClosing: true,
              isActive: true,
            };
          });

        if (terminalRows.length > 0) {
          await tx.insert(posTerminals).values(terminalRows);
        }
      }

      const [adminRole] = await tx
        .select()
        .from(roles)
        .where(
          and(eq(roles.companyId, company.id), eq(roles.name, "Administrador")),
        )
        .limit(1);

      if (!adminRole) {
        throw new Error("Perfil Administrador nao encontrado");
      }

      const passwordToSet =
        data.adminPassword && data.adminPassword.trim().length >= 6
          ? data.adminPassword
          : `invite-pending-${Date.now()}-${Math.random()}`;
      const hashedPassword = await bcrypt.hash(passwordToSet, 10);

      const [adminUser] = await tx
        .insert(users)
        .values({
          companyId: company.id,
          roleId: adminRole.id,
          username: data.adminEmail.split("@")[0],
          email: data.adminEmail,
          password: hashedPassword,
          name: data.adminName,
        })
        .returning();

      if (data.adminPassword && data.adminPassword.trim().length >= 6) {
        return { company, adminUser, passwordDefined: true as const };
      }

      const code = generateOnboardingCode();
      const codeHash = hashOnboardingCode(code);
      const expiresInMinutes = Number(
        process.env.ONBOARDING_CODE_TTL_MINUTES || 30,
      );
      const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000);

      await tx.insert(companyOnboardingCodes).values({
        companyId: company.id,
        userId: adminUser.id,
        email: data.adminEmail,
        codeHash,
        expiresAt,
      });

      return { company, adminUser, code, expiresAt, passwordDefined: false as const };
    });

    const emailResult =
      result.passwordDefined || !("code" in result)
        ? ({ sent: false as const, reason: "manual_password" as const })
        : await sendOnboardingCodeEmail({
            to: data.adminEmail,
            userName: data.adminName,
            companyName: result.company.nomeFantasia || result.company.razaoSocial,
            code: result.code,
          });

    res.json({
      message: result.passwordDefined
        ? "Empresa cadastrada com senha definida para o responsavel."
        : "Empresa cadastrada. O responsavel recebeu um codigo para criar a senha.",
      adminUser: {
        id: result.adminUser.id,
        name: result.adminUser.name,
        email: result.adminUser.email,
      },
      company: {
        id: result.company.id,
        cnpj: result.company.cnpj,
        razaoSocial: result.company.razaoSocial,
        nomeFantasia: result.company.nomeFantasia,
        email: result.company.email,
        phone: result.company.phone,
      },
      onboarding: {
        emailSent: result.passwordDefined ? false : emailResult.sent,
        expiresAt: "expiresAt" in result ? result.expiresAt : null,
        ...(!result.passwordDefined && process.env.NODE_ENV !== "production" && "code" in result
          ? { code: result.code }
          : {}),
        ...(result.passwordDefined || emailResult.sent ? {} : { emailError: emailResult.reason }),
      },
      passwordDefined: result.passwordDefined,
    });
  } catch (error) {
    console.error("Manager registration error:", error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Dados invalidos", details: error.errors });
    }
    res.status(500).json({ error: "Erro ao cadastrar empresa pelo manager" });
  }
});

authRouter.post("/manager/resend-invite", async (req, res) => {
  if (!ensureManagerSession(req, res)) {
    return;
  }

  try {
    const data = managerResendInviteSchema.parse(req.body);
    const normalizedCnpj = data.cnpj.replace(/\D/g, "");

    const [company] = await db
      .select()
      .from(companies)
      .where(eq(companies.cnpj, normalizedCnpj))
      .limit(1);

    if (!company) {
      return res.status(404).json({ error: "Empresa nao encontrada para o CNPJ informado" });
    }

    const [adminUser] = await db
      .select()
      .from(users)
      .where(
        and(eq(users.companyId, company.id), eq(users.email, data.adminEmail)),
      )
      .limit(1);

    if (!adminUser) {
      return res
        .status(404)
        .json({ error: "Usuario responsavel nao encontrado para esta empresa" });
    }

    const code = generateOnboardingCode();
    const codeHash = hashOnboardingCode(code);
    const expiresInMinutes = Number(
      process.env.ONBOARDING_CODE_TTL_MINUTES || 30,
    );
    const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000);

    await db.transaction(async (tx) => {
      await tx.execute(
        sql`select set_config('request.jwt.claims', ${JSON.stringify({ company_id: company.id })}, true)`,
      );

      await tx.insert(companyOnboardingCodes).values({
        companyId: company.id,
        userId: adminUser.id,
        email: adminUser.email,
        codeHash,
        expiresAt,
      });
    });

    const emailResult = await sendOnboardingCodeEmail({
      to: adminUser.email,
      userName: adminUser.name,
      companyName: company.nomeFantasia || company.razaoSocial,
      code,
    });

    res.json({
      message: "Codigo de ativacao reenviado",
      onboarding: {
        emailSent: emailResult.sent,
        expiresAt,
        ...(process.env.NODE_ENV !== "production" ? { code } : {}),
        ...(emailResult.sent ? {} : { emailError: emailResult.reason }),
      },
    });
  } catch (error) {
    console.error("Manager resend invite error:", error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Dados invalidos", details: error.errors });
    }
    res.status(500).json({ error: "Erro ao reenviar codigo de ativacao" });
  }
});

authRouter.post("/manager/company-users", async (req, res) => {
  if (!ensureManagerSession(req, res)) {
    return;
  }

  try {
    const data = managerCreateCompanyUserSchema.parse(req.body);

    const [company] = await db
      .select()
      .from(companies)
      .where(eq(companies.id, data.companyId))
      .limit(1);

    if (!company) {
      return res.status(404).json({ error: "Empresa nao encontrada" });
    }

    const existingUser = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, data.email))
      .limit(1);

    if (existingUser.length > 0) {
      return res.status(400).json({ error: "Email ja cadastrado no sistema" });
    }

    const [targetRole] = await db
      .select()
      .from(roles)
      .where(and(eq(roles.companyId, data.companyId), eq(roles.name, data.roleName)))
      .limit(1);

    if (!targetRole) {
      return res.status(404).json({ error: "Perfil nao encontrado na empresa" });
    }

    const passwordDefined = Boolean(data.password && data.password.trim().length >= 6);
    const passwordToSet =
      passwordDefined
        ? data.password!
        : `invite-pending-${Date.now()}-${Math.random()}`;
    const hashedPassword = await bcrypt.hash(passwordToSet, 10);

    const code = passwordDefined ? null : generateOnboardingCode();
    const codeHash = code ? hashOnboardingCode(code) : null;
    const expiresInMinutes = Number(
      process.env.ONBOARDING_CODE_TTL_MINUTES || 30,
    );
    const expiresAt = passwordDefined
      ? null
      : new Date(Date.now() + expiresInMinutes * 60 * 1000);

    const newUser = await db.transaction(async (tx) => {
      await tx.execute(
        sql`select set_config('request.jwt.claims', ${JSON.stringify({ company_id: company.id })}, true)`,
      );

      const [createdUser] = await tx
        .insert(users)
        .values({
          companyId: data.companyId,
          roleId: targetRole.id,
          username: data.email.split("@")[0],
          email: data.email,
          password: hashedPassword,
          name: data.name,
        })
        .returning();

      if (codeHash && expiresAt) {
        await tx.insert(companyOnboardingCodes).values({
          companyId: company.id,
          userId: createdUser.id,
          email: createdUser.email,
          codeHash,
          expiresAt,
        });
      }

      return createdUser;
    });

    const emailResult = code
      ? await sendOnboardingCodeEmail({
          to: newUser.email,
          userName: newUser.name,
          companyName: company.nomeFantasia || company.razaoSocial,
          code,
        })
      : { sent: false as const, reason: "manual_password" as const };

    res.json({
      message: passwordDefined
        ? "Usuario cadastrado com senha definida"
        : "Usuario cadastrado e convite gerado",
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        companyId: company.id,
        roleName: targetRole.name,
      },
      onboarding: {
        emailSent: code ? emailResult.sent : false,
        expiresAt,
        ...(code && process.env.NODE_ENV !== "production" ? { code } : {}),
        ...(!code || emailResult.sent ? {} : { emailError: emailResult.reason }),
      },
      passwordDefined,
    });
  } catch (error) {
    console.error("Manager create company user error:", error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Dados invalidos", details: error.errors });
    }
    res.status(500).json({ error: "Erro ao cadastrar usuario da empresa" });
  }
});

authRouter.patch("/manager/company", async (req, res) => {
  if (!ensureManagerSession(req, res)) {
    return;
  }

  try {
    const data = managerUpdateCompanySchema.parse(req.body);
    const normalizedCnpj = data.cnpj.replace(/\D/g, "");

    const [company] = await db
      .select()
      .from(companies)
      .where(eq(companies.id, data.companyId))
      .limit(1);

    if (!company) {
      return res.status(404).json({ error: "Empresa nao encontrada" });
    }

    const existingCnpj = await db
      .select({ id: companies.id })
      .from(companies)
      .where(and(eq(companies.cnpj, normalizedCnpj), ne(companies.id, data.companyId)))
      .limit(1);

    if (existingCnpj.length > 0) {
      return res.status(400).json({ error: "CNPJ ja cadastrado em outra empresa" });
    }

    const existingAdminEmail = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.email, data.adminEmail), ne(users.id, data.userId)))
      .limit(1);

    if (existingAdminEmail.length > 0) {
      return res.status(400).json({ error: "Email do responsavel ja usado por outro usuario" });
    }

    await db.transaction(async (tx) => {
      await tx.execute(
        sql`select set_config('request.jwt.claims', ${JSON.stringify({ company_id: data.companyId })}, true)`,
      );

      await tx
        .update(companies)
        .set({
          cnpj: normalizedCnpj,
          razaoSocial: data.razaoSocial,
          nomeFantasia: data.nomeFantasia || data.razaoSocial,
          email: data.companyEmail || null,
          phone: data.companyPhone || null,
          address: data.address || null,
          city: data.city || null,
          state: data.state || null,
          zipCode: data.zipCode || null,
        })
        .where(eq(companies.id, data.companyId));

      await tx
        .update(users)
        .set({
          name: data.adminName,
          email: data.adminEmail,
          username: data.adminEmail.split("@")[0],
          ...(data.adminPassword && data.adminPassword.trim().length >= 6
            ? { password: await bcrypt.hash(data.adminPassword, 10) }
            : {}),
        })
        .where(and(eq(users.id, data.userId), eq(users.companyId, data.companyId)));

      await tx
        .update(companySettings)
        .set({
          cnpj: normalizedCnpj,
          razaoSocial: data.razaoSocial,
          nomeFantasia: data.nomeFantasia || data.razaoSocial,
          stoneEnabled: Boolean(data.stoneEnabled),
          stoneClientId: data.stoneClientId || null,
          stoneClientSecret: data.stoneClientSecret || null,
          stoneTerminalId: data.stoneTerminalId || null,
          stoneEnvironment: data.stoneEnvironment || "producao",
          mpEnabled: Boolean(data.mpEnabled),
          mpAccessToken: data.mpAccessToken || null,
          mpTerminalId: data.mpTerminalId || null,
          printerEnabled: Boolean(data.printerEnabled),
          printerModel: data.printerModel || null,
          printerPort: data.printerPort || null,
          printerBaudRate: data.printerBaudRate ?? 9600,
          printerColumns: data.printerColumns ?? 48,
          printerCutCommand:
            data.printerCutCommand === undefined ? true : Boolean(data.printerCutCommand),
          printerBeepOnSale:
            data.printerBeepOnSale === undefined ? true : Boolean(data.printerBeepOnSale),
          receiptHeaderText: data.receiptHeaderText || null,
          receiptFooterText: data.receiptFooterText || null,
          receiptShowSeller:
            data.receiptShowSeller === undefined ? true : Boolean(data.receiptShowSeller),
          nfcePrintLayout: data.nfcePrintLayout || null,
          nfeDanfeLayout: data.nfeDanfeLayout || null,
          danfeLogoUrl: data.danfeLogoUrl || null,
        })
        .where(eq(companySettings.companyId, data.companyId));
    });

    res.json({ message: "Empresa atualizada com sucesso" });
  } catch (error) {
    console.error("Manager update company error:", error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Dados invalidos", details: error.errors });
    }
    res.status(500).json({ error: "Erro ao atualizar empresa" });
  }
});

authRouter.post("/manager/company/set-active", async (req, res) => {
  if (!ensureManagerSession(req, res)) {
    return;
  }

  try {
    const data = managerSetCompanyActiveSchema.parse(req.body);

    await db.transaction(async (tx) => {
      await tx.execute(
        sql`select set_config('request.jwt.claims', ${JSON.stringify({ company_id: data.companyId })}, true)`,
      );

      await tx
        .update(companies)
        .set({ isActive: data.isActive })
        .where(eq(companies.id, data.companyId));

      await tx
        .update(users)
        .set({ isActive: data.isActive })
        .where(eq(users.companyId, data.companyId));
    });

    res.json({
      message: data.isActive
        ? "Empresa ativada com sucesso"
        : "Empresa inativada com sucesso",
    });
  } catch (error) {
    console.error("Manager set company active error:", error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Dados invalidos" });
    }
    res.status(500).json({ error: "Erro ao atualizar status da empresa" });
  }
});

authRouter.delete("/manager/company", async (req, res) => {
  if (!ensureManagerSession(req, res)) {
    return;
  }

  try {
    const data = managerDeleteCompanySchema.parse(req.body);

    await db.transaction(async (tx) => {
      const companyRoles = await tx
        .select({ id: roles.id })
        .from(roles)
        .where(eq(roles.companyId, data.companyId));

      const roleIds = companyRoles.map((role) => role.id);

      await tx
        .delete(companyOnboardingCodes)
        .where(eq(companyOnboardingCodes.companyId, data.companyId));
      await tx
        .delete(passwordResetCodes)
        .where(eq(passwordResetCodes.companyId, data.companyId));
      await tx.delete(users).where(eq(users.companyId, data.companyId));

      if (roleIds.length > 0) {
        await tx
          .delete(rolePermissions)
          .where(inArray(rolePermissions.roleId, roleIds));
      }

      await tx.delete(roles).where(eq(roles.companyId, data.companyId));
      await tx
        .delete(companySettings)
        .where(eq(companySettings.companyId, data.companyId));
      await tx.delete(companies).where(eq(companies.id, data.companyId));
    });

    res.json({ message: "Empresa excluida com sucesso" });
  } catch (error: any) {
    console.error("Manager delete company error:", error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Dados invalidos" });
    }

    const message = String(error?.message || "");
    if (message.toLowerCase().includes("violates foreign key constraint")) {
      return res.status(409).json({
        error:
          "Nao foi possivel excluir porque existem registros vinculados. Inative a empresa.",
      });
    }

    res.status(500).json({ error: "Erro ao excluir empresa" });
  }
});

authRouter.post("/complete-invite", async (req, res) => {
  try {
    const data = completeInviteSchema.parse(req.body);

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, data.email))
      .limit(1);

    if (!user) {
      return res.status(400).json({ error: "Convite invalido" });
    }

    const [invite] = await db
      .select()
      .from(companyOnboardingCodes)
      .where(
        and(
          eq(companyOnboardingCodes.userId, user.id),
          eq(companyOnboardingCodes.email, data.email),
          isNull(companyOnboardingCodes.usedAt),
        ),
      )
      .orderBy(desc(companyOnboardingCodes.createdAt))
      .limit(1);

    if (!invite) {
      return res.status(400).json({ error: "Codigo invalido ou ja utilizado" });
    }

    if (new Date(invite.expiresAt).getTime() < Date.now()) {
      return res.status(400).json({ error: "Codigo expirado" });
    }

    if (hashOnboardingCode(data.code) !== invite.codeHash) {
      return res.status(400).json({ error: "Codigo invalido" });
    }

    const hashedPassword = await bcrypt.hash(data.password, 10);
    await db.transaction(async (tx) => {
      await tx.execute(
        sql`select set_config('request.jwt.claims', ${JSON.stringify({ company_id: user.companyId })}, true)`,
      );

      await tx
        .update(users)
        .set({ password: hashedPassword })
        .where(eq(users.id, user.id));

      await tx
        .update(companyOnboardingCodes)
        .set({ usedAt: new Date() })
        .where(eq(companyOnboardingCodes.id, invite.id));
    });

    res.json({ message: "Senha criada com sucesso. Faca login para continuar." });
  } catch (error) {
    console.error("Complete invite error:", error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Dados invalidos" });
    }
    res.status(500).json({ error: "Erro ao concluir criacao de senha" });
  }
});

authRouter.post("/forgot-password/request", async (req, res) => {
  try {
    const data = forgotPasswordRequestSchema.parse(req.body);
    const normalizedCnpj = data.cnpj.replace(/\D/g, "");

    const [company] = await db
      .select()
      .from(companies)
      .where(eq(companies.cnpj, normalizedCnpj))
      .limit(1);

    if (!company) {
      return res.status(404).json({ error: "Empresa nao encontrada para o CNPJ informado" });
    }

    const [user] = await db
      .select()
      .from(users)
      .where(
        and(eq(users.companyId, company.id), eq(users.email, data.email)),
      )
      .limit(1);

    if (!user) {
      return res.status(404).json({ error: "Email nao encontrado para esta empresa" });
    }

    const code = generateOnboardingCode();
    const codeHash = hashOnboardingCode(code);
    const expiresInMinutes = Number(
      process.env.ONBOARDING_CODE_TTL_MINUTES || 30,
    );
    const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000);

    await db.transaction(async (tx) => {
      await tx.execute(
        sql`select set_config('request.jwt.claims', ${JSON.stringify({ company_id: company.id })}, true)`,
      );

      await tx.insert(passwordResetCodes).values({
        companyId: company.id,
        userId: user.id,
        email: user.email,
        cnpj: company.cnpj,
        codeHash,
        expiresAt,
      });
    });

    const emailResult = await sendPasswordResetCodeEmail({
      to: user.email,
      userName: user.name,
      companyName: company.nomeFantasia || company.razaoSocial,
      code,
    });

    res.json({
      message: "Codigo de redefinicao enviado",
      passwordReset: {
        emailSent: emailResult.sent,
        expiresAt,
        ...(process.env.NODE_ENV !== "production" ? { code } : {}),
        ...(emailResult.sent ? {} : { emailError: emailResult.reason }),
      },
    });
  } catch (error) {
    console.error("Forgot password request error:", error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Dados invalidos", details: error.errors });
    }
    res.status(500).json({ error: "Erro ao solicitar redefinicao de senha" });
  }
});

authRouter.post("/forgot-password/reset", async (req, res) => {
  try {
    const data = forgotPasswordResetSchema.parse(req.body);

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, data.email))
      .limit(1);

    if (!user) {
      return res.status(400).json({ error: "Solicitacao invalida" });
    }

    const [resetCode] = await db
      .select()
      .from(passwordResetCodes)
      .where(
        and(
          eq(passwordResetCodes.userId, user.id),
          eq(passwordResetCodes.email, data.email),
          isNull(passwordResetCodes.usedAt),
        ),
      )
      .orderBy(desc(passwordResetCodes.createdAt))
      .limit(1);

    if (!resetCode) {
      return res.status(400).json({ error: "Codigo invalido ou ja utilizado" });
    }

    if (new Date(resetCode.expiresAt).getTime() < Date.now()) {
      return res.status(400).json({ error: "Codigo expirado" });
    }

    if (hashOnboardingCode(data.code) !== resetCode.codeHash) {
      return res.status(400).json({ error: "Codigo invalido" });
    }

    const hashedPassword = await bcrypt.hash(data.password, 10);
    await db.transaction(async (tx) => {
      await tx.execute(
        sql`select set_config('request.jwt.claims', ${JSON.stringify({ company_id: user.companyId })}, true)`,
      );

      await tx
        .update(users)
        .set({ password: hashedPassword })
        .where(eq(users.id, user.id));

      await tx
        .update(passwordResetCodes)
        .set({ usedAt: new Date() })
        .where(eq(passwordResetCodes.id, resetCode.id));
    });

    res.json({ message: "Senha redefinida com sucesso. Faca login para continuar." });
  } catch (error) {
    console.error("Forgot password reset error:", error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Dados invalidos" });
    }
    res.status(500).json({ error: "Erro ao redefinir senha" });
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
    const userCodeMap = await getCompanyUserCodeMap(user.companyId);

    await db.transaction(async (tx) => {
      await tx.execute(
        sql`select set_config('request.jwt.claims', ${JSON.stringify({ company_id: user.companyId })}, true)`,
      );

      await tx
        .update(users)
        .set({ lastLogin: new Date() })
        .where(eq(users.id, user.id));
    });

    req.session.userId = user.id;
    req.session.companyId = user.companyId;
    req.session.roleId = user.roleId;
    req.session.userPermissions = userPermissions;

    res.json({
      user: {
        id: user.id,
        displayCode: userCodeMap.get(user.id) || "00",
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
    const userCodeMap = await getCompanyUserCodeMap(user.companyId);

    res.json({
      user: {
        id: user.id,
        displayCode: userCodeMap.get(user.id) || "00",
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
      .where(eq(users.companyId, req.session.companyId))
      .orderBy(asc(users.createdAt), asc(users.name), asc(users.email));
    res.json(
      companyUsers.map((user, index) => ({
        ...user,
        displayCode: String(index + 1).padStart(2, "0"),
      })),
    );
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

authRouter.post("/refresh-session", async (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: "Não autenticado" });
  }

  try {
    // Reinicializar permissões globais
    await initializePermissions();

        // Se o usuario tem companyId, sincronizar os roles padrao da empresa
    if (req.session.companyId) {
      const companyRoles = await db
        .select()
        .from(roles)
        .where(eq(roles.companyId, req.session.companyId));

      const allPerms = await db
        .select({
          id: permissions.id,
          module: permissions.module,
          action: permissions.action,
        })
        .from(permissions);
      const permIdByKey = new Map(
        allPerms.map((p) => [`${p.module}:${p.action}`, p.id]),
      );
      const templateByRoleName = new Map(
        Object.values(ROLE_TEMPLATES).map((tpl) => [tpl.name, tpl]),
      );

      for (const role of companyRoles) {
        if (!role.isSystemRole) continue;
        const template = templateByRoleName.get(role.name);
        if (!template) continue;

        const permissionIds = template.permissions
          .map((permKey) => permIdByKey.get(permKey))
          .filter((id): id is number => typeof id === "number");

        await db.delete(rolePermissions).where(eq(rolePermissions.roleId, role.id));

        if (permissionIds.length > 0) {
          await db.insert(rolePermissions).values(
            permissionIds.map((permissionId) => ({
              roleId: role.id,
              permissionId,
            })),
          );
        }
      }
    }

    req.session.userPermissions = await getUserPermissions(req.session.userId);
res.json({ message: "Sessão atualizada com sucesso" });
  } catch (error) {
    console.error("Refresh session error:", error);
    res.status(500).json({ error: "Erro ao atualizar sessão" });
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
