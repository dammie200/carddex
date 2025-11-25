#!/usr/bin/env node
/*
  Fetch the PokémonTCG catalog into the local SQLite database so the app can search instantly offline.
  Usage: npm run sync:cards
*/

const fs = require("fs");
const path = require("path");
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient({ log: ["warn", "error"] });

const GITHUB_CARDS_URL =
  "https://raw.githubusercontent.com/PokemonTCG/pokemon-tcg-data/master/cards/en.json";
const API_BASE = "https://api.pokemontcg.io/v2";
const API_KEY = process.env.POKEMONTCG_API_KEY;
const PAGE_SIZE = 250;
const MAX_PAGES = 200;

const SAMPLE_PATH = path.join(__dirname, "../data/sample-cards.json");

function loadLocalDataset() {
  try {
    // The pokemon-tcg-data package bundles the full catalog so we can seed without relying on network calls.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const cards = require("pokemon-tcg-data/json/cards/en.json");
    if (Array.isArray(cards) && cards.length) {
      console.log(`Loaded local pokemon-tcg-data package (${cards.length} cards).`);
      return cards;
    }
    throw new Error("pokemon-tcg-data returned no cards");
  } catch (err) {
    const message =
      err.code === "MODULE_NOT_FOUND"
        ? "pokemon-tcg-data is missing. Run `npm install` to download the full catalog dependency before syncing."
        : `Unable to read pokemon-tcg-data: ${err.message}`;
    throw new Error(message);
  }
}

function coalesce(...values) {
  for (const val of values) {
    if (val !== undefined && val !== null) return val;
  }
  return null;
}

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
  if (card.price) return card.price;

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

function generateFallbackPrice(card) {
  const rarityBase = {
    Common: 0.15,
    Uncommon: 0.35,
    Rare: 0.75,
    "Rare Holo": 2.0,
    "Rare Ultra": 5.0,
    "Rare Secret": 8.5,
    "Rare Rainbow": 10.0,
  };

  const base = rarityBase[card.rarity] ?? 0.5;
  let hash = 0;
  const seed = card.id || card.name || "card";
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) % 100000;
  }
  const jitter = 0.85 + (hash % 30) / 100; // 0.85 - 1.14 range

  const normal = Number((base * jitter).toFixed(2));
  const holo = Number((normal * 1.25).toFixed(2));
  const reverse = Number((normal * 1.15).toFixed(2));

  const variants = [
    { finish: "Normal", marketPrice: normal, lowPrice: Number((normal * 0.85).toFixed(2)), midPrice: normal, highPrice: Number((normal * 1.35).toFixed(2)) },
    { finish: "Holo", marketPrice: holo, lowPrice: Number((holo * 0.85).toFixed(2)), midPrice: holo, highPrice: Number((holo * 1.35).toFixed(2)) },
    { finish: "Reverse Holo", marketPrice: reverse, lowPrice: Number((reverse * 0.85).toFixed(2)), midPrice: reverse, highPrice: Number((reverse * 1.35).toFixed(2)) },
  ];

  return {
    productId: card.tcgplayer?.productId ?? undefined,
    fetchedAt: new Date().toISOString(),
    variants,
    source: "deterministic-estimate",
  };
}

function mapCard(card) {
  let price = null;
  if (card.priceJson) {
    try {
      price = typeof card.priceJson === "string" ? JSON.parse(card.priceJson) : card.priceJson;
    } catch (_) {
      price = null;
    }
  }
  if (!price) {
    price = mapPricesFromCard(card);
  }
  if (!price) {
    price = generateFallbackPrice(card);
  }
  const set = card.set ?? null;
  return {
    id: card.id,
    name: card.name,
    setId: coalesce(set?.id, card.setId, ""),
    setName: coalesce(set?.name, card.setName, ""),
    setSeries: coalesce(set?.series, card.setSeries, null),
    printedTotal: coalesce(set?.printedTotal, card.printedTotal, null),
    number: card.number,
    rarity: card.rarity ?? null,
    imageSmallUrl: coalesce(card.images?.small, card.imageSmallUrl, ""),
    imageLargeUrl: coalesce(card.images?.large, card.imageLargeUrl, ""),
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

async function fetchFromSample() {
  const contents = await fs.promises.readFile(SAMPLE_PATH, "utf8");
  const parsed = JSON.parse(contents);
  if (!Array.isArray(parsed) || !parsed.length) {
    throw new Error("Bundled sample dataset is empty");
  }
  console.warn(`Using bundled sample dataset (${parsed.length} cards).`);
  return parsed;
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
    return loadLocalDataset();
  } catch (err) {
    console.error(err.message);
    if (!process.env.ALLOW_SAMPLE_FALLBACK) {
      throw new Error(
        "Full catalog missing. Install dependencies to get pokemon-tcg-data or set ALLOW_SAMPLE_FALLBACK=1 to use the tiny sample dataset."
      );
    }
    console.warn("ALLOW_SAMPLE_FALLBACK enabled; continuing with limited sample data.");
  }

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
  try {
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
  } catch (err) {
    console.warn("API pagination failed:", err.message);
  }

  console.warn("All remote catalog sources failed. Falling back to bundled sample data.");
  return fetchFromSample();
}

async function main() {
  console.log("Starting catalog sync...");
  const allCards = await fetchCatalog();

  console.log(`Fetched ${allCards.length} cards. Updating database...`);
  const chunks = [];
  for (let i = 0; i < allCards.length; i += 250) {
    chunks.push(allCards.slice(i, i + 250));
  }

  for (const chunk of chunks) {
    await prisma.$transaction(async (tx) => {
      await Promise.all(
        chunk.map((card) =>
          tx.card.upsert({
            where: { id: card.id },
            update: mapCard(card),
            create: mapCard(card),
          })
        )
      );
    });
  }

  console.log("Sync complete. Close Prisma...");
  await prisma.$disconnect();
  console.log("Done. You can now search locally without waiting on the API.");
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
