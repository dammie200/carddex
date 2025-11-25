import fs from "fs/promises";
import path from "path";

import { CardPriceData, CardSummary, FinishVariant, PriceVariant } from "@/types";

const API_BASE = "https://api.pokemontcg.io/v2";
const API_KEY = process.env.POKEMONTCG_API_KEY;
const DISK_CACHE_PATH = path.join(process.cwd(), ".next", "pokemontcg-catalog.json");

const CACHE_TTL_MS = 12 * 60 * 60 * 1000; // 12h cache for the full catalog
let catalogPromise: Promise<CardSummary[]> | null = null;
let catalogCache: { cards: CardSummary[]; fetchedAt: number } | null = null;

function addVariant(
  variants: Map<FinishVariant, PriceVariant>,
  finish: FinishVariant,
  value: Partial<PriceVariant>
) {
  if (!value.marketPrice && !value.lowPrice && !value.midPrice && !value.highPrice) return;
  const existing = variants.get(finish) ?? { finish };
  variants.set(finish, {
    finish,
    marketPrice: existing.marketPrice ?? value.marketPrice,
    lowPrice: existing.lowPrice ?? value.lowPrice,
    midPrice: existing.midPrice ?? value.midPrice,
    highPrice: existing.highPrice ?? value.highPrice,
  });
}

function mapPricesFromCard(card: any): CardPriceData | null {
  const variants = new Map<FinishVariant, PriceVariant>();

  const tcgPrices = card.tcgplayer?.prices;
  if (tcgPrices) {
    const mappings: [keyof typeof tcgPrices, FinishVariant][] = [
      ["normal", "Normal"],
      ["holofoil", "Holo"],
      ["reverseHolofoil", "Reverse Holo"],
      ["firstEditionHolofoil", "Holo"],
      ["unlimitedHolofoil", "Holo"],
      ["firstEdition", "Normal"],
    ];
    for (const [key, finish] of mappings) {
      const p = tcgPrices[key];
      if (!p) continue;
      addVariant(variants, finish, {
        marketPrice: p.market,
        lowPrice: p.low,
        midPrice: p.mid,
        highPrice: p.high,
      });
    }
  }

  const cardmarket = card.cardmarket?.prices;
  if (cardmarket) {
    addVariant(variants, "Normal", {
      marketPrice: cardmarket.trendPrice,
      lowPrice: cardmarket.lowPrice,
      midPrice: cardmarket.averageSellPrice,
    });
    addVariant(variants, "Reverse Holo", {
      marketPrice: cardmarket.reverseHoloTrend,
      lowPrice: cardmarket.reverseHoloLow,
      midPrice: cardmarket.reverseHoloSell,
    });
  }

  const variantList = Array.from(variants.values());
  if (!variantList.length) return null;

  return {
    productId: card.tcgplayer?.productId ?? undefined,
    fetchedAt: new Date().toISOString(),
    variants: variantList,
  };
}

function mapCard(card: any, includePrices = false): CardSummary {
  const base: CardSummary = {
    id: card.id,
    name: card.name,
    setName: card.set?.name ?? "",
    setId: card.set?.id ?? "",
    setSeries: card.set?.series ?? null,
    printedTotal: card.set?.printedTotal ?? null,
    number: card.number,
    rarity: card.rarity ?? null,
    imageSmallUrl: card.images?.small ?? "",
    imageLargeUrl: card.images?.large ?? "",
    tcgplayerProductId: card.tcgplayer?.productId ?? null,
  };

  if (!includePrices) return base;

  return {
    ...base,
    price: mapPricesFromCard(card),
  } as CardSummary;
}

async function fetchJson(
  url: string,
  opts: { allow404Empty?: boolean; timeoutMs?: number } = {}
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), opts.timeoutMs ?? 8000);

  try {
    const res = await fetch(url, {
      headers: {
        "Content-Type": "application/json",
        ...(API_KEY ? { "X-Api-Key": API_KEY } : {}),
      },
      cache: "no-store",
      signal: controller.signal,
    });

    if (res.status === 404 && opts.allow404Empty) {
      return { data: [] };
    }

    if (!res.ok) {
      throw new Error(`PokémonTCG API error ${res.status}`);
    }

    return res.json();
  } catch (err: any) {
    if (err?.name === "AbortError") {
      throw new Error("PokémonTCG API timeout");
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchJsonWithRetry(url: string, opts: { allow404Empty?: boolean; timeoutMs?: number } = {}, retries = 2) {
  let lastError: any;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fetchJson(url, opts);
    } catch (err) {
      lastError = err;
      if (attempt === retries) break;
      await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
    }
  }
  throw lastError;
}

async function readDiskCache(): Promise<{ cards: CardSummary[]; fetchedAt: number } | null> {
  try {
    const raw = await fs.readFile(DISK_CACHE_PATH, "utf8");
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed.cards) && typeof parsed.fetchedAt === "number") {
      return parsed as { cards: CardSummary[]; fetchedAt: number };
    }
  } catch (err) {
    // Ignore missing cache or JSON issues
  }
  return null;
}

async function writeDiskCache(cards: CardSummary[]) {
  try {
    await fs.mkdir(path.dirname(DISK_CACHE_PATH), { recursive: true });
    await fs.writeFile(DISK_CACHE_PATH, JSON.stringify({ cards, fetchedAt: Date.now() }), "utf8");
  } catch (err) {
    // Non-fatal if disk cache cannot be written
  }
}

async function fetchCatalog(): Promise<CardSummary[]> {
  const pageSize = 250;
  const selectFields = [
    "id",
    "name",
    "number",
    "rarity",
    "set.name",
    "set.id",
    "set.series",
    "set.printedTotal",
    "images.small",
    "images.large",
    "tcgplayer",
    "cardmarket",
  ].join(",");

  const results: CardSummary[] = [];
  let page = 1;

  while (true) {
    const url = `${API_BASE}/cards?page=${page}&pageSize=${pageSize}&select=${encodeURIComponent(selectFields)}`;
    const data = await fetchJsonWithRetry(url, { allow404Empty: true, timeoutMs: 7000 });
    const cards = data?.data ?? [];
    if (!cards.length) break;
    results.push(...cards.map((card: any) => mapCard(card, true)));
    if (cards.length < pageSize) break;
    page += 1;
  }

  return results;
}

async function loadCatalog(force = false): Promise<CardSummary[]> {
  const now = Date.now();
  if (!catalogCache) {
    const disk = await readDiskCache();
    if (disk) {
      catalogCache = disk;
    }
  }

  if (!force && catalogCache && now - catalogCache.fetchedAt < CACHE_TTL_MS) {
    return catalogCache.cards;
  }

  if (!force && catalogPromise) {
    return catalogPromise;
  }

  const promise = (async () => {
    try {
      const cards = await fetchCatalog();
      catalogCache = { cards, fetchedAt: Date.now() };
      await writeDiskCache(cards);
      return cards;
    } catch (err) {
      if (catalogCache) {
        return catalogCache.cards;
      }
      throw new Error("PokémonTCG catalog could not be fetched. Please retry in a moment.");
    }
  })();

  catalogPromise = promise;
  try {
    return await promise;
  } finally {
    catalogPromise = null;
  }
}

export async function searchCardsByName(query: string): Promise<CardSummary[]> {
  const sanitized = query.trim();
  if (!sanitized) return [];

  const catalog = await loadCatalog();
  const needle = sanitized.toLowerCase();
  const results = catalog.filter((card) => card.name.toLowerCase().includes(needle));
  return results.slice(0, 100);
}

export async function searchCardsByNumberId(cardId: string): Promise<CardSummary[]> {
  const trimmed = cardId.trim();
  if (!trimmed) return [];

  const catalog = await loadCatalog();
  const parts = trimmed.split("/").map((p) => p.trim()).filter(Boolean);
  const number = parts[0];
  const total = parts[1];

  let matches = catalog.filter((card) => card.number === number || card.number?.startsWith(number));
  if (total) {
    matches = matches.filter((card) => !card.printedTotal || String(card.printedTotal) === total);
  }

  // Prefer exact printedTotal matches first
  matches.sort((a, b) => {
    const aExact = total && a.printedTotal && String(a.printedTotal) === total ? 1 : 0;
    const bExact = total && b.printedTotal && String(b.printedTotal) === total ? 1 : 0;
    return bExact - aExact;
  });

  return matches.slice(0, 100);
}

export async function getCardById(id: string): Promise<CardSummary | null> {
  if (!id) return null;
  const catalog = await loadCatalog();
  const found = catalog.find((card) => card.id === id);
  return found ?? null;
}
