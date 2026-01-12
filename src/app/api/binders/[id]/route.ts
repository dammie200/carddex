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

async function loadBinder(id: number) {
  const binder = await prisma.binder.findUnique({
    where: { id },
    include: {
      slots: {
        include: { collectionEntry: { include: { card: true } } },
        orderBy: { position: "asc" },
      },
    },
  });
  if (!binder) return null;
  return {
    ...binder,
    slots: binder.slots.map((slot) => ({
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

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  const body = await request.json();
  const name = (body.name as string | undefined)?.trim();
  const layout = (body.layout as string | undefined)?.toLowerCase() === "list" ? "list" : "grid";
  const gridRows = body.gridRows ?? 3;
  const gridCols = body.gridCols ?? 3;
  const pages = body.pages ?? 1;

  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  await prisma.binder.update({
    where: { id },
    data: { name, layout, gridRows, gridCols, pages },
  });

  if (layout === "grid") {
    const maxSlots = Math.max(1, Number(gridRows) * Number(gridCols));
    await prisma.binderSlot.deleteMany({
      where: {
        binderId: id,
        OR: [
          { page: { gt: Number(pages) } },
          { position: { gt: maxSlots - 1 } },
          { position: null },
        ],
      },
    });
  }

  const binder = await loadBinder(id);
  if (!binder) return NextResponse.json({ error: "Binder not found" }, { status: 404 });
  return NextResponse.json({ binder });
}
