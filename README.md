# CardDex

CardDex is a lightweight Next.js app for tracking your physical Pokémon TCG collection with quick ID search, variant-aware pricing, and a local SQLite database.

## Getting started

1. Install dependencies (requires access to npm registry):

```bash
npm install
```

2. Set up your environment in `.env.local`:

```
DATABASE_URL="file:./dev.db"
POKEMONTCG_API_KEY=your_pokemontcg_api_key
```

3. Create the SQLite schema and generate the Prisma client:

```bash
npm run prisma:migrate
npm run prisma:generate
npm run dev
```

The app will be available at `http://localhost:3000`.

If you encounter missing table errors (for example when the dashboard loads), ensure the migration step above has been executed t
o create `Card` and `CollectionEntry` tables in `dev.db`.

## Key features
- **Dashboard** with unique card count, total quantity, and recent additions.
- **Search & Add** cards by name or by printed card ID (`number/total` like `158/236`), then add them to your collection with condition, language, finish/variant, notes, and purchase price.
- **My Collection** table with filters for finish and condition plus quick search.
- **Card details** page with large imagery and market pricing using the `tcgplayer` and `cardmarket` price data returned by PokémonTCG.io.

## API integrations
- **PokémonTCG.io v2**: search by name or number/printedTotal using the provided API key header `X-Api-Key` when present. Pricing is pulled directly from the `tcgplayer` and `cardmarket` fields in the PokémonTCG.io responses, so no extra keys are required.

## Database schema
Prisma models live in `prisma/schema.prisma`:
- `Card`: persistent metadata keyed by the PokémonTCG.io card id.
- `CollectionEntry`: your owned copies with quantity, condition, language, finish/variant, purchase price, notes, and timestamps.

## Notes
- Images from `images.pokemontcg.io` and `tcgplayer-cdn.tcgplayer.com` are allowed in `next.config.js` for Next/Image.
- The UI uses Tailwind CSS with a small set of components for search results and add-to-collection forms.
