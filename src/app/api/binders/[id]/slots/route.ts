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
  return serializeBinder(binder);
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const binderId = Number(params.id);
  const body = await request.json();
  const collectionEntryId = Number(body.collectionEntryId);
  if (!collectionEntryId) {
    return NextResponse.json({ error: "collectionEntryId is required" }, { status: 400 });
  }

  const binder = await prisma.binder.findUnique({
    where: { id: binderId },
    include: { slots: true },
  });

  if (!binder) return NextResponse.json({ error: "Binder not found" }, { status: 404 });

  const layout = binder.layout?.toLowerCase() === "list" ? "list" : "grid";

  if (layout === "grid") {
    const rows = binder.gridRows ?? 3;
    const cols = binder.gridCols ?? 3;
    const maxSlots = Math.max(1, rows * cols);
    const pages = binder.pages ?? 1;
    const page = Math.min(Math.max(1, Number(body.page) || 1), pages);
    let position: number | null = typeof body.position === "number" ? body.position : null;

    if (position === null) {
      const taken = new Set(
        binder.slots.filter((s) => s.page === page && s.position !== null && s.position !== undefined).map((s) => s.position!)
      );
      for (let i = 0; i < maxSlots; i += 1) {
        if (!taken.has(i)) {
          position = i;
          break;
        }
      }
    }

    if (position === null || position < 0 || position >= maxSlots) {
      return NextResponse.json({ error: "Invalid slot position" }, { status: 400 });
    }

    await prisma.$transaction([
      prisma.binderSlot.deleteMany({ where: { binderId, page, position } }),
      prisma.binderSlot.create({ data: { binderId, collectionEntryId, page, position } }),
    ]);
  } else {
    const nextPosition =
      binder.slots.length === 0
        ? 0
        : Math.max(...binder.slots.map((s) => (typeof s.position === "number" ? s.position : 0))) + 1;
    const position = typeof body.position === "number" ? body.position : nextPosition;
    await prisma.binderSlot.create({ data: { binderId, collectionEntryId, page: 1, position } });
  }

  const updated = await loadBinder(binderId);
  return NextResponse.json({ binder: updated });
}
