import {
  ensureCardCatalog,
  findCardsByName,
  findCardsByNumber,
  findCardsBySeries,
  getCard,
} from "./cardStore";
import { CardPriceData, CardSummary } from "@/types";
import { prisma } from "./prisma";

const PRICE_CACHE_MAX_AGE_MS = 12 * 60 * 60 * 1000; // 12 hours

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

export async function searchCardsByName(query: string): Promise<CardSummary[]> {
  return findCardsByName(query);
}

export async function searchCardsByNumberId(cardId: string): Promise<CardSummary[]> {
  return findCardsByNumber(cardId);
}

export async function searchCardsBySeriesName(query: string): Promise<CardSummary[]> {
  return findCardsBySeries(query);
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

  // Instead of calling the PokémonTCG API (which can time out or 404), reuse any stored price data.
  // If no price exists yet, try to pull the card from the local catalog (seeded via sync:cards) to capture any
  // price info already available there.
  if (!existingPrice) {
    const localCard = await getCard(cardId);
    const priceFromCatalog = localCard?.price ?? null;
    if (priceFromCatalog) {
      await prisma.card.update({
        where: { id: cardId },
        data: { priceJson: JSON.stringify(priceFromCatalog) },
      });
      return priceFromCatalog;
    }
    return null;
  }

  // Update fetchedAt so the value is treated as fresh without any remote calls.
  const freshened: CardPriceData = { ...existingPrice, fetchedAt: new Date().toISOString() };
  await prisma.card.update({ where: { id: cardId }, data: { priceJson: JSON.stringify(freshened) } });
  return freshened;
}
