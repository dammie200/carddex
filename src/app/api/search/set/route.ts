import { NextResponse } from "next/server";
import { searchCardsBySetName } from "@/lib/pokemontcg";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q") ?? "";
  try {
    const cards = await searchCardsBySetName(query);
    if (!cards.length) {
      return NextResponse.json({ error: "No cards found for that set." }, { status: 404 });
    }
    return NextResponse.json({ cards });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Failed" }, { status: 500 });
  }
}
