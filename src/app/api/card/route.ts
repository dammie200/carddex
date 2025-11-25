import { NextResponse } from "next/server";
import { getCardById } from "@/lib/pokemontcg";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }
  try {
    const card = await getCardById(id);
    if (!card) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ card, price: card.price ?? null });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Failed" }, { status: 500 });
  }
}
