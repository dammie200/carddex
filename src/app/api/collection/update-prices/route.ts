import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { refreshCardPrice } from "@/lib/pokemontcg";
import type { CardPriceData } from "@/types";

function parsePrice(priceJson: string | null): CardPriceData | null {
  if (!priceJson) return null;
  try {
    const parsed = JSON.parse(priceJson);
    if (!parsed || typeof parsed !== "object") return null;
    return parsed as CardPriceData;
  } catch {
    return null;
  }
}

export async function POST() {
  const cardIds = await prisma.collectionEntry.findMany({
    select: { cardId: true },
    distinct: ["cardId"],
  });

  let updated = 0;
  for (const { cardId } of cardIds) {
    const price = await refreshCardPrice(cardId);
    if (price) updated += 1;
  }

  const entries = await prisma.collectionEntry.findMany({
    include: { card: true },
    orderBy: { createdAt: "desc" },
  });

  const mapped = entries.map((entry) => ({
    ...entry,
    price: parsePrice(entry.card.priceJson),
  }));

  return NextResponse.json({ updated, entries: mapped });
}
