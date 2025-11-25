# CardDex

CardDex is a lightweight Next.js app for tracking your physical Pokémon TCG collection with quick ID search, variant-aware pricing, and a local SQLite database. Searches now run entirely against your local catalog for reliability; you can refresh that catalog with a one-time sync script.

## Getting started

1. Install dependencies (requires access to npm registry):

```bash
npm install
```

2. Create an `.env.local` (optional) if you want to use a PokémonTCG.io API key when syncing:

```
POKEMONTCG_API_KEY=your_pokemontcg_api_key
```

3. Initialize the SQLite schema and populate cards:

```bash
npm run prisma:migrate   # apply the checked-in migration to dev.db
npm run prisma:generate  # optional; dev server will also generate the client when needed
npm run sync:cards       # pulls the public PokémonTCG catalog (or a bundled sample) into SQLite for fast local searches
```

The sync script tries the public PokémonTCG GitHub dataset first, then the PokémonTCG paginated API, and finally a bundled sample set so the command succeeds even when external downloads fail. Syncing is non-destructive: it upserts cards and preserves any existing collection entries referencing them. You can re-run `npm run sync:cards` anytime to refresh cards and price data.

4. Start the dev server:

```bash
npm run dev
```

The app will be available at `http://localhost:3000`. The `npm run dev` script applies migrations before starting to avoid missing-table errors.

## How pricing works now
- Prices come from the `tcgplayer` and `cardmarket` fields included in the catalog data (sourced from the public PokémonTCG GitHub dataset, the PokémonTCG.io API fallback, or the bundled sample) during the catalog sync. When no upstream pricing exists, the sync fills in deterministic, rarity-based estimates so every card still has a value for collection totals.
- No direct TCGplayer API calls are made at runtime; searches and pricing are purely local once the catalog is synced.
- Manual price refreshes now rely entirely on stored catalog data—no remote calls are made. Refreshing simply reuses the latest saved price information and marks it as fresh.

## Key features
- **Dashboard** with unique card count, total quantity, estimated collection value, and recent additions.
- **Search & Add** cards by name or by printed card ID (`number/total` like `158/236`), then add them to your collection with condition, language, finish/variant, notes, and purchase price.
- **My Collection** table with filters for finish and condition plus quick search, pricing per entry, delete actions, inline edit, and a manual "Update prices" button that refreshes stored market data for all cards in your collection.
- **Card details** page with large imagery and market pricing from the locally stored catalog.

## API integrations
- **PokémonTCG.io v2**: used only by the `npm run sync:cards` script to populate the local catalog. Pricing is pulled directly from the `tcgplayer` and `cardmarket` fields. No other external APIs are required at runtime.

## Database schema
Prisma models live in `prisma/schema.prisma`:
- `Card`: persistent metadata keyed by the PokémonTCG.io card id, including stored price variants.
- `CollectionEntry`: your owned copies with quantity, condition, language, finish/variant, purchase price, notes, and timestamps.

## Notes
- Images from `images.pokemontcg.io` and `tcgplayer-cdn.tcgplayer.com` are allowed in `next.config.js` for Next/Image.
- The UI uses Tailwind CSS with a small set of components for search results and add-to-collection forms.
