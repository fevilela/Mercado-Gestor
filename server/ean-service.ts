import { z } from "zod";

const eanSchema = z
  .string()
  .regex(/^\d{8,14}$/, "EAN deve ter entre 8 e 14 digitos");

export interface ProductLookupResult {
  name: string;
  brand?: string;
  description?: string;
  thumbnail?: string;
  ncm?: string;
}

interface BrasilAPIResponse {
  gtin?: string;
  description?: string;
  brand?: {
    name?: string;
  };
  thumbnail?: string;
  ncm?: {
    code?: string;
  };
}

interface OpenFoodFactsResponse {
  status: number;
  product?: {
    product_name?: string;
    brands?: string;
    generic_name?: string;
    image_url?: string;
  };
}

async function fetchWithTimeout(
  url: string,
  timeout = 5000
): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
}

async function lookupBrasilAPI(
  ean: string
): Promise<ProductLookupResult | null> {
  try {
    const response = await fetchWithTimeout(
      `https://brasilapi.com.br/api/gtins/v1/${ean}`,
      5000
    );
    if (!response.ok) return null;

    const data: BrasilAPIResponse = await response.json();
    if (!data.description) return null;

    return {
      name: data.description,
      brand: data.brand?.name,
      thumbnail: data.thumbnail,
      ncm: data.ncm?.code,
    };
  } catch (error) {
    console.error("BrasilAPI lookup failed:", error);
    return null;
  }
}

async function lookupOpenFoodFacts(
  ean: string
): Promise<ProductLookupResult | null> {
  try {
    const response = await fetchWithTimeout(
      `https://world.openfoodfacts.org/api/v0/product/${ean}.json`,
      5000
    );
    if (!response.ok) return null;

    const data: OpenFoodFactsResponse = await response.json();
    if (data.status !== 1 || !data.product?.product_name) return null;

    return {
      name: data.product.product_name,
      brand: data.product.brands,
      description: data.product.generic_name,
      thumbnail: data.product.image_url,
    };
  } catch (error) {
    console.error("OpenFoodFacts lookup failed:", error);
    return null;
  }
}

async function lookupEANCode(ean: string): Promise<ProductLookupResult | null> {
  try {
    const response = await fetchWithTimeout(
      `https://eancode.eu/api/product/${ean}/`,
      5000
    );
    if (!response.ok) return null;

    const data: any = await response.json();
    if (!data.Name) return null;

    return {
      name: data.Name,
      brand: data.Brand,
      thumbnail: data.Image,
    };
  } catch (error) {
    console.error("EANCode lookup failed:", error);
    return null;
  }
}

export async function lookupEAN(
  ean: string
): Promise<ProductLookupResult | null> {
  const normalized = ean.replace(/\s+/g, "");
  const validation = eanSchema.safeParse(normalized);
  if (!validation.success) {
    return null;
  }

  let result = await lookupBrasilAPI(normalized);
  if (result) return result;

  result = await lookupOpenFoodFacts(normalized);
  if (result) return result;

  result = await lookupEANCode(normalized);
  if (result) return result;

  return null;
}
