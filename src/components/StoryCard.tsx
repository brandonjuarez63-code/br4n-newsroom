"use client";

import Link from "next/link";
import type { StoryWithArticles } from "@/lib/types";
import { StatusBadge } from "./StatusBadge";
import { formatWhen, safeArticleHref } from "@/lib/utils";

export function StoryCard({
  story,
  rank,
  compact,
}: {
  story: StoryWithArticles;
  rank?: number;
  compact?: boolean;
}) {
  const articles = Array.isArray(story?.articles) ? story.articles : [];
  const publications = Array.isArray(story?.publications) ? story.publications : [];
  const primary =
    articles.find((a) => a?.id === story?.primary_article_id) || articles[0];
  const sourceHref = safeArticleHref(primary?.url);
  const storyId = story?.id;
  const detailHref =
    typeof storyId === "number" && Number.isFinite(storyId)
      ? `/story/${storyId}#source-breakdown`
      : null;

  return (
    <article className="rounded-xl border border-newsroom-border bg-newsroom-card p-4 shadow-sm transition hover:border-newsroom-gold/40">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        {typeof rank === "number" && (
          <span className="rounded bg-newsroom-gold/20 px-2 py-0.5 text-xs font-bold text-newsroom-gold">
            #{rank}
          </span>
        )}
        <StatusBadge status={story.status} />
        <span className="text-[11px] text-newsroom-muted">
          Importance {story.importance ?? "—"} · Confidence {story.confidence ?? "—"}
        </span>
        {story.is_sample === 1 && (
          <span className="rounded border border-newsroom-border px-1.5 py-0.5 text-[10px] text-newsroom-muted">
            SAMPLE
          </span>
        )}
      </div>
      <h3 className="text-lg font-semibold leading-snug text-white">
        {detailHref ? (
          <Link href={detailHref} className="hover:text-newsroom-gold">
            {story.headline || "information unavailable"}
          </Link>
        ) : (
          <span>{story.headline || "information unavailable"}</span>
        )}
      </h3>
      {!compact && (
        <>
          <p className="mt-2 text-sm text-newsroom-muted line-clamp-3">
            {story.summary || "information unavailable"}
          </p>
          <p className="mt-2 text-sm text-newsroom-electric/90">
            <span className="font-medium text-newsroom-electric">Why it matters:</span>{" "}
            {story.why_it_matters || "information unavailable"}
          </p>
        </>
      )}
      <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-newsroom-muted">
        {publications.length ? (
          publications.map((p) => (
            <span key={p} className="rounded-md border border-newsroom-border px-2 py-0.5">
              {p}
            </span>
          ))
        ) : (
          <span className="rounded-md border border-newsroom-border px-2 py-0.5">
            information unavailable
          </span>
        )}
        <span>Updated {formatWhen(story.updated_at)}</span>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-4">
        {detailHref ? (
          <Link
            href={detailHref}
            className="text-xs font-semibold uppercase tracking-wider text-newsroom-gold hover:underline"
          >
            Source Breakdown →
          </Link>
        ) : (
          <span className="text-xs text-newsroom-muted">Source Breakdown unavailable</span>
        )}
        {sourceHref ? (
          <a
            href={sourceHref}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-semibold uppercase tracking-wider text-newsroom-electric hover:underline"
          >
            Read source →
          </a>
        ) : primary ? (
          <span className="text-xs text-newsroom-muted">Source link unavailable</span>
        ) : null}
      </div>
    </article>
  );
}
