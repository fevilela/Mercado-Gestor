import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  varchar,
  integer,
  decimal,
  timestamp,
  boolean,
  serial,
  jsonb,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ============================================
// MULTI-TENANCY: Companies (Empresas)
// ============================================
export const companies = pgTable("companies", {
  id: serial("id").primaryKey(),
  cnpj: text("cnpj").notNull().unique(),
  ie: text("ie"),
  im: text("im"),
  razaoSocial: text("razao_social").notNull(),
  nomeFantasia: text("nome_fantasia"),
  cnae: text("cnae"),
  regimeTributario: text("regime_tributario").default("Simples Nacional"),
  email: text("email"),
  phone: text("phone"),
  address: text("address"),
  city: text("city"),
  state: text("state"),
  zipCode: text("zip_code"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertCompanySchema = createInsertSchema(companies).omit({
  id: true,
  createdAt: true,
});
export type InsertCompany = z.infer<typeof insertCompanySchema>;
export type Company = typeof companies.$inferSelect;

// ============================================
// RBAC: Roles (Perfis/Funções)
// ============================================
export const roles = pgTable("roles", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  isSystemRole: boolean("is_system_role").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertRoleSchema = createInsertSchema(roles).omit({
  id: true,
  createdAt: true,
});
export type InsertRole = z.infer<typeof insertRoleSchema>;
export type Role = typeof roles.$inferSelect;

// ============================================
// RBAC: Permissions (Permissões)
// ============================================
export const permissions = pgTable("permissions", {
  id: serial("id").primaryKey(),
  module: text("module").notNull(),
  action: text("action").notNull(),
  description: text("description"),
});

export const insertPermissionSchema = createInsertSchema(permissions).omit({
  id: true,
});
export type InsertPermission = z.infer<typeof insertPermissionSchema>;
export type Permission = typeof permissions.$inferSelect;

// ============================================
// RBAC: Role Permissions (Permissões do Perfil)
// ============================================
export const rolePermissions = pgTable("role_permissions", {
  id: serial("id").primaryKey(),
  roleId: integer("role_id").notNull(),
  permissionId: integer("permission_id").notNull(),
});

export const insertRolePermissionSchema = createInsertSchema(
  rolePermissions
).omit({
  id: true,
});
export type InsertRolePermission = z.infer<typeof insertRolePermissionSchema>;
export type RolePermission = typeof rolePermissions.$inferSelect;

// ============================================
// USERS: Usuários (Funcionários)
// ============================================
export const users = pgTable("users", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  companyId: integer("company_id").notNull(),
  roleId: integer("role_id").notNull(),
  username: text("username").notNull(),
  email: text("email").notNull(),
  password: text("password").notNull(),
  name: text("name").notNull(),
  phone: text("phone"),
  isActive: boolean("is_active").default(true),
  lastLogin: timestamp("last_login"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  lastLogin: true,
  createdAt: true,
});
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// User with role information for frontend
export type UserWithRole = User & { role: Role; permissions: string[] };

export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id"),
  name: text("name").notNull(),
  ean: text("ean"),
  sku: text("sku"),
  category: text("category").notNull(),
  unit: text("unit").notNull().default("UN"),
  brand: text("brand"),
  type: text("type"),
  ncm: text("ncm"),
  serviceCode: text("service_code"),
  cest: text("cest"),
  csosnCode: text("csosn_code"),
  cstIcms: text("cst_icms"),
  cstIpi: text("cst_ipi"),
  cstPisCofins: text("cst_pis_cofins"),
  origin: text("origin").default("nacional"),
  description: text("description"),
  mainImageUrl: text("main_image_url"),
  purchasePrice: decimal("purchase_price", { precision: 10, scale: 2 }),
  margin: decimal("margin", { precision: 5, scale: 2 }),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  promoPrice: decimal("promo_price", { precision: 10, scale: 2 }),
  promoStart: timestamp("promo_start"),
  promoEnd: timestamp("promo_end"),
  stock: integer("stock").notNull().default(0),
  minStock: integer("min_stock").default(10),
  maxStock: integer("max_stock").default(100),
  isKit: boolean("is_kit").default(false),
  isActive: boolean("is_active").default(true),
  supplierId: integer("supplier_id"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertProductSchema = createInsertSchema(products).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type Product = typeof products.$inferSelect;

export const productVariations = pgTable("product_variations", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").notNull(),
  sku: text("sku"),
  name: text("name").notNull(),
  attributes: jsonb("attributes"),
  extraPrice: decimal("extra_price", { precision: 10, scale: 2 }).default("0"),
  stock: integer("stock").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertProductVariationSchema = createInsertSchema(
  productVariations
).omit({ id: true, createdAt: true });
export type InsertProductVariation = z.infer<
  typeof insertProductVariationSchema
>;
export type ProductVariation = typeof productVariations.$inferSelect;

export const productMedia = pgTable("product_media", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").notNull(),
  url: text("url").notNull(),
  isPrimary: boolean("is_primary").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertProductMediaSchema = createInsertSchema(productMedia).omit({
  id: true,
  createdAt: true,
});
export type InsertProductMedia = z.infer<typeof insertProductMediaSchema>;
export type ProductMedia = typeof productMedia.$inferSelect;

export const kitItems = pgTable("kit_items", {
  id: serial("id").primaryKey(),
  kitProductId: integer("kit_product_id").notNull(),
  productId: integer("product_id").notNull(),
  quantity: integer("quantity").notNull().default(1),
});

export const insertKitItemSchema = createInsertSchema(kitItems).omit({
  id: true,
});
export type InsertKitItem = z.infer<typeof insertKitItemSchema>;
export type KitItem = typeof kitItems.$inferSelect;

export const customers = pgTable("customers", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id"),
  name: text("name").notNull(),
  email: text("email"),
  phone: text("phone"),
  cpfCnpj: text("cpf_cnpj"),
  type: text("type").notNull().default("Regular"),
  personType: text("person_type").default("Física"),
  isIcmsContributor: boolean("is_icms_contributor").default(false),
  address: text("address"),
  city: text("city"),
  state: text("state"),
  zipCode: text("zip_code"),
  creditLimit: decimal("credit_limit", { precision: 10, scale: 2 }).default(
    "0"
  ),
  loyaltyPoints: integer("loyalty_points").default(0),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertCustomerSchema = createInsertSchema(customers).omit({
  id: true,
  createdAt: true,
});
export type InsertCustomer = z.infer<typeof insertCustomerSchema>;
export type Customer = typeof customers.$inferSelect;

export const suppliers = pgTable("suppliers", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id"),
  name: text("name").notNull(),
  contact: text("contact"),
  phone: text("phone"),
  email: text("email"),
  cnpj: text("cnpj"),
  personType: text("person_type").default("Jurídica"),
  isIcmsContributor: boolean("is_icms_contributor").default(true),
  address: text("address"),
  city: text("city"),
  state: text("state"),
  zipCode: text("zip_code"),
  paymentTerms: text("payment_terms"),
  leadTime: integer("lead_time"),
  rating: integer("rating").default(0),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertSupplierSchema = createInsertSchema(suppliers).omit({
  id: true,
  createdAt: true,
});
export type InsertSupplier = z.infer<typeof insertSupplierSchema>;
export type Supplier = typeof suppliers.$inferSelect;

export const sales = pgTable("sales", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id"),
  userId: varchar("user_id"),
  customerId: integer("customer_id"),
  customerName: text("customer_name").notNull().default("Consumidor Final"),
  total: decimal("total", { precision: 10, scale: 2 }).notNull(),
  itemsCount: integer("items_count").notNull(),
  paymentMethod: text("payment_method").notNull(),
  status: text("status").notNull().default("Concluído"),
  nfceProtocol: text("nfce_protocol"),
  nfceStatus: text("nfce_status").notNull().default("Pendente"),
  nfceKey: text("nfce_key"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertSaleSchema = createInsertSchema(sales).omit({
  id: true,
  createdAt: true,
});
export type InsertSale = z.infer<typeof insertSaleSchema>;
export type Sale = typeof sales.$inferSelect;

export const saleItems = pgTable("sale_items", {
  id: serial("id").primaryKey(),
  saleId: integer("sale_id").notNull(),
  productId: integer("product_id").notNull(),
  productName: text("product_name").notNull(),
  quantity: integer("quantity").notNull(),
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }).notNull(),
  subtotal: decimal("subtotal", { precision: 10, scale: 2 }).notNull(),
});

export const insertSaleItemSchema = createInsertSchema(saleItems).omit({
  id: true,
});
export type InsertSaleItem = z.infer<typeof insertSaleItemSchema>;
export type SaleItem = typeof saleItems.$inferSelect;

export const inventoryMovements = pgTable("inventory_movements", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id"),
  productId: integer("product_id").notNull(),
  variationId: integer("variation_id"),
  type: text("type").notNull(),
  quantity: integer("quantity").notNull(),
  reason: text("reason"),
  referenceId: integer("reference_id"),
  referenceType: text("reference_type"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertInventoryMovementSchema = createInsertSchema(
  inventoryMovements
).omit({ id: true, createdAt: true });
export type InsertInventoryMovement = z.infer<
  typeof insertInventoryMovementSchema
>;
export type InventoryMovement = typeof inventoryMovements.$inferSelect;

export const companySettings = pgTable("company_settings", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id"),
  cnpj: text("cnpj"),
  ie: text("ie"),
  razaoSocial: text("razao_social"),
  nomeFantasia: text("nome_fantasia"),
  regimeTributario: text("regime_tributario").default("Simples Nacional"),
  fiscalEnabled: boolean("fiscal_enabled").default(false),
  cscToken: text("csc_token"),
  cscId: text("csc_id"),
  stoneCode: text("stone_code"),
  stoneEnabled: boolean("stone_enabled").default(false),
  mpAccessToken: text("mp_access_token"),
  mpTerminalId: text("mp_terminal_id"),
  mpEnabled: boolean("mp_enabled").default(false),
  printerEnabled: boolean("printer_enabled").default(false),
  printerModel: text("printer_model"),
  printerPort: text("printer_port"),
  printerBaudRate: integer("printer_baud_rate").default(9600),
  printerColumns: integer("printer_columns").default(48),
  printerCutCommand: boolean("printer_cut_command").default(true),
  printerBeepOnSale: boolean("printer_beep_on_sale").default(true),
  barcodeScannerEnabled: boolean("barcode_scanner_enabled").default(true),
  barcodeScannerAutoAdd: boolean("barcode_scanner_auto_add").default(true),
  barcodeScannerBeep: boolean("barcode_scanner_beep").default(true),
  cashRegisterRequired: boolean("cash_register_required").default(true),
  nfeEnabled: boolean("nfe_enabled").default(false),
  nfceEnabled: boolean("nfce_enabled").default(true),
  nfseEnabled: boolean("nfse_enabled").default(false),
  cteEnabled: boolean("cte_enabled").default(false),
  mdfeEnabled: boolean("mdfe_enabled").default(false),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertCompanySettingsSchema = createInsertSchema(
  companySettings
).omit({ id: true, updatedAt: true });
export type InsertCompanySettings = z.infer<typeof insertCompanySettingsSchema>;
export type CompanySettings = typeof companySettings.$inferSelect;

export const payables = pgTable("payables", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id"),
  description: text("description").notNull(),
  supplierId: integer("supplier_id"),
  supplierName: text("supplier_name"),
  category: text("category").notNull().default("Outros"),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  dueDate: timestamp("due_date").notNull(),
  paidDate: timestamp("paid_date"),
  status: text("status").notNull().default("Pendente"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertPayableSchema = createInsertSchema(payables).omit({
  id: true,
  createdAt: true,
});
export type InsertPayable = z.infer<typeof insertPayableSchema>;
export type Payable = typeof payables.$inferSelect;

export const receivables = pgTable("receivables", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id"),
  description: text("description").notNull(),
  customerId: integer("customer_id"),
  customerName: text("customer_name"),
  saleId: integer("sale_id"),
  category: text("category").notNull().default("Vendas"),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  dueDate: timestamp("due_date").notNull(),
  receivedDate: timestamp("received_date"),
  status: text("status").notNull().default("Pendente"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertReceivableSchema = createInsertSchema(receivables).omit({
  id: true,
  createdAt: true,
});
export type InsertReceivable = z.infer<typeof insertReceivableSchema>;
export type Receivable = typeof receivables.$inferSelect;

// ============================================
// NOTIFICATIONS: Sistema de Notificações
// ============================================
export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull(),
  userId: varchar("user_id"),
  type: text("type").notNull(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  referenceId: integer("reference_id"),
  referenceType: text("reference_type"),
  isRead: boolean("is_read").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertNotificationSchema = createInsertSchema(notifications).omit({
  id: true,
  createdAt: true,
});
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type Notification = typeof notifications.$inferSelect;

// ============================================
// POS TERMINALS: Terminais PDV
// ============================================
export const posTerminals = pgTable("pos_terminals", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull(),
  name: text("name").notNull(),
  code: text("code"),
  description: text("description"),
  isAutonomous: boolean("is_autonomous").default(false),
  requiresSangria: boolean("requires_sangria").default(false),
  requiresSuprimento: boolean("requires_suprimento").default(false),
  requiresOpening: boolean("requires_opening").default(true),
  requiresClosing: boolean("requires_closing").default(true),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertPosTerminalSchema = createInsertSchema(posTerminals).omit({
  id: true,
  createdAt: true,
});
export type InsertPosTerminal = z.infer<typeof insertPosTerminalSchema>;
export type PosTerminal = typeof posTerminals.$inferSelect;

// ============================================
// CASH REGISTER: Controle de Caixa
// ============================================
export const cashRegisters = pgTable("cash_registers", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull(),
  terminalId: integer("terminal_id"),
  userId: varchar("user_id").notNull(),
  userName: text("user_name").notNull(),
  openingAmount: decimal("opening_amount", {
    precision: 10,
    scale: 2,
  }).notNull(),
  closingAmount: decimal("closing_amount", { precision: 10, scale: 2 }),
  expectedAmount: decimal("expected_amount", { precision: 10, scale: 2 }),
  difference: decimal("difference", { precision: 10, scale: 2 }),
  status: text("status").notNull().default("open"),
  notes: text("notes"),
  openedAt: timestamp("opened_at").defaultNow(),
  closedAt: timestamp("closed_at"),
});

export const insertCashRegisterSchema = createInsertSchema(cashRegisters).omit({
  id: true,
  openedAt: true,
  closedAt: true,
});
export type InsertCashRegister = z.infer<typeof insertCashRegisterSchema>;
export type CashRegister = typeof cashRegisters.$inferSelect;

// ============================================
// CASH MOVEMENTS: Movimentações de Caixa (Sangria, Suprimento, etc.)
// ============================================
export const cashMovements = pgTable("cash_movements", {
  id: serial("id").primaryKey(),
  cashRegisterId: integer("cash_register_id").notNull(),
  companyId: integer("company_id").notNull(),
  userId: varchar("user_id").notNull(),
  userName: text("user_name").notNull(),
  type: text("type").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  reason: text("reason"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertCashMovementSchema = createInsertSchema(cashMovements).omit({
  id: true,
  createdAt: true,
});
export type InsertCashMovement = z.infer<typeof insertCashMovementSchema>;
export type CashMovement = typeof cashMovements.$inferSelect;

// ============================================
// FISCAL SYSTEM: CFOP (Código Fiscal de Operações e Prestações)
// ============================================
export const cfopCodes = pgTable("cfop_codes", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  description: text("description").notNull(),
  type: text("type").notNull(),
  operationType: text("operation_type").notNull(),
  scope: text("scope").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertCfopSchema = createInsertSchema(cfopCodes).omit({
  id: true,
  createdAt: true,
});
export type InsertCfop = z.infer<typeof insertCfopSchema>;
export type CfopCode = typeof cfopCodes.$inferSelect;

// ============================================
// FISCAL SYSTEM: Tax Regime Configuration
// ============================================
export const fiscalConfigs = pgTable("fiscal_configs", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull().unique(),
  regimeTributario: text("regime_tributario")
    .notNull()
    .default("Simples Nacional"),
  nfeEnabled: boolean("nfe_enabled").default(false),
  nfceEnabled: boolean("nfce_enabled").default(true),
  nfseEnabled: boolean("nfse_enabled").default(false),
  defaultCfop: text("default_cfop"),
  ibptTaxEnabled: boolean("ibpt_tax_enabled").default(false),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertFiscalConfigSchema = createInsertSchema(fiscalConfigs).omit({
  id: true,
  updatedAt: true,
});
export type InsertFiscalConfig = z.infer<typeof insertFiscalConfigSchema>;
export type FiscalConfig = typeof fiscalConfigs.$inferSelect;

// ============================================
// FISCAL SYSTEM: Tax Aliquots by State
// ============================================
export const taxAliquots = pgTable("tax_aliquots", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull(),
  state: text("state").notNull(),
  productId: integer("product_id"),
  icmsAliquot: decimal("icms_aliquot", { precision: 5, scale: 2 }).default("0"),
  icmsReduction: decimal("icms_reduction", { precision: 5, scale: 2 }).default(
    "0"
  ),
  ipiAliquot: decimal("ipi_aliquot", { precision: 5, scale: 2 }).default("0"),
  pisAliquot: decimal("pis_aliquot", { precision: 5, scale: 2 }).default("0"),
  cofinsAliquot: decimal("cofins_aliquot", { precision: 5, scale: 2 }).default(
    "0"
  ),
  issAliquot: decimal("iss_aliquot", { precision: 5, scale: 2 }).default("0"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertTaxAliquotSchema = createInsertSchema(taxAliquots).omit({
  id: true,
  updatedAt: true,
});
export type InsertTaxAliquot = z.infer<typeof insertTaxAliquotSchema>;
export type TaxAliquot = typeof taxAliquots.$inferSelect;

// ============================================
// FISCAL SYSTEM: CST/CSOSN Codes
// ============================================
export const cstCodes = pgTable("cst_codes", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  description: text("description").notNull(),
  codeType: text("code_type").notNull(),
  taxType: text("tax_type").notNull(),
  regime: text("regime").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertCstSchema = createInsertSchema(cstCodes).omit({
  id: true,
  createdAt: true,
});
export type InsertCst = z.infer<typeof insertCstSchema>;
export type CstCode = typeof cstCodes.$inferSelect;
