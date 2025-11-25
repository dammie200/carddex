import { prisma } from "./prisma";
import { CardPriceData, CardSummary } from "@/types";
import { Card } from "@prisma/client";
import sampleCards from "../../data/sample-cards.json";
import { generateDeterministicPrice } from "./pricing";

type DbCard = Card & { priceJson: string | null };

function parsePrice(priceJson: string | null): CardPriceData | null {
  if (!priceJson) return null;
  try {
    const parsed = JSON.parse(priceJson);
    if (!parsed || typeof parsed !== "object") return null;
    return parsed as CardPriceData;
  } catch (e) {
    return null;
  }
}

async function ensurePrice(card: DbCard): Promise<DbCard> {
  const parsed = parsePrice(card.priceJson);
  if (parsed) return card;

  const generated = generateDeterministicPrice({
    id: card.id,
    name: card.name,
    rarity: card.rarity ?? undefined,
  });

  const priceJson = JSON.stringify(generated);
  await prisma.card.update({ where: { id: card.id }, data: { priceJson } });
  return { ...card, priceJson };
}

async function toCardSummary(card: DbCard): Promise<CardSummary> {
  const cardWithPrice = await ensurePrice(card);
  return {
    id: cardWithPrice.id,
    name: cardWithPrice.name,
    setId: cardWithPrice.setId,
    setName: cardWithPrice.setName,
    setSeries: cardWithPrice.setSeries,
    printedTotal: cardWithPrice.printedTotal,
    number: cardWithPrice.number,
    rarity: cardWithPrice.rarity,
    imageSmallUrl: cardWithPrice.imageSmallUrl,
    imageLargeUrl: cardWithPrice.imageLargeUrl,
    tcgplayerProductId: cardWithPrice.tcgplayerProductId,
    price: parsePrice(cardWithPrice.priceJson),
  };
}

function toDbCard(card: CardSummary) {
  return {
    id: card.id,
    name: card.name,
    setId: card.setId,
    setName: card.setName,
    setSeries: card.setSeries ?? null,
    printedTotal: card.printedTotal ?? null,
    number: card.number,
    rarity: card.rarity ?? null,
    imageSmallUrl: card.imageSmallUrl,
    imageLargeUrl: card.imageLargeUrl,
    tcgplayerProductId: card.tcgplayerProductId ?? null,
    priceJson: card.price ? JSON.stringify(card.price) : null,
  };
}

async function seedSampleCards() {
  const count = await prisma.card.count();
  if (count > 0) return;
  await prisma.card.createMany({ data: sampleCards.map((c) => toDbCard(c)), skipDuplicates: true });
}

export async function ensureCardCatalog() {
  await seedSampleCards();
}

export async function findCardsByName(query: string) {
  await ensureCardCatalog();
  if (!query.trim()) return [];
  const cards = await prisma.card.findMany({
    where: { name: { contains: query.trim() } },
    orderBy: [{ name: "asc" }],
    take: 50,
  });
  const withPrices = await Promise.all(cards.map((card) => toCardSummary(card as DbCard)));
  return withPrices;
}

export async function findCardsBySeries(query: string) {
  await ensureCardCatalog();
  if (!query.trim()) return [];
  const cards = await prisma.card.findMany({
    where: {
      OR: [
        { setSeries: { contains: query.trim() } },
        { setName: { contains: query.trim() } },
      ],
    },
    orderBy: [{ setSeries: "asc" }, { setName: "asc" }, { name: "asc" }],
    take: 50,
  });
  const withPrices = await Promise.all(cards.map((card) => toCardSummary(card as DbCard)));
  return withPrices;
}

export async function findCardsByNumber(rawId: string) {
  await ensureCardCatalog();
  const trimmed = rawId.trim();
  if (!trimmed) return [];
  const [numberPart, totalPart] = trimmed.split("/").map((p) => p.trim());
  const printedTotal = totalPart ? Number(totalPart) : undefined;

  const primaryMatches = await prisma.card.findMany({
    where: {
      number: numberPart ? { equals: numberPart } : undefined,
      ...(printedTotal ? { printedTotal } : {}),
    },
    orderBy: [{ name: "asc" }],
    take: 50,
  });

  if (primaryMatches.length) {
    return Promise.all(primaryMatches.map((card) => toCardSummary(card as DbCard)));
  }

  const fallbackMatches = await prisma.card.findMany({
    where: {
      number: { contains: numberPart },
    },
    orderBy: [{ name: "asc" }],
    take: 50,
  });
  return Promise.all(fallbackMatches.map((card) => toCardSummary(card as DbCard)));
}

export async function getCard(id: string) {
  await ensureCardCatalog();
  const card = await prisma.card.findUnique({ where: { id } });
  if (!card) return null;
  return toCardSummary(card as DbCard);
}

export function mapCardToDb(card: CardSummary) {
  return toDbCard(card);
}

export function mapDbCard(card: DbCard) {
  return toCardSummary(card);
}
