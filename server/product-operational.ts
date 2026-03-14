import type { Product, ProductOperationalConfig } from "@shared/schema";

export type SaleUnit = "UN" | "KG";

const roundQuantity = (value: number) =>
  Math.round((Number.isFinite(value) ? value : 0) * 1000) / 1000;

export const toNumber = (value: unknown, fallback: number = 0) => {
  const numeric =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value.replace(",", "."))
        : Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
};

export const normalizeProductOperationalConfig = (
  value: unknown
): ProductOperationalConfig => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const config = value as Record<string, unknown>;

  return {
    enabled: config.enabled === true,
    stockUnit: config.stockUnit === "KG" ? "KG" : "UN",
    saleMode:
      config.saleMode === "weight" || config.saleMode === "unit_or_weight"
        ? config.saleMode
        : "unit",
    averageUnitWeightKg:
      config.averageUnitWeightKg == null
        ? null
        : toNumber(config.averageUnitWeightKg, 0),
    carcassYieldPercent:
      config.carcassYieldPercent == null
        ? null
        : toNumber(config.carcassYieldPercent, 100),
    cookingYieldPercent:
      config.cookingYieldPercent == null
        ? null
        : toNumber(config.cookingYieldPercent, 100),
    purchaseStage:
      config.purchaseStage === "cooked" ? "cooked" : config.purchaseStage === "raw" ? "raw" : null,
    saleStage:
      config.saleStage === "cooked" ? "cooked" : config.saleStage === "raw" ? "raw" : null,
  };
};

export const resolveSaleUnitForProduct = (
  product: Pick<Product, "unit" | "operationalConfig">,
  requestedUnit?: string | null
): SaleUnit => {
  const config = normalizeProductOperationalConfig(product.operationalConfig);
  if (requestedUnit === "KG") return "KG";
  if (requestedUnit === "UN") return "UN";
  if (config.enabled && config.saleMode === "weight") return "KG";
  return "UN";
};

export const computeStockConsumption = (
  product: Pick<Product, "unit" | "operationalConfig">,
  saleQuantityInput: unknown,
  requestedUnit?: string | null
) => {
  const config = normalizeProductOperationalConfig(product.operationalConfig);
  const saleUnit = resolveSaleUnitForProduct(product, requestedUnit);
  const saleQuantity = Math.max(0, roundQuantity(toNumber(saleQuantityInput, 0)));

  if (!config.enabled || config.stockUnit !== "KG") {
    return {
      saleQuantity,
      saleUnit,
      stockQuantity: saleQuantity,
      stockUnit: saleUnit,
    };
  }

  const averageUnitWeightKg = Math.max(
    0,
    toNumber(config.averageUnitWeightKg, 0)
  );
  const soldWeightKg =
    saleUnit === "KG" ? saleQuantity : roundQuantity(saleQuantity * averageUnitWeightKg);

  const carcassYieldFactor = Math.max(
    0.0001,
    toNumber(config.carcassYieldPercent, 100) / 100
  );
  const cookingYieldFactor = Math.max(
    0.0001,
    toNumber(config.cookingYieldPercent, 100) / 100
  );
  const totalYieldFactor = roundQuantity(carcassYieldFactor * cookingYieldFactor);
  const stockQuantity = roundQuantity(soldWeightKg / Math.max(totalYieldFactor, 0.0001));

  return {
    saleQuantity,
    saleUnit,
    stockQuantity,
    stockUnit: "KG" as const,
  };
};
