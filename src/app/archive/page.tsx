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
    <main className="mx-auto max-w-6xl px-4 py-8">
      <Link href="/" className="text-sm text-newsroom-gold hover:underline">
        ← Back to newsroom
      </Link>
      <h1 className="mt-3 text-3xl font-bold text-white">Archive</h1>
      <p className="mt-1 text-sm text-newsroom-muted">
        Pick a date to review that day&apos;s Top 5 for Movies & TV and Gaming.
      </p>
      <div className="mt-4">
        <select
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="rounded-md border border-newsroom-border bg-newsroom-panel px-3 py-2 text-sm"
        >
          {dates.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
      </div>

      <section className="mt-8">
        <h2 className="mb-3 text-xl font-bold text-white">Movies & TV · Top 5</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {movies.map((s, i) => (
            <StoryCard key={s.id} story={s} rank={i + 1} />
          ))}
          {!movies.length && <p className="text-newsroom-muted">No stories for this date.</p>}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="mb-3 text-xl font-bold text-white">Gaming · Top 5</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {gaming.map((s, i) => (
            <StoryCard key={s.id} story={s} rank={i + 1} />
          ))}
          {!gaming.length && <p className="text-newsroom-muted">No stories for this date.</p>}
        </div>
      </section>
    </main>
  );
}
