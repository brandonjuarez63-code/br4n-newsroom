"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { Category, StoryWithArticles } from "@/lib/types";
import { StoryCard } from "./StoryCard";
import { formatWhen } from "@/lib/utils";

export function NewsroomDashboard({ initialCategory }: { initialCategory: Category }) {
  const [category, setCategory] = useState<Category>(initialCategory);
  const [stories, setStories] = useState<StoryWithArticles[]>([]);
  const [sort, setSort] = useState("importance");
  const [tag, setTag] = useState("");
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [scriptCount, setScriptCount] = useState<1 | 3 | 5>(3);
  const [scriptBody, setScriptBody] = useState("");
  const [scriptEngine, setScriptEngine] = useState("");
  const [scriptBusy, setScriptBusy] = useState(false);
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

  async function onScript() {
    setScriptBusy(true);
    setScriptBody("");
    try {
      const res = await fetch("/api/script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, count: scriptCount }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Script failed");
      setScriptBody(json.body || "");
      setScriptEngine(json.engine || "");
    } catch (e) {
      setScriptBody(e instanceof Error ? e.message : "Script failed");
      setScriptEngine("error");
    } finally {
      setScriptBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <header className="mb-8 flex flex-col gap-4 border-b border-newsroom-border pb-6 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-newsroom-gold">
            Personal research desk
          </p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-white md:text-4xl">
            BR4N Newsroom
          </h1>
          <p className="mt-1 text-sm text-newsroom-muted">
            Refresh → verify sources → generate a spoken 1–2 min script
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/archive"
            className="rounded-lg border border-newsroom-border px-3 py-2 text-sm text-newsroom-muted hover:border-newsroom-gold/50 hover:text-white"
          >
            Archive
          </Link>
          <button
            onClick={onRefresh}
            disabled={refreshing}
            className="rounded-lg bg-newsroom-gold px-4 py-2 text-sm font-bold text-black disabled:opacity-60"
          >
            {refreshing ? "Refreshing…" : "REFRESH NEWS"}
          </button>
        </div>
      </header>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        {(["movies_tv", "gaming"] as Category[]).map((c) => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold ${
              category === c
                ? "bg-newsroom-electric text-black"
                : "border border-newsroom-border text-newsroom-muted hover:text-white"
            }`}
          >
            {c === "movies_tv" ? "Movies & TV" : "Gaming"}
          </button>
        ))}
        <span className="text-xs text-newsroom-muted">
          LAST UPDATED: {formatWhen(lastUpdated)}
        </span>
      </div>

      {message && (
        <div className="mb-4 rounded-lg border border-newsroom-border bg-newsroom-panel px-3 py-2 text-sm text-newsroom-muted">
          {message}
        </div>
      )}

      <section className="mb-10">
        <div className="mb-3 flex items-end justify-between">
          <h2 className="text-xl font-bold text-white">
            Top 5 · {category === "movies_tv" ? "Movies & TV" : "Gaming"}
          </h2>
        </div>
        {loading ? (
          <p className="text-newsroom-muted">Loading…</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {top5.map((s, i) => (
              <StoryCard key={s.id} story={s} rank={i + 1} />
            ))}
            {!top5.length && (
              <p className="text-newsroom-muted">No stories yet. Hit REFRESH NEWS.</p>
            )}
          </div>
        )}
      </section>

      <section className="mb-10 grid gap-6 lg:grid-cols-[1fr_320px]">
        <div>
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <h2 className="text-xl font-bold text-white">Full feed</h2>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="rounded-md border border-newsroom-border bg-newsroom-panel px-2 py-1 text-sm"
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
              className="rounded-md border border-newsroom-border bg-newsroom-panel px-2 py-1 text-sm"
            />
          </div>
          <div className="grid gap-3">
            {stories.map((s) => (
              <StoryCard key={s.id} story={s} compact />
            ))}
          </div>
        </div>

        <aside className="h-fit rounded-xl border border-newsroom-border bg-newsroom-panel p-4">
          <h2 className="text-lg font-bold text-white">Generate Script</h2>
          <p className="mt-1 text-xs text-newsroom-muted">
            Rule-based spoken script for Top 1 / 3 / 5. Optional OpenAI if key set.
          </p>
          <div className="mt-3 flex gap-2">
            {([1, 3, 5] as const).map((n) => (
              <button
                key={n}
                onClick={() => setScriptCount(n)}
                className={`rounded-md px-3 py-1 text-sm font-semibold ${
                  scriptCount === n
                    ? "bg-newsroom-gold text-black"
                    : "border border-newsroom-border text-newsroom-muted"
                }`}
              >
                Top {n}
              </button>
            ))}
          </div>
          <button
            onClick={onScript}
            disabled={scriptBusy}
            className="mt-4 w-full rounded-lg border border-newsroom-electric/50 bg-newsroom-electric/10 px-3 py-2 text-sm font-bold text-newsroom-electric disabled:opacity-60"
          >
            {scriptBusy ? "Generating…" : "Generate spoken script"}
          </button>
          {scriptEngine && (
            <p className="mt-2 text-[11px] text-newsroom-muted">Engine: {scriptEngine}</p>
          )}
          {scriptBody && (
            <pre className="mt-3 max-h-[480px] overflow-auto whitespace-pre-wrap rounded-lg border border-newsroom-border bg-newsroom-bg p-3 text-xs leading-relaxed text-newsroom-muted">
              {scriptBody}
            </pre>
          )}
        </aside>
      </section>
    </div>
  );
}
