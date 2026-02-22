import { db } from "./db";
import {
  products,
  productVariations,
  productMedia,
  kitItems,
  customers,
  suppliers,
  transporters,
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
  fiscalTaxRules,
  cfopCodes,
  companies,
  cstCodes,
  paymentMethods,
  pdvLoads,
  simplesNacionalAliquots,
  sefazTransmissionLogs,
  digitalCertificates,
  fiscalXmlStorage,
  manifestDocuments,
  sequentialNumbering,
  nfeCancellations,
  nfeCorrectionLetters,
  nfeNumberInutilization,
  type InsertNfeCancellation,
  type InsertNfeCorrectionLetter,
  type InsertNfeNumberInutilization,
  type InsertProduct,
  type InsertCustomer,
  type InsertSupplier,
  type InsertTransporter,
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
  type InsertFiscalTaxRule,
  type InsertSimplesNacionalAliquot,
  type InsertPaymentMethod,
  type InsertPdvLoad,
  type InsertDigitalCertificate,
  type DigitalCertificate,
  type InsertSequentialNumbering,
  type InsertFiscalXmlStorage,
  type InsertManifestDocument,
  type InsertSefazTransmissionLog,
  type FiscalTaxRule,
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

  async searchProducts(query: string, companyId: number, limit: number = 10) {
    return await db
      .select({
        id: products.id,
        name: products.name,
        ean: products.ean,
        price: products.price,
        purchasePrice: products.purchasePrice,
        ncm: products.ncm,
        csosnCode: products.csosnCode,
        cstIcms: products.cstIcms,
        cstIpi: products.cstIpi,
        cstPisCofins: products.cstPisCofins,
        origin: products.origin,
        unit: products.unit,
        category: products.category,
        serviceCode: products.serviceCode,
        cest: products.cest,
      })
      .from(products)
      .where(
        and(
          eq(products.companyId, companyId),
          eq(products.isActive, true),
          ilike(products.name, `%${query}%`)
        )
      )
      .limit(limit);
  },

  async getCfopCodes(companyId: number) {
    return await db
      .select({
        id: cfopCodes.id,
        code: cfopCodes.code,
        description: cfopCodes.description,
        type: cfopCodes.type,
        operationType: cfopCodes.operationType,
        scope: cfopCodes.scope,
      })
      .from(cfopCodes)
      .orderBy(cfopCodes.code);
  },

  async getTaxAliquotsByProduct(
    productId: number,
    companyId: number,
    state: string
  ) {
    const [aliquot] = await db
      .select()
      .from(taxAliquots)
      .where(
        and(
          eq(taxAliquots.companyId, companyId),
          eq(taxAliquots.productId, productId),
          eq(taxAliquots.state, state)
        )
      )
      .limit(1);
    return aliquot || null;
  },

  async searchCustomers(query: string, companyId: number, limit: number = 10) {
    return await db
      .select({
        id: customers.id,
        name: customers.name,
        cpfCnpj: customers.cpfCnpj,
        personType: customers.personType,
        isIcmsContributor: customers.isIcmsContributor,
      })
      .from(customers)
      .where(
        and(
          eq(customers.companyId, companyId),
          ilike(customers.name, `%${query}%`)
        )
      )
      .limit(limit);
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

  async getProductByEAN(companyId: number, ean: string) {
    const [product] = await db
      .select()
      .from(products)
      .where(and(eq(products.companyId, companyId), eq(products.ean, ean)))
      .limit(1);
    return product || null;
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

  async getCustomer(id: number, companyId: number) {
    const [customer] = await db
      .select()
      .from(customers)
      .where(and(eq(customers.id, id), eq(customers.companyId, companyId)))
      .limit(1);
    return customer || null;
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

  async getAllTransporters(companyId: number) {
    return await db
      .select()
      .from(transporters)
      .where(eq(transporters.companyId, companyId))
      .orderBy(desc(transporters.createdAt));
  },

  async createTransporter(data: InsertTransporter) {
    const [transporter] = await db.insert(transporters).values(data).returning();
    return transporter;
  },

  async updateTransporter(
    id: number,
    companyId: number,
    data: Partial<InsertTransporter>
  ) {
    const [transporter] = await db
      .update(transporters)
      .set(data)
      .where(and(eq(transporters.id, id), eq(transporters.companyId, companyId)))
      .returning();
    return transporter;
  },

  async deleteTransporter(id: number, companyId: number) {
    await db
      .delete(transporters)
      .where(and(eq(transporters.id, id), eq(transporters.companyId, companyId)));
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
    nfceKey?: string,
    nfceError?: string | null
  ) {
    const [sale] = await db
      .update(sales)
      .set({ nfceStatus, nfceProtocol, nfceKey, nfceError })
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
    data: Partial<InsertCompanySettings> & {
      address?: string;
      city?: string;
      state?: string;
      zipCode?: string;
      cnae?: string;
      im?: string;
    }
  ) {
    const existing = await this.getCompanySettings(companyId);
    console.log(
      `Updating settings for company ${companyId}. Existing: ${!!existing}. Data:`,
      data
    );

    const {
      address,
      city,
      state,
      zipCode,
      cnae,
      im,
      ...settingsData
    } = data as any;

    // Also update the main company table if relevant fields are present
    if (
      data.razaoSocial ||
      data.nomeFantasia ||
      data.cnpj ||
      data.ie ||
      data.regimeTributario ||
      data.email ||
      data.phone ||
      address ||
      city ||
      state ||
      zipCode ||
      cnae ||
      im
    ) {
      const companyData: any = {};
      if (data.razaoSocial) companyData.razaoSocial = data.razaoSocial;
      if (data.nomeFantasia) companyData.nomeFantasia = data.nomeFantasia;
      if (data.cnpj) companyData.cnpj = data.cnpj;
      if (data.ie) companyData.ie = data.ie;
      if (data.email) companyData.email = data.email;
      if (data.phone) companyData.phone = data.phone;
      if (data.regimeTributario)
        companyData.regimeTributario = data.regimeTributario;
      if (address) companyData.address = address;
      if (city) companyData.city = city;
      if (state) companyData.state = state;
      if (zipCode) companyData.zipCode = zipCode;
      if (cnae) companyData.cnae = cnae;
      if (im) companyData.im = im;

      await db
        .update(companies)
        .set(companyData)
        .where(eq(companies.id, companyId));
    }

    if (existing) {
      const [updated] = await db
        .update(companySettings)
        .set({ ...settingsData, updatedAt: new Date() })
        .where(eq(companySettings.companyId, companyId))
        .returning();
      return updated;
    } else {
      const [created] = await db
        .insert(companySettings)
        .values({ ...settingsData, companyId })
        .returning();
      return created;
    }
  },

  async getPaymentMethods(companyId: number) {
    return await db
      .select()
      .from(paymentMethods)
      .where(eq(paymentMethods.companyId, companyId))
      .orderBy(paymentMethods.sortOrder, paymentMethods.name);
  },

  async createPaymentMethod(data: InsertPaymentMethod) {
    const [method] = await db
      .insert(paymentMethods)
      .values(data)
      .returning();
    return method;
  },

  async updatePaymentMethod(
    id: number,
    companyId: number,
    data: Partial<InsertPaymentMethod>
  ) {
    const [method] = await db
      .update(paymentMethods)
      .set(data)
      .where(and(eq(paymentMethods.id, id), eq(paymentMethods.companyId, companyId)))
      .returning();
    return method;
  },

  async deletePaymentMethod(id: number, companyId: number) {
    const [method] = await db
      .delete(paymentMethods)
      .where(and(eq(paymentMethods.id, id), eq(paymentMethods.companyId, companyId)))
      .returning();
    return method;
  },

  async createPdvLoad(data: InsertPdvLoad) {
    const [load] = await db.insert(pdvLoads).values(data).returning();
    return load;
  },

  async getLatestPdvLoad(companyId: number) {
    const [load] = await db
      .select()
      .from(pdvLoads)
      .where(eq(pdvLoads.companyId, companyId))
      .orderBy(desc(pdvLoads.createdAt))
      .limit(1);
    return load || null;
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

  async getCfopCodeById(id: number) {
    const [code] = await db
      .select()
      .from(cfopCodes)
      .where(eq(cfopCodes.id, id))
      .limit(1);
    return code;
  },

  async createCfopCode(data: any) {
    const [code] = await db.insert(cfopCodes).values(data).returning();
    return code;
  },

  async updateCfopCode(id: number, data: any) {
    const [code] = await db
      .update(cfopCodes)
      .set(data)
      .where(eq(cfopCodes.id, id))
      .returning();
    return code;
  },

  async deleteCfopCode(id: number) {
    const [code] = await db
      .delete(cfopCodes)
      .where(eq(cfopCodes.id, id))
      .returning();
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

  async listFiscalTaxRules(companyId: number, filters?: {
    isActive?: boolean;
    operationType?: string;
    customerType?: string;
    regime?: string;
    originUf?: string;
    destinationUf?: string;
    ncm?: string;
    cest?: string;
    cfop?: string;
  }) {
    const conditions = [eq(fiscalTaxRules.companyId, companyId)];
    if (typeof filters?.isActive === "boolean") {
      conditions.push(eq(fiscalTaxRules.isActive, filters.isActive));
    }
    if (filters?.operationType) {
      conditions.push(eq(fiscalTaxRules.operationType, filters.operationType));
    }
    if (filters?.customerType) {
      conditions.push(eq(fiscalTaxRules.customerType, filters.customerType));
    }
    if (filters?.regime) {
      conditions.push(eq(fiscalTaxRules.regime, filters.regime));
    }
    if (filters?.originUf) {
      conditions.push(eq(fiscalTaxRules.originUf, filters.originUf.toUpperCase()));
    }
    if (filters?.destinationUf) {
      conditions.push(
        eq(fiscalTaxRules.destinationUf, filters.destinationUf.toUpperCase())
      );
    }
    if (filters?.ncm) {
      conditions.push(eq(fiscalTaxRules.ncm, filters.ncm));
    }
    if (filters?.cest) {
      conditions.push(eq(fiscalTaxRules.cest, filters.cest));
    }
    if (filters?.cfop) {
      conditions.push(eq(fiscalTaxRules.cfop, filters.cfop));
    }

    return await db
      .select()
      .from(fiscalTaxRules)
      .where(and(...conditions))
      .orderBy(desc(fiscalTaxRules.priority), desc(fiscalTaxRules.updatedAt));
  },

  async createFiscalTaxRule(data: InsertFiscalTaxRule) {
    const [rule] = await db.insert(fiscalTaxRules).values(data).returning();
    return rule;
  },

  async updateFiscalTaxRule(
    id: number,
    companyId: number,
    data: Partial<InsertFiscalTaxRule>
  ) {
    const [rule] = await db
      .update(fiscalTaxRules)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(fiscalTaxRules.id, id), eq(fiscalTaxRules.companyId, companyId)))
      .returning();
    return rule;
  },

  async deleteFiscalTaxRule(id: number, companyId: number) {
    const [rule] = await db
      .delete(fiscalTaxRules)
      .where(and(eq(fiscalTaxRules.id, id), eq(fiscalTaxRules.companyId, companyId)))
      .returning();
    return rule;
  },

  async resolveFiscalTaxRule(
    companyId: number,
    context: {
      operationType?: string;
      customerType?: string;
      regime?: string;
      originUf?: string;
      destinationUf?: string;
      scope?: string;
      ncm?: string;
      cest?: string;
      cfop?: string;
      at?: Date;
    }
  ): Promise<FiscalTaxRule | null> {
    const activeRules = await this.listFiscalTaxRules(companyId, {
      isActive: true,
    });

    const at = context.at || new Date();
    const norm = {
      operationType: String(context.operationType || "").toLowerCase(),
      customerType: String(context.customerType || "").toLowerCase(),
      regime: String(context.regime || "").toLowerCase(),
      originUf: String(context.originUf || "").toUpperCase(),
      destinationUf: String(context.destinationUf || "").toUpperCase(),
      scope: String(context.scope || "").toLowerCase(),
      ncm: String(context.ncm || ""),
      cest: String(context.cest || ""),
      cfop: String(context.cfop || ""),
    };

    const matches: Array<{ rule: FiscalTaxRule; score: number }> = [];
    for (const rule of activeRules) {
      const validFrom = rule.validFrom ? new Date(rule.validFrom) : null;
      const validTo = rule.validTo ? new Date(rule.validTo) : null;
      if (validFrom && at < validFrom) continue;
      if (validTo && at > validTo) continue;

      let score = 0;
      const checks: Array<[string | null | undefined, string, number, boolean?]> = [
        [rule.operationType, norm.operationType, 4, true],
        [rule.customerType, norm.customerType, 4, true],
        [rule.regime, norm.regime, 4, true],
        [rule.originUf, norm.originUf, 3, false],
        [rule.destinationUf, norm.destinationUf, 3, false],
        [rule.scope, norm.scope, 3, true],
        [rule.ncm, norm.ncm, 5, false],
        [rule.cest, norm.cest, 5, false],
        [rule.cfop, norm.cfop, 5, false],
      ];

      let reject = false;
      for (const [ruleValue, ctxValue, weight, normalizeLower] of checks) {
        if (!ruleValue) continue;
        const left = normalizeLower
          ? String(ruleValue).toLowerCase()
          : String(ruleValue);
        if (left !== ctxValue) {
          reject = true;
          break;
        }
        score += weight;
      }
      if (reject) continue;

      score += Number(rule.priority || 0);
      matches.push({ rule, score });
    }

    if (matches.length === 0) return null;
    matches.sort((a, b) => b.score - a.score);
    return matches[0].rule;
  },

  async listSimplesNacionalAliquots(companyId: number) {
    return await db
      .select()
      .from(simplesNacionalAliquots)
      .where(eq(simplesNacionalAliquots.companyId, companyId))
      .orderBy(desc(simplesNacionalAliquots.createdAt));
  },

  async createSimplesNacionalAliquot(data: InsertSimplesNacionalAliquot) {
    const [aliquot] = await db
      .insert(simplesNacionalAliquots)
      .values(data)
      .returning();
    return aliquot;
  },

  async deleteSimplesNacionalAliquot(id: number, companyId: number) {
    const [aliquot] = await db
      .delete(simplesNacionalAliquots)
      .where(
        and(
          eq(simplesNacionalAliquots.id, id),
          eq(simplesNacionalAliquots.companyId, companyId)
        )
      )
      .returning();
    return aliquot;
  },

  async createSefazTransmissionLog(data: InsertSefazTransmissionLog) {
    const [log] = await db
      .insert(sefazTransmissionLogs)
      .values(data)
      .returning();
    return log;
  },

  // ============================================
  // DIGITAL CERTIFICATES
  // ============================================
  async getDigitalCertificate(companyId: number) {
    const [cert] = await db
      .select()
      .from(digitalCertificates)
      .where(eq(digitalCertificates.companyId, companyId))
      .limit(1);
    return cert;
  },

  async createOrUpdateDigitalCertificate(data: InsertDigitalCertificate) {
    const existing = await this.getDigitalCertificate(data.companyId);

    if (existing) {
      const [cert] = await db
        .update(digitalCertificates)
        .set({ ...data, isActive: true, updatedAt: new Date() })
        .where(eq(digitalCertificates.companyId, data.companyId))
        .returning();
      return cert;
    } else {
      const [cert] = await db
        .insert(digitalCertificates)
        .values({ ...data, isActive: true })
        .returning();
      return cert;
    }
  },

  async deleteDigitalCertificate(companyId: number) {
    const [cert] = await db
      .delete(digitalCertificates)
      .where(eq(digitalCertificates.companyId, companyId))
      .returning();
    return cert;
  },

  async validateDigitalCertificate(companyId: number): Promise<{
    isValid: boolean;
    message: string;
    daysUntilExpiration?: number;
  }> {
    const cert = await this.getDigitalCertificate(companyId);

    if (!cert) {
      return {
        isValid: false,
        message: "Certificado digital não configurado",
      };
    }

    const now = new Date();
    if (cert.validUntil && new Date(cert.validUntil) < now) {
      return {
        isValid: false,
        message: "Certificado digital expirado",
      };
    }

    const daysUntilExpiration = cert.validUntil
      ? Math.ceil(
          (new Date(cert.validUntil).getTime() - now.getTime()) /
            (1000 * 60 * 60 * 24)
        )
      : 0;

    if (daysUntilExpiration < 30) {
      return {
        isValid: true,
        message: `Certificado expira em ${daysUntilExpiration} dias`,
        daysUntilExpiration,
      };
    }

    return {
      isValid: true,
      message: "Certificado digital válido",
      daysUntilExpiration,
    };
  },

  // ============================================
  // SEQUENTIAL NUMBERING
  // ============================================
  async getSequentialNumbering(
    companyId: number,
    documentType: string,
    series: number
  ) {
    const [numbering] = await db
      .select()
      .from(sequentialNumbering)
      .where(
        and(
          eq(sequentialNumbering.companyId, companyId),
          eq(sequentialNumbering.documentType, documentType),
          eq(sequentialNumbering.series, series)
        )
      )
      .limit(1);
    return numbering;
  },

  async createSequentialNumbering(data: InsertSequentialNumbering) {
    const [numbering] = await db
      .insert(sequentialNumbering)
      .values(data)
      .returning();
    return numbering;
  },

  async updateSequentialNumbering(
    id: number,
    data: Partial<InsertSequentialNumbering>
  ) {
    const [numbering] = await db
      .update(sequentialNumbering)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(sequentialNumbering.id, id))
      .returning();
    return numbering;
  },

  async getNextDocumentNumber(
    companyId: number,
    documentType: string,
    series: number
  ): Promise<{
    number: number;
    numbering: typeof sequentialNumbering.$inferSelect;
  }> {
    const numbering = await this.getSequentialNumbering(
      companyId,
      documentType,
      series
    );

    if (!numbering) {
      throw new Error(
        `Numeração sequencial não configurada para ${documentType} série ${series}`
      );
    }

    if (!numbering.isActive) {
      throw new Error(
        `Numeração expirada para ${documentType} série ${series}`
      );
    }

    if (numbering.currentNumber > numbering.rangeEnd) {
      throw new Error(
        `Numeração esgotada! Máximo: ${numbering.rangeEnd}. Solicite nova autorização ao SEFAZ.`
      );
    }

    const nextNumber = numbering.currentNumber;

    // Incrementar contador
    await this.updateSequentialNumbering(numbering.id, {
      currentNumber: nextNumber + 1,
    });

    return { number: nextNumber, numbering };
  },

  async listSequentialNumbering(companyId: number) {
    return await db
      .select()
      .from(sequentialNumbering)
      .where(eq(sequentialNumbering.companyId, companyId))
      .orderBy(sequentialNumbering.documentType, sequentialNumbering.series);
  },

  async getCompanyById(id: number) {
    const [company] = await db
      .select()
      .from(companies)
      .where(eq(companies.id, id))
      .limit(1);
    return company || null;
  },

  async createNfeCancellation(data: InsertNfeCancellation) {
    const [record] = await db.insert(nfeCancellations).values(data).returning();
    return record;
  },

  async createNfeCorrectionLetter(data: InsertNfeCorrectionLetter) {
    const [record] = await db.insert(nfeCorrectionLetters).values(data).returning();
    return record;
  },

  async createNfeNumberInutilization(data: InsertNfeNumberInutilization) {
    const [record] = await db.insert(nfeNumberInutilization).values(data).returning();
    return record;
  },

  async saveFiscalXml(data: InsertFiscalXmlStorage) {
    const [record] = await db.insert(fiscalXmlStorage).values(data).returning();
    return record;
  },

  async getFiscalXmlByKey(companyId: number, documentKey: string) {
    const [record] = await db
      .select()
      .from(fiscalXmlStorage)
      .where(
        and(
          eq(fiscalXmlStorage.companyId, companyId),
          eq(fiscalXmlStorage.documentKey, documentKey)
        )
      )
      .limit(1);
    return record || null;
  },

  async saveManifestDocument(data: InsertManifestDocument) {
    const [record] = await db.insert(manifestDocuments).values(data).returning();
    return record;
  },

  async listManifestDocuments(companyId: number) {
    return await db
      .select()
      .from(manifestDocuments)
      .where(eq(manifestDocuments.companyId, companyId))
      .orderBy(desc(manifestDocuments.createdAt));
  },

  async getManifestDocumentByKey(companyId: number, documentKey: string) {
    const [record] = await db
      .select()
      .from(manifestDocuments)
      .where(
        and(
          eq(manifestDocuments.companyId, companyId),
          eq(manifestDocuments.documentKey, documentKey),
        ),
      )
      .limit(1);
    return record || null;
  },
};
