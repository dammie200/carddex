import { NextResponse } from "next/server";
import { searchCardsByName } from "@/lib/pokemontcg";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q") ?? "";
  try {
    const cards = await searchCardsByName(query);
    return NextResponse.json({ cards });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Failed" }, { status: 500 });
  }
}
