import { CardPriceData, CardSummary, FinishVariant, PriceVariant } from "@/types";

const API_BASE = "https://api.pokemontcg.io/v2";
const API_KEY = process.env.POKEMONTCG_API_KEY;

const SEARCH_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

const searchCache = new Map<string, { results: CardSummary[]; fetchedAt: number }>();
const cardCache = new Map<string, { card: CardSummary; fetchedAt: number }>();

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

async function fetchJson(url: string, opts: { allow404Empty?: boolean; timeoutMs?: number } = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), opts.timeoutMs ?? 7000);

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
      await new Promise((resolve) => setTimeout(resolve, 400 * (attempt + 1)));
    }
  }
  throw lastError;
}

function cacheKey(prefix: string, value: string) {
  return `${prefix}:${value.trim().toLowerCase()}`;
}

function readSearchCache(key: string) {
  const entry = searchCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.fetchedAt > SEARCH_CACHE_TTL_MS) {
    searchCache.delete(key);
    return null;
  }
  return entry.results;
}

function writeSearchCache(key: string, results: CardSummary[]) {
  searchCache.set(key, { results, fetchedAt: Date.now() });
}

function readCardCache(id: string) {
  const entry = cardCache.get(id);
  if (!entry) return null;
  if (Date.now() - entry.fetchedAt > SEARCH_CACHE_TTL_MS) {
    cardCache.delete(id);
    return null;
  }
  return entry.card;
}

function writeCardCache(card: CardSummary) {
  cardCache.set(card.id, { card, fetchedAt: Date.now() });
}

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

async function searchApi(q: string, pageSize = 50): Promise<CardSummary[]> {
  const url = `${API_BASE}/cards?q=${encodeURIComponent(q)}&select=${encodeURIComponent(selectFields)}&pageSize=${pageSize}`;
  const data = await fetchJsonWithRetry(url, { allow404Empty: true });
  const cards = data?.data ?? [];
  return cards.map((c: any) => mapCard(c, true));
}

export async function searchCardsByName(query: string): Promise<CardSummary[]> {
  const sanitized = query.trim();
  if (!sanitized) return [];
  const key = cacheKey("name", sanitized);
  const cached = readSearchCache(key);
  if (cached) return cached;

  const escaped = sanitized.replace(/"/g, "\\\"");
  const phraseQuery = `name:\"${escaped}\"`;
  const fallbackQuery = `name:${escaped}`;

  let results: CardSummary[] = [];
  try {
    results = await searchApi(phraseQuery);
    if (!results.length) {
      results = await searchApi(fallbackQuery);
    }
  } catch (err) {
    const cachedResults = readSearchCache(key);
    if (cachedResults) return cachedResults;
    throw err;
  }

  writeSearchCache(key, results);
  return results;
}

export async function searchCardsByNumberId(cardId: string): Promise<CardSummary[]> {
  const trimmed = cardId.trim();
  if (!trimmed) return [];
  const key = cacheKey("number", trimmed);
  const cached = readSearchCache(key);
  if (cached) return cached;

  const parts = trimmed.split("/").map((p) => p.trim()).filter(Boolean);
  const number = parts[0];
  const total = parts[1];

  const queries = [
    total ? `number:${number} set.printedTotal:${total}` : `number:${number}`,
    `number:\"${number}\"`,
  ];

  let results: CardSummary[] = [];
  for (const q of queries) {
    try {
      results = await searchApi(q);
      if (results.length) break;
    } catch (err) {
      // continue to next query
    }
  }

  if (!results.length) {
    const cachedResults = readSearchCache(key);
    if (cachedResults) return cachedResults;
    throw new Error("No cards found for that card ID.");
  }

  // Prefer exact printedTotal matches first when available
  if (total) {
    results.sort((a, b) => {
      const aExact = a.printedTotal && String(a.printedTotal) === total ? 1 : 0;
      const bExact = b.printedTotal && String(b.printedTotal) === total ? 1 : 0;
      return bExact - aExact;
    });
  }

  writeSearchCache(key, results);
  return results;
}

export async function getCardById(id: string): Promise<CardSummary | null> {
  if (!id) return null;
  const cached = readCardCache(id);
  if (cached) return cached;

  const url = `${API_BASE}/cards/${encodeURIComponent(id)}?select=${encodeURIComponent(selectFields)}`;
  const data = await fetchJsonWithRetry(url, { allow404Empty: true });
  const card = data?.data;
  if (!card) return null;

  const mapped = mapCard(card, true);
  writeCardCache(mapped);
  return mapped;
}
