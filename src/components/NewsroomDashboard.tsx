"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { Category, StoryWithArticles } from "@/lib/types";
import { StoryCard } from "./StoryCard";
import { formatWhen, cn } from "@/lib/utils";

export function NewsroomDashboard({ initialCategory }: { initialCategory: Category }) {
  const [category, setCategory] = useState<Category>(initialCategory);
  const [stories, setStories] = useState<StoryWithArticles[]>([]);
  const [sort, setSort] = useState("importance");
  const [tag, setTag] = useState("");
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams({ category, sort });
      if (tag.trim()) q.set("tag", tag.trim());
      const [storiesRes, metaRes] = await Promise.all([
        fetch(`/api/stories?${q}`),
        fetch("/api/meta/last-updated"),
      ]);
      const storiesJson = await storiesRes.json();
      const metaJson = await metaRes.json();
      setStories(storiesJson.stories || []);
      setLastUpdated(metaJson.last_updated);
    } finally {
      setLoading(false);
    }
  }, [category, sort, tag]);

  useEffect(() => {
    load();
  }, [load]);

  const top5 = useMemo(() => stories.slice(0, 5), [stories]);
  const isGaming = category === "gaming";

  async function onRefresh() {
    setRefreshing(true);
    setMessage("");
    try {
      const res = await fetch(`/api/refresh?category=${category}`, { method: "POST" });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "Refresh failed");
      const r = json.results?.[0];
      const errN = Array.isArray(r?.errors) ? r.errors.length : 0;
      const skipN = r?.skipped_irrelevant || 0;
      const badUrlN = r?.skipped_bad_url || 0;
      setMessage(
        r
          ? `Refresh done: ${r.article_count} articles → ${r.story_count} stories${
              skipN ? ` (${skipN} off-category skipped)` : ""
            }${errN ? ` · ${errN} feed(s) unavailable` : ""}${
              r.kept_samples ? " (kept seed samples; feeds empty/unavailable)" : ""
            }`
          : "Refresh complete"
      );
      await load();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Refresh failed");
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <div className="mx-auto max-w-newsroom px-4 py-6 sm:px-6 lg:px-8">
      <header className="mb-8 flex flex-col gap-5 border-b border-newsroom-border pb-6 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-newsroom-gold">
            Personal research desk
          </p>
          <h1 className="mt-1.5 text-3xl font-bold tracking-tight text-white md:text-4xl">
            BR4N Newsroom
          </h1>
          <p className="mt-1.5 max-w-xl text-sm text-newsroom-muted">
            Refresh → verify sources → ranked research desk
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            href="/archive"
            className="rounded-lg border border-newsroom-border bg-newsroom-panel/40 px-3.5 py-2 text-sm text-newsroom-muted transition-colors hover:border-newsroom-border-strong hover:text-white"
          >
            Archive
          </Link>
          <button
            onClick={onRefresh}
            disabled={refreshing}
            className="rounded-lg bg-newsroom-gold px-4 py-2 text-sm font-bold text-black transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {refreshing ? "Refreshing…" : "REFRESH NEWS"}
          </button>
        </div>
      </header>

      <div className="mb-7 flex flex-wrap items-center gap-3">
        {(["movies_tv", "gaming"] as Category[]).map((c) => {
          const active = category === c;
          const gaming = c === "gaming";
          return (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={cn(
                "rounded-full px-4 py-1.5 text-sm font-semibold transition-colors",
                active
                  ? gaming
                    ? "bg-newsroom-electric text-black"
                    : "bg-newsroom-gold text-black"
                  : "border border-newsroom-border text-newsroom-muted hover:border-newsroom-border-strong hover:text-white"
              )}
            >
              {c === "movies_tv" ? "Movies & TV" : "Gaming"}
            </button>
          );
        })}
        <span className="text-[11px] uppercase tracking-wider text-newsroom-muted">
          Last updated {formatWhen(lastUpdated)}
        </span>
      </div>

      {message && (
        <div className="mb-5 rounded-lg border border-newsroom-border bg-newsroom-panel px-3.5 py-2.5 text-sm text-newsroom-muted">
          {message}
        </div>
      )}

      <section
        className={cn(
          "mb-10 rounded-2xl border border-newsroom-border/80 p-4 sm:p-5",
          isGaming
            ? "bg-gradient-to-b from-newsroom-electric/[0.04] to-transparent"
            : "bg-gradient-to-b from-newsroom-gold/[0.04] to-transparent"
        )}
      >
        <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
          <div>
            <p
              className={cn(
                "text-[11px] font-semibold uppercase tracking-[0.16em]",
                isGaming ? "text-newsroom-electric" : "text-newsroom-gold"
              )}
            >
              {isGaming ? "Gaming desk" : "Movies & TV desk"}
            </p>
            <h2 className="mt-1 text-xl font-bold tracking-tight text-white">Top 5</h2>
          </div>
        </div>
        {loading ? (
          <p className="text-newsroom-muted">Loading…</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {top5.map((s, i) => (
              <StoryCard
                key={s.id}
                story={s}
                rank={i + 1}
                featured={i === 0}
              />
            ))}
            {!top5.length && (
              <p className="text-newsroom-muted md:col-span-2">
                No stories yet. Hit REFRESH NEWS.
              </p>
            )}
          </div>
        )}
      </section>

      <section className="mb-10">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <h2 className="text-xl font-bold tracking-tight text-white">Full feed</h2>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="rounded-md border border-newsroom-border bg-newsroom-panel px-2.5 py-1.5 text-sm text-white"
          >
            <option value="importance">Importance</option>
            <option value="newest">Newest</option>
            <option value="confidence">Confidence</option>
            <option value="reported">Reported</option>
          </select>
          <input
            value={tag}
            onChange={(e) => setTag(e.target.value)}
            placeholder="Filter tag…"
            className="rounded-md border border-newsroom-border bg-newsroom-panel px-2.5 py-1.5 text-sm text-white placeholder:text-newsroom-muted"
          />
        </div>
        <div className="grid gap-2.5">
          {stories.map((s) => (
            <StoryCard key={s.id} story={s} compact />
          ))}
        </div>
      </section>
    </div>
  );
}
