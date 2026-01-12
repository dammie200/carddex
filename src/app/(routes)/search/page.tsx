import { SearchClient } from "./search-client";

export const metadata = {
  title: "Search & Add | CardDex",
};

export default function SearchPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Search & Add Cards</h1>
        <p className="text-sm text-slate-300">Find cards via PokémonTCG.io, see prices, and add to your collection quickly.</p>
      </div>
      <SearchClient />
    </div>
  );
}
