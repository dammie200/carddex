import { CardPriceData, CardSummary, FinishVariant, PriceVariant } from "@/types";

const API_BASE = "https://api.pokemontcg.io/v2";
const API_KEY = process.env.POKEMONTCG_API_KEY;

const cardCache = new Map<string, { card: CardSummary; fetchedAt: number }>();
const nameSearchCache = new Map<string, { results: CardSummary[]; fetchedAt: number }>();
const numberSearchCache = new Map<string, { results: CardSummary[]; fetchedAt: number }>();
const CACHE_TTL_MS = 10 * 60 * 1000;

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

export async function searchCardsByName(query: string): Promise<CardSummary[]> {
  if (!query) return [];
  const sanitized = query.trim();
  if (!sanitized) return [];

  const cached = nameSearchCache.get(sanitized);
  const isFresh = cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS;

  const exactUrl = `${API_BASE}/cards?q=${encodeURIComponent(`name:"${sanitized}"`)}`;
  try {
    let data = await fetchJson(exactUrl, { allow404Empty: true });

    if (!data.data?.length) {
      const fallbackUrl = `${API_BASE}/cards?q=${encodeURIComponent(`name:${sanitized}`)}`;
      data = await fetchJson(fallbackUrl, { allow404Empty: true });
    }

    const results = (data.data || []).map((card: any) => mapCard(card));
    nameSearchCache.set(sanitized, { results, fetchedAt: Date.now() });
    return results;
  } catch (error) {
    if (isFresh && cached) {
      return cached.results;
    }
    throw error;
  }
}

export async function searchCardsByNumberId(cardId: string): Promise<CardSummary[]> {
  const trimmed = cardId.trim();
  if (!trimmed) return [];
  const cached = numberSearchCache.get(trimmed);
  const isFresh = cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS;
  const parts = trimmed.split("/");
  const number = parts[0];
  const total = parts[1];
  const queryParts = [`number:${number}`];
  if (total) {
    queryParts.push(`set.printedTotal:${total}`);
  }
  const url = `${API_BASE}/cards?q=${encodeURIComponent(queryParts.join(" "))}`;

  try {
    let data = await fetchJson(url, { allow404Empty: true });
    if ((!data.data || data.data.length === 0) && total) {
      const fallbackUrl = `${API_BASE}/cards?q=${encodeURIComponent(`number:${number}`)}`;
      data = await fetchJson(fallbackUrl, { allow404Empty: true });
    }

    const results = (data.data || []).map((card: any) => mapCard(card));
    numberSearchCache.set(trimmed, { results, fetchedAt: Date.now() });
    return results;
  } catch (error) {
    if (isFresh && cached) {
      return cached.results;
    }
    throw error;
  }
}

export async function getCardById(id: string): Promise<CardSummary | null> {
  const cached = cardCache.get(id);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.card;
  }

  const url = `${API_BASE}/cards/${id}`;
  try {
    const data = await fetchJson(url, { allow404Empty: true });
    if (!data?.data) return cached?.card ?? null;
    const mapped = mapCard(data.data, true);
    cardCache.set(id, { card: mapped, fetchedAt: Date.now() });
    return mapped;
  } catch (error) {
    if (cached) {
      return cached.card;
    }
    if (error instanceof Error) {
      if (error.message.includes("404")) return null;
      // If the upstream API is flaky, return null so the UI can still render existing data.
      if (error.message.includes("timeout") || error.message.includes("504")) {
        return null;
      }
    }
    return null;
  }
}
