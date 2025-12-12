import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { db } from "./db";
import {
  products,
  productVariations,
  productMedia,
  kitItems,
} from "@shared/schema";
import {
  insertProductSchema,
  insertCustomerSchema,
  insertSupplierSchema,
  insertSaleSchema,
  insertSaleItemSchema,
  insertCompanySettingsSchema,
} from "@shared/schema";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { lookupEAN } from "./ean-service";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  app.get("/api/products", async (req, res) => {
    try {
      const productsList = await storage.getAllProducts();
      res.json(productsList);
    } catch (error) {
      console.error("Failed to fetch products:", error);
      res.status(500).json({ error: "Failed to fetch products" });
    }
  });

  app.get("/api/products/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const product = await storage.getProduct(id);
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
  });

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

  app.post("/api/products", async (req, res) => {
    try {
      const {
        product,
        variations,
        media,
        kitItems: kitItemsData,
      } = createProductRequestSchema.parse(req.body);

      const result = await db.transaction(async (tx) => {
        const [newProduct] = await tx
          .insert(products)
          .values(product)
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
  });

  app.patch("/api/products/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      console.log(
        "PATCH /api/products/:id - Request body:",
        JSON.stringify(req.body, null, 2)
      );

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
            .where(eq(products.id, id))
            .returning();
          if (!updated) {
            throw new Error("Product not found");
          }
          updatedProduct = updated;
        } else {
          const [existing] = await tx
            .select()
            .from(products)
            .where(eq(products.id, id));
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
  });

  app.delete("/api/products/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteProduct(id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete product" });
    }
  });

  app.get("/api/customers", async (req, res) => {
    try {
      const customers = await storage.getAllCustomers();
      res.json(customers);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch customers" });
    }
  });

  app.post("/api/customers", async (req, res) => {
    try {
      const validated = insertCustomerSchema.parse(req.body);
      const customer = await storage.createCustomer(validated);
      res.status(201).json(customer);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to create customer" });
    }
  });

  app.get("/api/suppliers", async (req, res) => {
    try {
      const suppliers = await storage.getAllSuppliers();
      res.json(suppliers);
    } catch (error) {
      console.error("Failed to fetch suppliers:", error);
      res.status(500).json({ error: "Failed to fetch suppliers" });
    }
  });

  app.post("/api/suppliers", async (req, res) => {
    try {
      const validated = insertSupplierSchema.parse(req.body);
      const supplier = await storage.createSupplier(validated);
      res.status(201).json(supplier);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to create supplier" });
    }
  });

  app.get("/api/sales", async (req, res) => {
    try {
      const sales = await storage.getAllSales();
      res.json(sales);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch sales" });
    }
  });

  app.get("/api/sales/stats", async (req, res) => {
    try {
      const stats = await storage.getSalesStats();
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch stats" });
    }
  });

  app.get("/api/sales/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const sale = await storage.getSale(id);
      if (!sale) {
        return res.status(404).json({ error: "Sale not found" });
      }
      const items = await storage.getSaleItems(id);
      res.json({ ...sale, items });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch sale" });
    }
  });

  const createSaleRequestSchema = z.object({
    sale: insertSaleSchema,
    items: z.array(insertSaleItemSchema.omit({ saleId: true })),
  });

  app.post("/api/sales", async (req, res) => {
    try {
      const { sale, items } = createSaleRequestSchema.parse(req.body);

      for (const item of items) {
        await storage.updateProductStock(item.productId, -item.quantity);
      }

      const newSale = await storage.createSale(sale, items as any);
      res.status(201).json(newSale);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to create sale" });
    }
  });

  const updateNfceStatusSchema = z.object({
    status: z.string(),
    protocol: z.string().optional(),
    key: z.string().optional(),
  });

  app.patch("/api/sales/:id/nfce-status", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { status, protocol, key } = updateNfceStatusSchema.parse(req.body);
      const sale = await storage.updateSaleNfceStatus(
        id,
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
  });

  app.get("/api/settings", async (req, res) => {
    try {
      const settings = await storage.getCompanySettings();
      res.json(settings || {});
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch settings" });
    }
  });

  app.patch("/api/settings", async (req, res) => {
    try {
      const validated = insertCompanySettingsSchema.partial().parse(req.body);
      const settings = await storage.updateCompanySettings(validated);
      res.json(settings);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to update settings" });
    }
  });

  app.get("/api/ean/:code", async (req, res) => {
    try {
      const { code } = req.params;
      const result = await lookupEAN(code);
      if (!result) {
        return res.status(404).json({ error: "Produto não encontrado" });
      }
      res.json(result);
    } catch (error) {
      if (error instanceof Error) {
        return res.status(400).json({ error: error.message });
      }
      res.status(500).json({ error: "Falha ao buscar produto" });
    }
  });

  return httpServer;
}
