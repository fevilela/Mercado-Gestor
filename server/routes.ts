import type { Express } from "express";
import { createServer, type Server } from "http";
import JSZip from "jszip";
import { storage } from "./storage";
import { db } from "./db";
import {
  products,
  inventoryMovements,
  productVariations,
  productMedia,
  kitItems,
  referenceTables,
  customers,
  suppliers,
  transporters,
  paymentMachines,
  digitalCertificates,
  sefazTransmissionLogs,
} from "@shared/schema";
import {
  insertProductSchema,
  insertCustomerSchema,
  insertSupplierSchema,
  insertTransporterSchema,
  insertSaleSchema,
  insertSaleItemSchema,
  insertCompanySettingsSchema,
  insertPayableSchema,
  insertReceivableSchema,
  insertNotificationSchema,
  insertFiscalConfigSchema,
  insertTaxAliquotSchema,
  insertFiscalTaxRuleSchema,
  insertSimplesNacionalAliquotSchema,
} from "@shared/schema";
import { z } from "zod";
import { eq, and, desc, sql } from "drizzle-orm";
import { createHash } from "crypto";
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
import { XMLSignatureService } from "./xml-signature";
import {
  authorizePayment,
  cancelMercadoPagoByReference,
  createMercadoPagoPixQr,
  clearMercadoPagoTerminalQueue,
  getMercadoPagoOrderStatus,
  validateMercadoPagoSettings,
} from "./payment-service";
import {
  validateStoneSettings,
  captureStonePayment,
  cancelStonePayment,
  getStonePaymentStatus,
} from "./stone-connect";
import { getFiscalReadiness } from "./fiscal-readiness";
import { certificateService } from "./certificate-service";
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

function parseNFeHeaderTotals(xmlContent: string): {
  productsTotal: number;
  discountTotal: number;
  otherExpensesTotal: number;
  icmsStTotal: number;
  ipiTotal: number;
  noteTotal: number;
} {
  const getTagValue = (tag: string, content: string): number => {
    const regex = new RegExp(`<${tag}>([^<]*)</${tag}>`, "i");
    const match = regex.exec(content);
    const parsed = Number(String(match?.[1] ?? "0").replace(",", "."));
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const icmsTotMatch = /<ICMSTot>([\s\S]*?)<\/ICMSTot>/i.exec(xmlContent);
  const totalsSource = icmsTotMatch?.[1] || xmlContent;

  return {
    productsTotal: getTagValue("vProd", totalsSource),
    discountTotal: getTagValue("vDesc", totalsSource),
    otherExpensesTotal: getTagValue("vOutro", totalsSource),
    icmsStTotal: getTagValue("vST", totalsSource),
    ipiTotal: getTagValue("vIPI", totalsSource),
    noteTotal: getTagValue("vNF", totalsSource),
  };
}

type AccessoryObligationType = "sped" | "sintegra";

function formatPeriodDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseAccessoryPeriod(input?: string): {
  period: string;
  start: Date;
  end: Date;
} {
  const now = new Date();
  const fallbackPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const period = String(input || fallbackPeriod).trim();
  const match = /^(\d{4})-(\d{2})$/.exec(period);
  if (!match) {
    throw new Error("Periodo invalido. Use YYYY-MM");
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) {
    throw new Error("Mes invalido no periodo");
  }
  const start = new Date(year, month - 1, 1, 0, 0, 0, 0);
  const end = new Date(year, month, 0, 23, 59, 59, 999);
  return { period, start, end };
}

function generateAccessoryContent(params: {
  type: AccessoryObligationType;
  companyId: number;
  period: string;
  generatedAt: Date;
  sales: any[];
}) {
  const header =
    params.type === "sped"
      ? `|0000|SPED FISCAL|${params.period}|EMPRESA ${params.companyId}|`
      : `10|SINTEGRA|${params.period}|EMPRESA ${params.companyId}|`;

  const lines: string[] = [header];
  let totalValue = 0;

  for (const sale of params.sales) {
    const createdAt = sale.createdAt instanceof Date ? sale.createdAt : new Date(sale.createdAt);
    const saleDate = formatPeriodDate(createdAt);
    const total = Number(String(sale.total || "0").replace(",", "."));
    const safeTotal = Number.isFinite(total) ? total : 0;
    totalValue += safeTotal;

    if (params.type === "sped") {
      lines.push(
        `|C100|${sale.id}|${saleDate}|${String(sale.customerName || "CONSUMIDOR FINAL").toUpperCase()}|${safeTotal.toFixed(
          2,
        )}|${String(sale.nfceKey || "")}|${String(sale.nfceProtocol || "")}|`,
      );
    } else {
      lines.push(
        `50|${saleDate}|${String(sale.id).padStart(6, "0")}|${safeTotal.toFixed(2)}|${String(
          sale.nfceStatus || "PENDENTE",
        ).toUpperCase()}|`,
      );
    }
  }

  if (params.type === "sped") {
    lines.push(`|9900|REGISTROS|${Math.max(lines.length - 1, 0)}|`);
    lines.push(`|9999|${lines.length + 1}|`);
  } else {
    lines.push(`90|TOTAL|${params.sales.length}|${totalValue.toFixed(2)}|`);
  }

  return {
    content: lines.join("\r\n"),
    totalDocuments: params.sales.length,
    totalValue: Number(totalValue.toFixed(2)),
  };
}

async function pushAccessoryObligationToProvider(params: {
  obligationType: AccessoryObligationType;
  companyId: number;
  period: string;
  fileName: string;
  content: string;
  deliveryUrl: string;
  deliveryToken?: string;
  deliveryApiKey?: string;
}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000);

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (params.deliveryToken) {
      headers.Authorization = `Bearer ${params.deliveryToken}`;
    }
    if (params.deliveryApiKey) {
      headers["x-api-key"] = params.deliveryApiKey;
    }

    const response = await fetch(params.deliveryUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({
        obligationType: params.obligationType.toUpperCase(),
        companyId: params.companyId,
        period: params.period,
        fileName: params.fileName,
        contentBase64: Buffer.from(params.content, "utf8").toString("base64"),
      }),
      signal: controller.signal,
    });

    const rawText = await response.text();
    let parsed: any = null;
    try {
      parsed = rawText ? JSON.parse(rawText) : null;
    } catch {
      parsed = null;
    }

    if (!response.ok) {
      throw new Error(
        parsed?.error ||
          parsed?.message ||
          `Falha no provedor externo (${response.status})`,
      );
    }

    return {
      providerStatus: response.status,
      providerPayload: parsed,
      rawResponse: rawText,
      protocol:
        parsed?.protocol ||
        parsed?.receipt ||
        response.headers.get("x-protocol") ||
        null,
    };
  } finally {
    clearTimeout(timeout);
  }
}

function resolveAccessoryProviderMode(): "homolog" | "prod" {
  return String(process.env.ACCESSORY_PROVIDER_MODE || "homolog").toLowerCase() ===
    "prod"
    ? "prod"
    : "homolog";
}

function isAccessoryProviderAuthorized(req: any) {
  const configuredBearer = String(
    process.env.ACCESSORY_PROVIDER_BEARER_TOKEN || "",
  ).trim();
  const configuredApiKey = String(
    process.env.ACCESSORY_PROVIDER_API_KEY || "",
  ).trim();

  const authHeader = String(req.headers?.authorization || "");
  const apiKeyHeader = String(req.headers?.["x-api-key"] || "");
  const bearerToken = authHeader.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length).trim()
    : "";

  const hasBearerConfig = configuredBearer.length > 0;
  const hasApiKeyConfig = configuredApiKey.length > 0;

  if (!hasBearerConfig && !hasApiKeyConfig) {
    // In homolog, allow testing without credentials.
    return {
      allowed: resolveAccessoryProviderMode() !== "prod",
      reason:
        "Configure ACCESSORY_PROVIDER_BEARER_TOKEN ou ACCESSORY_PROVIDER_API_KEY",
      hasBearerConfig,
      hasApiKeyConfig,
    };
  }

  const bearerOk = !hasBearerConfig || configuredBearer === bearerToken;
  const apiKeyOk = !hasApiKeyConfig || configuredApiKey === apiKeyHeader;

  return {
    allowed: bearerOk && apiKeyOk,
    reason: "Credenciais invalidas para o provedor",
    hasBearerConfig,
    hasApiKeyConfig,
  };
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

  const normalizePromoDateFields = (body: any) => {
    if (!body || typeof body !== "object" || !body.product) return body;
    const product = { ...body.product };

    const toDateOrNull = (value: unknown) => {
      if (value === undefined) return undefined;
      if (value === null || value === "") return null;
      if (value instanceof Date) return value;
      const raw = String(value);
      const parsed = raw.includes("T")
        ? new Date(raw)
        : new Date(`${raw}T00:00:00`);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    };

    if ("promoStart" in product) {
      product.promoStart = toDateOrNull(product.promoStart);
    }
    if ("promoEnd" in product) {
      product.promoEnd = toDateOrNull(product.promoEnd);
    }

    return { ...body, product };
  };

  app.post(
    "/api/products",
    requireAuth,
    requirePermission("inventory:create"),
    async (req, res) => {
      try {
        const companyId = getCompanyId(req);
        if (!companyId)
          return res.status(401).json({ error: "Não autenticado" });

        const normalizedBody = normalizePromoDateFields(req.body);
        const {
          product,
          variations,
          media,
          kitItems: kitItemsData,
        } = createProductRequestSchema.parse(normalizedBody);

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

        const normalizedBody = normalizePromoDateFields(req.body);
        const parseResult = updateProductRequestSchema.safeParse(normalizedBody);
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
    requirePermission("customers:view", "fiscal:emit_nfe", "fiscal:view"),
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
    requirePermission("customers:view", "fiscal:emit_nfe", "fiscal:view"),
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
    requirePermission("customers:create"),
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
    requirePermission("customers:edit"),
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
    requirePermission("customers:delete"),
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
    requirePermission("suppliers:create"),
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
    requirePermission("suppliers:edit"),
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
    requirePermission("suppliers:delete"),
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
    "/api/transporters/search/:query",
    requireAuth,
    requirePermission("suppliers:view", "fiscal:emit_nfe", "fiscal:view"),
    async (req, res) => {
      try {
        const companyId = getCompanyId(req);
        if (!companyId)
          return res.status(401).json({ error: "NÃ£o autenticado" });

        const { query } = req.params;
        const transportersList = await storage.searchTransporters(
          query,
          companyId,
          10
        );
        res.json(transportersList);
      } catch (error) {
        console.error("Failed to search transporters:", error);
        res.status(500).json({ error: "Failed to search transporters" });
      }
    }
  );

  app.get(
    "/api/transporters",
    requireAuth,
    requirePermission("suppliers:view", "fiscal:emit_nfe", "fiscal:view"),
    async (req, res) => {
      try {
        const companyId = getCompanyId(req);
        if (!companyId) return res.status(401).json({ error: "NÃ£o autenticado" });
        const transportersList = await storage.getAllTransporters(companyId);
        res.json(transportersList);
      } catch (error) {
        console.error("Failed to fetch transporters:", error);
        res.status(500).json({ error: "Failed to fetch transporters" });
      }
    }
  );

  app.post(
    "/api/transporters",
    requireAuth,
    requirePermission("suppliers:create"),
    async (req, res) => {
      try {
        const companyId = getCompanyId(req);
        if (!companyId) return res.status(401).json({ error: "NÃ£o autenticado" });
        const validated = insertTransporterSchema.parse(req.body);
        const transporter = await storage.createTransporter({ ...validated, companyId });
        res.status(201).json(transporter);
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({ error: error.errors });
        }
        res.status(500).json({ error: "Failed to create transporter" });
      }
    }
  );

  app.patch(
    "/api/transporters/:id",
    requireAuth,
    requirePermission("suppliers:edit"),
    async (req, res) => {
      try {
        const companyId = getCompanyId(req);
        if (!companyId) return res.status(401).json({ error: "NÃ£o autenticado" });
        const id = parseInt(req.params.id);
        const validated = insertTransporterSchema.partial().parse(req.body);
        const transporter = await storage.updateTransporter(id, companyId, validated);
        if (!transporter) {
          return res.status(404).json({ error: "Transporter not found" });
        }
        res.json(transporter);
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({ error: error.errors });
        }
        res.status(500).json({ error: "Failed to update transporter" });
      }
    }
  );

  app.delete(
    "/api/transporters/:id",
    requireAuth,
    requirePermission("suppliers:delete"),
    async (req, res) => {
      try {
        const companyId = getCompanyId(req);
        if (!companyId) return res.status(401).json({ error: "NÃ£o autenticado" });
        const id = parseInt(req.params.id);
        await storage.deleteTransporter(id, companyId);
        res.status(204).send();
      } catch (error) {
        res.status(500).json({ error: "Failed to delete transporter" });
      }
    }
  );

  app.get(
    "/api/sales",
    requireAuth,
    requirePermission("reports:view"),
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
    requirePermission("reports:view"),
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
    requirePermission("reports:view"),
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
    posTerminalId: z.number().int().positive().optional(),
  });
  const pixQrSchema = z.object({
    amount: z.number().positive(),
  });

  const mpValidationSchema = z.object({
    accessToken: z.string().min(1),
    terminalId: z.string().min(1),
  });
  const mpClearQueueSchema = z.object({
    terminalId: z.string().optional(),
    providerReference: z.string().optional(),
  });
  const mpCancelSchema = z.object({
    providerReference: z.string().min(1),
  });
  const userCanAccessTerminal = async (
    req: any,
    companyId: number,
    terminalId: number,
  ) => {
    const terminal = await storage.getPosTerminal(terminalId, companyId);
    if (!terminal) {
      return { ok: false as const, status: 404, error: "Terminal PDV nao encontrado", terminal: null };
    }
    const currentUserId = String(req.session?.userId || "");
    const userPerms = (req.session?.userPermissions || []) as string[];
    const isAdminOverride =
      userPerms.includes("users:manage") || userPerms.includes("settings:edit");
    const assignedUserId = String((terminal as any).assignedUserId || "").trim();
    if (assignedUserId && assignedUserId !== currentUserId && !isAdminOverride) {
      return {
        ok: false as const,
        status: 403,
        error: "Este terminal PDV esta vinculado a outro usuario",
        terminal,
      };
    }
    return { ok: true as const, status: 200, error: null, terminal };
  };
  const stoneValidationSchema = z.object({
    clientId: z.string().min(1),
    clientSecret: z.string().min(1),
    terminalId: z.string().min(1),
    environment: z.enum(["homologacao", "producao"]).optional(),
  });
  const stoneActionSchema = z.object({
    paymentId: z.string().min(1),
    environment: z.enum(["homologacao", "producao"]).optional(),
  });

  app.post(
    "/api/payments/pix/qr",
    requireAuth,
    requirePermission("pos:sell"),
    async (req, res) => {
      try {
        const companyId = getCompanyId(req);
        if (!companyId)
          return res.status(401).json({ error: "Nao autenticado" });

        const { amount } = pixQrSchema.parse(req.body);
        const settings = await storage.getCompanySettings(companyId);
        if (!settings?.mpAccessToken) {
          return res.status(400).json({ error: "Mercado Pago nao configurado" });
        }
        const result = await createMercadoPagoPixQr({
          amount,
          accessToken: settings.mpAccessToken,
          description: `PIX PDV ${companyId}`,
          payerEmail: settings.email,
        });
        res.json(result);
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({ error: error.errors });
        }
        res.status(500).json({
          error:
            error instanceof Error ? error.message : "Erro ao gerar QR PIX",
        });
      }
    }
  );

  app.post(
    "/api/payments/mercadopago/cancel",
    requireAuth,
    requirePermission("pos:sell"),
    async (req, res) => {
      try {
        const companyId = getCompanyId(req);
        if (!companyId)
          return res.status(401).json({ error: "Nao autenticado" });

        const { providerReference } = mpCancelSchema.parse(req.body || {});
        const settings = await storage.getCompanySettings(companyId);
        if (!settings?.mpAccessToken) {
          return res.status(400).json({ error: "Mercado Pago nao configurado" });
        }
        const result = await cancelMercadoPagoByReference({
          accessToken: settings.mpAccessToken,
          providerReference,
        });
        if (!result?.ok) {
          return res.status(409).json({
            error:
              "Nao foi possivel cancelar a cobranca na maquininha. Cancele diretamente no terminal.",
            ...result,
          });
        }
        res.json(result);
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({ error: error.errors });
        }
        res.status(500).json({
          error:
            error instanceof Error
              ? error.message
              : "Falha ao cancelar cobranca no Mercado Pago",
        });
      }
    }
  );

  app.post(
    "/api/payments/mercadopago/validate",
    requireAuth,
    requirePermission("settings:edit"),
    async (req, res) => {
      try {
        const { accessToken, terminalId } = mpValidationSchema.parse(req.body);
        const result = await validateMercadoPagoSettings(
          accessToken,
          terminalId
        );
        res.json(result);
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({ error: error.errors });
        }
        res.status(500).json({
          error:
            error instanceof Error
              ? error.message
              : "Falha ao validar Mercado Pago",
        });
      }
    }
  );

  app.post(
    "/api/payments/stone/validate",
    requireAuth,
    requirePermission("settings:edit"),
    async (req, res) => {
      try {
        const { clientId, clientSecret, terminalId, environment } =
          stoneValidationSchema.parse(req.body);
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
          error:
            error instanceof Error ? error.message : "Falha ao validar Stone",
        });
      }
    }
  );

  app.post(
    "/api/payments/stone/capture",
    requireAuth,
    requirePermission("pos:sell"),
    async (req, res) => {
      try {
        const companyId = getCompanyId(req);
        if (!companyId)
          return res.status(401).json({ error: "Nao autenticado" });

        const { paymentId, environment } = stoneActionSchema.parse(req.body);
        const settings = await storage.getCompanySettings(companyId);
        if (!settings?.stoneClientId || !settings?.stoneClientSecret) {
          return res
            .status(400)
            .json({ error: "Stone Connect nao configurado" });
        }
        const result = await captureStonePayment({
          paymentId,
          clientId: settings.stoneClientId,
          clientSecret: settings.stoneClientSecret,
          environment: environment === "homologacao" ? "homologacao" : "producao",
        });
        res.json(result);
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({ error: error.errors });
        }
        res.status(500).json({
          error:
            error instanceof Error ? error.message : "Erro ao capturar pagamento",
        });
      }
    }
  );

  app.post(
    "/api/payments/stone/cancel",
    requireAuth,
    requirePermission("pos:sell"),
    async (req, res) => {
      try {
        const companyId = getCompanyId(req);
        if (!companyId)
          return res.status(401).json({ error: "Nao autenticado" });

        const { paymentId, environment } = stoneActionSchema.parse(req.body);
        const settings = await storage.getCompanySettings(companyId);
        if (!settings?.stoneClientId || !settings?.stoneClientSecret) {
          return res
            .status(400)
            .json({ error: "Stone Connect nao configurado" });
        }
        const result = await cancelStonePayment({
          paymentId,
          clientId: settings.stoneClientId,
          clientSecret: settings.stoneClientSecret,
          environment: environment === "homologacao" ? "homologacao" : "producao",
        });
        res.json(result);
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({ error: error.errors });
        }
        res.status(500).json({
          error:
            error instanceof Error ? error.message : "Erro ao cancelar pagamento",
        });
      }
    }
  );

  app.get(
    "/api/payments/stone/status/:id",
    requireAuth,
    requirePermission("pos:sell"),
    async (req, res) => {
      try {
        const companyId = getCompanyId(req);
        if (!companyId)
          return res.status(401).json({ error: "Nao autenticado" });

        const paymentId = String(req.params.id || "").trim();
        const environment =
          req.query.environment === "homologacao" ? "homologacao" : "producao";
        if (!paymentId) {
          return res.status(400).json({ error: "paymentId obrigatorio" });
        }
        const settings = await storage.getCompanySettings(companyId);
        if (!settings?.stoneClientId || !settings?.stoneClientSecret) {
          return res
            .status(400)
            .json({ error: "Stone Connect nao configurado" });
        }
        const result = await getStonePaymentStatus({
          paymentId,
          clientId: settings.stoneClientId,
          clientSecret: settings.stoneClientSecret,
          environment,
        });
        res.json(result);
      } catch (error) {
        res.status(500).json({
          error:
            error instanceof Error ? error.message : "Erro ao consultar pagamento",
        });
      }
    }
  );

  app.get(
    "/api/payments/mercadopago/status/:id",
    requireAuth,
    requirePermission("pos:sell"),
    async (req, res) => {
      try {
        res.set("Cache-Control", "no-store, no-cache, must-revalidate, private");
        res.set("Pragma", "no-cache");
        res.set("Expires", "0");
        res.set("Surrogate-Control", "no-store");

        const companyId = getCompanyId(req);
        if (!companyId)
          return res.status(401).json({ error: "Nao autenticado" });

        const orderId = String(req.params.id || "").trim();
        if (!orderId) {
          return res.status(400).json({ error: "orderId obrigatorio" });
        }

        const settings = await storage.getCompanySettings(companyId);
        if (!settings?.mpAccessToken) {
          return res.status(400).json({ error: "Mercado Pago nao configurado" });
        }

        const result = await getMercadoPagoOrderStatus(
          settings.mpAccessToken,
          orderId
        );
        res.json(result);
      } catch (error) {
        res.status(500).json({
          error:
            error instanceof Error ? error.message : "Erro ao consultar pagamento",
        });
      }
    }
  );

  app.post(
    "/api/payments/mercadopago/clear-queue",
    requireAuth,
    requirePermission("pos:sell"),
    async (req, res) => {
      try {
        const companyId = getCompanyId(req);
        if (!companyId)
          return res.status(401).json({ error: "Nao autenticado" });

        const { terminalId, providerReference } = mpClearQueueSchema.parse(
          req.body || {}
        );
        const settings = await storage.getCompanySettings(companyId);
        if (!settings?.mpAccessToken) {
          return res.status(400).json({ error: "Mercado Pago nao configurado" });
        }
        const terminalRef = String(terminalId || settings.mpTerminalId || "").trim();
        if (!terminalRef) {
          return res.status(400).json({ error: "Terminal nao configurado" });
        }

        const result = await clearMercadoPagoTerminalQueue(
          settings.mpAccessToken,
          terminalRef,
          providerReference
        );
        if (!result?.ok) {
          return res.status(409).json({
            error:
              "Nao foi possivel limpar a fila da maquininha automaticamente.",
            ...result,
          });
        }
        res.json(result);
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({ error: error.errors });
        }
        res.status(500).json({
          error:
            error instanceof Error
              ? error.message
              : "Falha ao liberar fila do terminal",
        });
      }
    }
  );

  app.post(
    "/api/payments/authorize",
    requireAuth,
    requirePermission("pos:sell"),
    async (req, res) => {
      try {
        const companyId = getCompanyId(req);
        if (!companyId)
          return res.status(401).json({ error: "Nao autenticado" });

        const { amount, method, posTerminalId } = paymentAuthorizeSchema.parse(
          req.body
        );
        const settings = await storage.getCompanySettings(companyId);
        let effectiveSettings = settings;

        if (posTerminalId) {
          const terminalAccess = await userCanAccessTerminal(
            req,
            companyId,
            posTerminalId
          );
          if (!terminalAccess.ok) {
            return res.status(terminalAccess.status).json({ error: terminalAccess.error });
          }
          const posTerminal = terminalAccess.terminal!;

          let linkedMachine: any = null;
          if (posTerminal.paymentMachineId) {
            const [machine] = await db
              .select()
              .from(paymentMachines)
              .where(
                and(
                  eq(paymentMachines.id, posTerminal.paymentMachineId),
                  eq(paymentMachines.companyId, companyId),
                  eq(paymentMachines.isActive, true)
                )
              )
              .limit(1);
            linkedMachine = machine || null;
          }

          effectiveSettings = {
            ...(settings || {}),
            mpTerminalId:
              linkedMachine?.mpTerminalId ||
              posTerminal.mpTerminalId ||
              settings?.mpTerminalId ||
              "",
            stoneTerminalId:
              linkedMachine?.stoneTerminalId ||
              posTerminal.stoneTerminalId ||
              settings?.stoneTerminalId ||
              "",
          } as any;

          const resolvedProvider =
            linkedMachine?.provider || posTerminal.paymentProvider || "company_default";

          if (resolvedProvider === "mercadopago") {
            (effectiveSettings as any).mpEnabled = true;
            (effectiveSettings as any).stoneEnabled = false;
          } else if (resolvedProvider === "stone") {
            (effectiveSettings as any).stoneEnabled = true;
            (effectiveSettings as any).mpEnabled = false;
          }
        }

        const result = await authorizePayment({
          amount,
          method,
          settings: effectiveSettings,
          description: `Venda PDV ${companyId}`,
        });
        res.json(result);
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({ error: error.errors });
        }
        if (error instanceof Error) {
          const msg = error.message.toLowerCase();
          if (msg.includes("nao configurado") || msg.includes("faltam credenciais") || msg.includes("habilitado")) {
            return res.status(400).json({ error: error.message });
          }
          if (msg.includes("already_queued_order_on_terminal") || msg.includes("queued order on the terminal")) {
            return res.status(409).json({
              error:
                "Ja existe uma cobranca pendente nesta maquininha. Finalize ou cancele no terminal antes de tentar novamente.",
            });
          }
          if (msg.includes("nao autorizado") || msg.includes("declined") || msg.includes("rejected")) {
            return res.status(402).json({ error: error.message });
          }
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
        const fiscalReadiness = await getFiscalReadiness(companyId);
        const certificateCheck = fiscalReadiness.checks.find(
          (check) => check.key === "certificate",
        );
        if (settings?.fiscalEnabled && certificateCheck && !certificateCheck.ok) {
          return res.status(403).json({
            error: certificateCheck.details || "Certificado fiscal invalido.",
            fiscalReadiness,
          });
        }
        const isFiscalConfigured = fiscalReadiness.ready;
        const isNfceAuto =
          Boolean(settings?.nfceEnabled) && isFiscalConfigured;

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
          nfceStatus: isNfceAuto ? "Pendente" : "Pendente Fiscal",
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
          fiscalReadiness,
        });
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({ error: error.errors });
        }
        res.status(500).json({ error: "Failed to create sale" });
      }
    }
  );

  app.get(
    "/api/fiscal/readiness",
    requireAuth,
    async (req, res) => {
      try {
        const companyId = getCompanyId(req);
        if (!companyId) {
          return res.status(401).json({ error: "Nao autenticado" });
        }
        const readiness = await getFiscalReadiness(companyId);
        res.json(readiness);
      } catch (error) {
        res.status(500).json({
          error:
            error instanceof Error
              ? error.message
              : "Falha ao carregar diagnostico fiscal",
        });
      }
    },
  );

  const updateNfceStatusSchema = z.object({
    status: z.string(),
    protocol: z.string().optional(),
    key: z.string().optional(),
    error: z.string().nullable().optional(),
    xmlContent: z.string().optional(),
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
        const { status, protocol, key, error, xmlContent } =
          updateNfceStatusSchema.parse(
          req.body
        );
        const sale = await storage.updateSaleNfceStatus(
          id,
          companyId,
          status,
          protocol,
          key,
          error ?? null
        );
        if (sale && status === "Autorizada" && xmlContent && key) {
          const authorizedAt = new Date();
          const expiresAt = new Date(
            authorizedAt.getTime() + 5 * 365 * 24 * 60 * 60 * 1000
          );
          await storage.saveFiscalXml({
            companyId,
            documentType: "NFCe",
            documentKey: key,
            xmlContent,
            authorizedAt,
            expiresAt,
          });
        }
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
        const company = await storage.getCompanyById(companyId);
        res.json({
          ...(settings || {}),
          address: company?.address || "",
          city: company?.city || "",
          state: company?.state || "",
          zipCode: company?.zipCode || "",
          cnae: (company as any)?.cnae || (settings as any)?.cnae || "",
          im: (company as any)?.im || (settings as any)?.im || "",
        });
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
      const {
        address,
        city,
        state,
        zipCode,
        cnae,
        im,
        ...rest
      } = req.body || {};
      const validated = insertCompanySettingsSchema.partial().parse(rest);
      const settings = await storage.updateCompanySettings(
        companyId,
        { ...validated, address, city, state, zipCode, cnae, im }
      );
      const company = await storage.getCompanyById(companyId);
      console.log(
        `Settings updated for company ${companyId}: ${JSON.stringify(settings)}`
      );
      res.json({
        ...(settings || {}),
        address: company?.address || "",
        city: company?.city || "",
        state: company?.state || "",
        zipCode: company?.zipCode || "",
        cnae: (company as any)?.cnae || (settings as any)?.cnae || "",
        im: (company as any)?.im || (settings as any)?.im || "",
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to update settings" });
    }
  });

  // ============================================
  // PAYMENT METHODS
  // ============================================
  const paymentMethodSchema = z.object({
    name: z.string().min(1),
    type: z.enum(["pix", "credito", "debito", "dinheiro", "outros"]),
    nfceCode: z.string().optional(),
    tefMethod: z.enum(["pix", "credito", "debito"]).optional(),
    isActive: z.boolean().optional(),
    sortOrder: z.number().int().optional(),
  });
  const referenceTableTypeSchema = z.enum([
    "classificacao_mercadologica",
    "infos_adicionais",
    "infos_complementares",
    "infos_nutricionais",
    "etiquetas",
  ]);
  const referenceTableSchema = z.object({
    name: z.string().min(1),
    code: z.string().optional(),
    description: z.string().optional(),
    isActive: z.boolean().optional(),
  });

  app.get(
    "/api/payment-methods",
    requireAuth,
    requirePermission("settings:payments"),
    async (req, res) => {
      try {
        const companyId = getCompanyId(req);
        if (!companyId) {
          return res.status(401).json({ error: "Nao autenticado" });
        }
        const methods = await storage.getPaymentMethods(companyId);
        res.json(methods);
      } catch (error) {
        res.status(500).json({ error: "Failed to fetch payment methods" });
      }
    }
  );

  app.post(
    "/api/payment-methods",
    requireAuth,
    requirePermission("settings:payments"),
    async (req, res) => {
      try {
        const companyId = getCompanyId(req);
        if (!companyId) {
          return res.status(401).json({ error: "Nao autenticado" });
        }
        const data = paymentMethodSchema.parse(req.body);
        const created = await storage.createPaymentMethod({
          companyId,
          name: data.name.trim(),
          type: data.type,
          nfceCode: data.nfceCode || null,
          tefMethod: data.tefMethod || null,
          isActive: data.isActive ?? true,
          sortOrder: data.sortOrder ?? 0,
        });
        res.status(201).json(created);
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({ error: error.errors });
        }
        res.status(500).json({ error: "Failed to create payment method" });
      }
    }
  );

  app.patch(
    "/api/payment-methods/:id",
    requireAuth,
    requirePermission("settings:payments"),
    async (req, res) => {
      try {
        const companyId = getCompanyId(req);
        if (!companyId) {
          return res.status(401).json({ error: "Nao autenticado" });
        }
        const id = parseInt(req.params.id);
        const data = paymentMethodSchema.partial().parse(req.body);
        const updated = await storage.updatePaymentMethod(id, companyId, {
          name: data.name?.trim(),
          type: data.type,
          nfceCode: data.nfceCode ?? undefined,
          tefMethod: data.tefMethod ?? undefined,
          isActive: data.isActive,
          sortOrder: data.sortOrder,
        });
        if (!updated) {
          return res.status(404).json({ error: "Payment method not found" });
        }
        res.json(updated);
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({ error: error.errors });
        }
        res.status(500).json({ error: "Failed to update payment method" });
      }
    }
  );

  app.delete(
    "/api/payment-methods/:id",
    requireAuth,
    requirePermission("settings:payments"),
    async (req, res) => {
      try {
        const companyId = getCompanyId(req);
        if (!companyId) {
          return res.status(401).json({ error: "Nao autenticado" });
        }
        const id = parseInt(req.params.id);
        const deleted = await storage.deletePaymentMethod(id, companyId);
        if (!deleted) {
          return res.status(404).json({ error: "Payment method not found" });
        }
        res.json({ success: true });
      } catch (error) {
        res.status(500).json({ error: "Failed to delete payment method" });
      }
    }
  );

  // ============================================
  // REFERENCE TABLES
  // ============================================
  app.get(
    "/api/reference-tables/:type",
    requireAuth,
    requirePermission("inventory:view", "settings:view"),
    async (req, res) => {
      try {
        const companyId = getCompanyId(req);
        if (!companyId) {
          return res.status(401).json({ error: "Nao autenticado" });
        }
        const type = referenceTableTypeSchema.parse(req.params.type);
        const rows = await db
          .select()
          .from(referenceTables)
          .where(
            and(
              eq(referenceTables.companyId, companyId),
              eq(referenceTables.type, type)
            )
          )
          .orderBy(referenceTables.name);
        res.json(rows);
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({ error: error.errors });
        }
        res.status(500).json({ error: "Falha ao carregar tabela" });
      }
    }
  );

  app.post(
    "/api/reference-tables/:type",
    requireAuth,
    requirePermission("inventory:manage", "settings:manage"),
    async (req, res) => {
      try {
        const companyId = getCompanyId(req);
        if (!companyId) {
          return res.status(401).json({ error: "Nao autenticado" });
        }
        const type = referenceTableTypeSchema.parse(req.params.type);
        const payload = referenceTableSchema.parse(req.body);
        const [created] = await db
          .insert(referenceTables)
          .values({
            companyId,
            type,
            code: payload.code?.trim() || null,
            name: payload.name.trim(),
            description: payload.description?.trim() || null,
            isActive: payload.isActive ?? true,
          })
          .returning();
        res.status(201).json(created);
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({ error: error.errors });
        }
        res.status(500).json({ error: "Falha ao cadastrar item" });
      }
    }
  );

  app.patch(
    "/api/reference-tables/:type/:id",
    requireAuth,
    requirePermission("inventory:manage", "settings:manage"),
    async (req, res) => {
      try {
        const companyId = getCompanyId(req);
        if (!companyId) {
          return res.status(401).json({ error: "Nao autenticado" });
        }
        const type = referenceTableTypeSchema.parse(req.params.type);
        const id = parseInt(req.params.id, 10);
        const payload = referenceTableSchema.partial().parse(req.body);
        const [updated] = await db
          .update(referenceTables)
          .set({
            ...(payload.code !== undefined
              ? { code: payload.code?.trim() || null }
              : {}),
            ...(payload.name !== undefined ? { name: payload.name.trim() } : {}),
            ...(payload.description !== undefined
              ? { description: payload.description?.trim() || null }
              : {}),
            ...(payload.isActive !== undefined
              ? { isActive: payload.isActive }
              : {}),
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(referenceTables.id, id),
              eq(referenceTables.companyId, companyId),
              eq(referenceTables.type, type)
            )
          )
          .returning();
        if (!updated) {
          return res.status(404).json({ error: "Item nao encontrado" });
        }
        res.json(updated);
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({ error: error.errors });
        }
        res.status(500).json({ error: "Falha ao atualizar item" });
      }
    }
  );

  app.delete(
    "/api/reference-tables/:type/:id",
    requireAuth,
    requirePermission("inventory:manage", "settings:manage"),
    async (req, res) => {
      try {
        const companyId = getCompanyId(req);
        if (!companyId) {
          return res.status(401).json({ error: "Nao autenticado" });
        }
        const type = referenceTableTypeSchema.parse(req.params.type);
        const id = parseInt(req.params.id, 10);
        const [deleted] = await db
          .delete(referenceTables)
          .where(
            and(
              eq(referenceTables.id, id),
              eq(referenceTables.companyId, companyId),
              eq(referenceTables.type, type)
            )
          )
          .returning();
        if (!deleted) {
          return res.status(404).json({ error: "Item nao encontrado" });
        }
        res.json({ success: true });
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({ error: error.errors });
        }
        res.status(500).json({ error: "Falha ao excluir item" });
      }
    }
  );

  // ============================================
  // PDV LOAD
  // ============================================
  app.post(
    "/api/pdv/load",
    requireAuth,
    requirePermission("settings:payments"),
    async (req, res) => {
      try {
        const companyId = getCompanyId(req);
        if (!companyId) {
          return res.status(401).json({ error: "Nao autenticado" });
        }

        const productsList = await storage.getAllProducts(companyId);
        const methods = await storage.getPaymentMethods(companyId);
        const applyPromoPrice = (product: any) => {
          const promoPrice = Number(product.promoPrice || 0);
          if (!Number.isFinite(promoPrice) || promoPrice <= 0) return product;
          return {
            ...product,
            regularPrice: product.regularPrice ?? product.price,
            price: product.promoPrice,
          };
        };

        const pdvProducts = productsList.map((product: any) =>
          applyPromoPrice(product)
        );
        const payload = {
          generatedAt: new Date().toISOString(),
          products: pdvProducts,
          paymentMethods: methods.filter((m) => m.isActive !== false),
        };
        const load = await storage.createPdvLoad({
          companyId,
          payload,
        });

        res.json({
          success: true,
          loadId: load.id,
          generatedAt: load.createdAt,
          products: pdvProducts.length,
          paymentMethods: payload.paymentMethods.length,
        });
      } catch (error) {
        res.status(500).json({ error: "Failed to generate PDV load" });
      }
    }
  );

  app.get(
    "/api/pdv/load",
    requireAuth,
    requirePermission("pos:view"),
    async (req, res) => {
      try {
        const companyId = getCompanyId(req);
        if (!companyId) {
          return res.status(401).json({ error: "Nao autenticado" });
        }
        const load = await storage.getLatestPdvLoad(companyId);
        if (!load) {
          return res.status(404).json({ error: "Nenhuma carga enviada" });
        }
        const currentProducts = await storage.getAllProducts(companyId);
        const regularPriceById = new Map<number, string>(
          currentProducts.map((p: any) => [Number(p.id), String(p.price || "0")])
        );
        const payload = (load.payload || {}) as any;
        const products = Array.isArray(payload.products) ? payload.products : [];
        const normalizedProducts = products.map((product: any) => {
          const promoPrice = Number(product?.promoPrice || 0);
          const productId = Number(product?.id || 0);
          const regularPriceFromCatalog =
            regularPriceById.get(productId) ||
            String(product?.regularPrice || product?.price || "0");
          if (!Number.isFinite(promoPrice) || promoPrice <= 0) {
            return {
              ...product,
              regularPrice: regularPriceFromCatalog,
              price: regularPriceFromCatalog,
            };
          }
          return {
            ...product,
            regularPrice: regularPriceFromCatalog,
            price: product.promoPrice,
          };
        });

        res.json({
          ...payload,
          products: normalizedProducts,
        });
      } catch (error) {
        res.status(500).json({ error: "Failed to fetch PDV load" });
      }
    }
  );

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
      const noteTotals = parseNFeHeaderTotals(xmlContent);

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
        const purchasePrice = Number(prod.purchasePrice || "0");
        const salePrice = Number(prod.price || "0");
        const marginPercent =
          purchasePrice > 0 && Math.abs(salePrice - purchasePrice) > 0.0001
            ? ((salePrice - purchasePrice) / purchasePrice) * 100
            : 30;
        const unitsPerPackage = 1;
        const stockQuantity = Math.max(
          0,
          Math.floor(prod.quantity * unitsPerPackage)
        );
        return {
          tempId: index,
          name: prod.name,
          ean: prod.ean,
          ncm: prod.ncm,
          unit: prod.unit,
          quantity: prod.quantity,
          unitsPerPackage,
          stockQuantity,
          price: prod.price,
          purchasePrice: prod.purchasePrice,
          marginPercent: Number.isFinite(marginPercent)
            ? Number(marginPercent.toFixed(2))
            : 30,
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
        noteTotals,
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
        cfop: z.string().optional(),
        cstIcms: z.string().optional(),
        cstIpi: z.string().optional(),
        cstPisCofins: z.string().optional(),
        csosnCode: z.string().optional(),
        origin: z.string().optional(),
        cest: z.string().optional(),
        serviceCode: z.string().optional(),
        icmsAliquot: z.number().optional(),
        icmsReduction: z.number().optional(),
        ipiAliquot: z.number().optional(),
        pisAliquot: z.number().optional(),
        cofinsAliquot: z.number().optional(),
        issAliquot: z.number().optional(),
        irrfAliquot: z.number().optional(),
        quantity: z.number(),
        unitsPerPackage: z.number().optional(),
        stockQuantity: z.number().optional(),
        price: z.union([z.string(), z.number()]).transform((v) => String(v)),
        purchasePrice: z
          .union([z.string(), z.number()])
          .transform((v) => String(v)),
        marginPercent: z.number().optional(),
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
        const unitsPerPackage = Number(prodData.unitsPerPackage || 1);
        const resolvedStockQuantity =
          typeof prodData.stockQuantity === "number"
            ? prodData.stockQuantity
            : prodData.quantity * unitsPerPackage;
        const quantityToStock = Math.max(
          0,
          Math.floor(
            Number.isFinite(resolvedStockQuantity) ? resolvedStockQuantity : 0
          )
        );
        if (prodData.isExisting && prodData.existingProductId) {
          await db.transaction(async (tx) => {
            await tx.execute(
              sql`select set_config('request.jwt.claims', ${JSON.stringify({ company_id: companyId })}, true)`,
            );

            await tx
              .update(products)
              .set({
                purchasePrice: prodData.purchasePrice,
                price: prodData.price,
                cstIcms: prodData.cstIcms ?? null,
                cstIpi: prodData.cstIpi ?? null,
                cstPisCofins: prodData.cstPisCofins ?? null,
                csosnCode: prodData.csosnCode ?? null,
                origin: prodData.origin ?? "nacional",
                cest: prodData.cest ?? null,
                serviceCode: prodData.serviceCode ?? null,
                icmsAliquot: Number(prodData.icmsAliquot ?? 0).toFixed(2),
                icmsReduction: Number(prodData.icmsReduction ?? 0).toFixed(2),
                ipiAliquot: Number(prodData.ipiAliquot ?? 0).toFixed(2),
                pisAliquot: Number(prodData.pisAliquot ?? 0).toFixed(2),
                cofinsAliquot: Number(prodData.cofinsAliquot ?? 0).toFixed(2),
                issAliquot: Number(prodData.issAliquot ?? 0).toFixed(2),
                irrfAliquot: Number(prodData.irrfAliquot ?? 0).toFixed(2),
                margin: Number(
                  Number.isFinite(prodData.marginPercent)
                    ? prodData.marginPercent
                    : 0
                ).toFixed(2),
                updatedAt: new Date(),
              })
              .where(
                and(
                  eq(products.id, prodData.existingProductId!),
                  eq(products.companyId, companyId)
                )
              );
          });
          await storage.updateProductStock(
            prodData.existingProductId,
            companyId,
            quantityToStock
          );
          await storage.createInventoryMovement({
            productId: prodData.existingProductId,
            companyId,
            type: "entrada",
            quantity: quantityToStock,
            reason: "Importação XML NFe",
            notes: null,
            referenceId: null,
            referenceType: null,
            variationId: null,
          });
          updatedProducts.push({
            id: prodData.existingProductId,
            name: prodData.name,
            quantityAdded: quantityToStock,
          });
        } else {
          const [newProduct] = await db.transaction(async (tx) => {
            await tx.execute(
              sql`select set_config('request.jwt.claims', ${JSON.stringify({ company_id: companyId })}, true)`,
            );

            return await tx
              .insert(products)
              .values({
                name: prodData.name,
                ean: prodData.ean,
                ncm: prodData.ncm,
                unit: prodData.unit,
                cstIcms: prodData.cstIcms ?? null,
                cstIpi: prodData.cstIpi ?? null,
                cstPisCofins: prodData.cstPisCofins ?? null,
                csosnCode: prodData.csosnCode ?? null,
                origin: prodData.origin ?? "nacional",
                cest: prodData.cest ?? null,
                serviceCode: prodData.serviceCode ?? null,
                category: "Importado",
                price: prodData.price,
                purchasePrice: prodData.purchasePrice,
                icmsAliquot: Number(prodData.icmsAliquot ?? 0).toFixed(2),
                icmsReduction: Number(prodData.icmsReduction ?? 0).toFixed(2),
                ipiAliquot: Number(prodData.ipiAliquot ?? 0).toFixed(2),
                pisAliquot: Number(prodData.pisAliquot ?? 0).toFixed(2),
                cofinsAliquot: Number(prodData.cofinsAliquot ?? 0).toFixed(2),
                issAliquot: Number(prodData.issAliquot ?? 0).toFixed(2),
                irrfAliquot: Number(prodData.irrfAliquot ?? 0).toFixed(2),
                margin: Number(
                  Number.isFinite(prodData.marginPercent)
                    ? prodData.marginPercent
                    : 0
                ).toFixed(2),
                stock: quantityToStock,
                isActive: true,
                companyId,
              })
              .returning();
          });

          if (quantityToStock > 0) {
            await storage.createInventoryMovement({
              productId: newProduct.id,
              companyId,
              type: "entrada",
              quantity: quantityToStock,
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

      const unreadOnly =
        String(req.query.unread || "").toLowerCase() === "true";

      const notificationsList = await storage.getAllNotifications(
        companyId,
        userId || undefined
      );

      const now = new Date();
      const upcomingLimit = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

      const [sales, payables, receivables] = await Promise.all([
        storage.getAllSales(companyId),
        storage.getAllPayables(companyId),
        storage.getAllReceivables(companyId),
      ]);
      const productsList = await storage.getAllProducts(companyId);

      const pendingFiscalSales = sales.filter((sale: any) => {
        const fiscalStatus = String(sale.nfceStatus || "").toLowerCase();
        const saleStatus = String(sale.status || "").toLowerCase();
        const isCanceled = saleStatus.includes("cancel");
        return !isCanceled && fiscalStatus !== "autorizada";
      });

      const payablesPending = payables.filter((item: any) => {
        const status = String(item.status || "").toLowerCase();
        return status !== "pago";
      });

      const receivablesPending = receivables.filter((item: any) => {
        const status = String(item.status || "").toLowerCase();
        return status !== "recebido";
      });

      const payablesOverdue = payablesPending.filter(
        (item: any) => new Date(item.dueDate) < now
      );
      const payablesUpcoming = payablesPending.filter((item: any) => {
        const due = new Date(item.dueDate);
        return due >= now && due <= upcomingLimit;
      });

      const receivablesOverdue = receivablesPending.filter(
        (item: any) => new Date(item.dueDate) < now
      );
      const receivablesUpcoming = receivablesPending.filter((item: any) => {
        const due = new Date(item.dueDate);
        return due >= now && due <= upcomingLimit;
      });

      const dynamicAlerts: any[] = [];
      const startOfDay = (date: Date) =>
        new Date(date.getFullYear(), date.getMonth(), date.getDate());
      const today = startOfDay(now);
      const alertThresholdDays = [10, 5, 3];

      const productsWithExpiration = productsList
        .filter((product: any) => Boolean(product.expirationDate))
        .map((product: any) => {
          const rawDate = String(product.expirationDate);
          const parsed = new Date(`${rawDate}T00:00:00`);
          return {
            product,
            expirationDate: startOfDay(parsed),
            validDate: !Number.isNaN(parsed.getTime()),
          };
        })
        .filter((item) => item.validDate);

      const expiredProducts = productsWithExpiration.filter(
        (item) => item.expirationDate < today
      );
      const toDayDiff = (target: Date) => {
        const diffMs = target.getTime() - today.getTime();
        return Math.round(diffMs / (24 * 60 * 60 * 1000));
      };

      const thresholdGroups = alertThresholdDays.map((days) => ({
        days,
        items: productsWithExpiration.filter(
          (item) => toDayDiff(item.expirationDate) === days
        ),
      }));

      if (pendingFiscalSales.length > 0) {
        dynamicAlerts.push({
          id: -1001,
          companyId,
          userId: userId || null,
          type: "fiscal_pending",
          title: "Notas fiscais pendentes",
          message: `${pendingFiscalSales.length} venda(s) com pendencia de emissao/autorizacao fiscal.`,
          referenceId: null,
          referenceType: "sales",
          isRead: false,
          createdAt: now,
        });
      }

      if (payablesOverdue.length > 0 || payablesUpcoming.length > 0) {
        dynamicAlerts.push({
          id: -1002,
          companyId,
          userId: userId || null,
          type: "payables_due",
          title: "Contas a pagar proximas do vencimento",
          message: `${payablesUpcoming.length} a vencer em ate 7 dias e ${payablesOverdue.length} em atraso.`,
          referenceId: null,
          referenceType: "payables",
          isRead: false,
          createdAt: now,
        });
      }

      if (receivablesOverdue.length > 0 || receivablesUpcoming.length > 0) {
        dynamicAlerts.push({
          id: -1003,
          companyId,
          userId: userId || null,
          type: "receivables_due",
          title: "Contas a receber proximas do vencimento",
          message: `${receivablesUpcoming.length} a vencer em ate 7 dias e ${receivablesOverdue.length} em atraso.`,
          referenceId: null,
          referenceType: "receivables",
          isRead: false,
          createdAt: now,
        });
      }

      if (
        expiredProducts.length > 0 ||
        thresholdGroups.some((group) => group.items.length > 0)
      ) {
        const nearMessages = thresholdGroups.flatMap((group) =>
          group.items.map(
            (item) =>
              `O produto ${item.product.name} (${item.product.id}) vence em ${group.days} dias.`
          )
        );

        const expiredMessages = expiredProducts.map((item) => {
          const daysExpired = Math.abs(toDayDiff(item.expirationDate));
          const dayText = daysExpired === 1 ? "dia" : "dias";
          return `O produto ${item.product.name} (${item.product.id}) venceu ha ${daysExpired} ${dayText}.`;
        });

        dynamicAlerts.push({
          id: -1004,
          companyId,
          userId: userId || null,
          type: "products_expiration",
          title: "Produtos com alerta de vencimento (10, 5 e 3 dias)",
          message: `${[...nearMessages, ...expiredMessages].join(" ")} Considere aplicar promocao para reduzir perdas.`,
          referenceId: null,
          referenceType: "products",
          isRead: false,
          createdAt: now,
        });
      }

      const mergedNotifications = [...dynamicAlerts, ...notificationsList]
        .filter((item: any) => (unreadOnly ? !item.isRead : true))
        .sort(
          (a: any, b: any) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );

      res.json(mergedNotifications);
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
    terminalId: z.number().int().positive().optional(),
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

        const { openingAmount, notes, terminalId } = openCashRegisterSchema.parse(
          req.body
        );

        if (terminalId) {
          const terminalAccess = await userCanAccessTerminal(
            req,
            companyId,
            terminalId
          );
          if (!terminalAccess.ok) {
            return res.status(terminalAccess.status).json({ error: terminalAccess.error });
          }
        }

        const user = await storage.getUser(userId);
        const userName = user?.name || "Operador";

        const register = await storage.openCashRegister({
          companyId,
          terminalId: terminalId || null,
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

  const buildNextPosTerminalCode = (existing: Array<{ code: string | null }>) => {
    const used = new Set(
      existing.map((t) => String(t.code || "").trim().toUpperCase()).filter(Boolean)
    );
    for (let i = 1; i <= 9999; i++) {
      const candidate = `CX${String(i).padStart(2, "0")}`;
      if (!used.has(candidate)) return candidate;
    }
    return `CX${Date.now().toString().slice(-4)}`;
  };

  const normalizePosTerminalCode = (value?: string | null) =>
    String(value || "")
      .trim()
      .toUpperCase();

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
    code: z.string().optional().nullable(),
    description: z.string().optional().nullable(),
    assignedUserId: z.string().optional().nullable(),
    paymentProvider: z
      .enum(["company_default", "mercadopago", "stone"])
      .optional()
      .nullable(),
    mpTerminalId: z.string().optional().nullable(),
    stoneTerminalId: z.string().optional().nullable(),
    isAutonomous: z.boolean().optional(),
    requiresSangria: z.boolean().optional(),
    requiresSuprimento: z.boolean().optional(),
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
        const normalizedCode = normalizePosTerminalCode(validated.code);
        const finalCode = normalizedCode
          ? normalizedCode
          : buildNextPosTerminalCode(await storage.getAllPosTerminals(companyId));
        const terminal = await storage.createPosTerminal({
          ...validated,
          code: finalCode,
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
        const nextData: any = { ...validated };
        if (Object.prototype.hasOwnProperty.call(validated, "code")) {
          const normalizedCode = normalizePosTerminalCode(validated.code);
          nextData.code = normalizedCode || null;
        }
        const terminal = await storage.updatePosTerminal(
          id,
          companyId,
          nextData
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
        cnae:
          Array.isArray(data.atividade_principal) &&
          data.atividade_principal[0]?.code
            ? String(data.atividade_principal[0].code).replace(/\D/g, "")
            : "",
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
  // Accessory Obligations (SPED / SINTEGRA)
  // ============================================
  app.post(
    "/api/fiscal/sped/generate",
    requireAuth,
    requirePermission("fiscal:sped"),
    async (req, res) => {
      try {
        const companyId = getCompanyId(req);
        if (!companyId)
          return res.status(401).json({ error: "Nao autenticado" });

        const { period, start, end } = parseAccessoryPeriod(req.body?.period);
        const allSales = await storage.getAllSales(companyId);
        const salesInPeriod = allSales.filter((sale: any) => {
          const saleDate = new Date(sale.createdAt);
          return saleDate >= start && saleDate <= end;
        });

        const generatedAt = new Date();
        const generated = generateAccessoryContent({
          type: "sped",
          companyId,
          period,
          generatedAt,
          sales: salesInPeriod,
        });

        const fileName = `SPED_FISCAL_${period.replace("-", "")}_EMP_${companyId}.txt`;

        await storage.createSefazTransmissionLog({
          companyId,
          action: "sped-generate",
          environment: "producao",
          requestPayload: {
            period,
            from: start.toISOString(),
            to: end.toISOString(),
          },
          responsePayload: {
            fileName,
            totalDocuments: generated.totalDocuments,
            totalValue: generated.totalValue,
            generatedAt: generatedAt.toISOString(),
          },
          success: true,
        });

        res.json({
          success: true,
          type: "SPED",
          period,
          fileName,
          generatedAt: generatedAt.toISOString(),
          totalDocuments: generated.totalDocuments,
          totalValue: generated.totalValue,
          content: generated.content,
        });
      } catch (error) {
        res.status(400).json({
          error: error instanceof Error ? error.message : "Falha ao gerar SPED",
        });
      }
    },
  );

  app.post(
    "/api/fiscal/sintegra/generate",
    requireAuth,
    requirePermission("fiscal:sintegra"),
    async (req, res) => {
      try {
        const companyId = getCompanyId(req);
        if (!companyId)
          return res.status(401).json({ error: "Nao autenticado" });

        const { period, start, end } = parseAccessoryPeriod(req.body?.period);
        const allSales = await storage.getAllSales(companyId);
        const salesInPeriod = allSales.filter((sale: any) => {
          const saleDate = new Date(sale.createdAt);
          return saleDate >= start && saleDate <= end;
        });

        const generatedAt = new Date();
        const generated = generateAccessoryContent({
          type: "sintegra",
          companyId,
          period,
          generatedAt,
          sales: salesInPeriod,
        });

        const fileName = `SINTEGRA_${period.replace("-", "")}_EMP_${companyId}.txt`;

        await storage.createSefazTransmissionLog({
          companyId,
          action: "sintegra-generate",
          environment: "producao",
          requestPayload: {
            period,
            from: start.toISOString(),
            to: end.toISOString(),
          },
          responsePayload: {
            fileName,
            totalDocuments: generated.totalDocuments,
            totalValue: generated.totalValue,
            generatedAt: generatedAt.toISOString(),
          },
          success: true,
        });

        res.json({
          success: true,
          type: "SINTEGRA",
          period,
          fileName,
          generatedAt: generatedAt.toISOString(),
          totalDocuments: generated.totalDocuments,
          totalValue: generated.totalValue,
          content: generated.content,
        });
      } catch (error) {
        res.status(400).json({
          error:
            error instanceof Error ? error.message : "Falha ao gerar Sintegra",
        });
      }
    },
  );

  app.post(
    "/api/fiscal/sped/deliver",
    requireAuth,
    requirePermission("fiscal:sped"),
    async (req, res) => {
      try {
        const companyId = getCompanyId(req);
        if (!companyId)
          return res.status(401).json({ error: "Nao autenticado" });

        const period = String(req.body?.period || "").trim();
        const fileName = String(req.body?.fileName || "").trim();
        const content = String(req.body?.content || "");
        const deliveryUrl = String(req.body?.deliveryUrl || "").trim();
        const deliveryToken = String(req.body?.deliveryToken || "").trim();
        const deliveryApiKey = String(req.body?.deliveryApiKey || "").trim();
        if (!period || !fileName) {
          return res
            .status(400)
            .json({ error: "Campos obrigatorios: period, fileName" });
        }

        let protocol = `SPED-${Date.now()}`;
        const deliveredAt = new Date();
        let providerStatus: number | null = null;
        let providerPayload: any = null;
        let mode: "local" | "provider_http" = "local";

        if (deliveryUrl) {
          if (!content) {
            return res.status(400).json({
              error: "Campo obrigatorio para entrega externa: content",
            });
          }
          const external = await pushAccessoryObligationToProvider({
            obligationType: "sped",
            companyId,
            period,
            fileName,
            content,
            deliveryUrl,
            deliveryToken: deliveryToken || undefined,
            deliveryApiKey: deliveryApiKey || undefined,
          });
          protocol = external.protocol || protocol;
          providerStatus = external.providerStatus;
          providerPayload = external.providerPayload || external.rawResponse;
          mode = "provider_http";
        }

        await storage.createSefazTransmissionLog({
          companyId,
          action: "sped-deliver",
          environment: "producao",
          requestPayload: {
            period,
            fileName,
            mode,
            deliveryUrl: deliveryUrl || null,
          },
          responsePayload: {
            protocol,
            deliveredAt: deliveredAt.toISOString(),
            receiptStatus: "received",
            providerStatus,
            providerPayload,
          },
          success: true,
        });

        res.json({
          success: true,
          type: "SPED",
          period,
          fileName,
          mode,
          protocol,
          deliveredAt: deliveredAt.toISOString(),
          receiptStatus: "received",
          providerStatus,
          providerPayload,
        });
      } catch (error) {
        res.status(400).json({
          error: error instanceof Error ? error.message : "Falha ao entregar SPED",
        });
      }
    },
  );

  app.post(
    "/api/fiscal/sintegra/deliver",
    requireAuth,
    requirePermission("fiscal:sintegra"),
    async (req, res) => {
      try {
        const companyId = getCompanyId(req);
        if (!companyId)
          return res.status(401).json({ error: "Nao autenticado" });

        const period = String(req.body?.period || "").trim();
        const fileName = String(req.body?.fileName || "").trim();
        const content = String(req.body?.content || "");
        const deliveryUrl = String(req.body?.deliveryUrl || "").trim();
        const deliveryToken = String(req.body?.deliveryToken || "").trim();
        const deliveryApiKey = String(req.body?.deliveryApiKey || "").trim();
        if (!period || !fileName) {
          return res
            .status(400)
            .json({ error: "Campos obrigatorios: period, fileName" });
        }

        let protocol = `SINTEGRA-${Date.now()}`;
        const deliveredAt = new Date();
        let providerStatus: number | null = null;
        let providerPayload: any = null;
        let mode: "local" | "provider_http" = "local";

        if (deliveryUrl) {
          if (!content) {
            return res.status(400).json({
              error: "Campo obrigatorio para entrega externa: content",
            });
          }
          const external = await pushAccessoryObligationToProvider({
            obligationType: "sintegra",
            companyId,
            period,
            fileName,
            content,
            deliveryUrl,
            deliveryToken: deliveryToken || undefined,
            deliveryApiKey: deliveryApiKey || undefined,
          });
          protocol = external.protocol || protocol;
          providerStatus = external.providerStatus;
          providerPayload = external.providerPayload || external.rawResponse;
          mode = "provider_http";
        }

        await storage.createSefazTransmissionLog({
          companyId,
          action: "sintegra-deliver",
          environment: "producao",
          requestPayload: {
            period,
            fileName,
            mode,
            deliveryUrl: deliveryUrl || null,
          },
          responsePayload: {
            protocol,
            deliveredAt: deliveredAt.toISOString(),
            receiptStatus: "received",
            providerStatus,
            providerPayload,
          },
          success: true,
        });

        res.json({
          success: true,
          type: "SINTEGRA",
          period,
          fileName,
          mode,
          protocol,
          deliveredAt: deliveredAt.toISOString(),
          receiptStatus: "received",
          providerStatus,
          providerPayload,
        });
      } catch (error) {
        res.status(400).json({
          error:
            error instanceof Error ? error.message : "Falha ao entregar Sintegra",
        });
      }
    },
  );

  app.get(
    "/api/fiscal/accountant/export",
    requireAuth,
    requirePermission("fiscal:view"),
    async (req, res) => {
      try {
        const companyId = getCompanyId(req);
        if (!companyId) {
          return res.status(401).json({ error: "Nao autenticado" });
        }

        const { period, start, end } = parseAccessoryPeriod(req.query.period as string);
        const formatParam = String(req.query.format || "json").toLowerCase();
        const format =
          formatParam === "csv" || formatParam === "zip" ? formatParam : "json";
        const [settings, allSales, allLogs] = await Promise.all([
          storage.getCompanySettings(companyId),
          storage.getAllSales(companyId),
          db
            .select()
            .from(sefazTransmissionLogs)
            .where(eq(sefazTransmissionLogs.companyId, companyId))
            .orderBy(desc(sefazTransmissionLogs.createdAt)),
        ]);

        const salesInPeriod = allSales.filter((sale: any) => {
          const saleDate = new Date(sale.createdAt);
          return saleDate >= start && saleDate <= end;
        });
        const saleIds = salesInPeriod.map((sale: any) => sale.id);
        const saleItemsMap = saleIds.length
          ? await storage.getSaleItemsBatch(saleIds)
          : new Map<number, any[]>();

        const logsInPeriod = allLogs.filter((log: any) => {
          const createdAt = new Date(log.createdAt);
          return createdAt >= start && createdAt <= end;
        });

        const accessoryLogs = logsInPeriod.filter((log: any) =>
          ["sped-generate", "sped-deliver", "sintegra-generate", "sintegra-deliver"].includes(
            String(log.action || ""),
          ),
        );
        const nfeLogs = logsInPeriod.filter((log: any) =>
          ["generate", "submit", "cancel", "cce", "inutilize"].includes(
            String(log.action || ""),
          ),
        );

        const payload = {
          exportType: "contador",
          version: 1,
          generatedAt: new Date().toISOString(),
          period,
          company: {
            companyId,
            cnpj: settings?.cnpj || null,
            razaoSocial: settings?.razaoSocial || null,
            nomeFantasia: settings?.nomeFantasia || null,
            ie: settings?.ie || null,
            regimeTributario: settings?.regimeTributario || null,
          },
          summary: {
            salesCount: salesInPeriod.length,
            salesTotal: Number(
              salesInPeriod
                .reduce(
                  (acc: number, sale: any) =>
                    acc + Number(String(sale.total || "0").replace(",", ".")),
                  0,
                )
                .toFixed(2),
            ),
            nfeEvents: nfeLogs.length,
            accessoryEvents: accessoryLogs.length,
          },
          sales: salesInPeriod.map((sale: any) => ({
            ...sale,
            items: saleItemsMap.get(sale.id) || [],
          })),
          fiscalEvents: {
            nfe: nfeLogs.map((log: any) => ({
              id: log.id,
              action: log.action,
              success: log.success,
              environment: log.environment,
              createdAt: log.createdAt,
              requestPayload: log.requestPayload,
              responsePayload: log.responsePayload,
            })),
            accessory: accessoryLogs.map((log: any) => ({
              id: log.id,
              action: log.action,
              success: log.success,
              environment: log.environment,
              createdAt: log.createdAt,
              requestPayload: log.requestPayload,
              responsePayload: log.responsePayload,
            })),
          },
        };

        const escapeCsv = (value: unknown) =>
          `"${String(value ?? "").replace(/"/g, '""')}"`;
        const csvUnifiedRows: string[] = [];
        const csvSummaryRows: string[] = [];
        const csvSalesRows: string[] = [];
        const csvSaleItemsRows: string[] = [];
        const csvFiscalEventsRows: string[] = [];

        const buildCsvFiles = () => {
          csvUnifiedRows.length = 0;
          csvSummaryRows.length = 0;
          csvSalesRows.length = 0;
          csvSaleItemsRows.length = 0;
          csvFiscalEventsRows.length = 0;

          csvUnifiedRows.push(
            [
              "recordType",
              "period",
              "saleId",
              "itemId",
              "eventId",
              "eventGroup",
              "action",
              "date",
              "customerName",
              "productName",
              "quantity",
              "unitPrice",
              "subtotal",
              "saleTotal",
              "status",
              "success",
              "documentKey",
              "protocol",
              "note",
            ]
              .map(escapeCsv)
              .join(";"),
          );
          csvSummaryRows.push(
            ["period", "generatedAt", "salesCount", "salesTotal", "nfeEvents", "accessoryEvents"]
              .map(escapeCsv)
              .join(";"),
          );
          csvSalesRows.push(
            [
              "saleId",
              "createdAt",
              "customerName",
              "saleTotal",
              "status",
              "nfceStatus",
              "nfceKey",
              "nfceProtocol",
            ]
              .map(escapeCsv)
              .join(";"),
          );
          csvSaleItemsRows.push(
            [
              "saleId",
              "itemId",
              "productId",
              "productName",
              "quantity",
              "unitPrice",
              "subtotal",
            ]
              .map(escapeCsv)
              .join(";"),
          );
          csvFiscalEventsRows.push(
            [
              "eventId",
              "group",
              "action",
              "createdAt",
              "success",
              "environment",
              "documentKey",
              "protocol",
              "fileName",
            ]
              .map(escapeCsv)
              .join(";"),
          );

          csvUnifiedRows.push(
            [
              "SUMMARY",
              period,
              "",
              "",
              "",
              "",
              "",
              payload.generatedAt,
              "",
              "",
              "",
              "",
              "",
              payload.summary.salesTotal,
              "",
              "",
              "",
              "",
              `sales=${payload.summary.salesCount};nfeEvents=${payload.summary.nfeEvents};accessoryEvents=${payload.summary.accessoryEvents}`,
            ]
              .map(escapeCsv)
              .join(";"),
          );
          csvSummaryRows.push(
            [
              period,
              payload.generatedAt,
              payload.summary.salesCount,
              payload.summary.salesTotal,
              payload.summary.nfeEvents,
              payload.summary.accessoryEvents,
            ]
              .map(escapeCsv)
              .join(";"),
          );

          for (const sale of payload.sales as any[]) {
            csvUnifiedRows.push(
              [
                "SALE",
                period,
                sale.id,
                "",
                "",
                "",
                "",
                sale.createdAt,
                sale.customerName,
                "",
                "",
                "",
                "",
                sale.total,
                sale.nfceStatus || sale.status || "",
                "",
                sale.nfceKey || "",
                sale.nfceProtocol || "",
                "",
                ]
                .map(escapeCsv)
                .join(";"),
            );
            csvSalesRows.push(
              [
                sale.id,
                sale.createdAt,
                sale.customerName,
                sale.total,
                sale.status || "",
                sale.nfceStatus || "",
                sale.nfceKey || "",
                sale.nfceProtocol || "",
              ]
                .map(escapeCsv)
                .join(";"),
            );
            for (const item of sale.items || []) {
              csvUnifiedRows.push(
                [
                  "SALE_ITEM",
                  period,
                  sale.id,
                  item.id || "",
                  "",
                  "",
                  "",
                  sale.createdAt,
                  sale.customerName,
                  item.productName || "",
                  item.quantity || "",
                  item.unitPrice || "",
                  item.subtotal || "",
                  sale.total,
                  "",
                  "",
                  "",
                  "",
                  `productId=${item.productId || ""}`,
                  ]
                  .map(escapeCsv)
                  .join(";"),
              );
              csvSaleItemsRows.push(
                [
                  sale.id,
                  item.id || "",
                  item.productId || "",
                  item.productName || "",
                  item.quantity || "",
                  item.unitPrice || "",
                  item.subtotal || "",
                ]
                  .map(escapeCsv)
                  .join(";"),
              );
            }
          }

          for (const event of payload.fiscalEvents.nfe as any[]) {
            csvUnifiedRows.push(
              [
                "FISCAL_EVENT",
                period,
                "",
                "",
                event.id,
                "nfe",
                event.action,
                event.createdAt,
                "",
                "",
                "",
                "",
                "",
                "",
                "",
                event.success ? "true" : "false",
                event.responsePayload?.key || "",
                event.responsePayload?.protocol || "",
                event.environment || "",
                ]
                .map(escapeCsv)
                .join(";"),
            );
            csvFiscalEventsRows.push(
              [
                event.id,
                "nfe",
                event.action,
                event.createdAt,
                event.success ? "true" : "false",
                event.environment || "",
                event.responsePayload?.key || "",
                event.responsePayload?.protocol || "",
                "",
              ]
                .map(escapeCsv)
                .join(";"),
            );
          }

          for (const event of payload.fiscalEvents.accessory as any[]) {
            csvUnifiedRows.push(
              [
                "FISCAL_EVENT",
                period,
                "",
                "",
                event.id,
                "accessory",
                event.action,
                event.createdAt,
                "",
                "",
                "",
                "",
                "",
                "",
                "",
                event.success ? "true" : "false",
                "",
                event.responsePayload?.protocol || "",
                event.responsePayload?.fileName || "",
                ]
                .map(escapeCsv)
                .join(";"),
            );
            csvFiscalEventsRows.push(
              [
                event.id,
                "accessory",
                event.action,
                event.createdAt,
                event.success ? "true" : "false",
                event.environment || "",
                "",
                event.responsePayload?.protocol || "",
                event.responsePayload?.fileName || "",
              ]
                .map(escapeCsv)
                .join(";"),
            );
          }
        };
        if (format === "csv" || format === "zip") buildCsvFiles();

        const fileName = `EXPORT_CONTADOR_${period.replace("-", "")}_EMP_${companyId}.${format}`;
        const content =
          format === "csv"
            ? csvUnifiedRows.join("\r\n")
            : JSON.stringify(payload, null, 2);

        await storage.createSefazTransmissionLog({
          companyId,
          action: "accountant-export",
          environment: "producao",
          requestPayload: { period, format },
          responsePayload: {
            fileName,
            salesCount: payload.summary.salesCount,
            salesTotal: payload.summary.salesTotal,
            nfeEvents: payload.summary.nfeEvents,
            accessoryEvents: payload.summary.accessoryEvents,
          },
          success: true,
        });

        res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
        if (format === "zip") {
          const zip = new JSZip();
          const folderName = `contador_${period.replace("-", "")}_emp_${companyId}`;
          const folder = zip.folder(folderName);
          folder?.file("export_contador.json", JSON.stringify(payload, null, 2));
          folder?.file("resumo.csv", csvSummaryRows.join("\r\n"));
          folder?.file("vendas.csv", csvSalesRows.join("\r\n"));
          folder?.file("itens_venda.csv", csvSaleItemsRows.join("\r\n"));
          folder?.file("eventos_fiscais.csv", csvFiscalEventsRows.join("\r\n"));
          folder?.file("exportacao_unificada.csv", csvUnifiedRows.join("\r\n"));
          const zipBuffer = await zip.generateAsync({
            type: "nodebuffer",
            compression: "DEFLATE",
            compressionOptions: { level: 6 },
          });
          res.setHeader("Content-Type", "application/zip");
          res.send(zipBuffer);
        } else if (format === "csv") {
          res.setHeader("Content-Type", "text/csv; charset=utf-8");
          res.send(content);
        } else {
          res.setHeader("Content-Type", "application/json; charset=utf-8");
          res.send(content);
        }
      } catch (error) {
        res.status(400).json({
          error:
            error instanceof Error
              ? error.message
              : "Falha ao exportar dados para contador",
        });
      }
    },
  );

  app.get(
    "/api/fiscal/accessory-obligations/history",
    requireAuth,
    requirePermission("fiscal:view", "fiscal:sped", "fiscal:sintegra"),
    async (req, res) => {
      try {
        const companyId = getCompanyId(req);
        if (!companyId)
          return res.status(401).json({ error: "Nao autenticado" });

        const type = String(req.query.type || "").trim().toLowerCase();
        const allowed = new Set([
          "sped-generate",
          "sped-deliver",
          "sintegra-generate",
          "sintegra-deliver",
        ]);

        const logs = await db
          .select()
          .from(sefazTransmissionLogs)
          .where(eq(sefazTransmissionLogs.companyId, companyId))
          .orderBy(desc(sefazTransmissionLogs.createdAt))
          .limit(300);

        const filtered = logs.filter((log) => {
          if (!allowed.has(log.action)) return false;
          if (!type) return true;
          return log.action.startsWith(type);
        });

        res.json(
          filtered.map((log) => ({
            id: log.id,
            action: log.action,
            success: Boolean(log.success),
            requestPayload: log.requestPayload,
            responsePayload: log.responsePayload,
            createdAt: log.createdAt,
          })),
        );
      } catch (error) {
        res.status(500).json({
          error:
            error instanceof Error
              ? error.message
              : "Falha ao carregar historico de obrigacoes acessorias",
        });
      }
    },
  );

  // Provedor receptor para obrigacoes acessorias (homologacao/producao)
  app.post("/api/fiscal/accessory-provider/receive", async (req, res) => {
    try {
      const auth = isAccessoryProviderAuthorized(req);
      if (!auth.allowed) {
        const code =
          resolveAccessoryProviderMode() === "prod" ? 503 : 401;
        return res.status(code).json({
          error: auth.reason,
          mode: resolveAccessoryProviderMode(),
          hasBearerConfig: auth.hasBearerConfig,
          hasApiKeyConfig: auth.hasApiKeyConfig,
        });
      }

      const obligationType = String(req.body?.obligationType || "")
        .trim()
        .toUpperCase();
      const companyId = Number(req.body?.companyId);
      const period = String(req.body?.period || "").trim();
      const fileName = String(req.body?.fileName || "").trim();
      const contentBase64 = String(req.body?.contentBase64 || "").trim();
      const confirmProduction = req.body?.confirmProduction === true;

      if (!["SPED", "SINTEGRA"].includes(obligationType)) {
        return res.status(400).json({
          error: "obligationType invalido. Use SPED ou SINTEGRA",
        });
      }
      if (!Number.isFinite(companyId) || companyId <= 0) {
        return res.status(400).json({ error: "companyId invalido" });
      }
      if (!/^\d{4}-\d{2}$/.test(period)) {
        return res.status(400).json({ error: "period invalido. Use YYYY-MM" });
      }
      if (!fileName) {
        return res.status(400).json({ error: "fileName obrigatorio" });
      }
      if (!contentBase64) {
        return res.status(400).json({ error: "contentBase64 obrigatorio" });
      }

      const providerMode = resolveAccessoryProviderMode();
      if (providerMode === "prod" && !confirmProduction) {
        return res.status(428).json({
          error:
            "Confirmacao obrigatoria para entrega em producao (confirmProduction=true)",
          mode: providerMode,
        });
      }

      const contentBuffer = Buffer.from(contentBase64, "base64");
      if (!contentBuffer.length) {
        return res.status(400).json({ error: "contentBase64 invalido" });
      }

      const hash = createHash("sha256").update(contentBuffer).digest("hex");
      const protocol = `${obligationType}-${Date.now()}`;
      const receivedAt = new Date();
      const environment = providerMode === "prod" ? "producao" : "homologacao";

      await storage.createSefazTransmissionLog({
        companyId,
        action: `accessory-provider-receive-${obligationType.toLowerCase()}`,
        environment,
        requestPayload: {
          obligationType,
          period,
          fileName,
          confirmProduction,
          byteLength: contentBuffer.length,
          sha256: hash,
        },
        responsePayload: {
          protocol,
          mode: providerMode,
          receivedAt: receivedAt.toISOString(),
          receiptStatus: "received",
        },
        success: true,
      });

      res.json({
        success: true,
        mode: providerMode,
        obligationType,
        protocol,
        receivedAt: receivedAt.toISOString(),
        receiptStatus: "received",
      });
    } catch (error) {
      res.status(500).json({
        error:
          error instanceof Error
            ? error.message
            : "Falha ao receber obrigacao acessoria",
      });
    }
  });

  app.get(
    "/api/fiscal/accessory-provider/status",
    requireAuth,
    requirePermission("fiscal:view"),
    async (_req, res) => {
      const mode = resolveAccessoryProviderMode();
      const hasBearerConfig = Boolean(
        String(process.env.ACCESSORY_PROVIDER_BEARER_TOKEN || "").trim(),
      );
      const hasApiKeyConfig = Boolean(
        String(process.env.ACCESSORY_PROVIDER_API_KEY || "").trim(),
      );

      res.json({
        mode,
        hasBearerConfig,
        hasApiKeyConfig,
        productionConfirmationRequired: mode === "prod",
      });
    },
  );

  app.get(
    "/api/fiscal/accessory-provider/audit",
    requireAuth,
    requirePermission("fiscal:view"),
    async (req, res) => {
      try {
        const companyId = getCompanyId(req);
        if (!companyId)
          return res.status(401).json({ error: "Nao autenticado" });

        const logs = await db
          .select()
          .from(sefazTransmissionLogs)
          .where(eq(sefazTransmissionLogs.companyId, companyId))
          .orderBy(desc(sefazTransmissionLogs.createdAt))
          .limit(300);

        const filtered = logs.filter((log) =>
          String(log.action).startsWith("accessory-provider-receive-"),
        );

        res.json(
          filtered.map((log) => ({
            id: log.id,
            action: log.action,
            environment: log.environment,
            success: Boolean(log.success),
            requestPayload: log.requestPayload,
            responsePayload: log.responsePayload,
            createdAt: log.createdAt,
          })),
        );
      } catch (error) {
        res.status(500).json({
          error:
            error instanceof Error
              ? error.message
              : "Falha ao carregar auditoria do provedor",
        });
      }
    },
  );

  app.get(
    "/api/fiscal-tax-rules",
    requireAuth,
    requirePermission("fiscal:view"),
    async (req, res) => {
      try {
        const companyId = getCompanyId(req);
        if (!companyId)
          return res.status(401).json({ error: "NÃ£o autenticado" });

        const rules = await storage.listFiscalTaxRules(companyId, {
          isActive:
            typeof req.query.isActive === "string"
              ? req.query.isActive === "true"
              : undefined,
          operationType: (req.query.operationType as string) || undefined,
          customerType: (req.query.customerType as string) || undefined,
          regime: (req.query.regime as string) || undefined,
          originUf: (req.query.originUf as string) || undefined,
          destinationUf: (req.query.destinationUf as string) || undefined,
          ncm: (req.query.ncm as string) || undefined,
          cest: (req.query.cest as string) || undefined,
          cfop: (req.query.cfop as string) || undefined,
        });
        res.json(rules);
      } catch (error) {
        console.error("Failed to fetch fiscal tax rules:", error);
        res.status(500).json({ error: "Failed to fetch fiscal tax rules" });
      }
    }
  );

  app.post(
    "/api/fiscal-tax-rules",
    requireAuth,
    requirePermission("fiscal:manage"),
    async (req, res) => {
      try {
        const companyId = getCompanyId(req);
        if (!companyId)
          return res.status(401).json({ error: "NÃ£o autenticado" });

        const validated = insertFiscalTaxRuleSchema.parse({
          ...req.body,
          companyId,
        });
        const created = await storage.createFiscalTaxRule(validated);
        res.status(201).json(created);
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({ error: error.errors });
        }
        console.error("Failed to create fiscal tax rule:", error);
        res.status(500).json({ error: "Failed to create fiscal tax rule" });
      }
    }
  );

  app.patch(
    "/api/fiscal-tax-rules/:id",
    requireAuth,
    requirePermission("fiscal:manage"),
    async (req, res) => {
      try {
        const companyId = getCompanyId(req);
        if (!companyId)
          return res.status(401).json({ error: "NÃ£o autenticado" });

        const id = parseInt(req.params.id, 10);
        if (isNaN(id)) {
          return res.status(400).json({ error: "ID invÃ¡lido" });
        }

        const validated = z.object({}).passthrough().parse(req.body) as any;
        const updated = await storage.updateFiscalTaxRule(id, companyId, validated);
        if (!updated) {
          return res.status(404).json({ error: "Regra fiscal nÃ£o encontrada" });
        }
        res.json(updated);
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({ error: error.errors });
        }
        console.error("Failed to update fiscal tax rule:", error);
        res.status(500).json({ error: "Failed to update fiscal tax rule" });
      }
    }
  );

  app.delete(
    "/api/fiscal-tax-rules/:id",
    requireAuth,
    requirePermission("fiscal:manage"),
    async (req, res) => {
      try {
        const companyId = getCompanyId(req);
        if (!companyId)
          return res.status(401).json({ error: "NÃ£o autenticado" });

        const id = parseInt(req.params.id, 10);
        if (isNaN(id)) {
          return res.status(400).json({ error: "ID invÃ¡lido" });
        }

        const deleted = await storage.deleteFiscalTaxRule(id, companyId);
        if (!deleted) {
          return res.status(404).json({ error: "Regra fiscal nÃ£o encontrada" });
        }
        res.json({ success: true });
      } catch (error) {
        console.error("Failed to delete fiscal tax rule:", error);
        res.status(500).json({ error: "Failed to delete fiscal tax rule" });
      }
    }
  );

  app.post(
    "/api/fiscal-tax-rules/resolve",
    requireAuth,
    requirePermission("fiscal:view"),
    async (req, res) => {
      try {
        const companyId = getCompanyId(req);
        if (!companyId)
          return res.status(401).json({ error: "NÃ£o autenticado" });

        const rule = await storage.resolveFiscalTaxRule(companyId, {
          operationType: req.body?.operationType,
          customerType: req.body?.customerType,
          regime: req.body?.regime,
          originUf: req.body?.originUf,
          destinationUf: req.body?.destinationUf,
          scope: req.body?.scope,
          ncm: req.body?.ncm,
          cest: req.body?.cest,
          cfop: req.body?.cfop,
        });
        res.json({ rule });
      } catch (error) {
        console.error("Failed to resolve fiscal tax rule:", error);
        res.status(500).json({ error: "Failed to resolve fiscal tax rule" });
      }
    }
  );

  app.get(
    "/api/simples-aliquots",
    requireAuth,
    requirePermission("fiscal:view"),
    async (req, res) => {
      try {
        const companyId = getCompanyId(req);
        if (!companyId)
          return res.status(401).json({ error: "NÇœo autenticado" });

        const aliquots = await storage.listSimplesNacionalAliquots(companyId);
        res.json(aliquots);
      } catch (error) {
        console.error("Failed to fetch Simples Nacional aliquots:", error);
        res.status(500).json({ error: "Failed to fetch Simples aliquots" });
      }
    }
  );

  app.post(
    "/api/simples-aliquots",
    requireAuth,
    requirePermission("fiscal:manage"),
    async (req, res) => {
      try {
        const companyId = getCompanyId(req);
        if (!companyId)
          return res.status(401).json({ error: "NÇœo autenticado" });

        const validated = insertSimplesNacionalAliquotSchema.parse({
          ...req.body,
          companyId,
        });
        const aliquot = await storage.createSimplesNacionalAliquot(validated);
        res.status(201).json(aliquot);
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({ error: error.errors });
        }
        console.error("Failed to create Simples Nacional aliquot:", error);
        res.status(500).json({ error: "Failed to create Simples aliquot" });
      }
    }
  );

  app.delete(
    "/api/simples-aliquots/:id",
    requireAuth,
    requirePermission("fiscal:manage"),
    async (req, res) => {
      try {
        const companyId = getCompanyId(req);
        if (!companyId)
          return res.status(401).json({ error: "NÇœo autenticado" });

        const id = parseInt(req.params.id, 10);
        if (isNaN(id)) {
          return res.status(400).json({ error: "ID invÇ­lido" });
        }

        const deleted = await storage.deleteSimplesNacionalAliquot(
          id,
          companyId
        );
        if (!deleted) {
          return res.status(404).json({ error: "AlÇðquota nÇœo encontrada" });
        }
        res.json({ success: true });
      } catch (error) {
        console.error("Failed to delete Simples Nacional aliquot:", error);
        res.status(500).json({ error: "Failed to delete Simples aliquot" });
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

  app.get(
    "/api/digital-certificate/debug",
    requireAuth,
    requirePermission("fiscal:manage"),
    async (req, res) => {
      try {
        const companyId = getCompanyId(req);
        if (!companyId)
          return res.status(401).json({ error: "NÃ£o autenticado" });

        const certBuffer = await certificateService.getCertificate(companyId);
        const certPassword =
          await certificateService.getCertificatePassword(companyId);
        if (!certBuffer || !certPassword) {
          return res.json({ installed: false });
        }

        const candidates =
          XMLSignatureService.extractCertificateCnpjCandidates(
            certBuffer.toString("base64"),
            certPassword
          );
        const info = XMLSignatureService.extractCertificateInfo(
          certBuffer.toString("base64"),
          certPassword
        );
        res.json({
          installed: true,
          cnpj: info.cnpj,
          subjectName: info.subjectName,
          issuer: info.issuer,
          candidates,
        });
      } catch (error) {
        console.error("Failed to debug certificate:", error);
        res.status(500).json({ error: "Failed to debug certificate" });
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

        const certInfo = XMLSignatureService.extractCertificateInfo(
          certificateData,
          certificatePassword
        );

        const certBuffer = Buffer.from(certificateData, "base64");
        const certCnpj = String(certInfo.cnpj || cnpj || "");
        const uploadResult = await certificateService.uploadCertificate(
          companyId,
          certBuffer,
          certificatePassword,
          certCnpj
        );
        if (!uploadResult.success) {
          throw new Error(uploadResult.message || "Erro ao salvar certificado");
        }
        await db.transaction(async (tx) => {
          await tx.execute(
            sql`select set_config('request.jwt.claims', ${JSON.stringify({ company_id: companyId })}, true)`,
          );

          await tx
            .update(digitalCertificates)
            .set({
              cnpj: certCnpj.replace(/\D/g, ""),
              certificateType: "e-CNPJ",
              subjectName: certInfo.subjectName,
              issuer: certInfo.issuer,
              validFrom: certInfo.validFrom,
              validUntil: certInfo.validUntil,
              isActive: true,
              updatedAt: new Date(),
            })
            .where(eq(digitalCertificates.companyId, companyId));
        });
        certificateService.clearCache(companyId);
        const cert = await storage.getDigitalCertificate(companyId);

        res.status(201).json({
          success: true,
          message: "Certificado digital salvo com sucesso",
          cnpj: cert?.cnpj || certCnpj,
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
        certificateService.clearCache(companyId);
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

        const settings = await storage.getCompanySettings(companyId);
        const defaultEnvironment =
          settings?.fiscalEnvironment === "producao"
            ? "producao"
            : "homologacao";

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
          environment: data.environment || defaultEnvironment,
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
