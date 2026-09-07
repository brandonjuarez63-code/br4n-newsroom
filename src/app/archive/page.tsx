"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { StoryWithArticles } from "@/lib/types";
import { StoryCard } from "@/components/StoryCard";

export default function ArchivePage() {
  const [dates, setDates] = useState<string[]>([]);
  const [date, setDate] = useState("");
  const [movies, setMovies] = useState<StoryWithArticles[]>([]);
  const [gaming, setGaming] = useState<StoryWithArticles[]>([]);

  useEffect(() => {
    fetch("/api/archive")
      .then((r) => r.json())
      .then((j) => {
        const d = j.dates || [];
        setDates(d);
        if (d[0]) setDate(d[0]);
      });
  }, []);

  useEffect(() => {
    if (!date) return;
    fetch(`/api/archive?date=${encodeURIComponent(date)}`)
      .then((r) => r.json())
      .then((j) => {
        setMovies(j.movies_tv || []);
        setGaming(j.gaming || []);
      });
  }, [date]);

  return (
    <main className="mx-auto max-w-newsroom px-4 py-8 sm:px-6 lg:px-8">
      <Link
        href="/"
        className="text-sm text-newsroom-gold transition-colors hover:text-newsroom-gold/80"
      >
        ← Back to newsroom
      </Link>
      <h1 className="mt-4 text-3xl font-bold tracking-tight text-white">Archive</h1>
      <p className="mt-1.5 text-sm text-newsroom-muted">
        Pick a date to review that day&apos;s Top 5 for Movies & TV and Gaming.
      </p>
      <div className="mt-5">
        <select
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="rounded-md border border-newsroom-border bg-newsroom-panel px-3 py-2 text-sm text-white"
        >
          {dates.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
      </div>

      <section className="mt-8 rounded-2xl border border-newsroom-border/80 bg-gradient-to-b from-newsroom-gold/[0.04] to-transparent p-4 sm:p-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-newsroom-gold">
          Movies & TV desk
        </p>
        <h2 className="mb-4 mt-1 text-xl font-bold tracking-tight text-white">Top 5</h2>
        <div className="grid gap-3 md:grid-cols-2">
          {movies.map((s, i) => (
            <StoryCard key={s.id} story={s} rank={i + 1} featured={i === 0} />
          ))}
          {!movies.length && (
            <p className="text-newsroom-muted md:col-span-2">No stories for this date.</p>
          )}
        </div>
      </section>

      <section className="mt-8 rounded-2xl border border-newsroom-border/80 bg-gradient-to-b from-newsroom-electric/[0.04] to-transparent p-4 sm:p-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-newsroom-electric">
          Gaming desk
        </p>
        <h2 className="mb-4 mt-1 text-xl font-bold tracking-tight text-white">Top 5</h2>
        <div className="grid gap-3 md:grid-cols-2">
          {gaming.map((s, i) => (
            <StoryCard key={s.id} story={s} rank={i + 1} featured={i === 0} />
          ))}
          {!gaming.length && (
            <p className="text-newsroom-muted md:col-span-2">No stories for this date.</p>
          )}
        </div>
      </section>
    </main>
  );
}
