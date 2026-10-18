import { OPEN_FOOD_FACTS_CONTACT } from "@/config";
import { productRepository } from "@/database/repositories";
import type { Nutrition, Product } from "@/types/models";
import { AppError } from "@/utils/errors";
import type { ProductService } from "./contracts";

const BASE_URL = "https://world.openfoodfacts.org";
const USER_AGENT = `NutriScan/1.0 (${OPEN_FOOD_FACTS_CONTACT})`;

type OffProduct = {
  code?: string;
  product_name?: string;
  brands?: string;
  quantity?: string;
  image_front_url?: string;
  serving_quantity?: number;
  ingredients_text?: string;
  allergens_tags?: string[];
  traces_tags?: string[];
  labels_tags?: string[];
  nova_group?: number;
  nutriments?: Record<string, number | undefined>;
};

function nutritionOf(raw: OffProduct): Nutrition {
  const n = raw.nutriments ?? {};
  return {
    energyKcal: n["energy-kcal_100g"],
    proteinG: n.proteins_100g,
    carbsG: n.carbohydrates_100g,
    sugarsG: n.sugars_100g,
    fatG: n.fat_100g,
    saturatedFatG: n["saturated-fat_100g"],
    fibreG: n.fiber_100g,
    sodiumMg: n.sodium_100g === undefined ? undefined : n.sodium_100g * 1000,
    saltG: n.salt_100g,
  };
}

function normalize(raw: OffProduct): Product {
  if (!raw.code || !raw.product_name) throw new AppError("MALFORMED_DATA");
  return {
    id: `off:${raw.code}`,
    barcode: raw.code,
    name: raw.product_name,
    brand: raw.brands,
    quantity: raw.quantity,
    imageUrl: raw.image_front_url,
    servingSizeG: raw.serving_quantity,
    nutritionPer100: nutritionOf(raw),
    ingredients: raw.ingredients_text,
    allergens: raw.allergens_tags?.map((item) => item.replace(/^..:/, "")) ?? [],
    traces: raw.traces_tags?.map((item) => item.replace(/^..:/, "")) ?? [],
    labels: raw.labels_tags?.map((item) => item.replace(/^..:/, "")) ?? [],
    novaGroup: [1, 2, 3, 4].includes(raw.nova_group ?? 0) ? raw.nova_group as 1 | 2 | 3 | 4 : undefined,
    source: "Open Food Facts",
    retrievedAt: new Date().toISOString(),
    origin: "api",
    verified: true,
  };
}

async function request(url: string, signal?: AbortSignal, attempt = 0): Promise<Response> {
  const timeout = new AbortController();
  const timer = setTimeout(() => timeout.abort(), 8000);
  const onAbort = () => timeout.abort();
  signal?.addEventListener("abort", onAbort);
  try {
    const response = await fetch(url, { headers: { "User-Agent": USER_AGENT }, signal: timeout.signal });
    if (response.status === 429) throw new AppError("RATE_LIMIT", undefined, true);
    if (response.status >= 500 && attempt < 2) {
      await new Promise((resolve) => setTimeout(resolve, 350 * 2 ** attempt + Math.random() * 200));
      return request(url, signal, attempt + 1);
    }
    return response;
  } catch (error) {
    if (signal?.aborted) throw error;
    if (attempt < 2) {
      await new Promise((resolve) => setTimeout(resolve, 350 * 2 ** attempt + Math.random() * 200));
      return request(url, signal, attempt + 1);
    }
    throw error instanceof AppError ? error : new AppError("OFFLINE", undefined, true);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onAbort);
  }
}

export class OpenFoodFactsProductService implements ProductService {
  async getByBarcode(barcode: string, signal?: AbortSignal): Promise<Product> {
    const cached = await productRepository.getByBarcode(barcode);
    if (cached && Date.now() - Date.parse(cached.retrievedAt) < 7 * 86400000) return cached;
    const response = await request(`${BASE_URL}/api/v2/product/${encodeURIComponent(barcode)}.json`, signal);
    if (response.status === 404) throw new AppError("NOT_FOUND");
    if (!response.ok) throw new AppError("PROVIDER_UNAVAILABLE", undefined, true);
    const json = await response.json() as { status?: number; product?: OffProduct };
    if (json.status !== 1 || !json.product) throw new AppError("NOT_FOUND");
    const product = normalize(json.product);
    await productRepository.save(product);
    await productRepository.recordScan(product.id);
    return product;
  }

  async search(query: string, signal?: AbortSignal): Promise<Product[]> {
    const response = await request(
      `${BASE_URL}/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=20`,
      signal,
    );
    if (!response.ok) throw new AppError("PROVIDER_UNAVAILABLE", undefined, true);
    const json = await response.json() as { products?: OffProduct[] };
    return (json.products ?? []).flatMap((item) => {
      try { return [normalize(item)]; } catch { return []; }
    });
  }
}

export const productService = new OpenFoodFactsProductService();
