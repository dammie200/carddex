import { NextResponse } from "next/server";
import { searchCardsByName } from "@/lib/pokemontcg";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q") ?? "";
  try {
    const cards = await searchCardsByName(query);
    if (!cards.length) {
      return NextResponse.json({ error: "No cards found for that name." }, { status: 404 });
    }
    return NextResponse.json({ cards });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Failed" }, { status: 500 });
  }
}
