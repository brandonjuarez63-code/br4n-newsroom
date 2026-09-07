"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import type { Category, StoryWithArticles } from "@/lib/types";
import { StoryCard } from "./StoryCard";
import { BrandMark } from "./BrandMark";
import { formatWhen, cn } from "@/lib/utils";

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-newsroom-muted/80">
      {children}
    </p>
  );
}

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

  const topStory = useMemo(() => stories[0] ?? null, [stories]);
  const supporting = useMemo(() => stories.slice(1, 5), [stories]);
  const moreStories = useMemo(() => stories.slice(5), [stories]);
  const isGaming = category === "gaming";

  const supportingRange =
    supporting.length > 0
      ? `02–${String(supporting.length + 1).padStart(2, "0")}`
      : null;

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
      <header className="mb-8 flex flex-col gap-5 border-b border-newsroom-border/80 pb-6 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-newsroom-gold">
            Personal research desk
          </p>
          <div className="mt-1.5">
            <BrandMark href={null} />
          </div>
          <p className="mt-2 max-w-xl text-sm text-newsroom-muted">
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

      <div className="mb-8 flex flex-wrap items-center gap-3">
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
        <span className="hidden text-[11px] text-newsroom-muted/50 sm:inline">
          · {isGaming ? "Gaming desk" : "Movies & TV desk"}
        </span>
      </div>

      {message && (
        <div className="mb-6 rounded-lg border border-newsroom-border/70 bg-newsroom-panel/60 px-3.5 py-2.5 text-sm text-newsroom-muted">
          {message}
        </div>
      )}

      {loading ? (
        <p className="text-newsroom-muted">Loading…</p>
      ) : !stories.length ? (
        <p className="text-newsroom-muted">No stories yet. Hit REFRESH NEWS.</p>
      ) : (
        <>
          {topStory && (
            <section className="mb-9">
              <div className="mb-3">
                <SectionLabel>Top story</SectionLabel>
              </div>
              <StoryCard story={topStory} rank={1} variant="featured" />
            </section>
          )}

          {supporting.length > 0 && (
            <section className="mb-10">
              <div className="mb-3 flex items-baseline justify-between gap-3">
                <SectionLabel>Top stories</SectionLabel>
                {supportingRange && (
                  <span className="font-mono text-[11px] tabular-nums text-newsroom-muted/50">
                    {supportingRange}
                  </span>
                )}
              </div>
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
            </section>
          )}

          <section className="mb-10">
            <div className="mb-3 flex flex-wrap items-center gap-3 border-b border-newsroom-border/50 pb-3">
              <SectionLabel>More stories</SectionLabel>
              <div className="ml-auto flex flex-wrap items-center gap-2">
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
            </div>

            {moreStories.length ? (
              <div className="divide-y divide-newsroom-border/40">
                {moreStories.map((s, i) => (
                  <StoryCard
                    key={s.id}
                    story={s}
                    rank={i + 6}
                    variant="compact"
                  />
                ))}
              </div>
            ) : (
              <p className="py-4 text-sm text-newsroom-muted">
                No additional stories beyond the top five.
              </p>
            )}
          </section>
        </>
      )}
    </div>
  );
}
