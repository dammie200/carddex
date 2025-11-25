"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import Image from "next/image";
import {
  FinishVariant,
  CardCondition,
  BinderDTO,
  BinderLayout,
  CollectionEntryDTO,
} from "@/types";

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
  const [entries, setEntries] = useState<CollectionEntryDTO[]>([]);
  const [binders, setBinders] = useState<BinderDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [binderLoading, setBinderLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"collection" | "binders">("collection");
  const [query, setQuery] = useState("");
  const [finishFilter, setFinishFilter] = useState<string>("all");
  const [conditionFilter, setConditionFilter] = useState<string>("all");
  const [selectedEntry, setSelectedEntry] = useState<CollectionEntryDTO | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [priceRefreshing, setPriceRefreshing] = useState(false);
  const [activeBinder, setActiveBinder] = useState<BinderDTO | null>(null);
  const [binderPage, setBinderPage] = useState(1);
  const [binderEditMode, setBinderEditMode] = useState(false);
  const [binderAddMode, setBinderAddMode] = useState(false);
  const [binderForm, setBinderForm] = useState({
    name: "",
    layout: "grid" as BinderLayout,
    gridRows: 3,
    gridCols: 3,
    pages: 1,
  });
  const [binderEditState, setBinderEditState] = useState({
    name: "",
    layout: "grid" as BinderLayout,
    gridRows: 3,
    gridCols: 3,
    pages: 1,
  });
  const [binderCardSelection, setBinderCardSelection] = useState<number | null>(null);
  const [binderEntryFilter, setBinderEntryFilter] = useState("");
  const [binderSaving, setBinderSaving] = useState(false);
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

  function getMarketPrice(entry: CollectionEntryDTO): number | null {
    const variants = entry.price?.variants ?? [];
    if (!variants.length) return null;
    const match = variants.find((v) => normalizedFinish(v.finish) === normalizedFinish(entry.finish));
    const variant = match ?? variants[0];
    return variant.marketPrice ?? null;
  }

  function getBinderValue(binder: BinderDTO): number {
    return binder.slots.reduce((sum, slot) => {
      const price = getMarketPrice(slot.collectionEntry);
      if (!price) return sum;
      return sum + price * slot.collectionEntry.quantity;
    }, 0);
  }

  async function deleteEntry(id: number) {
    await fetch(`/api/collection/${id}`, { method: "DELETE" });
    setEntries((prev) => prev.filter((e) => e.id !== id));
    if (selectedEntry?.id === id) setSelectedEntry(null);
    setBinders((prev) =>
      prev.map((binder) => ({
        ...binder,
        slots: binder.slots.filter((slot) => slot.collectionEntry.id !== id),
      }))
    );
    setActiveBinder((current) =>
      current
        ? {
            ...current,
            slots: current.slots.filter((slot) => slot.collectionEntry.id !== id),
          }
        : current
    );
  }

  function startEdit(entry: CollectionEntryDTO) {
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
        const latest = (data.entries ?? []).find((e: CollectionEntryDTO) => e.id === selectedEntry.id);
        if (latest) setSelectedEntry(latest);
      }
    } finally {
      setPriceRefreshing(false);
    }
  }

  async function loadBinders() {
    setBinderLoading(true);
    const res = await fetch("/api/binders");
    const data = await res.json();
    setBinders(data.binders ?? []);
    setBinderLoading(false);
  }

  function applyBinderUpdate(updated: BinderDTO) {
    setBinders((prev) => {
      const existing = prev.find((b) => b.id === updated.id);
      if (existing) {
        return prev.map((b) => (b.id === updated.id ? updated : b));
      }
      return [updated, ...prev];
    });
    setActiveBinder((current) => (current && current.id === updated.id ? updated : current));
  }

  async function createBinder(event: FormEvent) {
    event.preventDefault();
    setBinderSaving(true);
    try {
      const res = await fetch("/api/binders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(binderForm),
      });
      const data = await res.json();
      if (data?.binder) {
        applyBinderUpdate(data.binder as BinderDTO);
        setBinderForm({ name: "", layout: "grid", gridRows: 3, gridCols: 3, pages: 1 });
      }
    } finally {
      setBinderSaving(false);
    }
  }

  function openBinder(binder: BinderDTO) {
    setActiveBinder(binder);
    setBinderPage(1);
    setBinderEditMode(false);
    setBinderAddMode(false);
    setBinderEntryFilter("");
    setBinderEditState({
      name: binder.name,
      layout: (binder.layout as BinderLayout) ?? "grid",
      gridRows: binder.gridRows ?? 3,
      gridCols: binder.gridCols ?? 3,
      pages: binder.pages ?? 1,
    });
    setBinderCardSelection(entries[0]?.id ?? null);
  }

  async function saveBinderMeta() {
    if (!activeBinder) return;
    setBinderSaving(true);
    try {
      const res = await fetch(`/api/binders/${activeBinder.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(binderEditState),
      });
      const data = await res.json();
      if (data?.binder) {
        applyBinderUpdate(data.binder as BinderDTO);
      }
    } finally {
      setBinderSaving(false);
    }
  }

  async function assignSlot(page: number, position?: number | null, entryIdOverride?: number | null) {
    const chosen = entryIdOverride ?? binderCardSelection;
    if (!activeBinder || !chosen) return;
    const res = await fetch(`/api/binders/${activeBinder.id}/slots`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        collectionEntryId: chosen,
        page,
        position: typeof position === "number" ? position : undefined,
      }),
    });
    const data = await res.json();
    if (data?.binder) {
      applyBinderUpdate(data.binder as BinderDTO);
    }
  }

  async function removeSlot(slotId: number) {
    if (!activeBinder) return;
    const res = await fetch(`/api/binders/${activeBinder.id}/slots/${slotId}`, { method: "DELETE" });
    const data = await res.json();
    if (data?.binder) {
      applyBinderUpdate(data.binder as BinderDTO);
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
    loadBinders();
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

  useEffect(() => {
    if (activeBinder?.pages && binderPage > activeBinder.pages) {
      setBinderPage(Math.max(1, activeBinder.pages ?? 1));
    }
  }, [activeBinder, binderPage]);

  const gridSlots = (binder: BinderDTO, page: number) => {
    const rows = binder.gridRows ?? 3;
    const cols = binder.gridCols ?? 3;
    const total = Math.max(1, rows * cols);
    const slotsForPage = binder.slots.filter((s) => s.page === page && s.position !== null && s.position !== undefined);
    const map = new Map<number, typeof slotsForPage[number]>();
    slotsForPage.forEach((slot) => {
      if (typeof slot.position === "number") map.set(slot.position, slot);
    });
    return { rows, cols, total, map };
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setActiveTab("collection")}
          className={`rounded px-4 py-2 text-sm font-semibold ${
            activeTab === "collection"
              ? "bg-amber-500/20 text-amber-100 border border-amber-400/60"
              : "border border-slate-700 text-slate-200 hover:bg-slate-800"
          }`}
        >
          My collection
        </button>
        <button
          onClick={() => setActiveTab("binders")}
          className={`rounded px-4 py-2 text-sm font-semibold ${
            activeTab === "binders"
              ? "bg-amber-500/20 text-amber-100 border border-amber-400/60"
              : "border border-slate-700 text-slate-200 hover:bg-slate-800"
          }`}
        >
          My binders
        </button>
      </div>

      {activeTab === "collection" && (
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
                        <Image
                          src={entry.card.imageSmallUrl}
                          alt={entry.card.name}
                          width={60}
                          height={80}
                          className="rounded"
                        />
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
        </div>
      )}

      {activeTab === "binders" && (
        <div className="grid gap-4 lg:grid-cols-[320px,1fr]">
          <div className="space-y-4">
            <form
              onSubmit={createBinder}
              className="rounded-lg border border-slate-800 bg-slate-900/80 p-4 shadow"
            >
              <div className="mb-2 text-sm font-semibold text-amber-100">Nieuwe binder</div>
              <div className="flex flex-wrap items-end gap-3">
                <label className="flex flex-col text-sm text-slate-200">
                  Naam
                  <input
                    value={binderForm.name}
                    onChange={(e) => setBinderForm((s) => ({ ...s, name: e.target.value }))}
                    className="rounded border border-slate-700 bg-slate-950/60 p-2 text-white"
                    required
                  />
                </label>
                <label className="flex flex-col text-sm text-slate-200">
                  Layout
                  <select
                    value={binderForm.layout}
                    onChange={(e) => setBinderForm((s) => ({ ...s, layout: e.target.value as BinderLayout }))}
                    className="rounded border border-slate-700 bg-slate-950/60 p-2 text-white"
                  >
                    <option value="grid">Grid (binder pages)</option>
                    <option value="list">Losse kaarten lijst</option>
                  </select>
                </label>
                {binderForm.layout === "grid" && (
                  <>
                    <label className="flex flex-col text-sm text-slate-200">
                      Rows
                      <input
                        type="number"
                        min={1}
                        value={binderForm.gridRows}
                        onChange={(e) => setBinderForm((s) => ({ ...s, gridRows: Number(e.target.value) }))}
                        className="w-24 rounded border border-slate-700 bg-slate-950/60 p-2 text-white"
                      />
                    </label>
                    <label className="flex flex-col text-sm text-slate-200">
                      Columns
                      <input
                        type="number"
                        min={1}
                        value={binderForm.gridCols}
                        onChange={(e) => setBinderForm((s) => ({ ...s, gridCols: Number(e.target.value) }))}
                        className="w-24 rounded border border-slate-700 bg-slate-950/60 p-2 text-white"
                      />
                    </label>
                    <label className="flex flex-col text-sm text-slate-200">
                      Pages
                      <input
                        type="number"
                        min={1}
                        value={binderForm.pages}
                        onChange={(e) => setBinderForm((s) => ({ ...s, pages: Number(e.target.value) }))}
                        className="w-24 rounded border border-slate-700 bg-slate-950/60 p-2 text-white"
                      />
                    </label>
                  </>
                )}
                <button
                  type="submit"
                  disabled={binderSaving}
                  className="rounded border border-emerald-500/60 px-4 py-2 font-semibold text-emerald-100 hover:bg-emerald-500/10 disabled:opacity-60"
                >
                  {binderSaving ? "Creating..." : "Create binder"}
                </button>
              </div>
            </form>

            <div className="rounded-lg border border-slate-800 bg-slate-900/80 p-4">
              <div className="mb-2 text-sm font-semibold text-amber-100">Mijn binders</div>
              {binderLoading && <div className="text-slate-300">Binders laden...</div>}
              {!binderLoading && binders.length === 0 && (
                <div className="text-slate-300">Nog geen binders. Maak er één om kaarten te groeperen.</div>
              )}
              <div className="mt-2 space-y-2">
                {binders.map((binder) => (
                  <button
                    key={binder.id}
                    onClick={() => openBinder(binder)}
                    className={`w-full rounded border px-3 py-3 text-left transition ${
                      activeBinder?.id === binder.id
                        ? "border-amber-500/80 bg-amber-500/10"
                        : "border-slate-800 bg-slate-900/60 hover:border-amber-500/60"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-semibold text-amber-100">{binder.name}</div>
                        <div className="text-xs text-slate-400">
                          {binder.layout === "grid"
                            ? `Grid ${binder.gridRows}x${binder.gridCols}, ${binder.pages} pagina's`
                            : "Lijstweergave"}
                        </div>
                      </div>
                      <div className="text-xs text-emerald-200">${getBinderValue(binder).toFixed(2)}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            {!activeBinder && (
              <div className="rounded-lg border border-slate-800 bg-slate-900/80 p-6 text-slate-300">
                Selecteer een binder om de pagina's te bekijken.
              </div>
            )}

            {activeBinder && (
              <div className="space-y-4 rounded-xl border border-slate-800 bg-slate-900/80 p-4 shadow">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h3 className="text-2xl font-semibold text-amber-100">{activeBinder.name}</h3>
                    <div className="text-xs text-slate-400">
                      {activeBinder.layout === "grid"
                        ? `${activeBinder.gridRows} rijen • ${activeBinder.gridCols} kolommen • ${activeBinder.pages} pagina's`
                        : "Lijstweergave"}
                    </div>
                    <div className="text-sm text-emerald-200">
                      Totale binder waarde: ${getBinderValue(activeBinder).toFixed(2)}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => setBinderEditMode((s) => !s)}
                      className="rounded border border-sky-500/60 px-3 py-2 text-sm font-semibold text-sky-100 hover:bg-sky-500/10"
                    >
                      {binderEditMode ? "Stop edit" : "Edit binder"}
                    </button>
                    <button
                      onClick={() => {
                        setBinderAddMode((s) => !s);
                        if (!binderCardSelection && entries.length > 0) {
                          setBinderCardSelection(entries[0].id);
                        }
                      }}
                      className="rounded border border-emerald-500/60 px-3 py-2 text-sm font-semibold text-emerald-100 hover:bg-emerald-500/10"
                    >
                      {binderAddMode ? "Sluit toevoegen" : "Add cards"}
                    </button>
                    {activeBinder.layout === "grid" && activeBinder.pages && (
                      <div className="flex items-center gap-2 rounded border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-slate-200">
                        <span>Pagina</span>
                        <select
                          value={binderPage}
                          onChange={(e) => setBinderPage(Number(e.target.value))}
                          className="rounded border border-slate-700 bg-slate-900 p-2"
                        >
                          {Array.from({ length: activeBinder.pages }).map((_, idx) => (
                            <option key={idx + 1} value={idx + 1}>
                              Pagina {idx + 1}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                </div>

                {binderEditMode && (
                  <div className="grid gap-3 rounded border border-slate-800 bg-slate-950/60 p-3 md:grid-cols-4">
                    <label className="space-y-1 text-sm text-slate-200">
                      Naam
                      <input
                        value={binderEditState.name}
                        onChange={(e) => setBinderEditState((s) => ({ ...s, name: e.target.value }))}
                        className="w-full rounded border border-slate-700 bg-slate-950/60 p-2 text-white"
                      />
                    </label>
                    <label className="space-y-1 text-sm text-slate-200">
                      Layout
                      <select
                        value={binderEditState.layout}
                        onChange={(e) => setBinderEditState((s) => ({ ...s, layout: e.target.value as BinderLayout }))}
                        className="w-full rounded border border-slate-700 bg-slate-950/60 p-2 text-white"
                      >
                        <option value="grid">Grid (binder pages)</option>
                        <option value="list">Lijstweergave</option>
                      </select>
                    </label>
                    {binderEditState.layout === "grid" && (
                      <>
                        <label className="space-y-1 text-sm text-slate-200">
                          Rows
                          <input
                            type="number"
                            min={1}
                            value={binderEditState.gridRows}
                            onChange={(e) => setBinderEditState((s) => ({ ...s, gridRows: Number(e.target.value) }))}
                            className="w-full rounded border border-slate-700 bg-slate-950/60 p-2 text-white"
                          />
                        </label>
                        <label className="space-y-1 text-sm text-slate-200">
                          Columns
                          <input
                            type="number"
                            min={1}
                            value={binderEditState.gridCols}
                            onChange={(e) => setBinderEditState((s) => ({ ...s, gridCols: Number(e.target.value) }))}
                            className="w-full rounded border border-slate-700 bg-slate-950/60 p-2 text-white"
                          />
                        </label>
                        <label className="space-y-1 text-sm text-slate-200">
                          Pages
                          <input
                            type="number"
                            min={1}
                            value={binderEditState.pages}
                            onChange={(e) => setBinderEditState((s) => ({ ...s, pages: Number(e.target.value) }))}
                            className="w-full rounded border border-slate-700 bg-slate-950/60 p-2 text-white"
                          />
                        </label>
                      </>
                    )}
                    <button
                      onClick={saveBinderMeta}
                      disabled={binderSaving}
                      className="h-full rounded border border-emerald-500/60 px-4 py-2 text-sm font-semibold text-emerald-100 hover:bg-emerald-500/10 disabled:opacity-60"
                    >
                      {binderSaving ? "Saving..." : "Save changes"}
                    </button>
                  </div>
                )}

                {activeBinder.layout === "grid" ? (
                  <div className="rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-950 to-slate-900 p-6 shadow-inner">
                    <div className="mb-2 text-xs text-slate-400">Klik op een vakje om kaarten neer te zetten wanneer toevoegen is ingeschakeld.</div>
                    <div
                      className="grid gap-3"
                      style={{ gridTemplateColumns: `repeat(${activeBinder.gridCols ?? 1}, minmax(0, 1fr))` }}
                    >
                      {(() => {
                        const { total, map } = gridSlots(activeBinder, binderPage);
                        return Array.from({ length: total }).map((_, idx) => {
                          const slot = map.get(idx);
                          const selected = slot?.collectionEntry.id === binderCardSelection;
                          const price = slot ? getMarketPrice(slot.collectionEntry) : null;
                          return (
                            <button
                              key={idx}
                              onClick={() => binderAddMode && binderCardSelection ? assignSlot(binderPage, idx) : undefined}
                              className={`relative flex min-h-[160px] flex-col items-center justify-center rounded-lg border bg-slate-950/60 p-3 text-center transition ${
                                selected
                                  ? "border-amber-500/80"
                                  : slot
                                    ? "border-slate-800 hover:border-amber-500/60"
                                    : "border-dashed border-slate-700 hover:border-amber-500/60"
                              } ${binderAddMode && binderCardSelection ? "cursor-pointer" : "cursor-default"}`}
                            >
                              {slot ? (
                                <div className="flex flex-col items-center gap-2 text-xs text-slate-200">
                                  <Image
                                    src={slot.collectionEntry.card.imageSmallUrl}
                                    alt={slot.collectionEntry.card.name}
                                    width={96}
                                    height={120}
                                    className="rounded shadow"
                                  />
                                  <div className="font-semibold text-amber-100">{slot.collectionEntry.card.name}</div>
                                  <div className="text-[11px] text-slate-400">{slot.collectionEntry.card.setName}</div>
                                  <div className="text-[11px] text-emerald-200">{price ? `$${(price * slot.collectionEntry.quantity).toFixed(2)}` : "--"}</div>
                                  {binderEditMode && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        removeSlot(slot.id);
                                      }}
                                      className="rounded border border-rose-500/60 px-2 py-1 text-rose-100 hover:bg-rose-500/10"
                                    >
                                      Remove
                                    </button>
                                  )}
                                </div>
                              ) : (
                                <span className="text-slate-500">Leeg vak</span>
                              )}
                            </button>
                          );
                        });
                      })()}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2 rounded-lg border border-slate-800 bg-slate-950/60 p-3">
                    <p className="text-sm text-slate-300">Losse kaarten in deze binder.</p>
                    <div className="space-y-2">
                      {activeBinder.slots.length === 0 && (
                        <div className="rounded border border-slate-800 bg-slate-950/60 p-3 text-slate-300">
                          Nog geen kaarten toegevoegd.
                        </div>
                      )}
                      {activeBinder.slots.map((slot) => {
                        const price = getMarketPrice(slot.collectionEntry);
                        return (
                          <div
                            key={slot.id}
                            className="flex items-center justify-between rounded border border-slate-800 bg-slate-950/60 p-3"
                          >
                            <div className="flex items-center gap-3">
                              <Image
                                src={slot.collectionEntry.card.imageSmallUrl}
                                alt={slot.collectionEntry.card.name}
                                width={50}
                                height={70}
                                className="rounded"
                              />
                              <div>
                                <div className="font-semibold text-amber-100">{slot.collectionEntry.card.name}</div>
                                <div className="text-xs text-slate-400">{slot.collectionEntry.card.setName}</div>
                                <div className="text-xs text-emerald-200">{price ? `$${(price * slot.collectionEntry.quantity).toFixed(2)}` : "--"}</div>
                              </div>
                            </div>
                            {binderEditMode && (
                              <button
                                onClick={() => removeSlot(slot.id)}
                                className="rounded border border-rose-500/60 px-3 py-1 text-xs font-semibold text-rose-100 hover:bg-rose-500/10"
                              >
                                Verwijder
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {binderAddMode && (
                  <div className="space-y-3 rounded-lg border border-slate-800 bg-slate-950/60 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="text-sm font-semibold text-amber-100">Selecteer een kaart uit je collectie</div>
                      <input
                        value={binderEntryFilter}
                        onChange={(e) => setBinderEntryFilter(e.target.value)}
                        placeholder="Zoek op naam"
                        className="w-64 rounded border border-slate-700 bg-slate-900 p-2 text-white"
                      />
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                      {entries
                        .filter((entry) => entry.card.name.toLowerCase().includes(binderEntryFilter.toLowerCase()))
                        .map((entry) => {
                          const price = getMarketPrice(entry);
                          const isSelected = binderCardSelection === entry.id;
                          return (
                            <div
                              key={entry.id}
                              className={`rounded border p-3 text-sm transition ${
                                isSelected
                                  ? "border-amber-500/70 bg-amber-500/10"
                                  : "border-slate-800 bg-slate-900/70 hover:border-amber-500/60"
                              }`}
                            >
                              <button
                                type="button"
                                onClick={() => setBinderCardSelection(entry.id)}
                                className="flex w-full flex-col items-center gap-2"
                              >
                                <Image
                                  src={entry.card.imageSmallUrl}
                                  alt={entry.card.name}
                                  width={90}
                                  height={110}
                                  className="rounded"
                                />
                                <div className="mt-1 text-center">
                                  <div className="font-semibold text-amber-100">{entry.card.name}</div>
                                  <div className="text-xs text-slate-400">{entry.finish}</div>
                                  <div className="text-xs text-emerald-200">{price ? `$${(price * entry.quantity).toFixed(2)}` : "--"}</div>
                                </div>
                              </button>
                              {activeBinder.layout === "list" && (
                                <button
                                  onClick={() => assignSlot(1, activeBinder.slots.length, entry.id)}
                                  className="mt-2 w-full rounded border border-sky-500/60 px-2 py-1 text-xs font-semibold text-sky-100 hover:bg-sky-500/10"
                                >
                                  Voeg toe aan lijst
                                </button>
                              )}
                            </div>
                          );
                        })}
                    </div>
                    {activeBinder.layout === "grid" && !binderCardSelection && (
                      <div className="text-xs text-slate-400">Selecteer eerst een kaart en klik daarna een vakje.</div>
                    )}
                    {activeBinder.layout === "list" && binderCardSelection !== null && (
                      <button
                        onClick={() => assignSlot(1, activeBinder.slots.length, binderCardSelection)}
                        className="w-full rounded border border-sky-500/60 px-3 py-2 text-sm font-semibold text-sky-100 hover:bg-sky-500/10"
                      >
                        Voeg geselecteerde kaart toe aan lijst
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
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

      {activeBinder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-5xl space-y-4 rounded-xl border border-slate-800 bg-slate-900 p-4 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-lg font-semibold text-amber-100">{activeBinder.name}</div>
                <div className="text-sm text-slate-300">
                  {activeBinder.layout === "grid"
                    ? `Grid ${activeBinder.gridRows}x${activeBinder.gridCols}, ${activeBinder.pages} pagina's`
                    : "Losse kaarten"}
                </div>
              </div>
              <button
                onClick={() => setActiveBinder(null)}
                className="rounded px-2 py-1 text-slate-300 hover:bg-slate-800"
              >
                Close
              </button>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <label className="space-y-1 text-sm text-slate-200">
                Name
                <input
                  value={binderEditState.name}
                  onChange={(e) => setBinderEditState((s) => ({ ...s, name: e.target.value }))}
                  className="w-full rounded border border-slate-700 bg-slate-950/60 p-2 text-white"
                />
              </label>
              <label className="space-y-1 text-sm text-slate-200">
                Layout
                <select
                  value={binderEditState.layout}
                  onChange={(e) => setBinderEditState((s) => ({ ...s, layout: e.target.value as BinderLayout }))}
                  className="w-full rounded border border-slate-700 bg-slate-950/60 p-2 text-white"
                >
                  <option value="grid">Grid</option>
                  <option value="list">List</option>
                </select>
              </label>
              {binderEditState.layout === "grid" && (
                <>
                  <label className="space-y-1 text-sm text-slate-200">
                    Rows
                    <input
                      type="number"
                      min={1}
                      value={binderEditState.gridRows}
                      onChange={(e) => setBinderEditState((s) => ({ ...s, gridRows: Number(e.target.value) }))}
                      className="w-full rounded border border-slate-700 bg-slate-950/60 p-2 text-white"
                    />
                  </label>
                  <label className="space-y-1 text-sm text-slate-200">
                    Columns
                    <input
                      type="number"
                      min={1}
                      value={binderEditState.gridCols}
                      onChange={(e) => setBinderEditState((s) => ({ ...s, gridCols: Number(e.target.value) }))}
                      className="w-full rounded border border-slate-700 bg-slate-950/60 p-2 text-white"
                    />
                  </label>
                  <label className="space-y-1 text-sm text-slate-200">
                    Pages
                    <input
                      type="number"
                      min={1}
                      value={binderEditState.pages}
                      onChange={(e) => setBinderEditState((s) => ({ ...s, pages: Number(e.target.value) }))}
                      className="w-full rounded border border-slate-700 bg-slate-950/60 p-2 text-white"
                    />
                  </label>
                </>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={saveBinderMeta}
                disabled={binderSaving}
                className="rounded border border-emerald-500/60 px-4 py-2 font-semibold text-emerald-100 hover:bg-emerald-500/10 disabled:opacity-60"
              >
                {binderSaving ? "Saving..." : "Save binder settings"}
              </button>
              <div className="text-xs text-slate-400">Aanpassingen gelden direct en houden bestaande kaarten intact.</div>
            </div>

            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <label className="text-sm text-slate-200">
                  Kies kaart uit je collectie
                  <select
                    value={binderCardSelection ?? ""}
                    onChange={(e) => setBinderCardSelection(Number(e.target.value) || null)}
                    className="ml-2 rounded border border-slate-700 bg-slate-950/60 p-2 text-white"
                  >
                    <option value="">Selecteer een kaart</option>
                    {entries.map((entry) => (
                      <option key={entry.id} value={entry.id}>
                        {entry.card.name} ({entry.finish})
                      </option>
                    ))}
                  </select>
                </label>
                {activeBinder.layout === "grid" && activeBinder.pages && (
                  <label className="text-sm text-slate-200">
                    Pagina
                    <select
                      value={binderPage}
                      onChange={(e) => setBinderPage(Number(e.target.value))}
                      className="ml-2 rounded border border-slate-700 bg-slate-950/60 p-2 text-white"
                    >
                      {Array.from({ length: activeBinder.pages }).map((_, idx) => (
                        <option key={idx + 1} value={idx + 1}>
                          Pagina {idx + 1}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                {activeBinder.layout === "list" && (
                  <button
                    onClick={() => assignSlot(1, activeBinder.slots.length)}
                    disabled={!binderCardSelection}
                    className="rounded border border-sky-500/60 px-3 py-2 text-sm font-semibold text-sky-100 hover:bg-sky-500/10 disabled:opacity-50"
                  >
                    Voeg kaart toe aan lijst
                  </button>
                )}
              </div>

              {activeBinder.layout === "grid" ? (
                <div className="space-y-2">
                  <p className="text-sm text-slate-400">Klik op een vakje om de geselecteerde kaart neer te zetten.</p>
                  <div
                    className="grid gap-2"
                    style={{ gridTemplateColumns: `repeat(${activeBinder.gridCols ?? 1}, minmax(0, 1fr))` }}
                  >
                    {(() => {
                      const { total, map } = gridSlots(activeBinder, binderPage);
                      return Array.from({ length: total }).map((_, idx) => {
                        const slot = map.get(idx);
                        return (
                          <button
                            key={idx}
                            onClick={() => assignSlot(binderPage, idx)}
                            className="flex min-h-[120px] flex-col items-center justify-center rounded border border-slate-800 bg-slate-950/60 p-2 hover:border-amber-500/60"
                          >
                            {slot ? (
                              <div className="flex flex-col items-center gap-2 text-center text-xs text-slate-200">
                                <Image
                                  src={slot.collectionEntry.card.imageSmallUrl}
                                  alt={slot.collectionEntry.card.name}
                                  width={80}
                                  height={100}
                                  className="rounded"
                                />
                                <div className="font-semibold text-amber-100">{slot.collectionEntry.card.name}</div>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    removeSlot(slot.id);
                                  }}
                                  className="rounded border border-rose-500/60 px-2 py-1 text-rose-100 hover:bg-rose-500/10"
                                >
                                  Verwijder
                                </button>
                              </div>
                            ) : (
                              <span className="text-slate-500">Leeg vak</span>
                            )}
                          </button>
                        );
                      });
                    })()}
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm text-slate-400">Losse kaarten in deze binder.</p>
                  <div className="space-y-2">
                    {activeBinder.slots.length === 0 && (
                      <div className="rounded border border-slate-800 bg-slate-950/60 p-3 text-slate-300">
                        Nog geen kaarten toegevoegd.
                      </div>
                    )}
                    {activeBinder.slots.map((slot) => (
                      <div
                        key={slot.id}
                        className="flex items-center justify-between rounded border border-slate-800 bg-slate-950/60 p-3"
                      >
                        <div className="flex items-center gap-3">
                          <Image
                            src={slot.collectionEntry.card.imageSmallUrl}
                            alt={slot.collectionEntry.card.name}
                            width={50}
                            height={70}
                            className="rounded"
                          />
                          <div>
                            <div className="font-semibold text-amber-100">{slot.collectionEntry.card.name}</div>
                            <div className="text-xs text-slate-400">{slot.collectionEntry.card.setName}</div>
                          </div>
                        </div>
                        <button
                          onClick={() => removeSlot(slot.id)}
                          className="rounded border border-rose-500/60 px-3 py-1 text-xs font-semibold text-rose-100 hover:bg-rose-500/10"
                        >
                          Verwijder
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
