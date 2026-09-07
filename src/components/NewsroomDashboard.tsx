"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import type { Category, StoryWithArticles } from "@/lib/types";
import { StoryCard } from "./StoryCard";
import { BrandMark } from "./BrandMark";
import { formatWhen, cn } from "@/lib/utils";

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-newsroom-muted/75">
      {children}
    </p>
  );
}

function formatDeskDate(iso: string | null): string {
  const d = iso ? new Date(iso) : new Date();
  if (Number.isNaN(d.getTime())) {
    return new Date().toLocaleDateString(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  }
  return d.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function Sidebar({
  category,
  setCategory,
  stories,
  lastUpdated,
  topFive,
}: {
  category: Category;
  setCategory: (c: Category) => void;
  stories: StoryWithArticles[];
  lastUpdated: string | null;
  topFive: StoryWithArticles[];
}) {
  return (
    <aside className="space-y-7 lg:sticky lg:top-6 lg:self-start">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-newsroom-gold/85">
          Today&apos;s Newsroom
        </p>
        <p className="mt-2 text-sm leading-snug text-white/90">
          {formatDeskDate(lastUpdated)}
        </p>
        <p className="mt-1.5 text-[13px] text-newsroom-muted">
          {stories.length} {stories.length === 1 ? "story" : "stories"} on desk
        </p>
        <p className="mt-1 text-[11px] text-newsroom-muted/60">
          Updated {formatWhen(lastUpdated)}
        </p>
      </div>

      <div className="border-t border-newsroom-border/50 pt-5">
        <SectionLabel>Top 5</SectionLabel>
        {topFive.length ? (
          <ol className="mt-3 space-y-2.5">
            {topFive.map((s, i) => (
              <li key={s.id} className="flex gap-2.5">
                <span className="mt-0.5 w-5 shrink-0 font-mono text-[11px] tabular-nums text-newsroom-gold/60">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <Link
                  href={`/story/${s.id}`}
                  className="min-w-0 text-[13px] leading-snug text-white/80 transition-colors hover:text-newsroom-gold"
                >
                  <span className="line-clamp-2">{s.headline || "information unavailable"}</span>
                </Link>
              </li>
            ))}
          </ol>
        ) : (
          <p className="mt-3 text-sm text-newsroom-muted">No stories yet.</p>
        )}
      </div>

      <div className="border-t border-newsroom-border/50 pt-5">
        <SectionLabel>Archive</SectionLabel>
        <Link
          href="/archive"
          className="mt-2.5 inline-block text-sm text-newsroom-muted transition-colors hover:text-white"
        >
          Browse past Top 5 →
        </Link>
      </div>

      <div className="border-t border-newsroom-border/50 pt-5">
        <SectionLabel>Desks</SectionLabel>
        <p className="mt-2 text-[12px] leading-relaxed text-newsroom-muted/80">
          Switch category above, or jump here:
        </p>
        <div className="mt-3 flex flex-col gap-1.5">
          {(["movies_tv", "gaming"] as Category[]).map((c) => {
            const active = category === c;
            return (
              <button
                key={c}
                type="button"
                onClick={() => setCategory(c)}
                className={cn(
                  "rounded px-2.5 py-1.5 text-left text-sm transition-colors",
                  active
                    ? "bg-white/[0.04] text-white"
                    : "text-newsroom-muted hover:bg-white/[0.03] hover:text-white"
                )}
              >
                {c === "movies_tv" ? "Movies & TV" : "Gaming"}
                {active ? (
                  <span className="ml-2 text-[10px] uppercase tracking-wider text-newsroom-gold/70">
                    active
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>
    </aside>
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
  const topFive = useMemo(() => stories.slice(0, 5), [stories]);
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
    <div className="mx-auto max-w-newsroom px-4 py-5 sm:px-6 lg:px-8 xl:px-10">
      <header className="mb-6 flex flex-col gap-5 border-b border-newsroom-border/70 pb-5 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-newsroom-gold/90">
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
            className="rounded-md border border-newsroom-border/80 bg-transparent px-3.5 py-2 text-sm text-newsroom-muted transition-colors hover:border-newsroom-border-strong hover:text-white"
          >
            Archive
          </Link>
          <button
            type="button"
            onClick={onRefresh}
            disabled={refreshing}
            className="rounded-md bg-newsroom-gold px-4 py-2 text-sm font-bold text-black transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {refreshing ? "Refreshing…" : "REFRESH NEWS"}
          </button>
        </div>
      </header>

      <div className="mb-5 flex flex-wrap items-center gap-3">
        {(["movies_tv", "gaming"] as Category[]).map((c) => {
          const active = category === c;
          const gaming = c === "gaming";
          return (
            <button
              key={c}
              type="button"
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
        <span className="text-[11px] uppercase tracking-wider text-newsroom-muted/70">
          Last updated {formatWhen(lastUpdated)}
        </span>
        <span className="hidden text-[11px] text-newsroom-muted/45 sm:inline">
          · {isGaming ? "Gaming desk" : "Movies & TV desk"}
        </span>
      </div>

      {message && (
        <div className="mb-6 rounded-md border border-newsroom-border/60 bg-newsroom-panel/50 px-3.5 py-2.5 text-sm text-newsroom-muted">
          {message}
        </div>
      )}

      {loading ? (
        <p className="text-newsroom-muted">Loading…</p>
      ) : !stories.length ? (
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_15rem] lg:gap-10 xl:grid-cols-[minmax(0,1fr)_15.5rem] xl:gap-12">
          <p className="text-newsroom-muted">No stories yet. Hit REFRESH NEWS.</p>
          <Sidebar
            category={category}
            setCategory={setCategory}
            stories={stories}
            lastUpdated={lastUpdated}
            topFive={topFive}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_15rem] lg:gap-10 xl:grid-cols-[minmax(0,1fr)_15.5rem] xl:gap-12">
          {/* LEFT — main feed */}
          <div className="min-w-0">
            {topStory && (
              <section className="mb-6 border-b border-newsroom-border/55 pb-6">
                <div className="mb-3">
                  <SectionLabel>Top Story</SectionLabel>
                </div>
                <StoryCard story={topStory} rank={1} variant="featured" />
              </section>
            )}

            {supporting.length > 0 && (
              <section className="mb-6 border-b border-newsroom-border/45 pb-5">
                <div className="mb-1 flex items-baseline justify-between gap-3">
                  <SectionLabel>Top Stories</SectionLabel>
                  <span className="font-mono text-[11px] tabular-nums text-newsroom-muted/45">
                    02–{String(supporting.length + 1).padStart(2, "0")}
                  </span>
                </div>
                <div className="divide-y divide-newsroom-border/40 md:grid md:grid-cols-2 md:items-stretch md:gap-x-8 md:gap-y-0 md:divide-y-0 lg:gap-x-10">
                  {supporting.map((s, i) => (
                    <div
                      key={s.id}
                      className={cn(
                        "flex h-full flex-col md:border-b md:border-newsroom-border/40",
                        i % 2 === 0 ? "md:pr-1" : "md:pl-1",
                        i >= 2 ? "md:border-b-0" : ""
                      )}
                    >
                      <StoryCard story={s} rank={i + 2} variant="supporting" />
                    </div>
                  ))}
                </div>
              </section>
            )}

            <section className="mb-5">
              <div className="mb-2.5 flex flex-wrap items-center gap-3 border-b border-newsroom-border/45 pb-2.5">
                <SectionLabel>More Stories</SectionLabel>
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
                <div className="divide-y divide-newsroom-border/35">
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
          </div>

          {/* RIGHT — restrained sidebar (desktop); below feed on mobile */}
          <Sidebar
            category={category}
            setCategory={setCategory}
            stories={stories}
            lastUpdated={lastUpdated}
            topFive={topFive}
          />
        </div>
      )}
    </div>
  );
}
