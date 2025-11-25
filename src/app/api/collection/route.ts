import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { CardSummary, FinishVariant, CardCondition } from "@/types";
import { getCardById } from "@/lib/pokemontcg";

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

  const withPrices = await Promise.all(
    entries.map(async (entry) => {
      let remoteCard: CardSummary | null = null;
      try {
        remoteCard = await getCardById(entry.cardId);
      } catch (err) {
        console.error("Failed to fetch card price", err);
      }
      return {
        ...entry,
        price: remoteCard?.price ?? null,
      };
    })
  );

  return NextResponse.json({ entries: withPrices });
}

export async function POST(request: Request) {
  const body = await request.json();
  const card: CardSummary | undefined = body.card;
  if (!card) return NextResponse.json({ error: "Missing card" }, { status: 400 });
  const data = {
    id: card.id,
    name: card.name,
    setId: card.setId,
    setName: card.setName,
    setSeries: card.setSeries ?? undefined,
    printedTotal: card.printedTotal ?? undefined,
    number: card.number,
    rarity: card.rarity ?? undefined,
    imageSmallUrl: card.imageSmallUrl,
    imageLargeUrl: card.imageLargeUrl,
    tcgplayerProductId: card.tcgplayerProductId ?? undefined,
  };
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
