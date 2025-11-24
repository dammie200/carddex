"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { FinishVariant, CardCondition } from "@/types";

interface CollectionEntry {
  id: number;
  quantity: number;
  condition: string;
  language: string;
  finish: string;
  purchasePrice?: number | null;
  notes?: string | null;
  card: {
    id: string;
    name: string;
    setName: string;
    number: string;
    printedTotal?: number | null;
    imageSmallUrl: string;
    rarity?: string | null;
  };
}

const finishes: FinishVariant[] = [
  "Normal",
  "Holo",
  "Reverse Holo",
  "Full Art",
  "Gold",
  "Rainbow",
  "Trainer Gallery",
  "Other",
];

const conditions: CardCondition[] = [
  "Mint",
  "Near Mint",
  "Lightly Played",
  "Moderately Played",
  "Heavily Played",
  "Damaged",
];

export function CollectionClient() {
  const [entries, setEntries] = useState<CollectionEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [finishFilter, setFinishFilter] = useState<string>("all");
  const [conditionFilter, setConditionFilter] = useState<string>("all");

  useEffect(() => {
    async function load() {
      setLoading(true);
      const res = await fetch("/api/collection");
      const data = await res.json();
      setEntries(data.entries ?? []);
      setLoading(false);
    }
    load();
  }, []);

  const filtered = useMemo(() => {
    return entries.filter((entry) => {
      const matchesQuery = entry.card.name.toLowerCase().includes(query.toLowerCase());
      const matchesFinish = finishFilter === "all" || entry.finish.toLowerCase() === finishFilter.toLowerCase();
      const matchesCondition =
        conditionFilter === "all" || entry.condition.toLowerCase() === conditionFilter.toLowerCase().replace(" ", "");
      return matchesQuery && matchesFinish && matchesCondition;
    });
  }, [entries, query, finishFilter, conditionFilter]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <input
          placeholder="Search in my collection"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full rounded border border-slate-700 bg-slate-950/60 p-2 text-white md:w-64"
        />
        <div className="flex flex-wrap gap-2 text-sm">
          <select
            value={finishFilter}
            onChange={(e) => setFinishFilter(e.target.value)}
            className="rounded border border-slate-700 bg-slate-950/60 p-2 text-white"
          >
            <option value="all">All finishes</option>
            {finishes.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
          <select
            value={conditionFilter}
            onChange={(e) => setConditionFilter(e.target.value)}
            className="rounded border border-slate-700 bg-slate-950/60 p-2 text-white"
          >
            <option value="all">All conditions</option>
            {conditions.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading && <div className="text-slate-300">Loading collection...</div>}
      {!loading && filtered.length === 0 && <div className="text-slate-400">No entries found.</div>}

      <div className="overflow-hidden rounded-xl border border-slate-800">
        <table className="w-full text-sm">
          <thead className="bg-slate-800 text-slate-200">
            <tr>
              <th className="px-3 py-2 text-left font-semibold">Card</th>
              <th className="px-3 py-2 text-left font-semibold">Number</th>
              <th className="px-3 py-2 text-left font-semibold">Quantity</th>
              <th className="px-3 py-2 text-left font-semibold">Condition</th>
              <th className="px-3 py-2 text-left font-semibold">Finish</th>
              <th className="px-3 py-2 text-left font-semibold">Estimated Value</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((entry) => (
              <tr key={entry.id} className="border-t border-slate-800 bg-slate-900/60">
                <td className="px-3 py-3">
                  <div className="flex items-center gap-3">
                    <Image src={entry.card.imageSmallUrl} alt={entry.card.name} width={60} height={80} className="rounded" />
                    <div>
                      <div className="font-semibold text-amber-100">{entry.card.name}</div>
                      <div className="text-xs text-slate-400">{entry.card.setName}</div>
                      {entry.card.rarity && <div className="text-xs text-amber-200">{entry.card.rarity}</div>}
                    </div>
                  </div>
                </td>
                <td className="px-3 py-3 text-slate-200">
                  #{entry.card.number}
                  {entry.card.printedTotal ? `/${entry.card.printedTotal}` : ""}
                </td>
                <td className="px-3 py-3">{entry.quantity}</td>
                <td className="px-3 py-3">{entry.condition.replace(/([A-Z])/g, " $1").trim()}</td>
                <td className="px-3 py-3">{entry.finish.replace("Holo", " Holo").trim()}</td>
                <td className="px-3 py-3 text-amber-200">--</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
