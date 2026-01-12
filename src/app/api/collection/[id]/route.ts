import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
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

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  const id = Number(params.id);
  const body = await request.json();
  const entry = await prisma.collectionEntry.update({
    where: { id },
    data: {
      quantity: body.quantity,
      condition: body.condition?.replace(" ", ""),
      finish: body.finish?.replace(" ", ""),
      language: body.language,
      purchasePrice: body.purchasePrice,
      notes: body.notes,
    },
    include: { card: true },
  });
  return NextResponse.json({ entry: { ...entry, price: parsePrice(entry.card.priceJson) } });
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const id = Number(params.id);
  await prisma.$transaction([
    prisma.binderSlot.deleteMany({ where: { collectionEntryId: id } }),
    prisma.collectionEntry.delete({ where: { id } }),
  ]);
  return NextResponse.json({ ok: true });
}
