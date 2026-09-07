"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { StoryWithArticles } from "@/lib/types";
import { StoryCard } from "@/components/StoryCard";
import { BrandMark } from "@/components/BrandMark";

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
    accent === "electric" ? "text-newsroom-electric/85" : "text-newsroom-gold/85";

  return (
    <section className="mt-10 border-t border-newsroom-border/55 pt-8">
      <p
        className={`text-[11px] font-semibold uppercase tracking-[0.16em] ${accentClass}`}
      >
        {label}
      </p>
      <h2 className="mb-5 mt-1 text-xl font-bold tracking-tight text-white">Top 5</h2>
      {!stories.length ? (
        <p className="text-newsroom-muted">No stories for this date.</p>
      ) : (
        <>
          {top && (
            <div className="mb-6 border-b border-newsroom-border/45 pb-8">
              <StoryCard story={top} rank={1} variant="featured" />
            </div>
          )}
          {supporting.length > 0 && (
            <div className="divide-y divide-newsroom-border/40 md:grid md:grid-cols-2 md:gap-x-8 md:divide-y-0">
              {supporting.map((s, i) => (
                <div
                  key={s.id}
                  className={i < 2 ? "md:border-b md:border-newsroom-border/40" : ""}
                >
                  <StoryCard story={s} rank={i + 2} variant="supporting" />
                </div>
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
      <div className="mt-4">
        <BrandMark size="sm" />
      </div>
      <h1 className="mt-5 text-3xl font-bold tracking-tight text-white">Archive</h1>
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
