"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { FinishVariant, CardCondition } from "@/types";
import type { CardPriceData } from "@/types";

interface CollectionEntry {
  id: number;
  quantity: number;
  condition: string;
  language: string;
  finish: string;
  purchasePrice?: number | null;
  notes?: string | null;
  price?: CardPriceData | null;
  card: {
    id: string;
    name: string;
    setName: string;
    number: string;
    printedTotal?: number | null;
    imageSmallUrl: string;
    imageLargeUrl?: string;
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
  const [selectedEntry, setSelectedEntry] = useState<CollectionEntry | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [priceRefreshing, setPriceRefreshing] = useState(false);
  const [formState, setFormState] = useState({
    quantity: 1,
    condition: conditions[1],
    language: "EN",
    finish: finishes[0],
    purchasePrice: "",
    notes: "",
  });

  function normalizedFinish(value: string) {
    return value.toLowerCase().replace(/\s+/g, "");
  }

  function getMarketPrice(entry: CollectionEntry): number | null {
    const variants = entry.price?.variants ?? [];
    if (!variants.length) return null;
    const match = variants.find((v) => normalizedFinish(v.finish) === normalizedFinish(entry.finish));
    const variant = match ?? variants[0];
    return variant.marketPrice ?? null;
  }

  async function deleteEntry(id: number) {
    await fetch(`/api/collection/${id}`, { method: "DELETE" });
    setEntries((prev) => prev.filter((e) => e.id !== id));
    if (selectedEntry?.id === id) setSelectedEntry(null);
  }

  function startEdit(entry: CollectionEntry) {
    setSelectedEntry(entry);
    setIsEditing(true);
    setFormState({
      quantity: entry.quantity,
      condition: entry.condition as CardCondition,
      language: entry.language,
      finish: entry.finish as FinishVariant,
      purchasePrice: entry.purchasePrice?.toString() ?? "",
      notes: entry.notes ?? "",
    });
  }

  async function saveEdit() {
    if (!selectedEntry) return;
    setSaving(true);
    const res = await fetch(`/api/collection/${selectedEntry.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        quantity: Number(formState.quantity) || 1,
        condition: formState.condition,
        finish: formState.finish,
        language: formState.language,
        purchasePrice: formState.purchasePrice ? Number(formState.purchasePrice) : null,
        notes: formState.notes,
      }),
    });
    const data = await res.json();
    if (data?.entry) {
      setEntries((prev) => prev.map((e) => (e.id === selectedEntry.id ? { ...e, ...data.entry } : e)));
      setSelectedEntry((prev) => (prev ? { ...prev, ...data.entry } : prev));
      setIsEditing(false);
    }
    setSaving(false);
  }

  async function refreshPrices() {
    setPriceRefreshing(true);
    try {
      const res = await fetch("/api/collection/update-prices", { method: "POST" });
      const data = await res.json();
      setEntries(data.entries ?? []);
      if (selectedEntry) {
        const latest = (data.entries ?? []).find((e: CollectionEntry) => e.id === selectedEntry.id);
        if (latest) setSelectedEntry(latest);
      }
    } finally {
      setPriceRefreshing(false);
    }
  }

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

  const totalEstimated = useMemo(() => {
    return filtered.reduce((sum, entry) => {
      const price = getMarketPrice(entry);
      if (!price) return sum;
      return sum + price * entry.quantity;
    }, 0);
  }, [filtered]);

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
          <button
            onClick={refreshPrices}
            disabled={priceRefreshing}
            className="rounded border border-amber-500/60 px-3 py-2 font-semibold text-amber-100 hover:bg-amber-500/10 disabled:opacity-60"
          >
            {priceRefreshing ? "Updating prices..." : "Update prices"}
          </button>
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

      {filtered.length > 0 && (
        <div className="rounded border border-amber-500/40 bg-amber-500/5 px-4 py-2 text-amber-100">
          Estimated value for visible cards: ${totalEstimated.toFixed(2)}
        </div>
      )}

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
              <th className="px-3 py-2 text-left font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((entry) => (
              <tr key={entry.id} className="border-t border-slate-800 bg-slate-900/60">
                <td className="px-3 py-3">
                  <button
                    onClick={() => setSelectedEntry(entry)}
                    className="flex items-center gap-3 text-left hover:opacity-90"
                  >
                    <Image src={entry.card.imageSmallUrl} alt={entry.card.name} width={60} height={80} className="rounded" />
                    <div>
                      <div className="font-semibold text-amber-100">{entry.card.name}</div>
                      <div className="text-xs text-slate-400">{entry.card.setName}</div>
                      {entry.card.rarity && <div className="text-xs text-amber-200">{entry.card.rarity}</div>}
                    </div>
                  </button>
                </td>
                <td className="px-3 py-3 text-slate-200">
                  #{entry.card.number}
                  {entry.card.printedTotal ? `/${entry.card.printedTotal}` : ""}
                </td>
                <td className="px-3 py-3">{entry.quantity}</td>
                <td className="px-3 py-3">{entry.condition.replace(/([A-Z])/g, " $1").trim()}</td>
                <td className="px-3 py-3">{entry.finish.replace("Holo", " Holo").trim()}</td>
                <td className="px-3 py-3 text-amber-200">
                  {(() => {
                    const price = getMarketPrice(entry);
                    if (!price) return "--";
                    const total = price * entry.quantity;
                    return `$${total.toFixed(2)}`;
                  })()}
                </td>
                <td className="px-3 py-3 text-right">
                  <button
                    onClick={() => deleteEntry(entry.id)}
                    className="rounded border border-rose-500/50 px-3 py-1 text-xs font-semibold text-rose-200 hover:bg-rose-500/10"
                  >
                    Delete
                  </button>
                  <button
                    onClick={() => startEdit(entry)}
                    className="ml-2 rounded border border-sky-500/50 px-3 py-1 text-xs font-semibold text-sky-100 hover:bg-sky-500/10"
                  >
                    Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-3xl rounded-xl border border-slate-800 bg-slate-900 p-4 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div className="flex gap-4">
                <Image
                  src={selectedEntry.card.imageLargeUrl || selectedEntry.card.imageSmallUrl}
                  alt={selectedEntry.card.name}
                  width={250}
                  height={350}
                  className="rounded"
                />
                <div className="space-y-2">
                  <h3 className="text-xl font-semibold text-amber-100">{selectedEntry.card.name}</h3>
                  <p className="text-slate-300">{selectedEntry.card.setName}</p>
                  <p className="text-slate-400">
                    #{selectedEntry.card.number}
                    {selectedEntry.card.printedTotal ? `/${selectedEntry.card.printedTotal}` : ""}
                  </p>
                  {selectedEntry.card.rarity && <p className="text-amber-200">{selectedEntry.card.rarity}</p>}
                  <div className="text-slate-200">
                    Estimated value: {(() => {
                      const price = getMarketPrice(selectedEntry);
                      if (!price) return "--";
                      return `$${(price * selectedEntry.quantity).toFixed(2)}`;
                    })()}
                  </div>
                  <div className="text-xs text-slate-500">Click Edit to change quantity, condition, language, finish, or notes.</div>
                </div>
              </div>
              <button
                onClick={() => {
                  setSelectedEntry(null);
                  setIsEditing(false);
                }}
                className="rounded px-2 py-1 text-slate-300 hover:bg-slate-800"
              >
                Close
              </button>
            </div>

            {isEditing ? (
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <label className="space-y-1 text-sm text-slate-200">
                  Quantity
                  <input
                    type="number"
                    min={1}
                    value={formState.quantity}
                    onChange={(e) => setFormState((s) => ({ ...s, quantity: Number(e.target.value) }))}
                    className="w-full rounded border border-slate-700 bg-slate-950/60 p-2 text-white"
                  />
                </label>
                <label className="space-y-1 text-sm text-slate-200">
                  Condition
                  <select
                    value={formState.condition}
                    onChange={(e) => setFormState((s) => ({ ...s, condition: e.target.value as CardCondition }))}
                    className="w-full rounded border border-slate-700 bg-slate-950/60 p-2 text-white"
                  >
                    {conditions.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1 text-sm text-slate-200">
                  Finish / Variant
                  <select
                    value={formState.finish}
                    onChange={(e) => setFormState((s) => ({ ...s, finish: e.target.value as FinishVariant }))}
                    className="w-full rounded border border-slate-700 bg-slate-950/60 p-2 text-white"
                  >
                    {finishes.map((f) => (
                      <option key={f} value={f}>
                        {f}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1 text-sm text-slate-200">
                  Language
                  <input
                    value={formState.language}
                    onChange={(e) => setFormState((s) => ({ ...s, language: e.target.value }))}
                    className="w-full rounded border border-slate-700 bg-slate-950/60 p-2 text-white"
                  />
                </label>
                <label className="space-y-1 text-sm text-slate-200">
                  Purchase price
                  <input
                    type="number"
                    step="0.01"
                    value={formState.purchasePrice}
                    onChange={(e) => setFormState((s) => ({ ...s, purchasePrice: e.target.value }))}
                    className="w-full rounded border border-slate-700 bg-slate-950/60 p-2 text-white"
                  />
                </label>
                <label className="space-y-1 text-sm text-slate-200 md:col-span-2">
                  Notes
                  <textarea
                    value={formState.notes}
                    onChange={(e) => setFormState((s) => ({ ...s, notes: e.target.value }))}
                    className="w-full rounded border border-slate-700 bg-slate-950/60 p-2 text-white"
                  />
                </label>
                <div className="flex gap-2 md:col-span-2">
                  <button
                    onClick={saveEdit}
                    disabled={saving}
                    className="rounded border border-emerald-500/60 px-4 py-2 font-semibold text-emerald-100 hover:bg-emerald-500/10 disabled:opacity-60"
                  >
                    {saving ? "Saving..." : "Save changes"}
                  </button>
                  <button
                    onClick={() => setIsEditing(false)}
                    className="rounded border border-slate-700 px-4 py-2 text-slate-200 hover:bg-slate-800"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-4 flex justify-end gap-2">
                <button
                  onClick={() => startEdit(selectedEntry)}
                  className="rounded border border-sky-500/60 px-4 py-2 font-semibold text-sky-100 hover:bg-sky-500/10"
                >
                  Edit entry
                </button>
                <button
                  onClick={() => setSelectedEntry(null)}
                  className="rounded border border-slate-700 px-4 py-2 text-slate-200 hover:bg-slate-800"
                >
                  Close
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
