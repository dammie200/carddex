"use client";

import Image from "next/image";
import { CardSummary } from "@/types";

interface Props {
  card: CardSummary;
  onSelect?: (card: CardSummary) => void;
}

function getCardPrice(card: CardSummary): number | null {
  const variants = card.price?.variants ?? [];
  if (!variants.length) return null;
  const variant = variants[0];
  return variant.marketPrice ?? variant.lowPrice ?? variant.midPrice ?? variant.highPrice ?? null;
}

export function CardResult({ card, onSelect }: Props) {
  const price = getCardPrice(card);
  return (
    <button
      type="button"
      onClick={() => onSelect?.(card)}
      className="flex w-full gap-3 rounded-lg border border-slate-800 bg-slate-800/60 p-3 text-left transition hover:border-amber-300 hover:bg-slate-800"
    >
      <div className="relative h-24 w-18 shrink-0">
        <Image
          src={card.imageSmallUrl}
          alt={card.name}
          width={80}
          height={120}
          className="h-24 w-16 rounded"
        />
      </div>
      <div className="flex flex-col gap-1">
        <div className="text-sm font-semibold text-amber-100">{card.name}</div>
        <div className="text-xs text-slate-300">{card.setName}</div>
        <div className="text-xs text-slate-400">#{card.number}{card.printedTotal ? `/${card.printedTotal}` : ""}</div>
        {card.rarity && <div className="text-[11px] text-amber-200">{card.rarity}</div>}
        <div className="text-xs text-emerald-200">{price ? `$${price.toFixed(2)}` : "--"}</div>
      </div>
    </button>
  );
}
