import { CollectionClient } from "./collection-client";

export const metadata = {
  title: "My Collection | CardDex",
};

export default function CollectionPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">My Collection</h1>
        <p className="text-sm text-slate-300">Filter, search, and review every card you own.</p>
      </div>
      <CollectionClient />
    </div>
  );
}
