import { NextResponse } from "next/server";
import { searchCardsByNumberId } from "@/lib/pokemontcg";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id") ?? "";
  try {
    const cards = await searchCardsByNumberId(id);
    return NextResponse.json({ cards });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Failed" }, { status: 500 });
  }
}
