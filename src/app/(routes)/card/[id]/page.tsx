import Image from "next/image";
import { getCardById } from "@/lib/pokemontcg";
import { AddToCollectionForm } from "@/components/AddToCollectionForm";

interface Props {
  params: { id: string };
}

export default async function CardDetailPage({ params }: Props) {
  const card = await getCardById(params.id);
  if (!card) return <div className="text-slate-300">Card not found.</div>;

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-4">
        <Image
          src={card.imageLargeUrl}
          alt={card.name}
          width={400}
          height={560}
          className="w-full rounded"
        />
        <div className="mt-3 text-lg font-bold text-amber-100">{card.name}</div>
        <div className="text-sm text-slate-300">{card.setName}</div>
        <div className="text-xs text-slate-500">#{card.number}{card.printedTotal ? `/${card.printedTotal}` : ""}</div>
        {card.rarity && <div className="text-xs text-amber-200">{card.rarity}</div>}
      </div>

      <div className="space-y-4 lg:col-span-2">
        <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-4">
          <div className="text-lg font-semibold">Market pricing</div>
          {!card.price && <div className="text-sm text-slate-400">No price data.</div>}
          {card.price && (
            <div className="mt-3 grid gap-2 md:grid-cols-2">
              {card.price.variants.map((variant, idx) => (
                <div key={idx} className="rounded border border-slate-800 bg-slate-950/60 p-3">
                  <div className="text-sm font-semibold text-amber-100">{variant.finish}</div>
                  <div className="text-xs text-slate-400">Market: {variant.marketPrice ? `$${variant.marketPrice.toFixed(2)}` : "-"}</div>
                  <div className="text-xs text-slate-400">Low: {variant.lowPrice ? `$${variant.lowPrice.toFixed(2)}` : "-"}</div>
                  <div className="text-xs text-slate-400">Mid: {variant.midPrice ? `$${variant.midPrice.toFixed(2)}` : "-"}</div>
                  <div className="text-xs text-slate-400">High: {variant.highPrice ? `$${variant.highPrice.toFixed(2)}` : "-"}</div>
                </div>
              ))}
            </div>
          )}
        </div>
        <AddToCollectionForm card={card} />
      </div>
    </div>
  );
}
