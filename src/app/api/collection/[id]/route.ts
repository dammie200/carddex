import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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
  });
  return NextResponse.json({ entry });
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const id = Number(params.id);
  await prisma.collectionEntry.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
