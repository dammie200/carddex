import { CardPriceData } from "@/types";

const rarityBase: Record<string, number> = {
  Common: 0.15,
  Uncommon: 0.35,
  Rare: 0.75,
  "Rare Holo": 2.0,
  "Rare Holo GX": 2.25,
  "Rare Ultra": 5.0,
  "Rare Secret": 8.5,
  "Rare Rainbow": 10.0,
};

function jitterFromSeed(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) % 100000;
  }
  return 0.85 + (hash % 30) / 100; // 0.85 - 1.14 range
}

export function generateDeterministicPrice(input: {
  id?: string | null;
  name?: string | null;
  rarity?: string | null;
}): CardPriceData {
  const base = rarityBase[input.rarity ?? ""] ?? 0.5;
  const seed = input.id || input.name || "card";
  const jitter = jitterFromSeed(seed);

  const normal = Number((base * jitter).toFixed(2));
  const holo = Number((normal * 1.25).toFixed(2));
  const reverse = Number((normal * 1.15).toFixed(2));

  const variants = [
    {
      finish: "Normal",
      marketPrice: normal,
      lowPrice: Number((normal * 0.85).toFixed(2)),
      midPrice: normal,
      highPrice: Number((normal * 1.35).toFixed(2)),
    },
    {
      finish: "Holo",
      marketPrice: holo,
      lowPrice: Number((holo * 0.85).toFixed(2)),
      midPrice: holo,
      highPrice: Number((holo * 1.35).toFixed(2)),
    },
    {
      finish: "Reverse Holo",
      marketPrice: reverse,
      lowPrice: Number((reverse * 0.85).toFixed(2)),
      midPrice: reverse,
      highPrice: Number((reverse * 1.35).toFixed(2)),
    },
  ];

  return {
    fetchedAt: new Date().toISOString(),
    variants,
    source: "deterministic-estimate",
  };
}
