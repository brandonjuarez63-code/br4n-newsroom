"use client";

import Link from "next/link";
import type { Category, StoryWithArticles } from "@/lib/types";
import { StatusBadge } from "./StatusBadge";
import { PublisherLogo, SourceRow } from "./PublisherLogo";
import { formatWhen, safeArticleHref, cn } from "@/lib/utils";

function categoryAccent(category: Category): string {
  return category === "gaming"
    ? "from-newsroom-electric/10 via-transparent to-transparent"
    : "from-newsroom-gold/10 via-transparent to-transparent";
}

function categoryChip(category: Category): string {
  return category === "gaming"
    ? "text-newsroom-electric/90 border-newsroom-electric/25 bg-newsroom-electric/5"
    : "text-newsroom-gold/90 border-newsroom-gold/25 bg-newsroom-gold/5";
}

export function StoryCard({
  story,
  rank,
  compact,
  featured,
}: {
  story: StoryWithArticles;
  rank?: number;
  compact?: boolean;
  /** Extra visual weight for Top #1 */
  featured?: boolean;
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
  const isFeatured = Boolean(featured || rank === 1);
  const category = story.category;

  return (
    <article
      className={cn(
        "group relative overflow-hidden rounded-xl border border-newsroom-border bg-newsroom-card transition-colors duration-150",
        "hover:border-newsroom-border-strong hover:bg-newsroom-card-hover",
        isFeatured && !compact
          ? "p-5 md:p-6 md:col-span-2 shadow-lg shadow-black/20"
          : compact
            ? "px-4 py-3.5"
            : "p-4",
        isFeatured && !compact && "bg-gradient-to-br " + categoryAccent(category)
      )}
    >
      <div className="mb-2.5 flex flex-wrap items-center gap-2">
        {typeof rank === "number" && (
          <span
            className={cn(
              "inline-flex items-center justify-center rounded-md font-bold tabular-nums text-newsroom-gold",
              isFeatured && !compact
                ? "bg-newsroom-gold/20 px-2.5 py-1 text-sm"
                : "bg-newsroom-gold/15 px-2 py-0.5 text-xs"
            )}
          >
            #{rank}
          </span>
        )}
        <span
          className={cn(
            "rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em]",
            categoryChip(category)
          )}
        >
          {category === "movies_tv" ? "Movies & TV" : "Gaming"}
        </span>
        <StatusBadge status={story.status} />
        <span className="text-[11px] tabular-nums text-newsroom-muted/90">
          Imp {story.importance ?? "—"}
          <span className="mx-1 opacity-40">·</span>
          Conf {story.confidence ?? "—"}
        </span>
        {story.is_sample === 1 && (
          <span className="rounded border border-newsroom-border px-1.5 py-0.5 text-[10px] text-newsroom-muted">
            SAMPLE
          </span>
        )}
      </div>

      <h3
        className={cn(
          "font-semibold leading-snug tracking-tight text-white text-balance",
          isFeatured && !compact
            ? "text-xl md:text-2xl"
            : compact
              ? "text-base"
              : "text-lg"
        )}
      >
        {detailHref ? (
          <Link
            href={detailHref}
            className="outline-none transition-colors hover:text-newsroom-gold focus-visible:text-newsroom-gold"
          >
            {story.headline || "information unavailable"}
          </Link>
        ) : (
          <span>{story.headline || "information unavailable"}</span>
        )}
      </h3>

      {!compact && (
        <>
          <p
            className={cn(
              "mt-2.5 text-sm leading-relaxed text-newsroom-muted",
              isFeatured ? "line-clamp-4 md:max-w-3xl" : "line-clamp-3"
            )}
          >
            {story.summary || "information unavailable"}
          </p>
          <p className="mt-2.5 text-sm leading-relaxed text-newsroom-muted/95">
            <span
              className={cn(
                "font-medium",
                category === "gaming" ? "text-newsroom-electric" : "text-newsroom-gold"
              )}
            >
              Why it matters
            </span>
            <span className="mx-1.5 text-newsroom-border">—</span>
            {story.why_it_matters || "information unavailable"}
          </p>
        </>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
        {publications.length ? (
          <div className="flex flex-wrap items-center gap-1.5">
            {publications.slice(0, isFeatured ? 5 : 4).map((p) => {
              const art = articles.find((a) => a.source_name === p);
              return (
                <span
                  key={p}
                  className="inline-flex items-center gap-1.5 rounded-md border border-newsroom-border/80 bg-newsroom-panel/60 px-1.5 py-0.5 text-[11px] text-newsroom-muted"
                >
                  <PublisherLogo name={p} url={art?.url} size="xs" />
                  <span className="max-w-[9rem] truncate">{p}</span>
                </span>
              );
            })}
            {publications.length > (isFeatured ? 5 : 4) && (
              <span className="text-[11px] text-newsroom-muted">
                +{publications.length - (isFeatured ? 5 : 4)}
              </span>
            )}
          </div>
        ) : primary ? (
          <SourceRow
            publication={primary.source_name}
            author={primary.author}
            date={formatWhen(primary.published_at || story.updated_at)}
            url={primary.url}
          />
        ) : (
          <span className="text-[11px] text-newsroom-muted">information unavailable</span>
        )}
        <span className="text-[11px] text-newsroom-muted/80">
          Updated {formatWhen(story.updated_at)}
        </span>
      </div>

      <div className="mt-3.5 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-newsroom-border/60 pt-3">
        {detailHref ? (
          <Link
            href={detailHref}
            className="text-xs font-semibold tracking-wide text-newsroom-gold transition-colors hover:text-newsroom-gold/80"
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
            className="text-xs font-semibold tracking-wide text-newsroom-electric transition-colors hover:text-newsroom-electric/80"
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
