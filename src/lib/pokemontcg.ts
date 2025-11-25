import { ensureCardCatalog, findCardsByName, findCardsByNumber, getCard, mapCardToDb } from "./cardStore";
import { CardPriceData, CardSummary, FinishVariant } from "@/types";
import { prisma } from "./prisma";

const POKEMONTCG_API = "https://api.pokemontcg.io/v2";
const API_KEY = process.env.POKEMONTCG_API_KEY;

async function fetchWithTimeout(url: string, init: RequestInit = {}, timeoutMs = 8000) {
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
  try {
    const json = await fetchWithTimeout(`${POKEMONTCG_API}/cards/${cardId}`);
    const card = json?.data;
    if (!card) return null;
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
    return mappedPrice;
  } catch (err) {
    console.error(`Failed to refresh price for ${cardId}:`, err);
    return null;
  }
}
