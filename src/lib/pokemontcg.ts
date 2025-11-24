import { CardSummary } from "@/types";

const API_BASE = "https://api.pokemontcg.io/v2";
const API_KEY = process.env.POKEMONTCG_API_KEY;

function mapCard(card: any): CardSummary {
  return {
    id: card.id,
    name: card.name,
    setName: card.set?.name ?? "",
    setId: card.set?.id ?? "",
    setSeries: card.set?.series ?? null,
    printedTotal: card.set?.printedTotal ?? null,
    number: card.number,
    rarity: card.rarity ?? null,
    imageSmallUrl: card.images?.small ?? "",
    imageLargeUrl: card.images?.large ?? "",
    tcgplayerProductId: card.tcgplayer?.productId ?? null,
  };
}

async function fetchJson(url: string) {
  const res = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...(API_KEY ? { "X-Api-Key": API_KEY } : {}),
    },
    next: { revalidate: 60 },
  });
  if (!res.ok) {
    throw new Error(`PokémonTCG API error ${res.status}`);
  }
  return res.json();
}

export async function searchCardsByName(query: string): Promise<CardSummary[]> {
  if (!query) return [];
  const url = `${API_BASE}/cards?q=name:${encodeURIComponent(query)}`;
  const data = await fetchJson(url);
  return (data.data || []).map(mapCard);
}

export async function searchCardsByNumberId(cardId: string): Promise<CardSummary[]> {
  const trimmed = cardId.trim();
  if (!trimmed) return [];
  const parts = trimmed.split("/");
  const number = parts[0];
  const total = parts[1];
  const queryParts = [`number:${number}`];
  if (total) {
    queryParts.push(`set.printedTotal:${total}`);
  }
  const url = `${API_BASE}/cards?q=${encodeURIComponent(queryParts.join(" "))}`;
  const data = await fetchJson(url);
  return (data.data || []).map(mapCard);
}

export async function getCardById(id: string): Promise<CardSummary | null> {
  const url = `${API_BASE}/cards/${id}`;
  const data = await fetchJson(url);
  if (!data?.data) return null;
  return mapCard(data.data);
}
