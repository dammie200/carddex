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

function serializeBinder(binder: any) {
  return {
    ...binder,
    slots: binder.slots.map((slot: any) => ({
      ...slot,
      collectionEntry: {
        ...slot.collectionEntry,
        price: parsePrice(slot.collectionEntry.card.priceJson),
        card: {
          ...slot.collectionEntry.card,
          priceJson: undefined,
        },
      },
    })),
  };
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string; slotId: string } }
) {
  const binderId = Number(params.id);
  const slotId = Number(params.slotId);
  await prisma.binderSlot.delete({ where: { id: slotId } });

  const binder = await prisma.binder.findUnique({
    where: { id: binderId },
    include: {
      slots: {
        include: { collectionEntry: { include: { card: true } } },
        orderBy: { position: "asc" },
      },
    },
  });

  return NextResponse.json({ binder: binder ? serializeBinder(binder) : null });
}
