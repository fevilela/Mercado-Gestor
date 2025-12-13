import {
  type User,
  type InsertUser,
  type Product,
  type InsertProduct,
  type ProductVariation,
  type InsertProductVariation,
  type ProductMedia,
  type InsertProductMedia,
  type KitItem,
  type InsertKitItem,
  type Customer,
  type InsertCustomer,
  type Supplier,
  type InsertSupplier,
  type Sale,
  type InsertSale,
  type SaleItem,
  type InsertSaleItem,
  type InventoryMovement,
  type InsertInventoryMovement,
  type CompanySettings,
  type InsertCompanySettings,
  type Payable,
  type InsertPayable,
  type Receivable,
  type InsertReceivable,
  users,
  products,
  productVariations,
  productMedia,
  kitItems,
  customers,
  suppliers,
  sales,
  saleItems,
  inventoryMovements,
  companySettings,
  payables,
  receivables,
} from "@shared/schema";
import { db, pool } from "./db";
import { eq, desc, sql, gte } from "drizzle-orm";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  getAllProducts(): Promise<Product[]>;
  getProduct(id: number): Promise<Product | undefined>;
  createProduct(product: InsertProduct): Promise<Product>;
  updateProduct(
    id: number,
    product: Partial<InsertProduct>
  ): Promise<Product | undefined>;
  deleteProduct(id: number): Promise<boolean>;
  updateProductStock(
    id: number,
    quantity: number
  ): Promise<Product | undefined>;

  getProductVariations(productId: number): Promise<ProductVariation[]>;
  createProductVariation(
    variation: InsertProductVariation
  ): Promise<ProductVariation>;
  deleteProductVariations(productId: number): Promise<boolean>;

  getProductMedia(productId: number): Promise<ProductMedia[]>;
  createProductMedia(media: InsertProductMedia): Promise<ProductMedia>;
  deleteProductMedia(productId: number): Promise<boolean>;

  getKitItems(kitProductId: number): Promise<KitItem[]>;
  createKitItem(item: InsertKitItem): Promise<KitItem>;
  deleteKitItems(kitProductId: number): Promise<boolean>;

  getAllCustomers(): Promise<Customer[]>;
  getCustomer(id: number): Promise<Customer | undefined>;
  createCustomer(customer: InsertCustomer): Promise<Customer>;
  updateCustomer(
    id: number,
    customer: Partial<InsertCustomer>
  ): Promise<Customer | undefined>;

  getAllSuppliers(): Promise<Supplier[]>;
  getSupplier(id: number): Promise<Supplier | undefined>;
  createSupplier(supplier: InsertSupplier): Promise<Supplier>;
  updateSupplier(
    id: number,
    supplier: Partial<InsertSupplier>
  ): Promise<Supplier | undefined>;

  getAllSales(): Promise<Sale[]>;
  getSale(id: number): Promise<Sale | undefined>;
  createSale(sale: InsertSale, items: InsertSaleItem[]): Promise<Sale>;
  updateSaleNfceStatus(
    id: number,
    status: string,
    protocol?: string,
    key?: string
  ): Promise<Sale | undefined>;
  getSaleItems(saleId: number): Promise<SaleItem[]>;
  getSaleItemsBatch(saleIds: number[]): Promise<Map<number, SaleItem[]>>;
  getSalesStats(): Promise<{ today: number; week: number; month: number }>;

  createInventoryMovement(
    movement: InsertInventoryMovement
  ): Promise<InventoryMovement>;
  getInventoryMovements(productId: number): Promise<InventoryMovement[]>;

  getCompanySettings(): Promise<CompanySettings | undefined>;
  updateCompanySettings(
    settings: Partial<InsertCompanySettings>
  ): Promise<CompanySettings>;

  getAllPayables(): Promise<Payable[]>;
  getPayable(id: number): Promise<Payable | undefined>;
  createPayable(payable: InsertPayable): Promise<Payable>;
  updatePayable(
    id: number,
    payable: Partial<InsertPayable>
  ): Promise<Payable | undefined>;
  deletePayable(id: number): Promise<boolean>;

  getAllReceivables(): Promise<Receivable[]>;
  getReceivable(id: number): Promise<Receivable | undefined>;
  createReceivable(receivable: InsertReceivable): Promise<Receivable>;
  updateReceivable(
    id: number,
    receivable: Partial<InsertReceivable>
  ): Promise<Receivable | undefined>;
  deleteReceivable(id: number): Promise<boolean>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async getAllProducts(): Promise<Product[]> {
    return await db.select().from(products).orderBy(desc(products.id));
  }

  async getProduct(id: number): Promise<Product | undefined> {
    const [product] = await db
      .select()
      .from(products)
      .where(eq(products.id, id));
    return product || undefined;
  }

  async createProduct(product: InsertProduct): Promise<Product> {
    const [newProduct] = await db.insert(products).values(product).returning();
    return newProduct;
  }

  async updateProduct(
    id: number,
    product: Partial<InsertProduct>
  ): Promise<Product | undefined> {
    const [updated] = await db
      .update(products)
      .set({ ...product, updatedAt: new Date() })
      .where(eq(products.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteProduct(id: number): Promise<boolean> {
    await this.deleteProductVariations(id);
    await this.deleteProductMedia(id);
    await this.deleteKitItems(id);
    await db.delete(products).where(eq(products.id, id));
    return true;
  }

  async updateProductStock(
    id: number,
    quantity: number
  ): Promise<Product | undefined> {
    const [updated] = await db
      .update(products)
      .set({ stock: sql`${products.stock} + ${quantity}` })
      .where(eq(products.id, id))
      .returning();
    return updated || undefined;
  }

  async getProductVariations(productId: number): Promise<ProductVariation[]> {
    return await db
      .select()
      .from(productVariations)
      .where(eq(productVariations.productId, productId));
  }

  async createProductVariation(
    variation: InsertProductVariation
  ): Promise<ProductVariation> {
    const [newVariation] = await db
      .insert(productVariations)
      .values(variation)
      .returning();
    return newVariation;
  }

  async deleteProductVariations(productId: number): Promise<boolean> {
    await db
      .delete(productVariations)
      .where(eq(productVariations.productId, productId));
    return true;
  }

  async getProductMedia(productId: number): Promise<ProductMedia[]> {
    return await db
      .select()
      .from(productMedia)
      .where(eq(productMedia.productId, productId));
  }

  async createProductMedia(media: InsertProductMedia): Promise<ProductMedia> {
    const [newMedia] = await db.insert(productMedia).values(media).returning();
    return newMedia;
  }

  async deleteProductMedia(productId: number): Promise<boolean> {
    await db.delete(productMedia).where(eq(productMedia.productId, productId));
    return true;
  }

  async getKitItems(kitProductId: number): Promise<KitItem[]> {
    return await db
      .select()
      .from(kitItems)
      .where(eq(kitItems.kitProductId, kitProductId));
  }

  async createKitItem(item: InsertKitItem): Promise<KitItem> {
    const [newItem] = await db.insert(kitItems).values(item).returning();
    return newItem;
  }

  async deleteKitItems(kitProductId: number): Promise<boolean> {
    await db.delete(kitItems).where(eq(kitItems.kitProductId, kitProductId));
    return true;
  }

  async getAllCustomers(): Promise<Customer[]> {
    return await db.select().from(customers).orderBy(desc(customers.id));
  }

  async getCustomer(id: number): Promise<Customer | undefined> {
    const [customer] = await db
      .select()
      .from(customers)
      .where(eq(customers.id, id));
    return customer || undefined;
  }

  async createCustomer(customer: InsertCustomer): Promise<Customer> {
    const [newCustomer] = await db
      .insert(customers)
      .values(customer)
      .returning();
    return newCustomer;
  }

  async updateCustomer(
    id: number,
    customer: Partial<InsertCustomer>
  ): Promise<Customer | undefined> {
    const [updated] = await db
      .update(customers)
      .set(customer)
      .where(eq(customers.id, id))
      .returning();
    return updated || undefined;
  }

  async getAllSuppliers(): Promise<Supplier[]> {
    return await db.select().from(suppliers).orderBy(desc(suppliers.id));
  }

  async getSupplier(id: number): Promise<Supplier | undefined> {
    const [supplier] = await db
      .select()
      .from(suppliers)
      .where(eq(suppliers.id, id));
    return supplier || undefined;
  }

  async createSupplier(supplier: InsertSupplier): Promise<Supplier> {
    const [newSupplier] = await db
      .insert(suppliers)
      .values(supplier)
      .returning();
    return newSupplier;
  }

  async updateSupplier(
    id: number,
    supplier: Partial<InsertSupplier>
  ): Promise<Supplier | undefined> {
    const [updated] = await db
      .update(suppliers)
      .set(supplier)
      .where(eq(suppliers.id, id))
      .returning();
    return updated || undefined;
  }

  async getAllSales(): Promise<Sale[]> {
    return await db.select().from(sales).orderBy(desc(sales.id));
  }

  async getSale(id: number): Promise<Sale | undefined> {
    const [sale] = await db.select().from(sales).where(eq(sales.id, id));
    return sale || undefined;
  }

  async createSale(sale: InsertSale, items: InsertSaleItem[]): Promise<Sale> {
    const [newSale] = await db.insert(sales).values(sale).returning();

    const itemsWithSaleId = items.map((item) => ({
      ...item,
      saleId: newSale.id,
    }));

    await db.insert(saleItems).values(itemsWithSaleId);

    return newSale;
  }

  async updateSaleNfceStatus(
    id: number,
    status: string,
    protocol?: string,
    key?: string
  ): Promise<Sale | undefined> {
    const [updated] = await db
      .update(sales)
      .set({
        nfceStatus: status,
        ...(protocol && { nfceProtocol: protocol }),
        ...(key && { nfceKey: key }),
      })
      .where(eq(sales.id, id))
      .returning();
    return updated || undefined;
  }

  async getSaleItems(saleId: number): Promise<SaleItem[]> {
    return await db
      .select()
      .from(saleItems)
      .where(eq(saleItems.saleId, saleId));
  }

  async getSaleItemsBatch(saleIds: number[]): Promise<Map<number, SaleItem[]>> {
    if (saleIds.length === 0) {
      return new Map();
    }
    const allItems = await db
      .select()
      .from(saleItems)
      .where(
        sql`${saleItems.saleId} = ANY(ARRAY[${sql.raw(
          saleIds.join(",")
        )}]::int[])`
      );

    const itemsMap = new Map<number, SaleItem[]>();
    for (const item of allItems) {
      const existing = itemsMap.get(item.saleId) || [];
      existing.push(item);
      itemsMap.set(item.saleId, existing);
    }
    return itemsMap;
  }

  async getSalesStats(): Promise<{
    today: number;
    week: number;
    month: number;
  }> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);

    const monthAgo = new Date(today);
    monthAgo.setMonth(monthAgo.getMonth() - 1);

    const [todayStats] = await db
      .select({
        total: sql<number>`COALESCE(SUM(CAST(${sales.total} AS DECIMAL)), 0)`,
      })
      .from(sales)
      .where(gte(sales.createdAt, today));

    const [weekStats] = await db
      .select({
        total: sql<number>`COALESCE(SUM(CAST(${sales.total} AS DECIMAL)), 0)`,
      })
      .from(sales)
      .where(gte(sales.createdAt, weekAgo));

    const [monthStats] = await db
      .select({
        total: sql<number>`COALESCE(SUM(CAST(${sales.total} AS DECIMAL)), 0)`,
      })
      .from(sales)
      .where(gte(sales.createdAt, monthAgo));

    return {
      today: Number(todayStats?.total || 0),
      week: Number(weekStats?.total || 0),
      month: Number(monthStats?.total || 0),
    };
  }

  async createInventoryMovement(
    movement: InsertInventoryMovement
  ): Promise<InventoryMovement> {
    const [newMovement] = await db
      .insert(inventoryMovements)
      .values(movement)
      .returning();
    return newMovement;
  }

  async getInventoryMovements(productId: number): Promise<InventoryMovement[]> {
    return await db
      .select()
      .from(inventoryMovements)
      .where(eq(inventoryMovements.productId, productId))
      .orderBy(desc(inventoryMovements.id));
  }

  async getCompanySettings(): Promise<CompanySettings | undefined> {
    const [settings] = await db.select().from(companySettings).limit(1);
    return settings || undefined;
  }

  async updateCompanySettings(
    settings: Partial<InsertCompanySettings>
  ): Promise<CompanySettings> {
    const existing = await this.getCompanySettings();

    if (existing) {
      const [updated] = await db
        .update(companySettings)
        .set({ ...settings, updatedAt: new Date() })
        .where(eq(companySettings.id, existing.id))
        .returning();
      return updated;
    } else {
      const [created] = await db
        .insert(companySettings)
        .values(settings)
        .returning();
      return created;
    }
  }

  async getAllPayables(): Promise<Payable[]> {
    return await db.select().from(payables).orderBy(desc(payables.dueDate));
  }

  async getPayable(id: number): Promise<Payable | undefined> {
    const [payable] = await db
      .select()
      .from(payables)
      .where(eq(payables.id, id));
    return payable || undefined;
  }

  async createPayable(payable: InsertPayable): Promise<Payable> {
    const [newPayable] = await db.insert(payables).values(payable).returning();
    return newPayable;
  }

  async updatePayable(
    id: number,
    payable: Partial<InsertPayable>
  ): Promise<Payable | undefined> {
    const [updated] = await db
      .update(payables)
      .set(payable)
      .where(eq(payables.id, id))
      .returning();
    return updated || undefined;
  }

  async deletePayable(id: number): Promise<boolean> {
    await db.delete(payables).where(eq(payables.id, id));
    return true;
  }

  async getAllReceivables(): Promise<Receivable[]> {
    return await db
      .select()
      .from(receivables)
      .orderBy(desc(receivables.dueDate));
  }

  async getReceivable(id: number): Promise<Receivable | undefined> {
    const [receivable] = await db
      .select()
      .from(receivables)
      .where(eq(receivables.id, id));
    return receivable || undefined;
  }

  async createReceivable(receivable: InsertReceivable): Promise<Receivable> {
    const [newReceivable] = await db
      .insert(receivables)
      .values(receivable)
      .returning();
    return newReceivable;
  }

  async updateReceivable(
    id: number,
    receivable: Partial<InsertReceivable>
  ): Promise<Receivable | undefined> {
    const [updated] = await db
      .update(receivables)
      .set(receivable)
      .where(eq(receivables.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteReceivable(id: number): Promise<boolean> {
    await db.delete(receivables).where(eq(receivables.id, id));
    return true;
  }
}

export const storage = new DatabaseStorage();
