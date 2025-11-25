#!/usr/bin/env node
/*
  Fetch the PokémonTCG catalog into the local SQLite database so the app can search instantly offline.
  Usage: npm run sync:cards
*/

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient({ log: ["warn", "error"] });

const GITHUB_CARDS_URL =
  "https://raw.githubusercontent.com/PokemonTCG/pokemon-tcg-data/master/cards/en.json";
const API_BASE = "https://api.pokemontcg.io/v2";
const API_KEY = process.env.POKEMONTCG_API_KEY;
const PAGE_SIZE = 250;
const MAX_PAGES = 200;

function addVariant(variants, finish, value) {
  if (!value.marketPrice && !value.lowPrice && !value.midPrice && !value.highPrice) return;
  const existing = variants.get(finish) || { finish };
  variants.set(finish, {
    finish,
    marketPrice: value.marketPrice ?? existing.marketPrice,
    lowPrice: value.lowPrice ?? existing.lowPrice,
    midPrice: value.midPrice ?? existing.midPrice,
    highPrice: value.highPrice ?? existing.highPrice,
  });
}

function mapPricesFromCard(card) {
  const variants = new Map();
  const tcgPrices = card.tcgplayer?.prices;
  if (tcgPrices) {
    const mappings = [
      ["normal", "Normal"],
      ["holofoil", "Holo"],
      ["reverseHolofoil", "Reverse Holo"],
      ["firstEditionHolofoil", "Holo"],
      ["unlimitedHolofoil", "Holo"],
      ["firstEdition", "Normal"],
    ];
    for (const [key, finish] of mappings) {
      const p = tcgPrices[key];
      if (!p) continue;
      addVariant(variants, finish, {
        marketPrice: p.market,
        lowPrice: p.low,
        midPrice: p.mid,
        highPrice: p.high,
      });
    }
  }

  const cardmarket = card.cardmarket?.prices;
  if (cardmarket) {
    addVariant(variants, "Normal", {
      marketPrice: cardmarket.trendPrice,
      lowPrice: cardmarket.lowPrice,
      midPrice: cardmarket.averageSellPrice,
    });
    addVariant(variants, "Reverse Holo", {
      marketPrice: cardmarket.reverseHoloTrend,
      lowPrice: cardmarket.reverseHoloLow,
      midPrice: cardmarket.reverseHoloSell,
    });
  }

  const list = Array.from(variants.values());
  if (!list.length) return null;
  return {
    productId: card.tcgplayer?.productId ?? undefined,
    fetchedAt: new Date().toISOString(),
    variants: list,
  };
}

function mapCard(card) {
  const price = mapPricesFromCard(card);
  return {
    id: card.id,
    name: card.name,
    setId: card.set?.id ?? "",
    setName: card.set?.name ?? "",
    setSeries: card.set?.series ?? null,
    printedTotal: card.set?.printedTotal ?? null,
    number: card.number,
    rarity: card.rarity ?? null,
    imageSmallUrl: card.images?.small ?? "",
    imageLargeUrl: card.images?.large ?? "",
    tcgplayerProductId: card.tcgplayer?.productId ?? null,
    priceJson: price ? JSON.stringify(price) : null,
  };
}

async function fetchFromGithub() {
  const res = await fetch(GITHUB_CARDS_URL, {
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) {
    throw new Error(`Github catalog fetch failed ${res.status}`);
  }
  return res.json();
}

async function fetchPage(page) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  const url = `${API_BASE}/cards?page=${page}&pageSize=${PAGE_SIZE}`;
  try {
    const res = await fetch(url, {
      headers: {
        "Content-Type": "application/json",
        ...(API_KEY ? { "X-Api-Key": API_KEY } : {}),
      },
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`PokémonTCG API error ${res.status}`);
    }
    return res.json();
  } finally {
    clearTimeout(timer);
  }
}

async function fetchCatalog() {
  try {
    console.log("Fetching catalog from GitHub dataset...");
    const data = await fetchFromGithub();
    if (Array.isArray(data) && data.length) {
      return data;
    }
    console.warn("GitHub dataset empty, falling back to API pages...");
  } catch (err) {
    console.warn("GitHub dataset fetch failed:", err.message);
  }

  console.log("Falling back to PokémonTCG paginated API...");
  const firstPage = await fetchPage(1);
  const totalCount = firstPage.totalCount ?? firstPage.data?.length ?? 0;
  const totalPages = Math.min(Math.ceil(totalCount / PAGE_SIZE), MAX_PAGES);
  let allCards = firstPage.data ?? [];

  for (let page = 2; page <= totalPages; page++) {
    console.log(`Fetching page ${page}/${totalPages}`);
    const pageData = await fetchPage(page);
    allCards = allCards.concat(pageData.data ?? []);
  }

  return allCards;
}

async function main() {
  console.log("Starting catalog sync...");
  const allCards = await fetchCatalog();

  console.log(`Fetched ${allCards.length} cards. Updating database...`);
  await prisma.$transaction(async (tx) => {
    await tx.card.deleteMany();
    const chunks = [];
    for (let i = 0; i < allCards.length; i += 250) {
      chunks.push(allCards.slice(i, i + 250));
    }
    for (const chunk of chunks) {
      await tx.card.createMany({ data: chunk.map(mapCard) });
    }
  });

  console.log("Sync complete. Close Prisma...");
  await prisma.$disconnect();
  console.log("Done. You can now search locally without waiting on the API.");
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
