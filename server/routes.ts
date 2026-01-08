import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { db } from "./db";
import {
  products,
  productVariations,
  productMedia,
  kitItems,
  customers,
  suppliers,
} from "@shared/schema";
import {
  insertProductSchema,
  insertCustomerSchema,
  insertSupplierSchema,
  insertSaleSchema,
  insertSaleItemSchema,
  insertCompanySettingsSchema,
  insertPayableSchema,
  insertReceivableSchema,
  insertNotificationSchema,
  insertFiscalConfigSchema,
  insertTaxAliquotSchema,
} from "@shared/schema";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { lookupEAN } from "./ean-service";
import {
  requireAuth,
  requirePermission,
  getCompanyId,
  getUserId,
} from "./middleware";
import { CFOPValidator } from "./cfop-validator";
import { CSOSNCalculator } from "./csosn-calculator";
import fiscalRouter from "./fiscal-routes";
import { authorizePayment } from "./payment-service";
import "./types";

function parseNFeXML(xmlContent: string): Array<{
  name: string;
  ean: string | null;
  ncm: string | null;
  unit: string;
  quantity: number;
  price: string;
  purchasePrice: string;
}> {
  const produtos: Array<{
    name: string;
    ean: string | null;
    ncm: string | null;
    unit: string;
    quantity: number;
    price: string;
    purchasePrice: string;
  }> = [];

  const detPattern = /<det[^>]*>([\s\S]*?)<\/det>/gi;
  let detMatch;

  while ((detMatch = detPattern.exec(xmlContent)) !== null) {
    const detContent = detMatch[1];

    const prodMatch = /<prod>([\s\S]*?)<\/prod>/i.exec(detContent);
    if (!prodMatch) continue;

    const prodContent = prodMatch[1];

    const getTagValue = (tag: string, content: string): string | null => {
      const regex = new RegExp(`<${tag}>([^<]*)</${tag}>`, "i");
      const match = regex.exec(content);
      return match ? match[1].trim() : null;
    };

    const name = getTagValue("xProd", prodContent);
    if (!name) continue;

    const ean =
      getTagValue("cEAN", prodContent) || getTagValue("cEANTrib", prodContent);
    const ncm = getTagValue("NCM", prodContent);
    const unit = getTagValue("uCom", prodContent) || "UN";
    const quantityStr = getTagValue("qCom", prodContent);
    const priceStr =
      getTagValue("vUnCom", prodContent) || getTagValue("vUnTrib", prodContent);

    const quantity = quantityStr ? parseFloat(quantityStr) : 0;
    const price = priceStr ? parseFloat(priceStr).toFixed(2) : "0.00";

    produtos.push({
      name,
      ean: ean && ean !== "SEM GTIN" ? ean : null,
      ncm,
      unit: unit.toUpperCase(),
      quantity: Math.floor(quantity),
      price,
      purchasePrice: price,
    });
  }

  return produtos;
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  app.get(
    "/api/products",
    requireAuth,
    requirePermission("inventory:view"),
    async (req, res) => {
      try {
        const companyId = getCompanyId(req);
        if (!companyId)
          return res.status(401).json({ error: "Não autenticado" });

        const productsList = await storage.getAllProducts(companyId);
        res.json(productsList);
      } catch (error) {
        console.error("Failed to fetch products:", error);
        res.status(500).json({ error: "Failed to fetch products" });
      }
    }
  );

  app.get("/api/cfop-codes", requireAuth, async (req, res) => {
    try {
      const companyId = getCompanyId(req);
      if (!companyId) return res.status(401).json({ error: "Não autenticado" });

      const cfopCodes = await storage.getCfopCodes(companyId);
      res.json(cfopCodes);
    } catch (error) {
      console.error("Failed to fetch CFOP codes:", error);
      res.status(500).json({ error: "Failed to fetch CFOP codes" });
    }
  });

  app.get(
    "/api/products/search/:query",
    requireAuth,
    requirePermission("inventory:view"),
    async (req, res) => {
      try {
        const companyId = getCompanyId(req);
        if (!companyId)
          return res.status(401).json({ error: "Não autenticado" });

        const { query } = req.params;
        const products = await storage.searchProducts(query, companyId, 10);
        res.json(products);
      } catch (error) {
        console.error("Failed to search products:", error);
        res.status(500).json({ error: "Failed to search products" });
      }
    }
  );

  app.get(
    "/api/products/:id",
    requireAuth,
    requirePermission("inventory:view"),
    async (req, res) => {
      try {
        const companyId = getCompanyId(req);
        if (!companyId)
          return res.status(401).json({ error: "Não autenticado" });

        const id = parseInt(req.params.id);
        const product = await storage.getProduct(id, companyId);
        if (!product) {
          return res.status(404).json({ error: "Product not found" });
        }
        const variations = await storage.getProductVariations(id);
        const media = await storage.getProductMedia(id);
        const productKitItems = product.isKit
          ? await storage.getKitItems(id)
          : [];
        res.json({ ...product, variations, media, kitItems: productKitItems });
      } catch (error) {
        res.status(500).json({ error: "Failed to fetch product" });
      }
    }
  );

  const variationSchema = z.object({
    name: z.string(),
    sku: z.string().optional().nullable(),
    attributes: z.record(z.string()).optional().nullable(),
    extraPrice: z.string().optional().nullable(),
    stock: z.number().default(0),
  });

  const mediaSchema = z.object({
    url: z.string(),
    isPrimary: z.boolean().optional().nullable(),
  });

  const kitItemSchema = z.object({
    productId: z.number(),
    quantity: z.number().min(1),
  });

  const createProductRequestSchema = z.object({
    product: insertProductSchema,
    variations: z.array(variationSchema).optional(),
    media: z.array(mediaSchema).optional(),
    kitItems: z.array(kitItemSchema).optional(),
  });

  const updateProductRequestSchema = z.object({
    product: insertProductSchema.partial(),
    variations: z.array(variationSchema).optional(),
    media: z.array(mediaSchema).optional(),
    kitItems: z.array(kitItemSchema).optional(),
  });

  app.post(
    "/api/products",
    requireAuth,
    requirePermission("inventory:create"),
    async (req, res) => {
      try {
        const companyId = getCompanyId(req);
        if (!companyId)
          return res.status(401).json({ error: "Não autenticado" });

        const {
          product,
          variations,
          media,
          kitItems: kitItemsData,
        } = createProductRequestSchema.parse(req.body);

        const result = await db.transaction(async (tx) => {
          const [newProduct] = await tx
            .insert(products)
            .values({ ...product, companyId })
            .returning();

          if (variations && variations.length > 0) {
            for (const variation of variations) {
              await tx.insert(productVariations).values({
                productId: newProduct.id,
                name: variation.name,
                sku: variation.sku || null,
                attributes: variation.attributes || null,
                extraPrice: variation.extraPrice || "0",
                stock: variation.stock,
              });
            }
          }

          if (media && media.length > 0) {
            for (const m of media) {
              await tx.insert(productMedia).values({
                productId: newProduct.id,
                url: m.url,
                isPrimary: m.isPrimary || false,
              });
            }
          }

          if (kitItemsData && kitItemsData.length > 0 && newProduct.isKit) {
            for (const item of kitItemsData) {
              await tx.insert(kitItems).values({
                kitProductId: newProduct.id,
                productId: item.productId,
                quantity: item.quantity,
              });
            }
          }

          return newProduct;
        });

        res.status(201).json(result);
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({ error: error.errors });
        }
        console.error("Failed to create product:", error);
        res.status(500).json({ error: "Failed to create product" });
      }
    }
  );

  app.patch(
    "/api/products/:id",
    requireAuth,
    requirePermission("inventory:edit"),
    async (req, res) => {
      try {
        const companyId = getCompanyId(req);
        if (!companyId)
          return res.status(401).json({ error: "Não autenticado" });

        const id = parseInt(req.params.id);

        const parseResult = updateProductRequestSchema.safeParse(req.body);
        if (!parseResult.success) {
          console.error("Validation error:", parseResult.error.errors);
          return res.status(400).json({ error: parseResult.error.errors });
        }

        const {
          product,
          variations,
          media,
          kitItems: kitItemsData,
        } = parseResult.data;

        const result = await db.transaction(async (tx) => {
          let updatedProduct;
          if (product) {
            const [updated] = await tx
              .update(products)
              .set({ ...product, updatedAt: new Date() })
              .where(
                and(eq(products.id, id), eq(products.companyId, companyId))
              )
              .returning();
            if (!updated) {
              throw new Error("Product not found");
            }
            updatedProduct = updated;
          } else {
            const [existing] = await tx
              .select()
              .from(products)
              .where(
                and(eq(products.id, id), eq(products.companyId, companyId))
              );
            if (!existing) {
              throw new Error("Product not found");
            }
            updatedProduct = existing;
          }

          if (variations !== undefined) {
            await tx
              .delete(productVariations)
              .where(eq(productVariations.productId, id));
            for (const variation of variations) {
              await tx.insert(productVariations).values({
                productId: id,
                name: variation.name,
                sku: variation.sku || null,
                attributes: variation.attributes || null,
                extraPrice: variation.extraPrice || "0",
                stock: variation.stock,
              });
            }
          }

          if (media !== undefined) {
            await tx.delete(productMedia).where(eq(productMedia.productId, id));
            for (const m of media) {
              await tx.insert(productMedia).values({
                productId: id,
                url: m.url,
                isPrimary: m.isPrimary || false,
              });
            }
          }

          if (kitItemsData !== undefined) {
            await tx.delete(kitItems).where(eq(kitItems.kitProductId, id));
            for (const item of kitItemsData) {
              await tx.insert(kitItems).values({
                kitProductId: id,
                productId: item.productId,
                quantity: item.quantity,
              });
            }
          }

          return updatedProduct;
        });

        res.json(result);
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({ error: error.errors });
        }
        if (error instanceof Error && error.message === "Product not found") {
          return res.status(404).json({ error: "Product not found" });
        }
        console.error("Failed to update product:", error);
        res.status(500).json({ error: "Failed to update product" });
      }
    }
  );

  app.delete(
    "/api/products/:id",
    requireAuth,
    requirePermission("inventory:delete"),
    async (req, res) => {
      try {
        const companyId = getCompanyId(req);
        if (!companyId)
          return res.status(401).json({ error: "Não autenticado" });

        const id = parseInt(req.params.id);
        await storage.deleteProduct(id, companyId);
        res.status(204).send();
      } catch (error) {
        res.status(500).json({ error: "Failed to delete product" });
      }
    }
  );

  app.get(
    "/api/customers/search/:query",
    requireAuth,
    requirePermission("customers:view"),
    async (req, res) => {
      try {
        const companyId = getCompanyId(req);
        if (!companyId)
          return res.status(401).json({ error: "Não autenticado" });

        const { query } = req.params;
        const customersList = await storage.searchCustomers(
          query,
          companyId,
          10
        );
        res.json(customersList);
      } catch (error) {
        console.error("Failed to search customers:", error);
        res.status(500).json({ error: "Failed to search customers" });
      }
    }
  );

  app.get(
    "/api/customers",
    requireAuth,
    requirePermission("customers:view"),
    async (req, res) => {
      try {
        const companyId = getCompanyId(req);
        if (!companyId)
          return res.status(401).json({ error: "Não autenticado" });

        const customersList = await storage.getAllCustomers(companyId);
        res.json(customersList);
      } catch (error) {
        res.status(500).json({ error: "Failed to fetch customers" });
      }
    }
  );

  app.post(
    "/api/customers",
    requireAuth,
    requirePermission("customers:manage"),
    async (req, res) => {
      try {
        const companyId = getCompanyId(req);
        if (!companyId)
          return res.status(401).json({ error: "Não autenticado" });

        const validated = insertCustomerSchema.parse(req.body);
        const customer = await storage.createCustomer({
          ...validated,
          companyId,
        });
        res.status(201).json(customer);
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({ error: error.errors });
        }
        res.status(500).json({ error: "Failed to create customer" });
      }
    }
  );

  app.patch(
    "/api/customers/:id",
    requireAuth,
    requirePermission("customers:manage"),
    async (req, res) => {
      try {
        const companyId = getCompanyId(req);
        if (!companyId)
          return res.status(401).json({ error: "Não autenticado" });

        const id = parseInt(req.params.id);
        const validated = insertCustomerSchema.partial().parse(req.body);
        const customer = await storage.updateCustomer(id, companyId, validated);
        if (!customer) {
          return res.status(404).json({ error: "Customer not found" });
        }
        res.json(customer);
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({ error: error.errors });
        }
        res.status(500).json({ error: "Failed to update customer" });
      }
    }
  );

  app.delete(
    "/api/customers/:id",
    requireAuth,
    requirePermission("customers:manage"),
    async (req, res) => {
      try {
        const companyId = getCompanyId(req);
        if (!companyId)
          return res.status(401).json({ error: "Não autenticado" });

        const id = parseInt(req.params.id);
        await storage.deleteCustomer(id, companyId);
        res.status(204).send();
      } catch (error) {
        res.status(500).json({ error: "Failed to delete customer" });
      }
    }
  );

  app.get(
    "/api/suppliers",
    requireAuth,
    requirePermission("suppliers:view"),
    async (req, res) => {
      try {
        const companyId = getCompanyId(req);
        if (!companyId)
          return res.status(401).json({ error: "Não autenticado" });

        const suppliersList = await storage.getAllSuppliers(companyId);
        res.json(suppliersList);
      } catch (error) {
        console.error("Failed to fetch suppliers:", error);
        res.status(500).json({ error: "Failed to fetch suppliers" });
      }
    }
  );

  app.post(
    "/api/suppliers",
    requireAuth,
    requirePermission("suppliers:manage"),
    async (req, res) => {
      try {
        const companyId = getCompanyId(req);
        if (!companyId)
          return res.status(401).json({ error: "Não autenticado" });

        const validated = insertSupplierSchema.parse(req.body);
        const supplier = await storage.createSupplier({
          ...validated,
          companyId,
        });
        res.status(201).json(supplier);
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({ error: error.errors });
        }
        res.status(500).json({ error: "Failed to create supplier" });
      }
    }
  );

  app.patch(
    "/api/suppliers/:id",
    requireAuth,
    requirePermission("suppliers:manage"),
    async (req, res) => {
      try {
        const companyId = getCompanyId(req);
        if (!companyId)
          return res.status(401).json({ error: "Não autenticado" });

        const id = parseInt(req.params.id);
        const validated = insertSupplierSchema.partial().parse(req.body);
        const supplier = await storage.updateSupplier(id, companyId, validated);
        if (!supplier) {
          return res.status(404).json({ error: "Supplier not found" });
        }
        res.json(supplier);
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({ error: error.errors });
        }
        res.status(500).json({ error: "Failed to update supplier" });
      }
    }
  );

  app.delete(
    "/api/suppliers/:id",
    requireAuth,
    requirePermission("suppliers:manage"),
    async (req, res) => {
      try {
        const companyId = getCompanyId(req);
        if (!companyId)
          return res.status(401).json({ error: "Não autenticado" });

        const id = parseInt(req.params.id);
        await storage.deleteSupplier(id, companyId);
        res.status(204).send();
      } catch (error) {
        res.status(500).json({ error: "Failed to delete supplier" });
      }
    }
  );

  app.get(
    "/api/sales",
    requireAuth,
    requirePermission("pos:view", "reports:view"),
    async (req, res) => {
      try {
        const companyId = getCompanyId(req);
        if (!companyId)
          return res.status(401).json({ error: "Não autenticado" });

        const salesList = await storage.getAllSales(companyId);
        res.json(salesList);
      } catch (error) {
        res.status(500).json({ error: "Failed to fetch sales" });
      }
    }
  );

  app.get(
    "/api/sales/stats",
    requireAuth,
    requirePermission("pos:view", "reports:view"),
    async (req, res) => {
      try {
        const companyId = getCompanyId(req);
        if (!companyId)
          return res.status(401).json({ error: "Não autenticado" });

        const stats = await storage.getSalesStats(companyId);
        res.json(stats);
      } catch (error) {
        res.status(500).json({ error: "Failed to fetch stats" });
      }
    }
  );

  app.get(
    "/api/sales/:id",
    requireAuth,
    requirePermission("pos:view", "reports:view"),
    async (req, res) => {
      try {
        const companyId = getCompanyId(req);
        if (!companyId)
          return res.status(401).json({ error: "Não autenticado" });

        const id = parseInt(req.params.id);
        const sale = await storage.getSale(id, companyId);
        if (!sale) {
          return res.status(404).json({ error: "Sale not found" });
        }
        const items = await storage.getSaleItems(id);
        res.json({ ...sale, items });
      } catch (error) {
        res.status(500).json({ error: "Failed to fetch sale" });
      }
    }
  );

  const paymentInfoSchema = z.object({
    status: z.enum(["approved", "declined", "processing"]),
    nsu: z.string().optional().nullable(),
    brand: z.string().optional().nullable(),
    provider: z.string().optional().nullable(),
    authorizationCode: z.string().optional().nullable(),
    providerReference: z.string().optional().nullable(),
  });

  const createSaleRequestSchema = z.object({
    sale: insertSaleSchema,
    items: z.array(insertSaleItemSchema.omit({ saleId: true })),
    payment: paymentInfoSchema,
  });

  const paymentAuthorizeSchema = z.object({
    amount: z.number().positive(),
    method: z.enum(["pix", "credito", "debito"]),
  });

  app.post(
    "/api/payments/authorize",
    requireAuth,
    requirePermission("pos:sell"),
    async (req, res) => {
      try {
        const companyId = getCompanyId(req);
        if (!companyId)
          return res.status(401).json({ error: "Nao autenticado" });

        const { amount, method } = paymentAuthorizeSchema.parse(req.body);
        const settings = await storage.getCompanySettings(companyId);
        const result = await authorizePayment({
          amount,
          method,
          settings,
          description: `Venda PDV ${companyId}`,
        });
        res.json(result);
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({ error: error.errors });
        }
        res.status(500).json({
          error: error instanceof Error ? error.message : "Erro no pagamento",
        });
      }
    }
  );

  app.post(
    "/api/sales",
    requireAuth,
    requirePermission("pos:sell"),
    async (req, res) => {
      try {
        const companyId = getCompanyId(req);
        const userId = getUserId(req);
        if (!companyId)
          return res.status(401).json({ error: "Não autenticado" });

        const { sale, items, payment } = createSaleRequestSchema.parse(
          req.body
        );
        if (payment.status !== "approved") {
          return res.status(402).json({ error: "Pagamento nao autorizado" });
        }

        const settings = await storage.getCompanySettings(companyId);
        const isFiscalConfigured = !!(
          settings &&
          settings.fiscalEnabled &&
          settings.cscToken &&
          settings.cscId
        );

        const saleData = {
          ...sale,
          companyId,
          userId,
          paymentStatus: payment.status,
          paymentNsu: payment.nsu || null,
          paymentBrand: payment.brand || null,
          paymentProvider: payment.provider || null,
          paymentAuthorization: payment.authorizationCode || null,
          paymentReference: payment.providerReference || null,
          nfceStatus: isFiscalConfigured ? "Autorizada" : "Pendente Fiscal",
          status: isFiscalConfigured ? "Concluído" : "Aguardando Emissão",
        };

        for (const item of items) {
          await storage.updateProductStock(
            item.productId,
            companyId,
            -item.quantity
          );
        }

        const newSale = await storage.createSale(saleData, items as any);
        res.status(201).json({
          sale: newSale,
          fiscalConfigured: isFiscalConfigured,
        });
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({ error: error.errors });
        }
        res.status(500).json({ error: "Failed to create sale" });
      }
    }
  );

  const updateNfceStatusSchema = z.object({
    status: z.string(),
    protocol: z.string().optional(),
    key: z.string().optional(),
  });

  app.patch(
    "/api/sales/:id/nfce-status",
    requireAuth,
    requirePermission("fiscal:manage"),
    async (req, res) => {
      try {
        const companyId = getCompanyId(req);
        if (!companyId)
          return res.status(401).json({ error: "Não autenticado" });

        const id = parseInt(req.params.id);
        const { status, protocol, key } = updateNfceStatusSchema.parse(
          req.body
        );
        const sale = await storage.updateSaleNfceStatus(
          id,
          companyId,
          status,
          protocol,
          key
        );
        if (!sale) {
          return res.status(404).json({ error: "Sale not found" });
        }
        res.json(sale);
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({ error: error.errors });
        }
        res.status(500).json({ error: "Failed to update NFC-e status" });
      }
    }
  );

  app.get(
    "/api/settings",
    requireAuth,
    requirePermission("settings:view"),
    async (req, res) => {
      try {
        const companyId = getCompanyId(req);
        if (!companyId)
          return res.status(401).json({ error: "Não autenticado" });

        const settings = await storage.getCompanySettings(companyId);
        res.json(settings || {});
      } catch (error) {
        res.status(500).json({ error: "Failed to fetch settings" });
      }
    }
  );

  app.patch("/api/settings", requireAuth, async (req, res) => {
    try {
      const companyId = getCompanyId(req);
      if (!companyId) return res.status(401).json({ error: "Não autenticado" });

      // Temporarily simplified for debugging and quick fix
      const validated = insertCompanySettingsSchema.partial().parse(req.body);
      const settings = await storage.updateCompanySettings(
        companyId,
        validated
      );
      console.log(
        `Settings updated for company ${companyId}: ${JSON.stringify(settings)}`
      );
      res.json(settings);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to update settings" });
    }
  });

  app.get("/api/ean/:code", requireAuth, async (req, res) => {
    try {
      const companyId = getCompanyId(req);
      if (!companyId)
        return res.status(401).json({ error: "Nao autenticado" });

      const { code } = req.params;
      const normalized = String(code || "").replace(/\s+/g, "");
      if (!normalized) {
        return res.status(404).json({ error: "Produto nao encontrado" });
      }

      const localProduct = await storage.getProductByEAN(
        companyId,
        normalized
      );
      if (localProduct) {
        return res.json({
          name: localProduct.name,
          brand: localProduct.brand,
          description: localProduct.description,
          thumbnail: localProduct.mainImageUrl,
          ncm: localProduct.ncm,
          cest: localProduct.cest,
        });
      }

      const result = await lookupEAN(normalized);
      if (!result) {
        return res.status(404).json({ error: "Produto nao encontrado" });
      }

      let savedProduct: typeof products.$inferSelect | null = null;
      try {
        const [created] = await db
          .insert(products)
          .values({
            companyId,
            name: result.name,
            ean: normalized,
            brand: result.brand || null,
            description: result.description || null,
            ncm: result.ncm || null,
            mainImageUrl: result.thumbnail || null,
            category: "Importado",
            unit: "UN",
            price: "0",
            stock: 0,
          })
          .returning();
        savedProduct = created || null;
      } catch (error) {
        savedProduct = null;
      }

      if (savedProduct) {
        return res.json({
          name: savedProduct.name,
          brand: savedProduct.brand,
          description: savedProduct.description,
          thumbnail: savedProduct.mainImageUrl,
          ncm: savedProduct.ncm,
          cest: savedProduct.cest,
        });
      }

      res.json({
        name: result.name,
        brand: result.brand,
        description: result.description,
        thumbnail: result.thumbnail,
        ncm: result.ncm,
      });
    } catch (error) {
      res.status(404).json({ error: "Produto nao encontrado" });
    }
  });

  app.get("/api/products/fiscal/:name", requireAuth, async (req, res) => {
    try {
      const { name } = req.params;
      const companyId = getCompanyId(req);
      if (!companyId) {
        return res.status(401).json({ error: "Não autenticado" });
      }

      const result = await storage.getFiscalDataByProductName(name, companyId);
      if (!result) {
        return res
          .status(404)
          .json({ error: "Nenhum produto similar encontrado" });
      }
      res.json(result);
    } catch (error) {
      if (error instanceof Error) {
        return res.status(400).json({ error: error.message });
      }
      res.status(500).json({ error: "Falha ao buscar dados fiscais" });
    }
  });

  const adjustStockSchema = z.object({
    productId: z.number(),
    quantity: z.number(),
    type: z.enum(["entrada", "saida", "ajuste", "perda", "devolucao"]),
    reason: z.string().optional(),
    notes: z.string().optional(),
  });

  app.post(
    "/api/inventory/adjust",
    requireAuth,
    requirePermission("inventory:adjust"),
    async (req, res) => {
      try {
        const companyId = getCompanyId(req);
        if (!companyId)
          return res.status(401).json({ error: "Não autenticado" });

        const { productId, quantity, type, reason, notes } =
          adjustStockSchema.parse(req.body);

        const product = await storage.getProduct(productId, companyId);
        if (!product) {
          return res.status(404).json({ error: "Produto não encontrado" });
        }

        const quantityDelta =
          type === "saida" || type === "perda"
            ? -Math.abs(quantity)
            : Math.abs(quantity);

        const newStock = product.stock + quantityDelta;
        if (newStock < 0) {
          return res
            .status(400)
            .json({ error: "Estoque não pode ficar negativo" });
        }

        await storage.createInventoryMovement({
          productId,
          companyId,
          type,
          quantity: quantityDelta,
          reason: reason || null,
          notes: notes || null,
          referenceId: null,
          referenceType: null,
          variationId: null,
        });

        const updatedProduct = await storage.updateProductStock(
          productId,
          companyId,
          quantityDelta
        );

        res.json({
          product: updatedProduct,
          movement: {
            productId,
            type,
            quantity: quantityDelta,
            reason,
            notes,
          },
        });
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({ error: error.errors });
        }
        console.error("Failed to adjust stock:", error);
        res.status(500).json({ error: "Falha ao ajustar estoque" });
      }
    }
  );

  app.get(
    "/api/inventory/movements/:productId",
    requireAuth,
    async (req, res) => {
      try {
        const companyId = getCompanyId(req);
        if (!companyId)
          return res.status(401).json({ error: "Não autenticado" });

        const productId = parseInt(req.params.productId);
        const movements = await storage.getInventoryMovements(
          productId,
          companyId
        );
        res.json(movements);
      } catch (error) {
        res.status(500).json({ error: "Falha ao buscar movimentações" });
      }
    }
  );

  const importXmlSchema = z.object({
    xmlContent: z.string().min(1),
  });

  app.post("/api/products/preview-xml", requireAuth, async (req, res) => {
    try {
      const companyId = getCompanyId(req);
      if (!companyId) return res.status(401).json({ error: "Não autenticado" });

      const { xmlContent } = importXmlSchema.parse(req.body);

      const parsedProducts = parseNFeXML(xmlContent);

      if (parsedProducts.length === 0) {
        return res.status(400).json({
          error:
            "Nenhum produto encontrado no XML. Verifique se o arquivo é uma NFe válida.",
        });
      }

      const existingProducts = await storage.getAllProducts(companyId);

      const previewProducts = parsedProducts.map((prod, index) => {
        const existing = prod.ean
          ? existingProducts.find((p) => p.ean === prod.ean)
          : null;
        return {
          tempId: index,
          name: prod.name,
          ean: prod.ean,
          ncm: prod.ncm,
          unit: prod.unit,
          quantity: prod.quantity,
          price: prod.price,
          purchasePrice: prod.purchasePrice,
          existingProductId: existing?.id || null,
          existingProductName: existing?.name || null,
          existingStock: existing?.stock || 0,
          isExisting: !!existing,
        };
      });

      res.json({
        success: true,
        totalProducts: previewProducts.length,
        existingProducts: previewProducts.filter((p) => p.isExisting).length,
        newProducts: previewProducts.filter((p) => !p.isExisting).length,
        products: previewProducts,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      console.error("Failed to preview XML:", error);
      res.status(500).json({ error: "Falha ao processar XML" });
    }
  });

  const importProductsSchema = z.object({
    products: z.array(
      z.object({
        name: z.string(),
        ean: z.string().nullable(),
        ncm: z.string().nullable(),
        unit: z.string(),
        quantity: z.number(),
        price: z.union([z.string(), z.number()]).transform((v) => String(v)),
        purchasePrice: z
          .union([z.string(), z.number()])
          .transform((v) => String(v)),
        existingProductId: z.number().nullable(),
        isExisting: z.boolean(),
      })
    ),
  });

  app.post("/api/products/import-confirmed", requireAuth, async (req, res) => {
    try {
      const companyId = getCompanyId(req);
      if (!companyId) return res.status(401).json({ error: "Não autenticado" });

      const { products: productsToImport } = importProductsSchema.parse(
        req.body
      );

      const importedProducts = [];
      const updatedProducts = [];

      for (const prodData of productsToImport) {
        if (prodData.isExisting && prodData.existingProductId) {
          await storage.updateProductStock(
            prodData.existingProductId,
            companyId,
            prodData.quantity
          );
          await storage.createInventoryMovement({
            productId: prodData.existingProductId,
            companyId,
            type: "entrada",
            quantity: prodData.quantity,
            reason: "Importação XML NFe",
            notes: null,
            referenceId: null,
            referenceType: null,
            variationId: null,
          });
          updatedProducts.push({
            id: prodData.existingProductId,
            name: prodData.name,
            quantityAdded: prodData.quantity,
          });
        } else {
          const [newProduct] = await db
            .insert(products)
            .values({
              name: prodData.name,
              ean: prodData.ean,
              ncm: prodData.ncm,
              unit: prodData.unit,
              category: "Importado",
              price: prodData.price,
              purchasePrice: prodData.purchasePrice,
              stock: prodData.quantity,
              isActive: true,
              companyId,
            })
            .returning();

          if (prodData.quantity > 0) {
            await storage.createInventoryMovement({
              productId: newProduct.id,
              companyId,
              type: "entrada",
              quantity: prodData.quantity,
              reason: "Importação XML NFe - Estoque inicial",
              notes: null,
              referenceId: null,
              referenceType: null,
              variationId: null,
            });
          }

          importedProducts.push(newProduct);
        }
      }

      res.json({
        success: true,
        imported: importedProducts.length,
        updated: updatedProducts.length,
        importedProducts,
        updatedProducts,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      console.error("Failed to import products:", error);
      res.status(500).json({ error: "Falha ao importar produtos" });
    }
  });

  app.post("/api/products/import-xml", requireAuth, async (req, res) => {
    try {
      const companyId = getCompanyId(req);
      if (!companyId) return res.status(401).json({ error: "Não autenticado" });

      const { xmlContent } = importXmlSchema.parse(req.body);

      const parsedProducts = parseNFeXML(xmlContent);

      if (parsedProducts.length === 0) {
        return res
          .status(400)
          .json({ error: "Nenhum produto encontrado no XML" });
      }

      const importedProducts = [];
      const skippedProducts = [];

      for (const prodData of parsedProducts) {
        if (prodData.ean) {
          const existingProducts = await storage.getAllProducts(companyId);
          const existing = existingProducts.find((p) => p.ean === prodData.ean);
          if (existing) {
            const newStock = existing.stock + prodData.quantity;
            await storage.updateProductStock(
              existing.id,
              companyId,
              prodData.quantity
            );
            await storage.createInventoryMovement({
              productId: existing.id,
              companyId,
              type: "entrada",
              quantity: prodData.quantity,
              reason: "Importação XML NFe",
              notes: null,
              referenceId: null,
              referenceType: null,
              variationId: null,
            });
            skippedProducts.push({
              name: prodData.name,
              reason: "Estoque atualizado (produto já existente)",
              newStock,
            });
            continue;
          }
        }

        const [newProduct] = await db
          .insert(products)
          .values({
            name: prodData.name,
            ean: prodData.ean,
            ncm: prodData.ncm,
            unit: prodData.unit,
            category: "Importado",
            price: prodData.price,
            purchasePrice: prodData.purchasePrice,
            stock: prodData.quantity,
            isActive: true,
            companyId,
          })
          .returning();

        if (prodData.quantity > 0) {
          await storage.createInventoryMovement({
            productId: newProduct.id,
            companyId,
            type: "entrada",
            quantity: prodData.quantity,
            reason: "Importação XML NFe - Estoque inicial",
            notes: null,
            referenceId: null,
            referenceType: null,
            variationId: null,
          });
        }

        importedProducts.push(newProduct);
      }

      res.json({
        success: true,
        imported: importedProducts.length,
        updated: skippedProducts.length,
        products: importedProducts,
        skipped: skippedProducts,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      console.error("Failed to import XML:", error);
      res.status(500).json({ error: "Falha ao importar XML" });
    }
  });

  app.get("/api/sales/export/xml", requireAuth, async (req, res) => {
    try {
      const companyId = getCompanyId(req);
      if (!companyId) return res.status(401).json({ error: "Não autenticado" });

      const monthParam = req.query.month as string | undefined;
      const yearParam = req.query.year as string | undefined;

      const month = monthParam ? parseInt(monthParam) : null;
      const year = yearParam ? parseInt(yearParam) : new Date().getFullYear();

      if (monthParam && (isNaN(month!) || month! < 1 || month! > 12)) {
        return res
          .status(400)
          .json({ error: "Mês inválido. Use valores de 1 a 12." });
      }
      if (isNaN(year) || year < 2020 || year > 2030) {
        return res.status(400).json({ error: "Ano inválido." });
      }

      const sales = await storage.getAllSales(companyId);
      const settings = await storage.getCompanySettings(companyId);

      const filteredSales = sales.filter((sale: any) => {
        const saleDate = new Date(sale.createdAt);
        if (month) {
          return (
            saleDate.getMonth() + 1 === month && saleDate.getFullYear() === year
          );
        }
        return saleDate.getFullYear() === year;
      });

      const saleIds = filteredSales.map((sale: any) => sale.id);
      const allSaleItemsMap = await storage.getSaleItemsBatch(saleIds);

      const escapeXml = (str: string | null | undefined): string => {
        if (!str) return "";
        return str
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;");
      };

      let xmlContent = `<?xml version="1.0" encoding="UTF-8"?>\n`;
      xmlContent += `<exportacaoVendas>\n`;
      xmlContent += `  <empresa>\n`;
      xmlContent += `    <cnpj>${escapeXml(settings?.cnpj)}</cnpj>\n`;
      xmlContent += `    <razaoSocial>${escapeXml(
        settings?.razaoSocial
      )}</razaoSocial>\n`;
      xmlContent += `    <nomeFantasia>${escapeXml(
        settings?.nomeFantasia
      )}</nomeFantasia>\n`;
      xmlContent += `  </empresa>\n`;
      xmlContent += `  <periodo>\n`;
      xmlContent += `    <mes>${month || "todos"}</mes>\n`;
      xmlContent += `    <ano>${year}</ano>\n`;
      xmlContent += `  </periodo>\n`;
      xmlContent += `  <vendas>\n`;

      filteredSales.forEach((sale: any) => {
        const items = allSaleItemsMap.get(sale.id) || [];
        xmlContent += `    <venda>\n`;
        xmlContent += `      <id>${sale.id}</id>\n`;
        xmlContent += `      <data>${sale.createdAt}</data>\n`;
        xmlContent += `      <cliente>${escapeXml(
          sale.customerName
        )}</cliente>\n`;
        xmlContent += `      <total>${sale.total}</total>\n`;
        xmlContent += `      <formaPagamento>${escapeXml(
          sale.paymentMethod
        )}</formaPagamento>\n`;
        xmlContent += `      <status>${escapeXml(sale.status)}</status>\n`;
        xmlContent += `      <nfceStatus>${escapeXml(
          sale.nfceStatus
        )}</nfceStatus>\n`;
        xmlContent += `      <nfceProtocolo>${escapeXml(
          sale.nfceProtocol
        )}</nfceProtocolo>\n`;
        xmlContent += `      <nfceChave>${escapeXml(
          sale.nfceKey
        )}</nfceChave>\n`;
        xmlContent += `      <itens>\n`;
        for (const item of items) {
          xmlContent += `        <item>\n`;
          xmlContent += `          <produtoId>${item.productId}</produtoId>\n`;
          xmlContent += `          <nome>${escapeXml(
            item.productName
          )}</nome>\n`;
          xmlContent += `          <quantidade>${item.quantity}</quantidade>\n`;
          xmlContent += `          <precoUnitario>${item.unitPrice}</precoUnitario>\n`;
          xmlContent += `          <subtotal>${item.subtotal}</subtotal>\n`;
          xmlContent += `        </item>\n`;
        }
        xmlContent += `      </itens>\n`;
        xmlContent += `    </venda>\n`;
      });

      xmlContent += `  </vendas>\n`;
      xmlContent += `  <resumo>\n`;
      xmlContent += `    <totalVendas>${filteredSales.length}</totalVendas>\n`;
      xmlContent += `    <valorTotal>${filteredSales
        .reduce((acc: number, s: any) => acc + parseFloat(s.total), 0)
        .toFixed(2)}</valorTotal>\n`;
      xmlContent += `  </resumo>\n`;
      xmlContent += `</exportacaoVendas>`;

      const filename = `vendas_${month || "todos"}_${year}.xml`;
      res.setHeader("Content-Type", "application/xml; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${filename}"`
      );
      res.setHeader("Content-Length", Buffer.byteLength(xmlContent, "utf8"));
      res.send(xmlContent);
    } catch (error) {
      console.error("Failed to export XML:", error);
      res.status(500).json({ error: "Falha ao exportar XML" });
    }
  });

  app.get("/api/sales/report/closing", requireAuth, async (req, res) => {
    try {
      const companyId = getCompanyId(req);
      if (!companyId) return res.status(401).json({ error: "Não autenticado" });

      const dateParam = req.query.date as string | undefined;
      let targetDate: Date;

      if (dateParam) {
        targetDate = new Date(dateParam);
        if (isNaN(targetDate.getTime())) {
          return res
            .status(400)
            .json({ error: "Data inválida. Use formato YYYY-MM-DD." });
        }
      } else {
        targetDate = new Date();
      }

      const sales = await storage.getAllSales(companyId);

      const daySales = sales.filter((sale: any) => {
        const saleDate = new Date(sale.createdAt);
        return saleDate.toDateString() === targetDate.toDateString();
      });

      const paymentMethods: Record<string, { count: number; total: number }> =
        {};
      let totalItems = 0;

      for (const sale of daySales) {
        const method = sale.paymentMethod;
        if (!paymentMethods[method]) {
          paymentMethods[method] = { count: 0, total: 0 };
        }
        paymentMethods[method].count += 1;
        paymentMethods[method].total += parseFloat(sale.total);
        totalItems += sale.itemsCount;
      }

      const report = {
        date: targetDate.toISOString().split("T")[0],
        totalSales: daySales.length,
        totalValue: daySales
          .reduce((acc: number, s: any) => acc + parseFloat(s.total), 0)
          .toFixed(2),
        totalItems,
        averageTicket:
          daySales.length > 0
            ? (
                daySales.reduce(
                  (acc: number, s: any) => acc + parseFloat(s.total),
                  0
                ) / daySales.length
              ).toFixed(2)
            : "0.00",
        paymentMethods: Object.entries(paymentMethods).map(
          ([method, data]) => ({
            method,
            count: data.count,
            total: data.total.toFixed(2),
            percentage: ((data.count / daySales.length) * 100).toFixed(1),
          })
        ),
        salesByStatus: {
          authorized: daySales.filter((s: any) => s.nfceStatus === "Autorizada")
            .length,
          pending: daySales.filter(
            (s: any) =>
              s.nfceStatus === "Pendente" || s.nfceStatus === "Pendente Fiscal"
          ).length,
          contingency: daySales.filter(
            (s: any) => s.nfceStatus === "Contingência"
          ).length,
          cancelled: daySales.filter((s: any) => s.nfceStatus === "Cancelada")
            .length,
        },
        sales: daySales.map((sale: any) => ({
          id: sale.id,
          time: new Date(sale.createdAt).toLocaleTimeString("pt-BR"),
          customer: sale.customerName,
          total: sale.total,
          paymentMethod: sale.paymentMethod,
          status: sale.nfceStatus,
        })),
      };

      res.json(report);
    } catch (error) {
      console.error("Failed to generate closing report:", error);
      res.status(500).json({ error: "Falha ao gerar relatório de fechamento" });
    }
  });

  const createPayableSchema = z.object({
    description: z.string().min(1),
    supplierId: z.number().optional().nullable(),
    supplierName: z.string().optional().nullable(),
    category: z.string().default("Outros"),
    amount: z.string(),
    dueDate: z.string().transform((val) => new Date(val)),
    paidDate: z
      .string()
      .optional()
      .nullable()
      .transform((val) => (val ? new Date(val) : null)),
    status: z.string().default("Pendente"),
    notes: z.string().optional().nullable(),
  });

  const updatePayableSchema = z.object({
    description: z.string().min(1).optional(),
    supplierId: z.number().optional().nullable(),
    supplierName: z.string().optional().nullable(),
    category: z.string().optional(),
    amount: z.string().optional(),
    dueDate: z
      .string()
      .optional()
      .transform((val) => (val ? new Date(val) : undefined)),
    paidDate: z
      .string()
      .optional()
      .nullable()
      .transform((val) => (val ? new Date(val) : null)),
    status: z.string().optional(),
    notes: z.string().optional().nullable(),
  });

  const createReceivableSchema = z.object({
    description: z.string().min(1),
    customerId: z.number().optional().nullable(),
    customerName: z.string().optional().nullable(),
    saleId: z.number().optional().nullable(),
    category: z.string().default("Vendas"),
    amount: z.string(),
    dueDate: z.string().transform((val) => new Date(val)),
    receivedDate: z
      .string()
      .optional()
      .nullable()
      .transform((val) => (val ? new Date(val) : null)),
    status: z.string().default("Pendente"),
    notes: z.string().optional().nullable(),
  });

  const updateReceivableSchema = z.object({
    description: z.string().min(1).optional(),
    customerId: z.number().optional().nullable(),
    customerName: z.string().optional().nullable(),
    saleId: z.number().optional().nullable(),
    category: z.string().optional(),
    amount: z.string().optional(),
    dueDate: z
      .string()
      .optional()
      .transform((val) => (val ? new Date(val) : undefined)),
    receivedDate: z
      .string()
      .optional()
      .nullable()
      .transform((val) => (val ? new Date(val) : null)),
    status: z.string().optional(),
    notes: z.string().optional().nullable(),
  });

  app.get(
    "/api/payables",
    requireAuth,
    requirePermission("finance:view"),
    async (req, res) => {
      try {
        const companyId = getCompanyId(req);
        if (!companyId)
          return res.status(401).json({ error: "Não autenticado" });

        const payables = await storage.getAllPayables(companyId);
        res.json(payables);
      } catch (error) {
        console.error("Failed to fetch payables:", error);
        res.status(500).json({ error: "Failed to fetch payables" });
      }
    }
  );

  app.post(
    "/api/payables",
    requireAuth,
    requirePermission("finance:manage"),
    async (req, res) => {
      try {
        const companyId = getCompanyId(req);
        if (!companyId)
          return res.status(401).json({ error: "Não autenticado" });

        const validated = createPayableSchema.parse(req.body);
        const payable = await storage.createPayable({
          ...validated,
          companyId,
        } as any);
        res.status(201).json(payable);
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({ error: error.errors });
        }
        console.error("Failed to create payable:", error);
        res.status(500).json({ error: "Failed to create payable" });
      }
    }
  );

  app.patch(
    "/api/payables/:id",
    requireAuth,
    requirePermission("finance:manage"),
    async (req, res) => {
      try {
        const companyId = getCompanyId(req);
        if (!companyId)
          return res.status(401).json({ error: "Não autenticado" });

        const id = parseInt(req.params.id);
        const existing = await storage.getPayable(id, companyId);
        if (!existing) {
          return res.status(404).json({ error: "Payable not found" });
        }
        const validated = updatePayableSchema.parse(req.body);
        const cleanedData = Object.fromEntries(
          Object.entries(validated).filter(([_, v]) => v !== undefined)
        );
        const payable = await storage.updatePayable(
          id,
          companyId,
          cleanedData as any
        );
        res.json(payable);
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({ error: error.errors });
        }
        console.error("Failed to update payable:", error);
        res.status(500).json({ error: "Failed to update payable" });
      }
    }
  );

  app.delete(
    "/api/payables/:id",
    requireAuth,
    requirePermission("finance:manage"),
    async (req, res) => {
      try {
        const companyId = getCompanyId(req);
        if (!companyId)
          return res.status(401).json({ error: "Não autenticado" });

        const id = parseInt(req.params.id);
        const existing = await storage.getPayable(id, companyId);
        if (!existing) {
          return res.status(404).json({ error: "Payable not found" });
        }
        await storage.deletePayable(id, companyId);
        res.status(204).send();
      } catch (error) {
        console.error("Failed to delete payable:", error);
        res.status(500).json({ error: "Failed to delete payable" });
      }
    }
  );

  app.get(
    "/api/receivables",
    requireAuth,
    requirePermission("finance:view"),
    async (req, res) => {
      try {
        const companyId = getCompanyId(req);
        if (!companyId)
          return res.status(401).json({ error: "Não autenticado" });

        const receivables = await storage.getAllReceivables(companyId);
        res.json(receivables);
      } catch (error) {
        console.error("Failed to fetch receivables:", error);
        res.status(500).json({ error: "Failed to fetch receivables" });
      }
    }
  );

  app.post(
    "/api/receivables",
    requireAuth,
    requirePermission("finance:manage"),
    async (req, res) => {
      try {
        const companyId = getCompanyId(req);
        if (!companyId)
          return res.status(401).json({ error: "Não autenticado" });

        const validated = createReceivableSchema.parse(req.body);
        const receivable = await storage.createReceivable({
          ...validated,
          companyId,
        } as any);
        res.status(201).json(receivable);
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({ error: error.errors });
        }
        console.error("Failed to create receivable:", error);
        res.status(500).json({ error: "Failed to create receivable" });
      }
    }
  );

  app.patch(
    "/api/receivables/:id",
    requireAuth,
    requirePermission("finance:manage"),
    async (req, res) => {
      try {
        const companyId = getCompanyId(req);
        if (!companyId)
          return res.status(401).json({ error: "Não autenticado" });

        const id = parseInt(req.params.id);
        const existing = await storage.getReceivable(id, companyId);
        if (!existing) {
          return res.status(404).json({ error: "Receivable not found" });
        }
        const validated = updateReceivableSchema.parse(req.body);
        const cleanedData = Object.fromEntries(
          Object.entries(validated).filter(([_, v]) => v !== undefined)
        );
        const receivable = await storage.updateReceivable(
          id,
          companyId,
          cleanedData as any
        );
        res.json(receivable);
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({ error: error.errors });
        }
        console.error("Failed to update receivable:", error);
        res.status(500).json({ error: "Failed to update receivable" });
      }
    }
  );

  app.delete(
    "/api/receivables/:id",
    requireAuth,
    requirePermission("finance:manage"),
    async (req, res) => {
      try {
        const companyId = getCompanyId(req);
        if (!companyId)
          return res.status(401).json({ error: "Não autenticado" });

        const id = parseInt(req.params.id);
        const existing = await storage.getReceivable(id, companyId);
        if (!existing) {
          return res.status(404).json({ error: "Receivable not found" });
        }
        await storage.deleteReceivable(id, companyId);
        res.status(204).send();
      } catch (error) {
        console.error("Failed to delete receivable:", error);
        res.status(500).json({ error: "Failed to delete receivable" });
      }
    }
  );

  app.get("/api/notifications", requireAuth, async (req, res) => {
    try {
      const companyId = getCompanyId(req);
      const userId = getUserId(req);
      if (!companyId) return res.status(401).json({ error: "Não autenticado" });

      const notificationsList = await storage.getAllNotifications(
        companyId,
        userId || undefined
      );
      res.json(notificationsList);
    } catch (error) {
      console.error("Failed to fetch notifications:", error);
      res.status(500).json({ error: "Falha ao buscar notificações" });
    }
  });

  app.get("/api/notifications/count", requireAuth, async (req, res) => {
    try {
      const companyId = getCompanyId(req);
      const userId = getUserId(req);
      if (!companyId) return res.status(401).json({ error: "Não autenticado" });

      const count = await storage.getUnreadNotificationsCount(
        companyId,
        userId || undefined
      );
      res.json({ count });
    } catch (error) {
      console.error("Failed to fetch notification count:", error);
      res
        .status(500)
        .json({ error: "Falha ao buscar contagem de notificações" });
    }
  });

  app.post("/api/notifications", requireAuth, async (req, res) => {
    try {
      const companyId = getCompanyId(req);
      if (!companyId) return res.status(401).json({ error: "Não autenticado" });

      const validated = insertNotificationSchema.parse({
        ...req.body,
        companyId,
      });
      const notification = await storage.createNotification(validated);
      res.status(201).json(notification);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      console.error("Failed to create notification:", error);
      res.status(500).json({ error: "Falha ao criar notificação" });
    }
  });

  app.patch("/api/notifications/:id/read", requireAuth, async (req, res) => {
    try {
      const companyId = getCompanyId(req);
      if (!companyId) return res.status(401).json({ error: "Não autenticado" });

      const id = parseInt(req.params.id);
      const notification = await storage.markNotificationAsRead(id, companyId);
      if (!notification) {
        return res.status(404).json({ error: "Notificação não encontrada" });
      }
      res.json(notification);
    } catch (error) {
      console.error("Failed to mark notification as read:", error);
      res.status(500).json({ error: "Falha ao marcar notificação como lida" });
    }
  });

  app.post("/api/notifications/read-all", requireAuth, async (req, res) => {
    try {
      const companyId = getCompanyId(req);
      const userId = getUserId(req);
      if (!companyId) return res.status(401).json({ error: "Não autenticado" });

      await storage.markAllNotificationsAsRead(companyId, userId || undefined);
      res.json({ message: "Todas as notificações foram marcadas como lidas" });
    } catch (error) {
      console.error("Failed to mark all notifications as read:", error);
      res
        .status(500)
        .json({ error: "Falha ao marcar notificações como lidas" });
    }
  });

  app.delete("/api/notifications/:id", requireAuth, async (req, res) => {
    try {
      const companyId = getCompanyId(req);
      if (!companyId) return res.status(401).json({ error: "Não autenticado" });

      const id = parseInt(req.params.id);
      await storage.deleteNotification(id, companyId);
      res.status(204).send();
    } catch (error) {
      console.error("Failed to delete notification:", error);
      res.status(500).json({ error: "Falha ao excluir notificação" });
    }
  });

  // ============================================
  // CASH REGISTER ROUTES: Controle de Caixa
  // ============================================

  app.get("/api/cash-register/current", requireAuth, async (req, res) => {
    try {
      const companyId = getCompanyId(req);
      if (!companyId) return res.status(401).json({ error: "Não autenticado" });

      const register = await storage.getOpenCashRegister(companyId);
      if (register) {
        const movements = await storage.getCashMovements(register.id);
        res.json({ register, movements });
      } else {
        res.json({ register: null, movements: [] });
      }
    } catch (error) {
      console.error("Failed to fetch cash register:", error);
      res.status(500).json({ error: "Falha ao buscar caixa" });
    }
  });

  const openCashRegisterSchema = z.object({
    openingAmount: z.string(),
    notes: z.string().optional(),
  });

  app.post(
    "/api/cash-register/open",
    requireAuth,
    requirePermission("pos:cash_open"),
    async (req, res) => {
      try {
        const companyId = getCompanyId(req);
        const userId = getUserId(req);
        if (!companyId || !userId)
          return res.status(401).json({ error: "Não autenticado" });

        const existingOpen = await storage.getOpenCashRegister(companyId);
        if (existingOpen) {
          return res.status(400).json({ error: "Já existe um caixa aberto" });
        }

        const { openingAmount, notes } = openCashRegisterSchema.parse(req.body);

        const user = await storage.getUser(userId);
        const userName = user?.name || "Operador";

        const register = await storage.openCashRegister({
          companyId,
          userId,
          userName,
          openingAmount,
          notes,
          status: "open",
        });

        res.status(201).json(register);
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({ error: error.errors });
        }
        console.error("Failed to open cash register:", error);
        res.status(500).json({ error: "Falha ao abrir caixa" });
      }
    }
  );

  const closeCashRegisterSchema = z.object({
    closingAmount: z.string(),
    notes: z.string().optional(),
  });

  app.post(
    "/api/cash-register/close",
    requireAuth,
    requirePermission("pos:cash_close"),
    async (req, res) => {
      try {
        const companyId = getCompanyId(req);
        if (!companyId)
          return res.status(401).json({ error: "Não autenticado" });

        const openRegister = await storage.getOpenCashRegister(companyId);
        if (!openRegister) {
          return res.status(400).json({ error: "Nenhum caixa aberto" });
        }

        const { closingAmount, notes } = closeCashRegisterSchema.parse(
          req.body
        );

        const movements = await storage.getCashMovements(openRegister.id);
        const totalWithdrawals = movements
          .filter((m) => m.type === "sangria")
          .reduce((acc, m) => acc + parseFloat(m.amount), 0);
        const totalSupplements = movements
          .filter((m) => m.type === "suprimento")
          .reduce((acc, m) => acc + parseFloat(m.amount), 0);

        const allSales = await storage.getAllSales(companyId);
        const openedAt = openRegister.openedAt;
        const registerSales = allSales.filter(
          (sale) => sale.createdAt && sale.createdAt >= openedAt!
        );
        const totalSales = registerSales.reduce(
          (acc, sale) => acc + parseFloat(sale.total),
          0
        );

        const expectedAmount = (
          parseFloat(openRegister.openingAmount) +
          totalSales +
          totalSupplements -
          totalWithdrawals
        ).toFixed(2);

        const register = await storage.closeCashRegister(
          openRegister.id,
          companyId,
          closingAmount,
          expectedAmount,
          notes
        );

        res.json(register);
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({ error: error.errors });
        }
        console.error("Failed to close cash register:", error);
        res.status(500).json({ error: "Falha ao fechar caixa" });
      }
    }
  );

  const cashMovementSchema = z.object({
    type: z.enum(["sangria", "suprimento"]),
    amount: z.string(),
    reason: z.string().optional(),
  });

  app.post("/api/cash-register/movement", requireAuth, async (req, res) => {
    try {
      const companyId = getCompanyId(req);
      const userId = getUserId(req);
      if (!companyId || !userId)
        return res.status(401).json({ error: "Não autenticado" });

      const { type, amount, reason } = cashMovementSchema.parse(req.body);

      const requiredPermission =
        type === "sangria" ? "pos:sangria" : "pos:suprimento";
      const userPermissions = req.session?.userPermissions || [];
      if (!userPermissions.includes(requiredPermission)) {
        return res.status(403).json({
          error:
            type === "sangria"
              ? "Sem permissão para realizar sangria"
              : "Sem permissão para realizar suprimento",
        });
      }

      const openRegister = await storage.getOpenCashRegister(companyId);
      if (!openRegister) {
        return res.status(400).json({ error: "Nenhum caixa aberto" });
      }

      const user = await storage.getUser(userId);
      const userName = user?.name || "Operador";

      const movement = await storage.createCashMovement({
        cashRegisterId: openRegister.id,
        companyId,
        userId,
        userName,
        type,
        amount,
        reason,
      });

      res.status(201).json(movement);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      console.error("Failed to create cash movement:", error);
      res.status(500).json({ error: "Falha ao registrar movimentação" });
    }
  });

  app.get(
    "/api/cash-register/history",
    requireAuth,
    requirePermission("pos:cash_history"),
    async (req, res) => {
      try {
        const companyId = getCompanyId(req);
        if (!companyId)
          return res.status(401).json({ error: "Não autenticado" });

        const registers = await storage.getAllCashRegisters(companyId);
        const movements = await storage.getAllCashMovementsHistory(companyId);
        res.json({ registers, movements });
      } catch (error) {
        console.error("Failed to fetch cash register history:", error);
        res.status(500).json({ error: "Falha ao buscar histórico de caixa" });
      }
    }
  );

  // ============================================
  // POS TERMINALS ROUTES: Terminais PDV
  // ============================================

  app.get("/api/pos-terminals", requireAuth, async (req, res) => {
    try {
      const companyId = getCompanyId(req);
      if (!companyId) return res.status(401).json({ error: "Não autenticado" });

      const terminals = await storage.getAllPosTerminals(companyId);
      res.json(terminals);
    } catch (error) {
      console.error("Failed to fetch POS terminals:", error);
      res.status(500).json({ error: "Falha ao buscar terminais PDV" });
    }
  });

  const posTerminalSchema = z.object({
    name: z.string().min(1, "Nome é obrigatório"),
    description: z.string().optional(),
    requiresOpening: z.boolean().default(true),
    requiresClosing: z.boolean().default(true),
    isActive: z.boolean().default(true),
  });

  app.post(
    "/api/pos-terminals",
    requireAuth,
    requirePermission("settings:edit"),
    async (req, res) => {
      try {
        const companyId = getCompanyId(req);
        if (!companyId)
          return res.status(401).json({ error: "Não autenticado" });

        const validated = posTerminalSchema.parse(req.body);
        const terminal = await storage.createPosTerminal({
          ...validated,
          companyId,
        });
        res.status(201).json(terminal);
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({ error: error.errors });
        }
        console.error("Failed to create POS terminal:", error);
        res.status(500).json({ error: "Falha ao criar terminal PDV" });
      }
    }
  );

  app.patch(
    "/api/pos-terminals/:id",
    requireAuth,
    requirePermission("settings:edit"),
    async (req, res) => {
      try {
        const companyId = getCompanyId(req);
        if (!companyId)
          return res.status(401).json({ error: "Não autenticado" });

        const id = parseInt(req.params.id);
        const validated = posTerminalSchema.partial().parse(req.body);
        const terminal = await storage.updatePosTerminal(
          id,
          companyId,
          validated
        );
        if (!terminal) {
          return res.status(404).json({ error: "Terminal não encontrado" });
        }
        res.json(terminal);
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({ error: error.errors });
        }
        console.error("Failed to update POS terminal:", error);
        res.status(500).json({ error: "Falha ao atualizar terminal PDV" });
      }
    }
  );

  app.delete(
    "/api/pos-terminals/:id",
    requireAuth,
    requirePermission("settings:edit"),
    async (req, res) => {
      try {
        const companyId = getCompanyId(req);
        if (!companyId)
          return res.status(401).json({ error: "Não autenticado" });

        const id = parseInt(req.params.id);
        await storage.deletePosTerminal(id, companyId);
        res.status(204).send();
      } catch (error) {
        console.error("Failed to delete POS terminal:", error);
        res.status(500).json({ error: "Falha ao excluir terminal PDV" });
      }
    }
  );

  // ============================================
  // CNPJ LOOKUP: Buscar dados de empresa por CNPJ
  // ============================================
  app.get("/api/lookup-cnpj", async (req, res) => {
    try {
      const cnpj = req.query.cnpj as string;

      if (!cnpj || cnpj.length < 14) {
        return res.status(400).json({ error: "CNPJ inválido" });
      }

      const cleanCNPJ = cnpj.replace(/\D/g, "");
      const response = await fetch(
        `https://www.receitaws.com.br/v1/cnpj/${cleanCNPJ}`
      );

      if (!response.ok) {
        return res.status(404).json({ error: "CNPJ não encontrado" });
      }

      const data = await response.json();

      if (data.status !== "OK") {
        return res.status(404).json({ error: "CNPJ não encontrado" });
      }

      res.json({
        razaoSocial: data.nome || "",
        nomeFantasia: data.fantasia || "",
        email: data.email || "",
        phone: data.telefone || "",
        address: data.logradouro || "",
        city: data.municipio || "",
        state: data.uf || "",
        zipCode: data.cep || "",
      });
    } catch (error) {
      console.error("Erro ao buscar CNPJ:", error);
      res.status(500).json({ error: "Erro ao buscar dados do CNPJ" });
    }
  });

  // ============================================
  // FISCAL SYSTEM: Configuration
  // ============================================
  app.get(
    "/api/fiscal-config",
    requireAuth,
    requirePermission("fiscal:view"),
    async (req, res) => {
      try {
        const companyId = getCompanyId(req);
        if (!companyId)
          return res.status(401).json({ error: "Não autenticado" });

        let config = await storage.getFiscalConfig(companyId);
        if (!config) {
          config = await storage.createFiscalConfig({ companyId });
        }
        res.json(config);
      } catch (error) {
        console.error("Failed to fetch fiscal config:", error);
        res.status(500).json({ error: "Failed to fetch fiscal config" });
      }
    }
  );

  app.put(
    "/api/fiscal-config",
    requireAuth,
    requirePermission("fiscal:manage"),
    async (req, res) => {
      try {
        const companyId = getCompanyId(req);
        if (!companyId)
          return res.status(401).json({ error: "Não autenticado" });

        const validated = insertFiscalConfigSchema.partial().parse(req.body);
        const config = await storage.updateFiscalConfig(companyId, validated);
        res.json(config);
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({ error: error.errors });
        }
        console.error("Failed to update fiscal config:", error);
        res.status(500).json({ error: "Failed to update fiscal config" });
      }
    }
  );

  app.get("/api/cfop-codes-legacy", requireAuth, async (req, res) => {
    try {
      const companyId = getCompanyId(req);
      if (!companyId) return res.status(401).json({ error: "Não autenticado" });

      const codes = await storage.getCfopCodes(companyId);
      res.json(codes);
    } catch (error) {
      console.error("Failed to fetch CFOP codes:", error);
      res.status(500).json({ error: "Failed to fetch CFOP codes" });
    }
  });

  app.post(
    "/api/cfop-codes",
    requireAuth,
    requirePermission("fiscal:manage"),
    async (req, res) => {
      try {
        const { code, description, type, operationType, scope } = req.body;

        if (!code || !description || !type || !operationType || !scope) {
          return res
            .status(400)
            .json({ error: "Campos obrigatórios ausentes" });
        }

        const newCode = await storage.createCfopCode({
          code,
          description,
          type,
          operationType,
          scope,
        });
        res.status(201).json(newCode);
      } catch (error) {
        console.error("Failed to create CFOP code:", error);
        res.status(500).json({ error: "Failed to create CFOP code" });
      }
    }
  );

  app.post(
    "/api/cfop-codes/validate",
    requireAuth,
    requirePermission("fiscal:view"),
    async (req, res) => {
      try {
        const {
          cfopCode,
          direction,
          scope,
          operationType,
          originState,
          destinyState,
          customerType,
        } = req.body;

        if (!cfopCode || !direction || !scope) {
          return res.status(400).json({
            error: "Campos obrigatórios: cfopCode, direction, scope",
          });
        }

        const result = await CFOPValidator.validateCFOP(cfopCode, {
          direction,
          scope,
          operationType: operationType || "venda",
          originState,
          destinyState,
          customerType,
        });

        res.json(result);
      } catch (error) {
        console.error("Failed to validate CFOP:", error);
        res.status(500).json({ error: "Failed to validate CFOP" });
      }
    }
  );

  app.post(
    "/api/cfop-codes/suggest",
    requireAuth,
    requirePermission("fiscal:view"),
    async (req, res) => {
      try {
        const { direction, scope, operationType } = req.body;

        if (!direction || !scope) {
          return res
            .status(400)
            .json({ error: "Campos obrigatórios: direction, scope" });
        }

        const cfops = await CFOPValidator.getValidCFOPsForContext({
          direction,
          scope,
          operationType: operationType || "venda",
        });

        res.json(cfops);
      } catch (error) {
        console.error("Failed to suggest CFOPs:", error);
        res.status(500).json({ error: "Failed to suggest CFOPs" });
      }
    }
  );

  app.put(
    "/api/cfop-codes/:id",
    requireAuth,
    requirePermission("fiscal:manage"),
    async (req, res) => {
      try {
        const { id } = req.params;
        const { code, description, type, operationType, scope } = req.body;

        const cfopId = parseInt(id, 10);
        if (isNaN(cfopId)) {
          return res.status(400).json({ error: "ID inválido" });
        }

        const cfop = await storage.getCfopCodeById(cfopId);
        if (!cfop) {
          return res.status(404).json({ error: "CFOP não encontrado" });
        }

        const updateData: any = {};
        if (code !== undefined) updateData.code = code;
        if (description !== undefined) updateData.description = description;
        if (type !== undefined) updateData.type = type;
        if (operationType !== undefined)
          updateData.operationType = operationType;
        if (scope !== undefined) updateData.scope = scope;

        const updatedCfop = await storage.updateCfopCode(cfopId, updateData);
        res.json(updatedCfop);
      } catch (error) {
        console.error("Failed to update CFOP code:", error);
        res.status(500).json({ error: "Failed to update CFOP code" });
      }
    }
  );

  app.delete(
    "/api/cfop-codes/:id",
    requireAuth,
    requirePermission("fiscal:manage"),
    async (req, res) => {
      try {
        const { id } = req.params;

        const cfopId = parseInt(id, 10);
        if (isNaN(cfopId)) {
          return res.status(400).json({ error: "ID inválido" });
        }

        const cfop = await storage.getCfopCodeById(cfopId);
        if (!cfop) {
          return res.status(404).json({ error: "CFOP não encontrado" });
        }

        await storage.deleteCfopCode(cfopId);
        res.json({ message: "CFOP deletado com sucesso" });
      } catch (error) {
        console.error("Failed to delete CFOP code:", error);
        res.status(500).json({ error: "Failed to delete CFOP code" });
      }
    }
  );

  // ============= CSOSN Endpoints (Simples Nacional) =============

  app.get(
    "/api/csosn-codes",
    requireAuth,
    requirePermission("fiscal:view"),
    async (req, res) => {
      try {
        const csosns = await CSOSNCalculator.getAllCSOSNs();
        res.json(csosns);
      } catch (error) {
        console.error("Failed to fetch CSOSN codes:", error);
        res.status(500).json({ error: "Failed to fetch CSOSN codes" });
      }
    }
  );

  app.post(
    "/api/csosn-codes/validate",
    requireAuth,
    requirePermission("fiscal:view"),
    async (req, res) => {
      try {
        const { cfopCode, csosnCode, direction } = req.body;

        if (!cfopCode || !csosnCode || !direction) {
          return res.status(400).json({
            error: "Campos obrigatórios: cfopCode, csosnCode, direction",
          });
        }

        const result = await CSOSNCalculator.validateCSOSNxCFOP({
          cfopCode,
          csosnCode,
          direction,
        });

        res.json(result);
      } catch (error) {
        console.error("Failed to validate CSOSN:", error);
        res.status(500).json({ error: "Failed to validate CSOSN" });
      }
    }
  );

  app.post(
    "/api/csosn-codes/calculate-icms",
    requireAuth,
    requirePermission("fiscal:view"),
    async (req, res) => {
      try {
        const {
          baseValue,
          csosnCode,
          companyState,
          destinationState,
          icmsAliquot,
          icmsReduction,
        } = req.body;

        if (!baseValue || !csosnCode || !companyState) {
          return res.status(400).json({
            error: "Campos obrigatórios: baseValue, csosnCode, companyState",
          });
        }

        const result = await CSOSNCalculator.calculateICMS({
          baseValue: parseFloat(baseValue),
          csosnCode,
          companyState,
          destinationState,
          icmsAliquot: icmsAliquot ? parseFloat(icmsAliquot) : undefined,
          icmsReduction: icmsReduction ? parseFloat(icmsReduction) : undefined,
        });

        res.json(result);
      } catch (error) {
        console.error("Failed to calculate ICMS:", error);
        res.status(500).json({
          error:
            error instanceof Error ? error.message : "Failed to calculate ICMS",
        });
      }
    }
  );

  app.get(
    "/api/tax-aliquots",
    requireAuth,
    requirePermission("fiscal:view"),
    async (req, res) => {
      try {
        const companyId = getCompanyId(req);
        if (!companyId)
          return res.status(401).json({ error: "Não autenticado" });

        const state = req.query.state as string | undefined;
        const aliquots = await storage.getTaxAliquots(companyId, state);
        res.json(aliquots);
      } catch (error) {
        console.error("Failed to fetch tax aliquots:", error);
        res.status(500).json({ error: "Failed to fetch tax aliquots" });
      }
    }
  );

  app.post(
    "/api/tax-aliquots",
    requireAuth,
    requirePermission("fiscal:manage"),
    async (req, res) => {
      try {
        const companyId = getCompanyId(req);
        if (!companyId)
          return res.status(401).json({ error: "Não autenticado" });

        const validated = insertTaxAliquotSchema.parse({
          ...req.body,
          companyId,
        });
        const aliquot = await storage.createTaxAliquot(validated);
        res.status(201).json(aliquot);
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({ error: error.errors });
        }
        console.error("Failed to create tax aliquot:", error);
        res.status(500).json({ error: "Failed to create tax aliquot" });
      }
    }
  );

  // ============================================
  // DIGITAL CERTIFICATE MANAGEMENT
  // ============================================
  app.get(
    "/api/digital-certificate",
    requireAuth,
    requirePermission("fiscal:manage"),
    async (req, res) => {
      try {
        const companyId = getCompanyId(req);
        if (!companyId)
          return res.status(401).json({ error: "Não autenticado" });

        const cert = await storage.getDigitalCertificate(companyId);
        if (!cert) {
          return res.json({ installed: false });
        }

        const validation = await storage.validateDigitalCertificate(companyId);
        res.json({
          installed: true,
          cnpj: cert.cnpj,
          subjectName: cert.subjectName,
          issuer: cert.issuer,
          validFrom: cert.validFrom,
          validUntil: cert.validUntil,
          certificateType: cert.certificateType,
          ...validation,
        });
      } catch (error) {
        console.error("Failed to fetch certificate:", error);
        res.status(500).json({ error: "Failed to fetch certificate" });
      }
    }
  );

  app.post(
    "/api/digital-certificate/upload",
    requireAuth,
    requirePermission("fiscal:manage"),
    async (req, res) => {
      try {
        const companyId = getCompanyId(req);
        if (!companyId)
          return res.status(401).json({ error: "Não autenticado" });

        const { certificateData, certificatePassword, cnpj } = req.body;

        if (!certificateData || !certificatePassword) {
          return res.status(400).json({
            error: "Certificado e senha são obrigatórios",
          });
        }

        const cert = await storage.createOrUpdateDigitalCertificate({
          companyId,
          certificateData,
          certificatePassword,
          cnpj: cnpj || "",
          certificateType: "e-CNPJ",
          subjectName: "Digital Certificate",
          issuer: "AC Raiz",
          validFrom: new Date(),
          validUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        });

        res.status(201).json({
          success: true,
          message: "Certificado digital salvo com sucesso",
          cnpj: cert.cnpj,
        });
      } catch (error) {
        console.error("Failed to upload certificate:", error);
        res.status(500).json({
          error:
            error instanceof Error
              ? error.message
              : "Erro ao salvar certificado",
        });
      }
    }
  );

  app.delete(
    "/api/digital-certificate",
    requireAuth,
    requirePermission("fiscal:manage"),
    async (req, res) => {
      try {
        const companyId = getCompanyId(req);
        if (!companyId)
          return res.status(401).json({ error: "Não autenticado" });

        await storage.deleteDigitalCertificate(companyId);
        res.json({ success: true, message: "Certificado removido" });
      } catch (error) {
        console.error("Failed to delete certificate:", error);
        res.status(500).json({ error: "Failed to delete certificate" });
      }
    }
  );

  // ============================================
  // SEQUENTIAL NUMBERING (Numeração Sequencial Autorizada)
  // ============================================
  app.get(
    "/api/sequential-numbering",
    requireAuth,
    requirePermission("fiscal:manage"),
    async (req, res) => {
      try {
        const companyId = getCompanyId(req);
        if (!companyId)
          return res.status(401).json({ error: "Não autenticado" });

        const numberings = await storage.listSequentialNumbering(companyId);
        res.json(numberings);
      } catch (error) {
        console.error("Failed to list sequential numbering:", error);
        res.status(500).json({ error: "Failed to list sequential numbering" });
      }
    }
  );

  app.post(
    "/api/sequential-numbering",
    requireAuth,
    requirePermission("fiscal:manage"),
    async (req, res) => {
      try {
        const companyId = getCompanyId(req);
        if (!companyId)
          return res.status(401).json({ error: "Não autenticado" });

        const data = req.body as any;
        const numbering = await storage.createSequentialNumbering({
          companyId,
          documentType: data.documentType,
          series: data.series,
          rangeStart: data.rangeStart,
          rangeEnd: data.rangeEnd,
          currentNumber: data.rangeStart,
          authorization: data.authorization,
          authorizedAt: data.authorizedAt
            ? new Date(data.authorizedAt)
            : undefined,
          expiresAt: data.expiresAt ? new Date(data.expiresAt) : undefined,
          environment: data.environment || "homologacao",
          isActive: true,
        });
        res.status(201).json(numbering);
      } catch (error) {
        console.error("Failed to create sequential numbering:", error);
        res.status(500).json({
          error: error instanceof Error ? error.message : "Failed to create",
        });
      }
    }
  );

  app.post(
    "/api/sequential-numbering/:id/next-number",
    requireAuth,
    requirePermission("fiscal:manage"),
    async (req, res) => {
      try {
        const companyId = getCompanyId(req);
        if (!companyId)
          return res.status(401).json({ error: "Não autenticado" });

        const { documentType, series } = req.body;
        const result = await storage.getNextDocumentNumber(
          companyId,
          documentType,
          series
        );
        res.json(result);
      } catch (error) {
        res.status(400).json({
          error:
            error instanceof Error
              ? error.message
              : "Failed to get next number",
        });
      }
    }
  );

  // ============================================
  // Fiscal Documents Routes (NF-e, NFC-e, NFS-e, CT-e, MDF-e)
  // ============================================
  app.use("/api/fiscal", requireAuth, fiscalRouter);

  return httpServer;
}


