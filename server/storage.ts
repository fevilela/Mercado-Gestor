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
import { eq, desc, sql, gte, and } from "drizzle-orm";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  getAllProducts(companyId: number): Promise<Product[]>;
  getProduct(id: number, companyId: number): Promise<Product | undefined>;
  createProduct(product: InsertProduct): Promise<Product>;
  updateProduct(
    id: number,
    companyId: number,
    product: Partial<InsertProduct>
  ): Promise<Product | undefined>;
  deleteProduct(id: number, companyId: number): Promise<boolean>;
  updateProductStock(
    id: number,
    companyId: number,
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

  getAllCustomers(companyId: number): Promise<Customer[]>;
  getCustomer(id: number, companyId: number): Promise<Customer | undefined>;
  createCustomer(customer: InsertCustomer): Promise<Customer>;
  updateCustomer(
    id: number,
    companyId: number,
    customer: Partial<InsertCustomer>
  ): Promise<Customer | undefined>;
  deleteCustomer(id: number, companyId: number): Promise<boolean>;

  getAllSuppliers(companyId: number): Promise<Supplier[]>;
  getSupplier(id: number, companyId: number): Promise<Supplier | undefined>;
  createSupplier(supplier: InsertSupplier): Promise<Supplier>;
  updateSupplier(
    id: number,
    companyId: number,
    supplier: Partial<InsertSupplier>
  ): Promise<Supplier | undefined>;
  deleteSupplier(id: number, companyId: number): Promise<boolean>;

  getAllSales(companyId: number): Promise<Sale[]>;
  getSale(id: number, companyId: number): Promise<Sale | undefined>;
  createSale(sale: InsertSale, items: InsertSaleItem[]): Promise<Sale>;
  updateSaleNfceStatus(
    id: number,
    companyId: number,
    status: string,
    protocol?: string,
    key?: string
  ): Promise<Sale | undefined>;
  getSaleItems(saleId: number): Promise<SaleItem[]>;
  getSaleItemsBatch(saleIds: number[]): Promise<Map<number, SaleItem[]>>;
  getSalesStats(
    companyId: number
  ): Promise<{ today: number; week: number; month: number }>;

  createInventoryMovement(
    movement: InsertInventoryMovement
  ): Promise<InventoryMovement>;
  getInventoryMovements(
    productId: number,
    companyId: number
  ): Promise<InventoryMovement[]>;

  getCompanySettings(companyId: number): Promise<CompanySettings | undefined>;
  updateCompanySettings(
    companyId: number,
    settings: Partial<InsertCompanySettings>
  ): Promise<CompanySettings>;

  getAllPayables(companyId: number): Promise<Payable[]>;
  getPayable(id: number, companyId: number): Promise<Payable | undefined>;
  createPayable(payable: InsertPayable): Promise<Payable>;
  updatePayable(
    id: number,
    companyId: number,
    payable: Partial<InsertPayable>
  ): Promise<Payable | undefined>;
  deletePayable(id: number, companyId: number): Promise<boolean>;

  getAllReceivables(companyId: number): Promise<Receivable[]>;
  getReceivable(id: number, companyId: number): Promise<Receivable | undefined>;
  createReceivable(receivable: InsertReceivable): Promise<Receivable>;
  updateReceivable(
    id: number,
    companyId: number,
    receivable: Partial<InsertReceivable>
  ): Promise<Receivable | undefined>;
  deleteReceivable(id: number, companyId: number): Promise<boolean>;
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

  async getAllProducts(companyId: number): Promise<Product[]> {
    return await db
      .select()
      .from(products)
      .where(eq(products.companyId, companyId))
      .orderBy(desc(products.id));
  }

  async getProduct(
    id: number,
    companyId: number
  ): Promise<Product | undefined> {
    const [product] = await db
      .select()
      .from(products)
      .where(and(eq(products.id, id), eq(products.companyId, companyId)));
    return product || undefined;
  }

  async createProduct(product: InsertProduct): Promise<Product> {
    const [newProduct] = await db.insert(products).values(product).returning();
    return newProduct;
  }

  async updateProduct(
    id: number,
    companyId: number,
    product: Partial<InsertProduct>
  ): Promise<Product | undefined> {
    const [updated] = await db
      .update(products)
      .set({ ...product, updatedAt: new Date() })
      .where(and(eq(products.id, id), eq(products.companyId, companyId)))
      .returning();
    return updated || undefined;
  }

  async deleteProduct(id: number, companyId: number): Promise<boolean> {
    await this.deleteProductVariations(id);
    await this.deleteProductMedia(id);
    await this.deleteKitItems(id);
    await db
      .delete(products)
      .where(and(eq(products.id, id), eq(products.companyId, companyId)));
    return true;
  }

  async updateProductStock(
    id: number,
    companyId: number,
    quantity: number
  ): Promise<Product | undefined> {
    const [updated] = await db
      .update(products)
      .set({ stock: sql`${products.stock} + ${quantity}` })
      .where(and(eq(products.id, id), eq(products.companyId, companyId)))
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

  async getAllCustomers(companyId: number): Promise<Customer[]> {
    return await db
      .select()
      .from(customers)
      .where(eq(customers.companyId, companyId))
      .orderBy(desc(customers.id));
  }

  async getCustomer(
    id: number,
    companyId: number
  ): Promise<Customer | undefined> {
    const [customer] = await db
      .select()
      .from(customers)
      .where(and(eq(customers.id, id), eq(customers.companyId, companyId)));
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
    companyId: number,
    customer: Partial<InsertCustomer>
  ): Promise<Customer | undefined> {
    const [updated] = await db
      .update(customers)
      .set(customer)
      .where(and(eq(customers.id, id), eq(customers.companyId, companyId)))
      .returning();
    return updated || undefined;
  }

  async deleteCustomer(id: number, companyId: number): Promise<boolean> {
    await db
      .delete(customers)
      .where(and(eq(customers.id, id), eq(customers.companyId, companyId)));
    return true;
  }

  async getAllSuppliers(companyId: number): Promise<Supplier[]> {
    return await db
      .select()
      .from(suppliers)
      .where(eq(suppliers.companyId, companyId))
      .orderBy(desc(suppliers.id));
  }

  async getSupplier(
    id: number,
    companyId: number
  ): Promise<Supplier | undefined> {
    const [supplier] = await db
      .select()
      .from(suppliers)
      .where(and(eq(suppliers.id, id), eq(suppliers.companyId, companyId)));
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
    companyId: number,
    supplier: Partial<InsertSupplier>
  ): Promise<Supplier | undefined> {
    const [updated] = await db
      .update(suppliers)
      .set(supplier)
      .where(and(eq(suppliers.id, id), eq(suppliers.companyId, companyId)))
      .returning();
    return updated || undefined;
  }

  async deleteSupplier(id: number, companyId: number): Promise<boolean> {
    await db
      .delete(suppliers)
      .where(and(eq(suppliers.id, id), eq(suppliers.companyId, companyId)));
    return true;
  }

  async getAllSales(companyId: number): Promise<Sale[]> {
    return await db
      .select()
      .from(sales)
      .where(eq(sales.companyId, companyId))
      .orderBy(desc(sales.id));
  }

  async getSale(id: number, companyId: number): Promise<Sale | undefined> {
    const [sale] = await db
      .select()
      .from(sales)
      .where(and(eq(sales.id, id), eq(sales.companyId, companyId)));
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
    companyId: number,
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
      .where(and(eq(sales.id, id), eq(sales.companyId, companyId)))
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

  async getSalesStats(companyId: number): Promise<{
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
      .where(and(eq(sales.companyId, companyId), gte(sales.createdAt, today)));

    const [weekStats] = await db
      .select({
        total: sql<number>`COALESCE(SUM(CAST(${sales.total} AS DECIMAL)), 0)`,
      })
      .from(sales)
      .where(
        and(eq(sales.companyId, companyId), gte(sales.createdAt, weekAgo))
      );

    const [monthStats] = await db
      .select({
        total: sql<number>`COALESCE(SUM(CAST(${sales.total} AS DECIMAL)), 0)`,
      })
      .from(sales)
      .where(
        and(eq(sales.companyId, companyId), gte(sales.createdAt, monthAgo))
      );

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

  async getInventoryMovements(
    productId: number,
    companyId: number
  ): Promise<InventoryMovement[]> {
    return await db
      .select()
      .from(inventoryMovements)
      .where(
        and(
          eq(inventoryMovements.productId, productId),
          eq(inventoryMovements.companyId, companyId)
        )
      )
      .orderBy(desc(inventoryMovements.id));
  }

  async getCompanySettings(
    companyId: number
  ): Promise<CompanySettings | undefined> {
    const [settings] = await db
      .select()
      .from(companySettings)
      .where(eq(companySettings.companyId, companyId))
      .limit(1);
    return settings || undefined;
  }

  async updateCompanySettings(
    companyId: number,
    settings: Partial<InsertCompanySettings>
  ): Promise<CompanySettings> {
    const existing = await this.getCompanySettings(companyId);

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
        .values({ ...settings, companyId })
        .returning();
      return created;
    }
  }

  async getAllPayables(companyId: number): Promise<Payable[]> {
    return await db
      .select()
      .from(payables)
      .where(eq(payables.companyId, companyId))
      .orderBy(desc(payables.dueDate));
  }

  async getPayable(
    id: number,
    companyId: number
  ): Promise<Payable | undefined> {
    const [payable] = await db
      .select()
      .from(payables)
      .where(and(eq(payables.id, id), eq(payables.companyId, companyId)));
    return payable || undefined;
  }

  async createPayable(payable: InsertPayable): Promise<Payable> {
    const [newPayable] = await db.insert(payables).values(payable).returning();
    return newPayable;
  }

  async updatePayable(
    id: number,
    companyId: number,
    payable: Partial<InsertPayable>
  ): Promise<Payable | undefined> {
    const [updated] = await db
      .update(payables)
      .set(payable)
      .where(and(eq(payables.id, id), eq(payables.companyId, companyId)))
      .returning();
    return updated || undefined;
  }

  async deletePayable(id: number, companyId: number): Promise<boolean> {
    await db
      .delete(payables)
      .where(and(eq(payables.id, id), eq(payables.companyId, companyId)));
    return true;
  }

  async getAllReceivables(companyId: number): Promise<Receivable[]> {
    return await db
      .select()
      .from(receivables)
      .where(eq(receivables.companyId, companyId))
      .orderBy(desc(receivables.dueDate));
  }

  async getReceivable(
    id: number,
    companyId: number
  ): Promise<Receivable | undefined> {
    const [receivable] = await db
      .select()
      .from(receivables)
      .where(and(eq(receivables.id, id), eq(receivables.companyId, companyId)));
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
    companyId: number,
    receivable: Partial<InsertReceivable>
  ): Promise<Receivable | undefined> {
    const [updated] = await db
      .update(receivables)
      .set(receivable)
      .where(and(eq(receivables.id, id), eq(receivables.companyId, companyId)))
      .returning();
    return updated || undefined;
  }

  async deleteReceivable(id: number, companyId: number): Promise<boolean> {
    await db
      .delete(receivables)
      .where(and(eq(receivables.id, id), eq(receivables.companyId, companyId)));
    return true;
  }
}

export const storage = new DatabaseStorage();
