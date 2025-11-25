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
npm run sync:cards       # pulls the PokémonTCG catalog into SQLite for fast local searches
```

> Important: The sync script now assembles the catalog from the public PokémonTCG GitHub dataset by first downloading the set list (`sets/en.json`) and then fetching every per-set card file under `cards/en/<setId>.json`. If GitHub is unreachable, it falls back to the paginated PokémonTCG API, then to a cached copy from your last successful sync (`data/catalog-cache.json`), and finally to the tiny bundled sample (enabled by default). Set `ALLOW_SAMPLE_FALLBACK=0` to skip the sample and force a real catalog when you have network access.

Syncing is non-destructive: it upserts cards and preserves any existing collection entries referencing them. You can re-run `npm run sync:cards` anytime to refresh cards and price data.

4. Start the dev server:

```bash
npm run dev
```

The app will be available at `http://localhost:3000`. The `npm run dev` script applies migrations before starting to avoid missing-table errors.

## How pricing works now
- Prices come from the `tcgplayer` and `cardmarket` fields included in the catalog data (sourced from the public PokémonTCG GitHub dataset, the PokémonTCG.io API fallback, or the bundled sample) during the catalog sync. When no upstream pricing exists, the sync fills in deterministic, rarity-based estimates so every card still has a value for collection totals. If any catalog records still miss a price (for example from a previous sync), the app now auto-generates and persists a deterministic estimate as soon as you search or view the card, so collection totals never show blank values.
- No direct TCGplayer API calls are made at runtime; searches and pricing are purely local once the catalog is synced.
- Manual price refreshes now rely entirely on stored catalog data—no remote calls are made. Refreshing simply reuses the latest saved price information and marks it as fresh.

## Key features
- **Dashboard** with unique card count, total quantity, estimated collection value, and recent additions.
- **Search & Add** cards by name or by printed card ID (`number/total` like `158/236`), then add them to your collection with condition, language, finish/variant, notes, and purchase price.
- **My Collection** table with filters for finish and condition plus quick search, pricing per entry, delete actions, inline edit, and a manual "Update prices" button that refreshes stored market data for all cards in your collection.
- **My Binders** tab to create binders in grid or list mode, adjust grid sizes/pages after creation, and place any collection entry into binder slots or lists for quick visual grouping.
- **Card details** page with large imagery and market pricing from the locally stored catalog.

## API integrations
- **PokémonTCG.io v2**: used only by the `npm run sync:cards` script to populate the local catalog. Pricing is pulled directly from the `tcgplayer` and `cardmarket` fields. No other external APIs are required at runtime.

## Database schema
Prisma models live in `prisma/schema.prisma`:
- `Card`: persistent metadata keyed by the PokémonTCG.io card id, including stored price variants.
- `CollectionEntry`: your owned copies with quantity, condition, language, finish/variant, purchase price, notes, and timestamps.
- `Binder`: user-created binder definitions, including layout (grid or list), grid rows/columns, and page count.
- `BinderSlot`: placements of collection entries inside binders, with page/slot metadata for grids or ordered rows for lists.

## Notes
- Images from `images.pokemontcg.io` and `tcgplayer-cdn.tcgplayer.com` are allowed in `next.config.js` for Next/Image.
- The UI uses Tailwind CSS with a small set of components for search results and add-to-collection forms.
