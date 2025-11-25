import { prisma } from "@/lib/prisma";
import Link from "next/link";

async function getStats() {
  const [totalEntries, uniqueCardIds, entries] = await Promise.all([
    prisma.collectionEntry.aggregate({ _sum: { quantity: true } }),
    prisma.collectionEntry.findMany({ distinct: ["cardId"], select: { cardId: true } }),
    prisma.collectionEntry.findMany({ include: { card: true }, orderBy: { createdAt: "desc" }, take: 5 }),
  ]);
  return {
    totalQuantity: totalEntries._sum.quantity ?? 0,
    uniqueCards: uniqueCardIds.length,
    recent: entries,
  };
}

export default async function DashboardPage() {
  const stats = await getStats();
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatCard label="Unique cards" value={stats.uniqueCards} />
        <StatCard label="Total cards" value={stats.totalQuantity} />
        <StatCard label="Estimated value" value="$--" description="Pricing loads per card" />
      </div>

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
