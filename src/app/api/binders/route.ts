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

function serializeBinders(binders: any[]) {
  return binders.map((binder) => ({
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
  }));
}

export async function GET() {
  const binders = await prisma.binder.findMany({
    include: {
      slots: {
        include: { collectionEntry: { include: { card: true } } },
        orderBy: { position: "asc" },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ binders: serializeBinders(binders) });
}

export async function POST(request: Request) {
  const body = await request.json();
  const name = (body.name as string | undefined)?.trim();
  const layout = (body.layout as string | undefined)?.toLowerCase() === "list" ? "list" : "grid";
  const gridRows = body.gridRows ?? 3;
  const gridCols = body.gridCols ?? 3;
  const pages = body.pages ?? 1;

  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const binder = await prisma.binder.create({
    data: {
      name,
      layout,
      gridRows,
      gridCols,
      pages,
    },
    include: {
      slots: {
        include: { collectionEntry: { include: { card: true } } },
      },
    },
  });

  return NextResponse.json({ binder: serializeBinders([binder])[0] });
}
