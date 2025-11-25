"use client";

import { useState } from "react";
import { CardSummary, CardCondition, FinishVariant } from "@/types";

interface Props {
  card: CardSummary;
  onSaved?: () => void;
}

const conditions: CardCondition[] = [
  "Mint",
  "Near Mint",
  "Lightly Played",
  "Moderately Played",
  "Heavily Played",
  "Damaged",
];

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

export function AddToCollectionForm({ card, onSaved }: Props) {
  const [quantity, setQuantity] = useState(1);
  const [condition, setCondition] = useState<CardCondition>("Near Mint");
  const [finish, setFinish] = useState<FinishVariant>("Normal");
  const [language, setLanguage] = useState("EN");
  const [purchasePrice, setPurchasePrice] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/collection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          card,
          quantity,
          condition,
          finish,
          language,
          purchasePrice: purchasePrice ? Number(purchasePrice) : null,
          notes,
        }),
      });
      if (!res.ok) throw new Error("Failed to save");
      setMessage("Saved to your collection");
      onSaved?.();
    } catch (err: any) {
      setMessage(err.message ?? "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border border-slate-800 bg-slate-900/80 p-4">
      <div className="text-lg font-semibold text-amber-100">Add to collection</div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <label className="text-sm">
          Quantity
          <input
            type="number"
            min={1}
            value={quantity}
            onChange={(e) => setQuantity(Number(e.target.value))}
            className="mt-1 w-full rounded border border-slate-700 bg-slate-950/60 p-2 text-white"
          />
        </label>
        <label className="text-sm">
          Condition
          <select
            value={condition}
            onChange={(e) => setCondition(e.target.value as CardCondition)}
            className="mt-1 w-full rounded border border-slate-700 bg-slate-950/60 p-2 text-white"
          >
            {conditions.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Finish / Variant
          <select
            value={finish}
            onChange={(e) => setFinish(e.target.value as FinishVariant)}
            className="mt-1 w-full rounded border border-slate-700 bg-slate-950/60 p-2 text-white"
          >
            {finishes.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Language
          <input
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="mt-1 w-full rounded border border-slate-700 bg-slate-950/60 p-2 text-white"
          />
        </label>
        <label className="text-sm">
          Purchase price (optional)
          <input
            type="number"
            step="0.01"
            value={purchasePrice}
            onChange={(e) => setPurchasePrice(e.target.value)}
            className="mt-1 w-full rounded border border-slate-700 bg-slate-950/60 p-2 text-white"
          />
        </label>
        <label className="text-sm md:col-span-2">
          Notes
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="mt-1 w-full rounded border border-slate-700 bg-slate-950/60 p-2 text-white"
            rows={3}
          />
        </label>
      </div>
      <div className="flex items-center gap-3">
        <button
          disabled={saving}
          type="submit"
          className="rounded bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-amber-400 disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save"}
        </button>
        {message && <span className="text-sm text-slate-200">{message}</span>}
      </div>
    </form>
  );
}
