"use client";

import Link from "next/link";
import { useState } from "react";
import type { Category, StoryWithArticles } from "@/lib/types";
import { StatusBadge } from "./StatusBadge";
import { PublisherLogo, SourceRow } from "./PublisherLogo";
import { formatWhen, safeArticleHref, cn } from "@/lib/utils";

export type StoryCardVariant = "featured" | "supporting" | "compact";

function categoryLabel(category: Category): string {
  return category === "movies_tv" ? "Movies & TV" : "Gaming";
}

function categoryChip(category: Category): string {
  return category === "gaming"
    ? "text-newsroom-electric/80 border-newsroom-electric/20 bg-newsroom-electric/[0.04]"
    : "text-newsroom-gold/80 border-newsroom-gold/20 bg-newsroom-gold/[0.04]";
}

function pickImageUrl(story: StoryWithArticles): string | null {
  const articles = Array.isArray(story?.articles) ? story.articles : [];
  const primary =
    articles.find((a) => a?.id === story?.primary_article_id) || articles[0];
  const candidates = [primary, ...articles].filter(Boolean);
  for (const a of candidates) {
    const url = (a as { image_url?: string | null })?.image_url;
    if (typeof url === "string" && /^https?:\/\//i.test(url.trim())) {
      return url.trim();
    }
  }
  return null;
}

function MetaScores({
  importance,
  confidence,
  quiet,
}: {
  importance?: number | null;
  confidence?: number | null;
  quiet?: boolean;
}) {
  return (
    <span
      className={cn(
        "tabular-nums text-newsroom-muted/70",
        quiet ? "text-[10px]" : "text-[11px]"
      )}
    >
      Imp {importance ?? "—"}
      <span className="mx-1 opacity-35">·</span>
      Conf {confidence ?? "—"}
    </span>
  );
}

function StoryActions({
  detailHref,
  sourceHref,
  hasPrimary,
  compact,
}: {
  detailHref: string | null;
  sourceHref: string | null;
  hasPrimary: boolean;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-4 gap-y-1.5",
        compact
          ? "mt-2"
          : "mt-3.5 border-t border-newsroom-border/50 pt-3"
      )}
    >
      {detailHref ? (
        <Link
          href={detailHref}
          className="text-xs font-medium tracking-wide text-newsroom-gold/90 transition-colors hover:text-newsroom-gold"
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
          className="text-xs font-medium tracking-wide text-newsroom-electric/90 transition-colors hover:text-newsroom-electric"
        >
          Read source →
        </a>
      ) : hasPrimary ? (
        <span className="text-xs text-newsroom-muted">Source link unavailable</span>
      ) : null}
    </div>
  );
}

function PublicationChips({
  publications,
  articles,
  limit,
}: {
  publications: string[];
  articles: StoryWithArticles["articles"];
  limit: number;
}) {
  if (!publications.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {publications.slice(0, limit).map((p) => {
        const art = articles.find((a) => a.source_name === p);
        return (
          <span
            key={p}
            className="inline-flex items-center gap-1.5 text-[11px] text-newsroom-muted"
          >
            <PublisherLogo name={p} url={art?.url} size="xs" />
            <span className="max-w-[8.5rem] truncate">{p}</span>
          </span>
        );
      })}
      {publications.length > limit && (
        <span className="text-[11px] text-newsroom-muted/80">
          +{publications.length - limit}
        </span>
      )}
    </div>
  );
}

function FeaturedImage({ src, alt }: { src: string; alt: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className="h-full w-full object-cover"
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
    />
  );
}

export function StoryCard({
  story,
  rank,
  compact,
  featured,
  variant: variantProp,
}: {
  story: StoryWithArticles;
  rank?: number;
  compact?: boolean;
  /** Extra visual weight for Top #1 */
  featured?: boolean;
  variant?: StoryCardVariant;
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
  const category = story.category;

  const variant: StoryCardVariant =
    variantProp ||
    (featured || rank === 1 ? "featured" : compact ? "compact" : "supporting");

  const imageUrl = variant === "featured" ? pickImageUrl(story) : null;
  const rankLabel =
    typeof rank === "number"
      ? String(rank).padStart(2, "0")
      : null;

  /* ---------- FEATURED (#1) ---------- */
  if (variant === "featured") {
    return (
      <article className="group relative overflow-hidden rounded-xl border border-newsroom-border/60 bg-newsroom-card/70 shadow-card">
        <div
          className={cn(
            "grid gap-0",
            imageUrl ? "md:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]" : ""
          )}
        >
          <div className="flex flex-col p-5 sm:p-6 md:p-7">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              {rankLabel && (
                <span className="font-mono text-xs tabular-nums text-newsroom-gold/80">
                  {rankLabel}
                </span>
              )}
              <span
                className={cn(
                  "rounded border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.06em]",
                  categoryChip(category)
                )}
              >
                {categoryLabel(category)}
              </span>
              <StatusBadge status={story.status} />
              <MetaScores
                importance={story.importance}
                confidence={story.confidence}
                quiet
              />
              {story.is_sample === 1 && (
                <span className="rounded border border-newsroom-border px-1.5 py-0.5 text-[10px] text-newsroom-muted">
                  SAMPLE
                </span>
              )}
            </div>

            <h3 className="text-2xl font-semibold leading-[1.2] tracking-tight text-white text-balance sm:text-3xl md:text-[2rem]">
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

            <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-newsroom-muted line-clamp-3 md:line-clamp-4">
              {story.summary || "information unavailable"}
            </p>

            <p className="mt-3 text-sm leading-relaxed text-newsroom-muted/90">
              <span className="font-medium text-white/70">Why it matters</span>
              <span className="mx-1.5 text-newsroom-border">—</span>
              {story.why_it_matters || "information unavailable"}
            </p>

            <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2">
              {publications.length ? (
                <PublicationChips
                  publications={publications}
                  articles={articles}
                  limit={5}
                />
              ) : primary ? (
                <SourceRow
                  publication={primary.source_name}
                  author={primary.author}
                  date={formatWhen(primary.published_at || story.updated_at)}
                  url={primary.url}
                />
              ) : (
                <span className="text-[11px] text-newsroom-muted">
                  information unavailable
                </span>
              )}
              <span className="text-[11px] text-newsroom-muted/65">
                Updated {formatWhen(story.updated_at)}
              </span>
            </div>

            <StoryActions
              detailHref={detailHref}
              sourceHref={sourceHref}
              hasPrimary={Boolean(primary)}
            />
          </div>

          {imageUrl ? (
            <div className="relative hidden min-h-[12rem] border-t border-newsroom-border/40 bg-newsroom-panel/40 md:block md:border-l md:border-t-0">
              <FeaturedImage src={imageUrl} alt="" />
            </div>
          ) : null}
        </div>
      </article>
    );
  }

  /* ---------- COMPACT (More Stories) ---------- */
  if (variant === "compact") {
    return (
      <article className="group relative py-3.5 transition-colors hover:bg-newsroom-card/25 sm:px-1">
        <div className="flex gap-3 sm:gap-4">
          {typeof rank === "number" && (
            <span className="mt-0.5 w-6 shrink-0 font-mono text-[11px] tabular-nums text-newsroom-muted/45">
              {rankLabel}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex flex-wrap items-center gap-1.5">
              <span
                className={cn(
                  "rounded border px-1 py-px text-[9px] font-medium uppercase tracking-[0.05em]",
                  categoryChip(category)
                )}
              >
                {categoryLabel(category)}
              </span>
              <StatusBadge status={story.status} className="!py-px !text-[9px]" />
              <MetaScores
                importance={story.importance}
                confidence={story.confidence}
                quiet
              />
              {story.is_sample === 1 && (
                <span className="text-[9px] uppercase tracking-wide text-newsroom-muted/70">
                  Sample
                </span>
              )}
            </div>

            <h3 className="text-[15px] font-semibold leading-snug tracking-tight text-white/95 text-balance">
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

            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
              {primary ? (
                <SourceRow
                  publication={primary.source_name || publications[0]}
                  author={primary.author}
                  date={formatWhen(primary.published_at || story.updated_at)}
                  url={primary.url}
                />
              ) : publications.length ? (
                <PublicationChips
                  publications={publications}
                  articles={articles}
                  limit={3}
                />
              ) : (
                <span className="text-[11px] text-newsroom-muted">
                  information unavailable
                </span>
              )}
            </div>

            <StoryActions
              detailHref={detailHref}
              sourceHref={sourceHref}
              hasPrimary={Boolean(primary)}
              compact
            />
          </div>
        </div>
      </article>
    );
  }

  /* ---------- SUPPORTING (#2–#5) ---------- */
  return (
    <article className="group relative flex h-full flex-col rounded-lg border border-newsroom-border/35 bg-newsroom-panel/30 px-4 py-4 transition-colors hover:border-newsroom-border/60 hover:bg-newsroom-card/50 sm:px-5 sm:py-5">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        {rankLabel && (
          <span className="font-mono text-xs tabular-nums text-newsroom-gold/70">
            {rankLabel}
          </span>
        )}
        <span
          className={cn(
            "rounded border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.06em]",
            categoryChip(category)
          )}
        >
          {categoryLabel(category)}
        </span>
        <StatusBadge status={story.status} />
        <MetaScores
          importance={story.importance}
          confidence={story.confidence}
          quiet
        />
        {story.is_sample === 1 && (
          <span className="rounded border border-newsroom-border px-1.5 py-0.5 text-[10px] text-newsroom-muted">
            SAMPLE
          </span>
        )}
      </div>

      <h3 className="text-base font-semibold leading-snug tracking-tight text-white text-balance sm:text-[1.05rem]">
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

      <p className="mt-2 flex-1 text-sm leading-relaxed text-newsroom-muted line-clamp-3">
        {story.summary || "information unavailable"}
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5">
        {publications.length ? (
          <PublicationChips
            publications={publications}
            articles={articles}
            limit={3}
          />
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
        <span className="text-[11px] text-newsroom-muted/65">
          Updated {formatWhen(story.updated_at)}
        </span>
      </div>

      <StoryActions
        detailHref={detailHref}
        sourceHref={sourceHref}
        hasPrimary={Boolean(primary)}
      />
    </article>
  );
}
