import {
  ensureCardCatalog,
  findCardsByName,
  findCardsByNumber,
  getCard,
  mapCardToDb,
} from "./cardStore";
import { CardPriceData, CardSummary, FinishVariant } from "@/types";
import { prisma } from "./prisma";

const POKEMONTCG_API = "https://api.pokemontcg.io/v2";
const API_KEY = process.env.POKEMONTCG_API_KEY;
const PRICE_CACHE_MAX_AGE_MS = 12 * 60 * 60 * 1000; // 12 hours

async function fetchWithTimeout(url: string, init: RequestInit = {}, timeoutMs = 10000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: {
        ...(init.headers ?? {}),
        ...(API_KEY ? { "X-Api-Key": API_KEY } : {}),
      },
      cache: "no-store",
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`PokémonTCG API error ${res.status}: ${text}`);
    }
    return res.json();
  } finally {
    clearTimeout(timer);
  }
}

function parseStoredPrice(priceJson: string | null): CardPriceData | null {
  if (!priceJson) return null;
  try {
    const parsed = JSON.parse(priceJson);
    if (!parsed || typeof parsed !== "object") return null;
    return parsed as CardPriceData;
  } catch (err) {
    return null;
  }
}

function priceIsFresh(price: CardPriceData | null) {
  if (!price?.fetchedAt) return false;
  const fetched = Date.parse(price.fetchedAt);
  if (Number.isNaN(fetched)) return false;
  return Date.now() - fetched < PRICE_CACHE_MAX_AGE_MS;
}

function mapPricesFromApi(card: any): CardPriceData | null {
  const variants: { finish: FinishVariant; marketPrice?: number; lowPrice?: number; midPrice?: number; highPrice?: number }[] = [];
  const prices = card?.tcgplayer?.prices ?? {};
  const finishMap: Record<string, FinishVariant> = {
    normal: "Normal",
    holofoil: "Holo",
    reverseHolofoil: "Reverse Holo",
    reverseHolo: "Reverse Holo",
    "reverse holo": "Reverse Holo",
    firstEditionHolofoil: "Holo",
    firstEdition: "Normal",
  };

  for (const [key, value] of Object.entries(prices)) {
    const finish = finishMap[key] ?? "Other";
    if (!value || typeof value !== "object") continue;
    variants.push({
      finish,
      marketPrice: (value as any).market,
      lowPrice: (value as any).low,
      midPrice: (value as any).mid,
      highPrice: (value as any).high,
    });
  }

  if (!variants.length) {
    const cm = card?.cardmarket?.prices;
    if (cm) {
      variants.push({
        finish: "Normal",
        marketPrice: cm.averageSellPrice ?? cm.trendPrice,
        lowPrice: cm.lowPrice,
        midPrice: cm.avg1 ?? cm.avg7,
        highPrice: cm.avg30,
      });
    }
  }

  if (!variants.length) return null;

  return {
    productId: card?.tcgplayer?.productId,
    fetchedAt: new Date().toISOString(),
    variants,
  };
}

export async function searchCardsByName(query: string): Promise<CardSummary[]> {
  return findCardsByName(query);
}

export async function searchCardsByNumberId(cardId: string): Promise<CardSummary[]> {
  return findCardsByNumber(cardId);
}

export async function getCardById(id: string): Promise<CardSummary | null> {
  return getCard(id);
}

export async function ensureCatalogSeeded() {
  await ensureCardCatalog();
}

export async function refreshCardPrice(cardId: string): Promise<CardPriceData | null> {
  const existing = await prisma.card.findUnique({ where: { id: cardId }, select: { priceJson: true } });
  const existingPrice = parseStoredPrice(existing?.priceJson ?? null);
  if (priceIsFresh(existingPrice)) {
    return existingPrice;
  }

  let lastError: unknown;
  const timeouts = [10000, 14000];
  for (const timeout of timeouts) {
    try {
      const json = await fetchWithTimeout(`${POKEMONTCG_API}/cards/${cardId}`, {}, timeout);
      const card = json?.data;
      if (!card) return existingPrice ?? null;
      const mappedPrice = mapPricesFromApi(card);
      if (mappedPrice) {
        const { id: _ignoredId, priceJson: _ignoredPrice, ...rest } = mapCardToDb({
          id: card.id,
          name: card.name,
          setId: card.set.id,
          setName: card.set.name,
          setSeries: card.set.series,
          printedTotal: card.set.printedTotal,
          number: card.number,
          rarity: card.rarity,
          imageSmallUrl: card.images?.small,
          imageLargeUrl: card.images?.large,
          tcgplayerProductId: card?.tcgplayer?.productId,
          price: mappedPrice,
        });
        await prisma.card.update({
          where: { id: cardId },
          data: { priceJson: JSON.stringify(mappedPrice), ...rest },
        });
      }
      return mappedPrice ?? existingPrice ?? null;
    } catch (err) {
      lastError = err;
    }
  }

  if (existingPrice) {
    console.warn(`Using stored price for ${cardId} after refresh error:`, lastError instanceof Error ? lastError.message : lastError);
    return existingPrice;
  }

  console.error(`Failed to refresh price for ${cardId}:`, lastError);
  return null;
}
