import { db } from "./db";
import {
  products,
  productVariations,
  productMedia,
  kitItems,
  customers,
  suppliers,
  sales,
  saleItems,
  companySettings,
  payables,
  receivables,
  notifications,
  inventoryMovements,
  posTerminals,
  cashRegisters,
  cashMovements,
  users,
  fiscalConfigs,
  taxAliquots,
  cfopCodes,
  type InsertProduct,
  type InsertCustomer,
  type InsertSupplier,
  type InsertSale,
  type InsertSaleItem,
  type InsertCompanySettings,
  type InsertPayable,
  type InsertReceivable,
  type InsertNotification,
  type InsertInventoryMovement,
  type InsertPosTerminal,
  type InsertCashRegister,
  type InsertCashMovement,
  type InsertFiscalConfig,
  type InsertTaxAliquot,
} from "@shared/schema";
import { eq, and, desc, sql, ilike } from "drizzle-orm";

export const storage = {
  async getFiscalDataByProductName(name: string, companyId: number) {
    const [product] = await db
      .select({
        ncm: products.ncm,
        serviceCode: products.serviceCode,
        cest: products.cest,
        origin: products.origin,
      })
      .from(products)
      .where(
        and(
          eq(products.companyId, companyId),
          ilike(products.name, `%${name}%`)
        )
      )
      .limit(1);
    return product || null;
  },

  async getAllProducts(companyId: number) {
    return await db
      .select()
      .from(products)
      .where(eq(products.companyId, companyId))
      .orderBy(desc(products.createdAt));
  },

  async getProduct(id: number, companyId: number) {
    const [product] = await db
      .select()
      .from(products)
      .where(and(eq(products.id, id), eq(products.companyId, companyId)))
      .limit(1);
    return product;
  },

  async getProductVariations(productId: number) {
    return await db
      .select()
      .from(productVariations)
      .where(eq(productVariations.productId, productId));
  },

  async getProductMedia(productId: number) {
    return await db
      .select()
      .from(productMedia)
      .where(eq(productMedia.productId, productId));
  },

  async getKitItems(kitProductId: number) {
    return await db
      .select()
      .from(kitItems)
      .where(eq(kitItems.kitProductId, kitProductId));
  },

  async deleteProduct(id: number, companyId: number) {
    await db
      .delete(products)
      .where(and(eq(products.id, id), eq(products.companyId, companyId)));
  },

  async updateProductStock(
    productId: number,
    companyId: number,
    quantity: number
  ) {
    const [product] = await db
      .update(products)
      .set({ stock: sql`${products.stock} + ${quantity}` })
      .where(and(eq(products.id, productId), eq(products.companyId, companyId)))
      .returning();
    return product;
  },

  async getAllCustomers(companyId: number) {
    return await db
      .select()
      .from(customers)
      .where(eq(customers.companyId, companyId))
      .orderBy(desc(customers.createdAt));
  },

  async createCustomer(data: InsertCustomer) {
    const [customer] = await db.insert(customers).values(data).returning();
    return customer;
  },

  async updateCustomer(
    id: number,
    companyId: number,
    data: Partial<InsertCustomer>
  ) {
    const [customer] = await db
      .update(customers)
      .set(data)
      .where(and(eq(customers.id, id), eq(customers.companyId, companyId)))
      .returning();
    return customer;
  },

  async deleteCustomer(id: number, companyId: number) {
    await db
      .delete(customers)
      .where(and(eq(customers.id, id), eq(customers.companyId, companyId)));
  },

  async getAllSuppliers(companyId: number) {
    return await db
      .select()
      .from(suppliers)
      .where(eq(suppliers.companyId, companyId))
      .orderBy(desc(suppliers.createdAt));
  },

  async createSupplier(data: InsertSupplier) {
    const [supplier] = await db.insert(suppliers).values(data).returning();
    return supplier;
  },

  async updateSupplier(
    id: number,
    companyId: number,
    data: Partial<InsertSupplier>
  ) {
    const [supplier] = await db
      .update(suppliers)
      .set(data)
      .where(and(eq(suppliers.id, id), eq(suppliers.companyId, companyId)))
      .returning();
    return supplier;
  },

  async deleteSupplier(id: number, companyId: number) {
    await db
      .delete(suppliers)
      .where(and(eq(suppliers.id, id), eq(suppliers.companyId, companyId)));
  },

  async getAllSales(companyId: number) {
    return await db
      .select()
      .from(sales)
      .where(eq(sales.companyId, companyId))
      .orderBy(desc(sales.createdAt));
  },

  async getSalesStats(companyId: number) {
    const [result] = await db
      .select({
        totalSales: sql<number>`COALESCE(SUM(${sales.total}), 0)`,
        totalTransactions: sql<number>`COUNT(*)`,
      })
      .from(sales)
      .where(eq(sales.companyId, companyId));
    return result;
  },

  async getSale(id: number, companyId: number) {
    const [sale] = await db
      .select()
      .from(sales)
      .where(and(eq(sales.id, id), eq(sales.companyId, companyId)))
      .limit(1);
    return sale;
  },

  async getSaleItems(saleId: number) {
    return await db
      .select()
      .from(saleItems)
      .where(eq(saleItems.saleId, saleId));
  },

  async getSaleItemsBatch(saleIds: number[]) {
    if (saleIds.length === 0) {
      return new Map();
    }
    const items = await db
      .select()
      .from(saleItems)
      .where(
        sql`${saleItems.saleId} IN (${sql.join(
          saleIds.map((id) => sql`${id}`),
          sql`, `
        )})`
      );
    const map = new Map<number, typeof items>();
    for (const item of items) {
      const existing = map.get(item.saleId) || [];
      existing.push(item);
      map.set(item.saleId, existing);
    }
    return map;
  },

  async createSale(saleData: InsertSale, items: InsertSaleItem[]) {
    const [sale] = await db.insert(sales).values(saleData).returning();
    if (items.length > 0) {
      const itemsWithSaleId = items.map((item) => ({
        ...item,
        saleId: sale.id,
      }));
      await db.insert(saleItems).values(itemsWithSaleId);
    }
    return sale;
  },

  async updateSaleNfceStatus(
    id: number,
    companyId: number,
    nfceStatus: string,
    nfceProtocol?: string,
    nfceKey?: string
  ) {
    const [sale] = await db
      .update(sales)
      .set({ nfceStatus, nfceProtocol, nfceKey })
      .where(and(eq(sales.id, id), eq(sales.companyId, companyId)))
      .returning();
    return sale;
  },

  async getCompanySettings(companyId: number) {
    const [settings] = await db
      .select()
      .from(companySettings)
      .where(eq(companySettings.companyId, companyId))
      .limit(1);
    return settings;
  },

  async updateCompanySettings(
    companyId: number,
    data: Partial<InsertCompanySettings>
  ) {
    const existing = await this.getCompanySettings(companyId);
    if (existing) {
      const [updated] = await db
        .update(companySettings)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(companySettings.companyId, companyId))
        .returning();
      return updated;
    } else {
      const [created] = await db
        .insert(companySettings)
        .values({ ...data, companyId })
        .returning();
      return created;
    }
  },

  async getAllPayables(companyId: number) {
    return await db
      .select()
      .from(payables)
      .where(eq(payables.companyId, companyId))
      .orderBy(desc(payables.dueDate));
  },

  async getPayable(id: number, companyId: number) {
    const [payable] = await db
      .select()
      .from(payables)
      .where(and(eq(payables.id, id), eq(payables.companyId, companyId)))
      .limit(1);
    return payable;
  },

  async createPayable(data: InsertPayable) {
    const [payable] = await db.insert(payables).values(data).returning();
    return payable;
  },

  async updatePayable(
    id: number,
    companyId: number,
    data: Partial<InsertPayable>
  ) {
    const [payable] = await db
      .update(payables)
      .set(data)
      .where(and(eq(payables.id, id), eq(payables.companyId, companyId)))
      .returning();
    return payable;
  },

  async deletePayable(id: number, companyId: number) {
    await db
      .delete(payables)
      .where(and(eq(payables.id, id), eq(payables.companyId, companyId)));
  },

  async getAllReceivables(companyId: number) {
    return await db
      .select()
      .from(receivables)
      .where(eq(receivables.companyId, companyId))
      .orderBy(desc(receivables.dueDate));
  },

  async getReceivable(id: number, companyId: number) {
    const [receivable] = await db
      .select()
      .from(receivables)
      .where(and(eq(receivables.id, id), eq(receivables.companyId, companyId)))
      .limit(1);
    return receivable;
  },

  async createReceivable(data: InsertReceivable) {
    const [receivable] = await db.insert(receivables).values(data).returning();
    return receivable;
  },

  async updateReceivable(
    id: number,
    companyId: number,
    data: Partial<InsertReceivable>
  ) {
    const [receivable] = await db
      .update(receivables)
      .set(data)
      .where(and(eq(receivables.id, id), eq(receivables.companyId, companyId)))
      .returning();
    return receivable;
  },

  async deleteReceivable(id: number, companyId: number) {
    await db
      .delete(receivables)
      .where(and(eq(receivables.id, id), eq(receivables.companyId, companyId)));
  },

  async getAllNotifications(companyId: number, userId?: string) {
    if (userId) {
      return await db
        .select()
        .from(notifications)
        .where(
          and(
            eq(notifications.companyId, companyId),
            eq(notifications.userId, userId)
          )
        )
        .orderBy(desc(notifications.createdAt));
    }
    return await db
      .select()
      .from(notifications)
      .where(eq(notifications.companyId, companyId))
      .orderBy(desc(notifications.createdAt));
  },

  async getUnreadNotificationsCount(companyId: number, userId?: string) {
    const conditions = [
      eq(notifications.companyId, companyId),
      eq(notifications.isRead, false),
    ];
    if (userId) {
      conditions.push(eq(notifications.userId, userId));
    }
    const [result] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(notifications)
      .where(and(...conditions));
    return result.count;
  },

  async createNotification(data: InsertNotification) {
    const [notification] = await db
      .insert(notifications)
      .values(data)
      .returning();
    return notification;
  },

  async markNotificationAsRead(id: number, companyId: number) {
    const [notification] = await db
      .update(notifications)
      .set({ isRead: true })
      .where(
        and(eq(notifications.id, id), eq(notifications.companyId, companyId))
      )
      .returning();
    return notification;
  },

  async markAllNotificationsAsRead(companyId: number, userId?: string) {
    const conditions = [eq(notifications.companyId, companyId)];
    if (userId) {
      conditions.push(eq(notifications.userId, userId));
    }
    await db
      .update(notifications)
      .set({ isRead: true })
      .where(and(...conditions));
  },

  async deleteNotification(id: number, companyId: number) {
    await db
      .delete(notifications)
      .where(
        and(eq(notifications.id, id), eq(notifications.companyId, companyId))
      );
  },

  async getInventoryMovements(companyId: number, productId?: number) {
    if (productId) {
      return await db
        .select()
        .from(inventoryMovements)
        .where(
          and(
            eq(inventoryMovements.companyId, companyId),
            eq(inventoryMovements.productId, productId)
          )
        )
        .orderBy(desc(inventoryMovements.createdAt));
    }
    return await db
      .select()
      .from(inventoryMovements)
      .where(eq(inventoryMovements.companyId, companyId))
      .orderBy(desc(inventoryMovements.createdAt));
  },

  async createInventoryMovement(data: InsertInventoryMovement) {
    const [movement] = await db
      .insert(inventoryMovements)
      .values(data)
      .returning();
    return movement;
  },

  async getOpenCashRegister(companyId: number) {
    const [register] = await db
      .select()
      .from(cashRegisters)
      .where(
        and(
          eq(cashRegisters.companyId, companyId),
          eq(cashRegisters.status, "open")
        )
      )
      .orderBy(desc(cashRegisters.openedAt))
      .limit(1);
    return register;
  },

  async openCashRegister(data: InsertCashRegister) {
    const [register] = await db.insert(cashRegisters).values(data).returning();
    return register;
  },

  async closeCashRegister(
    id: number,
    companyId: number,
    closingAmount: number | string,
    expectedAmount: number | string,
    notes?: string
  ) {
    const closingNum =
      typeof closingAmount === "string"
        ? parseFloat(closingAmount)
        : closingAmount;
    const expectedNum =
      typeof expectedAmount === "string"
        ? parseFloat(expectedAmount)
        : expectedAmount;
    const difference = closingNum - expectedNum;
    const [register] = await db
      .update(cashRegisters)
      .set({
        closingAmount: closingNum.toString(),
        expectedAmount: expectedNum.toString(),
        difference: difference.toString(),
        status: "closed",
        closedAt: new Date(),
        notes,
      })
      .where(
        and(eq(cashRegisters.id, id), eq(cashRegisters.companyId, companyId))
      )
      .returning();
    return register;
  },

  async getCashMovements(cashRegisterId: number) {
    return await db
      .select()
      .from(cashMovements)
      .where(eq(cashMovements.cashRegisterId, cashRegisterId))
      .orderBy(desc(cashMovements.createdAt));
  },

  async createCashMovement(data: InsertCashMovement) {
    const [movement] = await db.insert(cashMovements).values(data).returning();
    return movement;
  },

  async getUser(userId: string) {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    return user;
  },

  async getAllPosTerminals(companyId: number) {
    return await db
      .select()
      .from(posTerminals)
      .where(eq(posTerminals.companyId, companyId))
      .orderBy(desc(posTerminals.createdAt));
  },

  async getPosTerminal(id: number, companyId: number) {
    const [terminal] = await db
      .select()
      .from(posTerminals)
      .where(
        and(eq(posTerminals.id, id), eq(posTerminals.companyId, companyId))
      )
      .limit(1);
    return terminal;
  },

  async createPosTerminal(data: InsertPosTerminal) {
    const [terminal] = await db.insert(posTerminals).values(data).returning();
    return terminal;
  },

  async updatePosTerminal(
    id: number,
    companyId: number,
    data: Partial<InsertPosTerminal>
  ) {
    const [terminal] = await db
      .update(posTerminals)
      .set(data)
      .where(
        and(eq(posTerminals.id, id), eq(posTerminals.companyId, companyId))
      )
      .returning();
    return terminal;
  },

  async deletePosTerminal(id: number, companyId: number) {
    await db
      .delete(posTerminals)
      .where(
        and(eq(posTerminals.id, id), eq(posTerminals.companyId, companyId))
      );
  },

  async getAllCashRegisters(companyId: number) {
    return await db
      .select()
      .from(cashRegisters)
      .where(eq(cashRegisters.companyId, companyId))
      .orderBy(desc(cashRegisters.openedAt));
  },

  async getAllCashMovementsHistory(companyId: number) {
    return await db
      .select()
      .from(cashMovements)
      .where(eq(cashMovements.companyId, companyId))
      .orderBy(desc(cashMovements.createdAt));
  },

  async getFiscalConfig(companyId: number) {
    const [config] = await db
      .select()
      .from(fiscalConfigs)
      .where(eq(fiscalConfigs.companyId, companyId))
      .limit(1);
    return config;
  },

  async createFiscalConfig(data: InsertFiscalConfig) {
    const [config] = await db.insert(fiscalConfigs).values(data).returning();
    return config;
  },

  async updateFiscalConfig(
    companyId: number,
    data: Partial<InsertFiscalConfig>
  ) {
    const [config] = await db
      .update(fiscalConfigs)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(fiscalConfigs.companyId, companyId))
      .returning();
    return config;
  },

  async getCfopCodes() {
    return await db.select().from(cfopCodes).orderBy(cfopCodes.code);
  },

  async createCfopCode(data: any) {
    const [code] = await db.insert(cfopCodes).values(data).returning();
    return code;
  },

  async getTaxAliquots(companyId: number, state?: string) {
    if (state) {
      return await db
        .select()
        .from(taxAliquots)
        .where(
          and(
            eq(taxAliquots.companyId, companyId),
            eq(taxAliquots.state, state)
          )
        );
    }
    return await db
      .select()
      .from(taxAliquots)
      .where(eq(taxAliquots.companyId, companyId));
  },

  async createTaxAliquot(data: InsertTaxAliquot) {
    const [aliquot] = await db.insert(taxAliquots).values(data).returning();
    return aliquot;
  },
};
