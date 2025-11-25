"use client";

import { useEffect, useState } from "react";
import { CardSummary } from "@/types";
import { CardResult } from "@/components/CardResult";
import { AddToCollectionForm } from "@/components/AddToCollectionForm";

export function SearchClient() {
  const [nameQuery, setNameQuery] = useState("");
  const [numberQuery, setNumberQuery] = useState("");
  const [results, setResults] = useState<CardSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<CardSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  async function search(type: "name" | "number") {
    setLoading(true);
    setError(null);
    setHasSearched(true);
    try {
      const q = type === "name" ? nameQuery : numberQuery;
      const res = await fetch(`/api/search/${type === "name" ? "name" : "number"}?${type === "name" ? `q=${encodeURIComponent(q)}` : `id=${encodeURIComponent(q)}`}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to search");
      if (!data.cards?.length) {
        setResults([]);
        setError(
          type === "name"
            ? `Geen kaarten gevonden voor "${q.trim()}".`
            : "Geen kaarten gevonden met dit kaartnummer."
        );
        return;
      }
      setResults(data.cards);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setSelected(null);
  }, [numberQuery, nameQuery]);

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-amber-400/20 bg-amber-500/10 p-4">
        <div className="text-sm font-semibold text-amber-200">Quick add by card ID</div>
        <div className="mt-2 flex flex-col gap-2 md:flex-row md:items-center">
          <input
            value={numberQuery}
            onChange={(e) => setNumberQuery(e.target.value)}
            placeholder="e.g. 158/236"
            className="flex-1 rounded border border-amber-300/40 bg-slate-950/60 p-2 text-white"
          />
          <button
            onClick={() => search("number")}
            className="rounded bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-amber-400"
          >
            Search ID
          </button>
        </div>
      </section>

      <section className="rounded-lg border border-slate-800 bg-slate-900/70 p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <div className="text-sm font-semibold">Search by name</div>
            <p className="text-xs text-slate-400">Use the Pokémon TCG API to find cards, then tap a result to add.</p>
          </div>
          <div className="flex gap-2">
            <input
              value={nameQuery}
              onChange={(e) => setNameQuery(e.target.value)}
              placeholder="Pikachu, Charizard, ..."
              className="w-64 rounded border border-slate-700 bg-slate-950/60 p-2 text-white"
            />
            <button
              onClick={() => search("name")}
              className="rounded bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-white"
            >
              Search
            </button>
          </div>
        </div>
        {error && <div className="mt-3 text-sm text-rose-300">{error}</div>}
        <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {loading && <div className="text-slate-300">Loading...</div>}
          {!loading && !error && results.length === 0 && hasSearched && (
            <div className="text-slate-400">Geen resultaten gevonden.</div>
          )}
          {results.map((card) => (
            <CardResult key={card.id} card={card} onSelect={(c) => setSelected(c)} />
          ))}
        </div>
      </section>

      {selected && (
        <section className="space-y-3">
          <div className="text-lg font-semibold text-amber-100">{selected.name}</div>
          <div className="text-sm text-slate-300">
            {selected.setName} · #{selected.number}
          </div>
          <AddToCollectionForm card={selected} onSaved={() => setSelected(null)} />
        </section>
      )}
    </div>
  );
}
