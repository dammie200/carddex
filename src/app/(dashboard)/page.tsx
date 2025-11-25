import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { CardPriceData } from "@/types";

type DashboardStats = {
  totalQuantity: number;
  uniqueCards: number;
  estimatedValue: number;
  binderCount: number;
  binderValue: number;
  mostValuable?: { name: string; value: number; finish: string; set: string } | null;
  topFinish?: string | null;
  recent: Awaited<ReturnType<typeof prisma.collectionEntry.findMany>>;
  error?: string;
};

function normalizedFinish(value: string) {
  return value.toLowerCase().replace(/\s+/g, "");
}

function parsePrice(priceJson: string | null): CardPriceData | null {
  if (!priceJson) return null;
  try {
    const parsed = JSON.parse(priceJson);
    if (!parsed || typeof parsed !== "object") return null;
    return parsed as CardPriceData;
  } catch {
    return null;
  }
}

async function getStats(): Promise<DashboardStats> {
  try {
    const [totalEntries, uniqueCardIds, entries, binders] = await Promise.all([
      prisma.collectionEntry.aggregate({ _sum: { quantity: true } }),
      prisma.collectionEntry.findMany({ distinct: ["cardId"], select: { cardId: true } }),
      prisma.collectionEntry.findMany({ include: { card: true }, orderBy: { createdAt: "desc" }, take: 5 }),
      prisma.binder.findMany({
        include: {
          slots: {
            include: {
              collectionEntry: {
                include: { card: true },
              },
            },
          },
        },
      }),
    ]);

    const prices = entries.map((entry) => {
      const price = parsePrice(entry.card.priceJson);
      const variants = price?.variants ?? [];
      const match = variants.find((v) => normalizedFinish(v.finish) === normalizedFinish(entry.finish));
      const variant = match ?? variants[0];
      return variant?.marketPrice ? variant.marketPrice * entry.quantity : 0;
    });

    const estimatedValue = prices.reduce((acc, val) => acc + val, 0);

    const mostValuable = entries.reduce<{ name: string; value: number; finish: string; set: string } | null>(
      (best, entry) => {
        const price = parsePrice(entry.card.priceJson);
        const variants = price?.variants ?? [];
        const match = variants.find((v) => normalizedFinish(v.finish) === normalizedFinish(entry.finish));
        const variant = match ?? variants[0];
        const val = variant?.marketPrice ? variant.marketPrice * entry.quantity : 0;
        if (!best || val > best.value) {
          return { name: entry.card.name, value: val, finish: entry.finish, set: entry.card.setName };
        }
        return best;
      },
      null
    );

    const finishCounts = entries.reduce<Record<string, number>>((acc, entry) => {
      acc[entry.finish] = (acc[entry.finish] ?? 0) + 1;
      return acc;
    }, {});
    const topFinish = Object.entries(finishCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

    const binderValue = binders.reduce((total, binder) => {
      const subtotal = binder.slots.reduce((sum, slot) => {
        const price = parsePrice(slot.collectionEntry.card.priceJson);
        const variants = price?.variants ?? [];
        const match = variants.find(
          (v) => normalizedFinish(v.finish) === normalizedFinish(slot.collectionEntry.finish)
        );
        const variant = match ?? variants[0];
        return variant?.marketPrice
          ? sum + variant.marketPrice * slot.collectionEntry.quantity
          : sum;
      }, 0);
      return total + subtotal;
    }, 0);

    return {
      totalQuantity: totalEntries._sum.quantity ?? 0,
      uniqueCards: uniqueCardIds.length,
      estimatedValue,
      binderCount: binders.length,
      binderValue,
      mostValuable,
      topFinish,
      recent: entries,
    };
  } catch (error) {
    console.error("Failed to load dashboard stats. Ensure database migrations have been applied.", error);
    return {
      totalQuantity: 0,
      uniqueCards: 0,
      estimatedValue: 0,
      binderCount: 0,
      binderValue: 0,
      mostValuable: null,
      topFinish: null,
      recent: [],
      error: "Database not initialized. Run 'npm run prisma:migrate' once to create the tables.",
    };
  }
}

export default async function DashboardPage() {
  const stats = await getStats();
  return (
    <div className="space-y-8">
      {stats.error && (
        <div className="rounded border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-100">
          {stats.error}
        </div>
      )}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Unique cards" value={stats.uniqueCards} />
        <StatCard label="Total cards" value={stats.totalQuantity} />
        <StatCard
          label="Estimated value"
          value={stats.estimatedValue ? `$${stats.estimatedValue.toFixed(2)}` : "$--"}
          description="Based on latest market prices"
        />
        <StatCard
          label="Binders"
          value={`${stats.binderCount} (${stats.binderValue ? `$${stats.binderValue.toFixed(0)}` : "$--"})`}
          description="Aantal binders en geschatte waarde"
        />
      </div>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="space-y-3 rounded-lg border border-slate-800 bg-slate-900/70 p-4">
          <h3 className="text-sm font-semibold text-amber-100">Collection highlights</h3>
          <div className="space-y-2 text-sm text-slate-200">
            <div className="flex items-center justify-between rounded border border-slate-800 bg-slate-950/60 p-3">
              <span>Top finish</span>
              <span className="text-amber-200">{stats.topFinish ?? "--"}</span>
            </div>
            <div className="flex items-center justify-between rounded border border-slate-800 bg-slate-950/60 p-3">
              <span>Binder value</span>
              <span className="text-emerald-200">{stats.binderValue ? `$${stats.binderValue.toFixed(2)}` : "--"}</span>
            </div>
            <div className="flex items-center justify-between rounded border border-slate-800 bg-slate-950/60 p-3">
              <span>Most valuable card</span>
              <span className="text-amber-200">
                {stats.mostValuable
                  ? `${stats.mostValuable.name} (${stats.mostValuable.finish}) – $${stats.mostValuable.value.toFixed(2)}`
                  : "--"}
              </span>
            </div>
          </div>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-4">
          <h3 className="text-sm font-semibold text-amber-100">Next steps</h3>
          <ul className="mt-2 space-y-2 text-sm text-slate-300">
            <li>• Gebruik de nieuwe serie-zoekfunctie om sets sneller te vinden.</li>
            <li>• Open een binder om de grid- of lijstweergave te vullen.</li>
            <li>• Houd de waarde bij door prijzen bij te werken in “My collection”.</li>
          </ul>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Recently added</h2>
          <Link href="/collection" className="text-sm text-amber-300 hover:text-amber-200">
            View all
          </Link>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {stats.recent.length === 0 && (
            <div className="rounded border border-slate-800 bg-slate-900/70 p-4 text-sm text-slate-300">
              Add cards to see them here.
            </div>
          )}
          {stats.recent.map((entry) => (
            <div key={entry.id} className="flex gap-3 rounded border border-slate-800 bg-slate-900/70 p-4">
              <div className="flex flex-col">
                <div className="text-sm font-semibold text-amber-100">{entry.card.name}</div>
                <div className="text-xs text-slate-300">{entry.card.setName}</div>
                <div className="text-xs text-slate-400">#{entry.card.number}{entry.card.printedTotal ? `/${entry.card.printedTotal}` : ""}</div>
              </div>
              <div className="ml-auto text-right text-sm text-slate-200">
                <div>Qty: {entry.quantity}</div>
                <div className="text-xs text-slate-400">{entry.finish}</div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function StatCard({ label, value, description }: { label: string; value: number | string; description?: string }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-5">
      <div className="text-xs uppercase tracking-wide text-slate-400">{label}</div>
      <div className="text-3xl font-bold text-amber-200">{value}</div>
      {description && <div className="text-xs text-slate-500">{description}</div>}
    </div>
  );
}
