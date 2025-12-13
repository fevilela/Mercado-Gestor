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

      const settings = await storage.getCompanySettings();
      const isFiscalConfigured = !!(
        settings &&
        settings.fiscalEnabled &&
        settings.cscToken &&
        settings.cscId
      );

      const saleData = {
        ...sale,
        nfceStatus: isFiscalConfigured ? "Autorizada" : "Pendente Fiscal",
        status: isFiscalConfigured ? "Concluído" : "Aguardando Emissão",
      };

      for (const item of items) {
        await storage.updateProductStock(item.productId, -item.quantity);
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

  const adjustStockSchema = z.object({
    productId: z.number(),
    quantity: z.number(),
    type: z.enum(["entrada", "saida", "ajuste", "perda", "devolucao"]),
    reason: z.string().optional(),
    notes: z.string().optional(),
  });

  app.post("/api/inventory/adjust", async (req, res) => {
    try {
      const { productId, quantity, type, reason, notes } =
        adjustStockSchema.parse(req.body);

      const product = await storage.getProduct(productId);
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
  });

  app.get("/api/inventory/movements/:productId", async (req, res) => {
    try {
      const productId = parseInt(req.params.productId);
      const movements = await storage.getInventoryMovements(productId);
      res.json(movements);
    } catch (error) {
      res.status(500).json({ error: "Falha ao buscar movimentações" });
    }
  });

  const importXmlSchema = z.object({
    xmlContent: z.string().min(1),
  });

  app.post("/api/products/preview-xml", async (req, res) => {
    try {
      const { xmlContent } = importXmlSchema.parse(req.body);

      const parsedProducts = parseNFeXML(xmlContent);

      if (parsedProducts.length === 0) {
        return res.status(400).json({
          error:
            "Nenhum produto encontrado no XML. Verifique se o arquivo é uma NFe válida.",
        });
      }

      const existingProducts = await storage.getAllProducts();

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

  app.post("/api/products/import-confirmed", async (req, res) => {
    try {
      const { products: productsToImport } = importProductsSchema.parse(
        req.body
      );

      const importedProducts = [];
      const updatedProducts = [];

      for (const prodData of productsToImport) {
        if (prodData.isExisting && prodData.existingProductId) {
          await storage.updateProductStock(
            prodData.existingProductId,
            prodData.quantity
          );
          await storage.createInventoryMovement({
            productId: prodData.existingProductId,
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
            })
            .returning();

          if (prodData.quantity > 0) {
            await storage.createInventoryMovement({
              productId: newProduct.id,
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

  app.post("/api/products/import-xml", async (req, res) => {
    try {
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
          const existingProducts = await storage.getAllProducts();
          const existing = existingProducts.find((p) => p.ean === prodData.ean);
          if (existing) {
            const newStock = existing.stock + prodData.quantity;
            await storage.updateProductStock(existing.id, prodData.quantity);
            await storage.createInventoryMovement({
              productId: existing.id,
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
          })
          .returning();

        if (prodData.quantity > 0) {
          await storage.createInventoryMovement({
            productId: newProduct.id,
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

  return httpServer;
}
