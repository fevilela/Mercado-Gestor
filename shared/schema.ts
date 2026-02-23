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

// ============================================
// COMPANY ONBOARDING CODES: Convite para criar senha
// ============================================
export const companyOnboardingCodes = pgTable("company_onboarding_codes", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull(),
  userId: varchar("user_id").notNull(),
  email: text("email").notNull(),
  codeHash: text("code_hash").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertCompanyOnboardingCodeSchema = createInsertSchema(
  companyOnboardingCodes
).omit({
  id: true,
  usedAt: true,
  createdAt: true,
});

export type InsertCompanyOnboardingCode = z.infer<
  typeof insertCompanyOnboardingCodeSchema
>;
export type CompanyOnboardingCode = typeof companyOnboardingCodes.$inferSelect;

// ============================================
// PASSWORD RESET CODES: Recuperacao de senha
// ============================================
export const passwordResetCodes = pgTable("password_reset_codes", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull(),
  userId: varchar("user_id").notNull(),
  email: text("email").notNull(),
  cnpj: text("cnpj").notNull(),
  codeHash: text("code_hash").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertPasswordResetCodeSchema = createInsertSchema(
  passwordResetCodes,
).omit({
  id: true,
  usedAt: true,
  createdAt: true,
});

export type InsertPasswordResetCode = z.infer<typeof insertPasswordResetCodeSchema>;
export type PasswordResetCode = typeof passwordResetCodes.$inferSelect;

export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id"),
  name: text("name").notNull(),
  ean: text("ean"),
  sku: text("sku"),
  category: text("category").notNull(),
  marketClassification: text("market_classification"),
  additionalInfo: text("additional_info"),
  complementaryInfo: text("complementary_info"),
  nutritionalInfo: text("nutritional_info"),
  labelInfo: text("label_info"),
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
  // ===== Tributação (Impostos) =====
  icmsAliquot: decimal("icms_aliquot", { precision: 5, scale: 2 }).default("0"),
  icmsReduction: decimal("icms_reduction", { precision: 5, scale: 2 }).default(
    "0"
  ),
  ipiAliquot: decimal("ipi_aliquot", { precision: 5, scale: 2 }).default("0"),
  pisAliquot: decimal("pis_aliquot", { precision: 5, scale: 2 }).default("0"),
  pisCalculationMethod: text("pis_calculation_method").default("percentage"),
  cofinsAliquot: decimal("cofins_aliquot", { precision: 5, scale: 2 }).default(
    "0"
  ),
  cofinsCalculationMethod: text("cofins_calculation_method").default(
    "percentage"
  ),
  issAliquot: decimal("iss_aliquot", { precision: 5, scale: 2 }).default("0"),
  irrfAliquot: decimal("irrf_aliquot", { precision: 5, scale: 2 }).default("0"),
  ibptTaxRate: decimal("ibpt_tax_rate", { precision: 5, scale: 2 }).default(
    "0"
  ),
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

export const transporters = pgTable("transporters", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id"),
  name: text("name").notNull(),
  contact: text("contact"),
  phone: text("phone"),
  email: text("email"),
  cnpjCpf: text("cnpj_cpf"),
  ie: text("ie"),
  rntc: text("rntc"),
  address: text("address"),
  city: text("city"),
  state: text("state"),
  zipCode: text("zip_code"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertTransporterSchema = createInsertSchema(transporters).omit({
  id: true,
  createdAt: true,
});
export type InsertTransporter = z.infer<typeof insertTransporterSchema>;
export type Transporter = typeof transporters.$inferSelect;

export const sales = pgTable("sales", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id"),
  userId: varchar("user_id"),
  customerId: integer("customer_id"),
  customerName: text("customer_name").notNull().default("Consumidor Final"),
  total: decimal("total", { precision: 10, scale: 2 }).notNull(),
  itemsCount: integer("items_count").notNull(),
  paymentMethod: text("payment_method").notNull(),
  paymentStatus: text("payment_status").notNull().default("approved"),
  paymentNsu: text("payment_nsu"),
  paymentBrand: text("payment_brand"),
  paymentProvider: text("payment_provider"),
  paymentAuthorization: text("payment_authorization"),
  paymentReference: text("payment_reference"),
  status: text("status").notNull().default("Concluído"),
  nfceProtocol: text("nfce_protocol"),
  nfceStatus: text("nfce_status").notNull().default("Pendente"),
  nfceKey: text("nfce_key"),
  nfceError: text("nfce_error"),
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
  // ===== Tributação do Item =====
  ncm: text("ncm"),
  csosn: text("csosn"),
  cstIcms: text("cst_icms"),
  cstIpi: text("cst_ipi"),
  cstPisCofins: text("cst_pis_cofins"),
  icmsAliquot: decimal("icms_aliquot", { precision: 5, scale: 2 }).default("0"),
  icmsValue: decimal("icms_value", { precision: 10, scale: 2 }).default("0"),
  ipiAliquot: decimal("ipi_aliquot", { precision: 5, scale: 2 }).default("0"),
  ipiValue: decimal("ipi_value", { precision: 10, scale: 2 }).default("0"),
  pisAliquot: decimal("pis_aliquot", { precision: 5, scale: 2 }).default("0"),
  pisValue: decimal("pis_value", { precision: 10, scale: 2 }).default("0"),
  cofinsAliquot: decimal("cofins_aliquot", { precision: 5, scale: 2 }).default(
    "0"
  ),
  cofinsValue: decimal("cofins_value", { precision: 10, scale: 2 }).default(
    "0"
  ),
  issAliquot: decimal("iss_aliquot", { precision: 5, scale: 2 }).default("0"),
  issValue: decimal("iss_value", { precision: 10, scale: 2 }).default("0"),
  irrfAliquot: decimal("irrf_aliquot", { precision: 5, scale: 2 }).default("0"),
  irrfValue: decimal("irrf_value", { precision: 10, scale: 2 }).default("0"),
  totalTaxes: decimal("total_taxes", { precision: 10, scale: 2 }).default("0"),
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
  email: text("email"),
  phone: text("phone"),
  regimeTributario: text("regime_tributario").default("Simples Nacional"),
  crt: text("crt").default("1"),
  fiscalEnvironment: text("fiscal_environment").default("homologacao"),
  fiscalEnabled: boolean("fiscal_enabled").default(false),
  cscToken: text("csc_token"),
  cscId: text("csc_id"),
  stoneCode: text("stone_code"),
  stoneEnabled: boolean("stone_enabled").default(false),
  stoneClientId: text("stone_client_id"),
  stoneClientSecret: text("stone_client_secret"),
  stoneTerminalId: text("stone_terminal_id"),
  stoneEnvironment: text("stone_environment").default("producao"),
  mpAccessToken: text("mp_access_token"),
  mpTerminalId: text("mp_terminal_id"),
  mpEnabled: boolean("mp_enabled").default(false),
  paymentTimeoutSeconds: integer("payment_timeout_seconds").default(30),
  printerEnabled: boolean("printer_enabled").default(false),
  printerModel: text("printer_model"),
  printerPort: text("printer_port"),
  printerBaudRate: integer("printer_baud_rate").default(9600),
  printerColumns: integer("printer_columns").default(48),
  printerCutCommand: boolean("printer_cut_command").default(true),
  printerBeepOnSale: boolean("printer_beep_on_sale").default(true),
  receiptHeaderText: text("receipt_header_text"),
  receiptFooterText: text("receipt_footer_text"),
  receiptShowSeller: boolean("receipt_show_seller").default(true),
  nfcePrintLayout: jsonb("nfce_print_layout"),
  barcodeScannerEnabled: boolean("barcode_scanner_enabled").default(true),
  barcodeScannerAutoAdd: boolean("barcode_scanner_auto_add").default(true),
  barcodeScannerBeep: boolean("barcode_scanner_beep").default(true),
  cashRegisterRequired: boolean("cash_register_required").default(true),
  nfeEnabled: boolean("nfe_enabled").default(false),
  nfceEnabled: boolean("nfce_enabled").default(true),
  nfseEnabled: boolean("nfse_enabled").default(false),
  cteEnabled: boolean("cte_enabled").default(false),
  mdfeEnabled: boolean("mdfe_enabled").default(false),
  sefazUrlHomologacao: text("sefaz_url_homologacao"),
  sefazUrlProducao: text("sefaz_url_producao"),
  sefazUf: text("sefaz_uf"),
  sefazMunicipioCodigo: text("sefaz_municipio_codigo"),
  sefazQrCodeUrlHomologacao: text("sefaz_qr_url_homologacao"),
  sefazQrCodeUrlProducao: text("sefaz_qr_url_producao"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertCompanySettingsSchema = createInsertSchema(
  companySettings
).omit({ id: true, updatedAt: true });
export type InsertCompanySettings = z.infer<typeof insertCompanySettingsSchema>;
export type CompanySettings = typeof companySettings.$inferSelect;

export const paymentMethods = pgTable("payment_methods", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull(),
  name: text("name").notNull(),
  type: text("type").notNull(),
  nfceCode: text("nfce_code"),
  tefMethod: text("tef_method"),
  isActive: boolean("is_active").default(true),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertPaymentMethodSchema = createInsertSchema(
  paymentMethods
).omit({ id: true, createdAt: true });
export type InsertPaymentMethod = z.infer<typeof insertPaymentMethodSchema>;
export type PaymentMethod = typeof paymentMethods.$inferSelect;

export const referenceTables = pgTable("reference_tables", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull(),
  type: text("type").notNull(),
  code: text("code"),
  name: text("name").notNull(),
  description: text("description"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertReferenceTableSchema = createInsertSchema(
  referenceTables
).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertReferenceTable = z.infer<typeof insertReferenceTableSchema>;
export type ReferenceTable = typeof referenceTables.$inferSelect;

export const pdvLoads = pgTable("pdv_loads", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull(),
  payload: jsonb("payload").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertPdvLoadSchema = createInsertSchema(pdvLoads).omit({
  id: true,
  createdAt: true,
});
export type InsertPdvLoad = z.infer<typeof insertPdvLoadSchema>;
export type PdvLoad = typeof pdvLoads.$inferSelect;

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
  assignedUserId: varchar("assigned_user_id"),
  paymentMachineId: integer("payment_machine_id"),
  paymentProvider: text("payment_provider"),
  mpTerminalId: text("mp_terminal_id"),
  stoneTerminalId: text("stone_terminal_id"),
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
// PAYMENT MACHINES: Maquininhas cadastradas
// ============================================
export const paymentMachines = pgTable("payment_machines", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull(),
  name: text("name").notNull(),
  provider: text("provider").notNull(), // mercadopago | stone
  mpTerminalId: text("mp_terminal_id"),
  stoneTerminalId: text("stone_terminal_id"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertPaymentMachineSchema = createInsertSchema(paymentMachines).omit({
  id: true,
  createdAt: true,
});
export type InsertPaymentMachine = z.infer<typeof insertPaymentMachineSchema>;
export type PaymentMachine = typeof paymentMachines.$inferSelect;

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
  respTecCnpj: text("resp_tec_cnpj"),
  respTecContato: text("resp_tec_contato"),
  respTecEmail: text("resp_tec_email"),
  respTecFone: text("resp_tec_fone"),
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
// FISCAL SYSTEM: Tax Rules Matrix (NCM/CEST/UF/CFOP/Regime/Cliente/Operacao)
// ============================================
export const fiscalTaxRules = pgTable("fiscal_tax_rules", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  isActive: boolean("is_active").default(true),
  priority: integer("priority").default(0),

  // Contexto de aplicacao
  operationType: text("operation_type"), // venda, compra, devolucao, servico
  customerType: text("customer_type"), // consumidor_final, revenda, contribuinte, nao_contribuinte
  regime: text("regime"), // Simples Nacional, Lucro Real, Lucro Presumido
  originUf: text("origin_uf"),
  destinationUf: text("destination_uf"),
  scope: text("scope"), // interna, interestadual, exterior
  ncm: text("ncm"),
  cest: text("cest"),
  cfop: text("cfop"),

  // Resultado fiscal aplicado
  cstIcms: text("cst_icms"),
  csosn: text("csosn"),
  cstIpi: text("cst_ipi"),
  cstPis: text("cst_pis"),
  cstCofins: text("cst_cofins"),
  icmsAliquot: decimal("icms_aliquot", { precision: 5, scale: 2 }).default("0"),
  icmsReduction: decimal("icms_reduction", { precision: 5, scale: 2 }).default(
    "0",
  ),
  icmsStAliquot: decimal("icms_st_aliquot", {
    precision: 5,
    scale: 2,
  }).default("0"),
  ipiAliquot: decimal("ipi_aliquot", { precision: 5, scale: 2 }).default("0"),
  pisAliquot: decimal("pis_aliquot", { precision: 5, scale: 2 }).default("0"),
  cofinsAliquot: decimal("cofins_aliquot", { precision: 5, scale: 2 }).default(
    "0",
  ),
  issAliquot: decimal("iss_aliquot", { precision: 5, scale: 2 }).default("0"),

  // Excecoes e vigencia
  exceptionData: jsonb("exception_data"),
  validFrom: timestamp("valid_from"),
  validTo: timestamp("valid_to"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertFiscalTaxRuleSchema = createInsertSchema(fiscalTaxRules)
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
  })
  .superRefine((value, ctx) => {
    if (value.originUf && !/^[A-Z]{2}$/.test(String(value.originUf).toUpperCase())) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["originUf"],
        message: "originUf deve ter 2 letras (UF)",
      });
    }
    if (
      value.destinationUf &&
      !/^[A-Z]{2}$/.test(String(value.destinationUf).toUpperCase())
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["destinationUf"],
        message: "destinationUf deve ter 2 letras (UF)",
      });
    }
    if (value.ncm && !/^\d{8}$/.test(String(value.ncm))) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["ncm"],
        message: "ncm deve ter 8 digitos",
      });
    }
    if (value.cest && !/^\d{7}$/.test(String(value.cest))) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["cest"],
        message: "cest deve ter 7 digitos",
      });
    }
    if (value.cfop && !/^\d{4}$/.test(String(value.cfop))) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["cfop"],
        message: "cfop deve ter 4 digitos",
      });
    }
  });
export type InsertFiscalTaxRule = z.infer<typeof insertFiscalTaxRuleSchema>;
export type FiscalTaxRule = typeof fiscalTaxRules.$inferSelect;

// ============================================
// FISCAL SYSTEM: Simples Nacional Aliquots
// ============================================
export const simplesNacionalAliquots = pgTable("simples_nacional_aliquots", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull(),
  annex: text("annex").notNull(),
  rangeStart: decimal("range_start", { precision: 12, scale: 2 }).default("0"),
  rangeEnd: decimal("range_end", { precision: 12, scale: 2 }).default("0"),
  nominalAliquot: decimal("nominal_aliquot", {
    precision: 5,
    scale: 2,
  }).default("0"),
  effectiveAliquot: decimal("effective_aliquot", {
    precision: 5,
    scale: 2,
  }).default("0"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertSimplesNacionalAliquotSchema = createInsertSchema(
  simplesNacionalAliquots
).omit({
  id: true,
  createdAt: true,
});
export type InsertSimplesNacionalAliquot = z.infer<
  typeof insertSimplesNacionalAliquotSchema
>;
export type SimplesNacionalAliquot =
  typeof simplesNacionalAliquots.$inferSelect;

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

// ============================================
// SEFAZ INTEGRATION: NF-e Submissions
// ============================================
export const nfeSubmissions = pgTable("nfe_submissions", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull(),
  saleId: integer("sale_id"),
  nfeNumber: text("nfe_number"),
  nfeSeries: text("nfe_series"),
  status: text("status").notNull().default("draft"), // draft, sent, authorized, cancelled, denied
  submissionProtocol: text("submission_protocol"),
  submissionStatus: text("submission_status"), // pending, processing, completed, error
  submissionTimestamp: timestamp("submission_timestamp"),
  authorizedProtocol: text("authorized_protocol"),
  authorizedTimestamp: timestamp("authorized_timestamp"),
  denialReason: text("denial_reason"),
  xmlContent: text("xml_content"),
  xmlSignature: text("xml_signature"),
  environment: text("environment").default("homologacao"), // homologacao or producao
  contingencyMode: boolean("contingency_mode").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertNfeSubmissionSchema = createInsertSchema(
  nfeSubmissions
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertNfeSubmission = z.infer<typeof insertNfeSubmissionSchema>;
export type NfeSubmission = typeof nfeSubmissions.$inferSelect;

// ============================================
// SEFAZ INTEGRATION: Transmission Logs
// ============================================
export const sefazTransmissionLogs = pgTable("sefaz_transmission_logs", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull(),
  action: text("action").notNull(),
  environment: text("environment").notNull(),
  requestPayload: jsonb("request_payload"),
  responsePayload: jsonb("response_payload"),
  success: boolean("success").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertSefazTransmissionLogSchema = createInsertSchema(
  sefazTransmissionLogs
).omit({
  id: true,
  createdAt: true,
});
export type InsertSefazTransmissionLog = z.infer<
  typeof insertSefazTransmissionLogSchema
>;
export type SefazTransmissionLog = typeof sefazTransmissionLogs.$inferSelect;

// ============================================
// FISCAL XML STORAGE: Authorized XML retention
// ============================================
export const fiscalXmlStorage = pgTable("fiscal_xml_storage", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull(),
  documentType: text("document_type").notNull(),
  documentKey: text("document_key").notNull(),
  xmlContent: text("xml_content").notNull(),
  qrCodeUrl: text("qr_code_url"),
  authorizedAt: timestamp("authorized_at"),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertFiscalXmlStorageSchema = createInsertSchema(
  fiscalXmlStorage
).omit({
  id: true,
  createdAt: true,
});
export type InsertFiscalXmlStorage = z.infer<
  typeof insertFiscalXmlStorageSchema
>;
export type FiscalXmlStorage = typeof fiscalXmlStorage.$inferSelect;

// ============================================
// MANIFESTATION: Documents issued against CNPJ
// ============================================
export const manifestDocuments = pgTable("manifest_documents", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull(),
  documentKey: text("document_key").notNull(),
  issuerCnpj: text("issuer_cnpj").notNull(),
  receiverCnpj: text("receiver_cnpj").notNull(),
  xmlContent: text("xml_content").notNull(),
  downloadedAt: timestamp("downloaded_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertManifestDocumentSchema = createInsertSchema(
  manifestDocuments
).omit({
  id: true,
  createdAt: true,
});
export type InsertManifestDocument = z.infer<
  typeof insertManifestDocumentSchema
>;
export type ManifestDocument = typeof manifestDocuments.$inferSelect;

// ============================================
// SEFAZ INTEGRATION: NF-e Cancellations
// ============================================
export const nfeCancellations = pgTable("nfe_cancellations", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull(),
  nfeSubmissionId: integer("nfe_submission_id").notNull(),
  nfeNumber: text("nfe_number").notNull(),
  nfeSeries: text("nfe_series").notNull(),
  cancellationReason: text("cancellation_reason").notNull(),
  cancellationProtocol: text("cancellation_protocol"),
  cancellationStatus: text("cancellation_status").notNull().default("pending"), // pending, authorized, denied
  cancellationTimestamp: timestamp("cancellation_timestamp"),
  authorizedProtocol: text("authorized_protocol"),
  authorizedTimestamp: timestamp("authorized_timestamp"),
  denialReason: text("denial_reason"),
  requestedAt: timestamp("requested_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertNfeCancellationSchema = createInsertSchema(
  nfeCancellations
).omit({
  id: true,
  requestedAt: true,
  createdAt: true,
});
export type InsertNfeCancellation = z.infer<typeof insertNfeCancellationSchema>;
export type NfeCancellation = typeof nfeCancellations.$inferSelect;

// ============================================
// SEFAZ INTEGRATION: Correction Letters (Carta de Correção)
// ============================================
export const nfeCorrectionLetters = pgTable("nfe_correction_letters", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull(),
  nfeSubmissionId: integer("nfe_submission_id").notNull(),
  nfeNumber: text("nfe_number").notNull(),
  nfeSeries: text("nfe_series").notNull(),
  correctionReason: text("correction_reason").notNull(),
  originalContent: text("original_content"),
  correctedContent: text("corrected_content").notNull(),
  correctionProtocol: text("correction_protocol"),
  status: text("status").notNull().default("pending"), // pending, authorized, denied
  authorizedProtocol: text("authorized_protocol"),
  authorizedTimestamp: timestamp("authorized_timestamp"),
  denialReason: text("denial_reason"),
  requestedAt: timestamp("requested_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertNfeCorrectionLetterSchema = createInsertSchema(
  nfeCorrectionLetters
).omit({
  id: true,
  requestedAt: true,
  createdAt: true,
});
export type InsertNfeCorrectionLetter = z.infer<
  typeof insertNfeCorrectionLetterSchema
>;
export type NfeCorrectionLetter = typeof nfeCorrectionLetters.$inferSelect;

// ============================================
// SEFAZ INTEGRATION: Number Inutilization
// ============================================
export const nfeNumberInutilization = pgTable("nfe_number_inutilization", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull(),
  nfeSeries: text("nfe_series").notNull(),
  startNumber: integer("start_number").notNull(),
  endNumber: integer("end_number").notNull(),
  reason: text("reason").notNull(),
  inutilizationProtocol: text("inutilization_protocol"),
  status: text("status").notNull().default("pending"), // pending, authorized, denied
  authorizedProtocol: text("authorized_protocol"),
  authorizedTimestamp: timestamp("authorized_timestamp"),
  denialReason: text("denial_reason"),
  requestedAt: timestamp("requested_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertNfeNumberInutilizationSchema = createInsertSchema(
  nfeNumberInutilization
).omit({
  id: true,
  requestedAt: true,
  createdAt: true,
});
export type InsertNfeNumberInutilization = z.infer<
  typeof insertNfeNumberInutilizationSchema
>;
export type NfeNumberInutilization = typeof nfeNumberInutilization.$inferSelect;

// ============================================
// SEFAZ INTEGRATION: Contingency Mode
// ============================================
export const nfeContingency = pgTable("nfe_contingency", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull(),
  contingencyMode: text("contingency_mode").notNull(), // offline, svc, svc_rs, svc_an
  reason: text("reason").notNull(),
  description: text("description"),
  startedAt: timestamp("started_at").notNull(),
  endedAt: timestamp("ended_at"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertNfeContingencySchema = createInsertSchema(
  nfeContingency
).omit({
  id: true,
  createdAt: true,
});
export type InsertNfeContingency = z.infer<typeof insertNfeContingencySchema>;
export type NfeContingency = typeof nfeContingency.$inferSelect;

// ============================================
// SEFAZ INTEGRATION: SEFAZ Configuration
// ============================================
export const sefazConfigs = pgTable("sefaz_configs", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull().unique(),
  certificatePath: text("certificate_path"),
  certificatePassword: text("certificate_password"),
  environment: text("environment").notNull().default("homologacao"), // homologacao or producao
  sefazUrl: text("sefaz_url"),
  sefazTimeOut: integer("sefaz_timeout").default(30),
  autoSubmit: boolean("auto_submit").default(false),
  proxySefaz: text("proxy_sefaz"),
  isEnabled: boolean("is_enabled").default(true),
  lastConnectionTest: timestamp("last_connection_test"),
  connectionStatus: text("connection_status").default("unknown"), // connected, disconnected, error
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertSefazConfigSchema = createInsertSchema(sefazConfigs).omit({
  id: true,
  updatedAt: true,
});
export type InsertSefazConfig = z.infer<typeof insertSefazConfigSchema>;
export type SefazConfig = typeof sefazConfigs.$inferSelect;

// ============================================
// DIGITAL CERTIFICATES: e-CNPJ Management
// ============================================
export const digitalCertificates = pgTable("digital_certificates", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull().unique(),
  certificateData: text("certificate_data").notNull(), // Base64 encoded P12/PFX
  certificatePassword: text("certificate_password").notNull(), // Encrypted password
  cnpj: text("cnpj").notNull(),
  subjectName: text("subject_name"),
  issuer: text("issuer"),
  validFrom: timestamp("valid_from"),
  validUntil: timestamp("valid_until"),
  certificateType: text("certificate_type").default("e-CNPJ"), // e-CNPJ, e-CPF
  isActive: boolean("is_active").default(true),
  lastUsedAt: timestamp("last_used_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertDigitalCertificateSchema = createInsertSchema(
  digitalCertificates
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertDigitalCertificate = z.infer<
  typeof insertDigitalCertificateSchema
>;
export type DigitalCertificate = typeof digitalCertificates.$inferSelect;

// ============================================
// FISCAL NUMBERING: Numeração Sequencial Autorizada (NSA)
// ============================================
export const sequentialNumbering = pgTable("sequential_numbering", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull(),
  documentType: text("document_type").notNull(), // NF-e, NFC-e, NFS-e, CT-e, MDF-e
  series: integer("series").notNull(), // Série do documento
  rangeStart: integer("range_start").notNull(), // Número inicial autorizado
  rangeEnd: integer("range_end").notNull(), // Número final autorizado
  currentNumber: integer("current_number").notNull(), // Próximo número a usar
  authorization: text("authorization"), // Protocolo de autorização SEFAZ
  authorizedAt: timestamp("authorized_at"), // Data da autorização
  expiresAt: timestamp("expires_at"), // Data de expiração
  environment: text("environment").notNull().default("homologacao"), // homologacao or producao
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertSequentialNumberingSchema = createInsertSchema(
  sequentialNumbering
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertSequentialNumbering = z.infer<
  typeof insertSequentialNumberingSchema
>;
export type SequentialNumbering = typeof sequentialNumbering.$inferSelect;
