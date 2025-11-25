import { prisma } from "./prisma";
import { CardPriceData, CardSummary } from "@/types";
import { Card, Prisma } from "@prisma/client";
import sampleCards from "../../data/sample-cards.json";

type DbCard = Card & { priceJson: Prisma.JsonValue | null };

function parsePrice(priceJson: Prisma.JsonValue | null): CardPriceData | null {
  if (!priceJson || typeof priceJson !== "object") return null;
  return priceJson as CardPriceData;
}

function toCardSummary(card: DbCard): CardSummary {
  return {
    id: card.id,
    name: card.name,
    setId: card.setId,
    setName: card.setName,
    setSeries: card.setSeries,
    printedTotal: card.printedTotal,
    number: card.number,
    rarity: card.rarity,
    imageSmallUrl: card.imageSmallUrl,
    imageLargeUrl: card.imageLargeUrl,
    tcgplayerProductId: card.tcgplayerProductId,
    price: parsePrice(card.priceJson),
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
    priceJson: card.price ?? null,
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
    where: { name: { contains: query.trim(), mode: "insensitive" } },
    orderBy: [{ name: "asc" }],
    take: 50,
  });
  return cards.map(toCardSummary);
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

  if (primaryMatches.length) return primaryMatches.map(toCardSummary);

  const fallbackMatches = await prisma.card.findMany({
    where: {
      number: { contains: numberPart, mode: "insensitive" },
    },
    orderBy: [{ name: "asc" }],
    take: 50,
  });
  return fallbackMatches.map(toCardSummary);
}

export async function getCard(id: string) {
  await ensureCardCatalog();
  const card = await prisma.card.findUnique({ where: { id } });
  return card ? toCardSummary(card) : null;
}

export function mapCardToDb(card: CardSummary) {
  return toDbCard(card);
}

export function mapDbCard(card: DbCard) {
  return toCardSummary(card);
}
