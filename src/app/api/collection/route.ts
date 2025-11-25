import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { CardSummary, FinishVariant, CardCondition, CardPriceData } from "@/types";
import { mapCardToDb } from "@/lib/cardStore";

function mapFinishToDb(finish: FinishVariant) {
  return finish;
}

function mapConditionToDb(condition: CardCondition) {
  return condition;
}

export async function GET() {
  const entries = await prisma.collectionEntry.findMany({
    include: { card: true },
    orderBy: { createdAt: "desc" },
  });

  const mapped = entries.map((entry) => ({
    ...entry,
    price: (entry.card.priceJson as CardPriceData | null) ?? null,
  }));

  return NextResponse.json({ entries: mapped });
}

export async function POST(request: Request) {
  const body = await request.json();
  const card: CardSummary | undefined = body.card;
  if (!card) return NextResponse.json({ error: "Missing card" }, { status: 400 });
  const data = mapCardToDb(card);
  await prisma.card.upsert({
    where: { id: card.id },
    update: data,
    create: data,
  });
  const entry = await prisma.collectionEntry.create({
    data: {
      cardId: card.id,
      quantity: body.quantity ?? 1,
      condition: mapConditionToDb(body.condition ?? "Near Mint") as any,
      finish: mapFinishToDb(body.finish ?? "Normal") as any,
      language: body.language ?? "EN",
      purchasePrice: body.purchasePrice ?? null,
      notes: body.notes ?? null,
    },
  });
  return NextResponse.json({ entry });
}
