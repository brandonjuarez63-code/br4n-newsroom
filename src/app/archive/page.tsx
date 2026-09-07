"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { StoryWithArticles } from "@/lib/types";
import { StoryCard } from "@/components/StoryCard";

function DeskTop5({
  label,
  accent,
  stories,
}: {
  label: string;
  accent: "gold" | "electric";
  stories: StoryWithArticles[];
}) {
  const top = stories[0];
  const supporting = stories.slice(1, 5);
  const accentClass =
    accent === "electric" ? "text-newsroom-electric" : "text-newsroom-gold";
  const wash =
    accent === "electric"
      ? "from-newsroom-electric/[0.04]"
      : "from-newsroom-gold/[0.04]";

  return (
    <section
      className={`mt-8 rounded-2xl border border-newsroom-border/80 bg-gradient-to-b ${wash} to-transparent p-4 sm:p-5`}
    >
      <p
        className={`text-[11px] font-semibold uppercase tracking-[0.16em] ${accentClass}`}
      >
        {label}
      </p>
      <h2 className="mb-4 mt-1 text-xl font-bold tracking-tight text-white">Top 5</h2>
      {!stories.length ? (
        <p className="text-newsroom-muted">No stories for this date.</p>
      ) : (
        <>
          {top && (
            <div className="mb-4">
              <StoryCard story={top} rank={1} variant="featured" />
            </div>
          )}
          {supporting.length > 0 && (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4">
              {supporting.map((s, i) => (
                <StoryCard
                  key={s.id}
                  story={s}
                  rank={i + 2}
                  variant="supporting"
                />
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}

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

      <DeskTop5 label="Movies & TV desk" accent="gold" stories={movies} />
      <DeskTop5 label="Gaming desk" accent="electric" stories={gaming} />
    </main>
  );
}
