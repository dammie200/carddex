import type { Metadata } from "next";
import "./globals.css";
import Link from "next/link";

export const metadata: Metadata = {
  title: "CardDex - Pokémon TCG Tracker",
  description: "Track your physical Pokémon TCG collection with prices and variants",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="bg-slate-900 text-slate-100">
        <header className="border-b border-slate-800 bg-slate-950/70 backdrop-blur sticky top-0 z-20">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
            <Link href="/" className="text-xl font-bold text-amber-300">CardDex</Link>
            <nav className="flex gap-4 text-sm font-medium text-slate-200">
              <Link className="hover:text-amber-200" href="/">Dashboard</Link>
              <Link className="hover:text-amber-200" href="/search">Search & Add</Link>
              <Link className="hover:text-amber-200" href="/collection">My Collection</Link>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
      </body>
    </html>
  );
}
