import { PriceVariant, FinishVariant, CardPriceData } from "@/types";

const API_BASE = "https://api.tcgplayer.com";
const PUBLIC_KEY = process.env.TCGPLAYER_PUBLIC_KEY;
const PRIVATE_KEY = process.env.TCGPLAYER_PRIVATE_KEY;

let cachedToken: { access_token: string; expires_at: number } | null = null;

async function getToken(): Promise<string | null> {
  if (!PUBLIC_KEY || !PRIVATE_KEY) return null;
  const now = Date.now();
  if (cachedToken && cachedToken.expires_at > now + 60_000) {
    return cachedToken.access_token;
  }
  const res = await fetch(`${API_BASE}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: PUBLIC_KEY,
      client_secret: PRIVATE_KEY,
    }).toString(),
  });
  if (!res.ok) {
    console.error("Failed to get TCGPlayer token", await res.text());
    return null;
  }
  const data = await res.json();
  cachedToken = {
    access_token: data.access_token,
    expires_at: now + data.expires_in * 1000,
  };
  return cachedToken.access_token;
}

function mapFinish(key?: string): FinishVariant {
  const normalized = (key ?? "").toLowerCase();
  if (normalized.includes("reverse")) return "Reverse Holo";
  if (normalized.includes("holo")) return "Holo";
  if (normalized.includes("full")) return "Full Art";
  if (normalized.includes("gold")) return "Gold";
  if (normalized.includes("rainbow")) return "Rainbow";
  if (normalized.includes("trainer")) return "Trainer Gallery";
  return "Normal";
}

export async function fetchPrices(productId?: number | null): Promise<CardPriceData | null> {
  if (!productId) return null;
  const token = await getToken();
  if (!token) return null;
  const res = await fetch(`${API_BASE}/pricing/product/${productId}`, {
    headers: { Authorization: `Bearer ${token}` },
    next: { revalidate: 30 },
  });
  if (!res.ok) {
    console.error("Failed to fetch TCGPlayer pricing", res.status);
    return null;
  }
  const data = await res.json();
  const variants: PriceVariant[] = (data.results || []).map((item: any) => ({
    finish: mapFinish(item.subTypeName),
    marketPrice: item.marketPrice ?? undefined,
    lowPrice: item.lowPrice ?? undefined,
    midPrice: item.midPrice ?? undefined,
    highPrice: item.highPrice ?? undefined,
  }));
  return {
    productId,
    fetchedAt: new Date().toISOString(),
    variants,
  };
}
