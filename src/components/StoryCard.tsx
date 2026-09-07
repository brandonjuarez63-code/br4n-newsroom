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
    ? "text-newsroom-electric/75 border-newsroom-electric/18"
    : "text-newsroom-gold/75 border-newsroom-gold/18";
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
}: {
  importance?: number | null;
  confidence?: number | null;
}) {
  return (
    <span className="tabular-nums text-[10px] tracking-wide text-newsroom-muted/55">
      Imp {importance ?? "—"}
      <span className="mx-1 opacity-30">·</span>
      Conf {confidence ?? "—"}
    </span>
  );
}

function StoryActions({
  breakdownHref,
  sourceHref,
  hasPrimary,
  compact,
}: {
  breakdownHref: string | null;
  sourceHref: string | null;
  hasPrimary: boolean;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-4 gap-y-1.5",
        compact ? "mt-2" : "mt-4 border-t border-newsroom-border/40 pt-3"
      )}
    >
      {breakdownHref ? (
        <Link
          href={breakdownHref}
          className="text-xs font-medium tracking-wide text-newsroom-gold/85 transition-colors hover:text-newsroom-gold"
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
          className="text-xs font-medium tracking-wide text-newsroom-electric/85 transition-colors hover:text-newsroom-electric"
        >
          Read Source →
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
    <div className="flex flex-wrap items-center gap-2">
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
        <span className="text-[11px] text-newsroom-muted/70">
          +{publications.length - limit}
        </span>
      )}
    </div>
  );
}

/** Editorial thumb — float-right for featured/supporting; compact stays a side thumb. */
function StoryThumb({
  src,
  href,
  size,
  onFail,
}: {
  src: string;
  href: string | null;
  size: "featured" | "supporting" | "compact";
  onFail: () => void;
}) {
  const box =
    size === "featured"
      ? // Mobile: full-width block; sm+: fixed float-right so text wraps underneath
        "mb-3 w-full float-none sm:float-right sm:mb-3 sm:ml-5 sm:h-[14rem] sm:w-[21.5rem] md:h-[16rem] md:w-[24.5rem] lg:h-[17.5rem] lg:w-[27rem] aspect-[16/10] sm:aspect-auto"
      : size === "supporting"
        ? "float-right mb-2.5 ml-3.5 h-[5.75rem] w-[9.5rem] sm:mb-3 sm:ml-4 sm:h-[7rem] sm:w-[11.5rem] md:h-[7.75rem] md:w-[13rem]"
        : "h-[3.25rem] w-[4.5rem] sm:h-[3.75rem] sm:w-[5.25rem]";

  const img = (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      className="h-full w-full object-cover"
      loading="lazy"
      decoding="async"
      onError={onFail}
    />
  );

  return (
    <div
      className={cn(
        "relative overflow-hidden bg-newsroom-panel/40",
        size === "featured" ? "rounded-md" : "rounded",
        size === "compact" ? "shrink-0" : "",
        box
      )}
    >
      {href ? (
        <Link
          href={href}
          className="block h-full w-full outline-none transition-opacity hover:opacity-90 focus-visible:ring-1 focus-visible:ring-newsroom-gold/50"
          aria-label="Open story"
        >
          {img}
        </Link>
      ) : (
        img
      )}
    </div>
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
  const storyHref =
    typeof storyId === "number" && Number.isFinite(storyId)
      ? `/story/${storyId}`
      : null;
  const breakdownHref = storyHref ? `${storyHref}#source-breakdown` : null;
  const category = story.category;

  const variant: StoryCardVariant =
    variantProp ||
    (featured || rank === 1 ? "featured" : compact ? "compact" : "supporting");

  const rawImageUrl = pickImageUrl(story);
  const [imgFailed, setImgFailed] = useState(false);
  const imageUrl = rawImageUrl && !imgFailed ? rawImageUrl : null;

  const rankLabel =
    typeof rank === "number" ? String(rank).padStart(2, "0") : null;

  const headline = story.headline || "information unavailable";

  const Headline = ({ className }: { className: string }) => (
    <h3 className={className}>
      {storyHref ? (
        <Link
          href={storyHref}
          className="outline-none transition-colors hover:text-newsroom-gold focus-visible:text-newsroom-gold"
        >
          {headline}
        </Link>
      ) : (
        <span>{headline}</span>
      )}
    </h3>
  );

  /* ---------- FEATURED (#1 Top Story) — editorial float, not two-col ---------- */
  if (variant === "featured") {
    return (
      <article className="group relative">
        <div className="mb-3.5 flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
          {rankLabel && (
            <span className="font-mono text-sm tabular-nums text-newsroom-gold">
              #{rank === 1 ? "1" : rankLabel}
            </span>
          )}
          <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-newsroom-gold/90">
            Top Story
          </span>
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
          />
          {story.is_sample === 1 && (
            <span className="rounded border border-newsroom-border/70 px-1.5 py-0.5 text-[10px] text-newsroom-muted">
              SAMPLE
            </span>
          )}
        </div>

        {/* Float body: image upper-right; text wraps full-width under it */}
        <div>
          {imageUrl ? (
            <StoryThumb
              src={imageUrl}
              href={storyHref}
              size="featured"
              onFail={() => setImgFailed(true)}
            />
          ) : null}

          <Headline className="text-[1.75rem] font-semibold leading-[1.15] tracking-tight text-white text-balance sm:text-[2rem] md:text-[2.28rem]" />

          <p className="mt-4 text-[15px] leading-relaxed text-newsroom-muted line-clamp-4 md:line-clamp-5">
            {story.summary || "information unavailable"}
          </p>

          <p className="mt-3 text-sm leading-relaxed text-newsroom-muted/85">
            <span className="font-medium text-white/65">Why it matters</span>
            <span className="mx-1.5 text-newsroom-border">—</span>
            {story.why_it_matters || "information unavailable"}
          </p>
        </div>

        {/* Clear so meta/actions sit full-width below the float */}
        <div className="clear-both">
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
            <span className="text-[11px] text-newsroom-muted/55">
              Updated {formatWhen(story.updated_at)}
            </span>
          </div>

          <StoryActions
            breakdownHref={breakdownHref}
            sourceHref={sourceHref}
            hasPrimary={Boolean(primary)}
          />
        </div>
      </article>
    );
  }

  /* ---------- COMPACT (More Stories) ---------- */
  if (variant === "compact") {
    return (
      <article className="group relative py-3.5 transition-colors hover:bg-white/[0.015] sm:px-1">
        <div className="flex gap-3 sm:gap-4">
          {typeof rank === "number" && (
            <span className="mt-0.5 w-6 shrink-0 font-mono text-[11px] tabular-nums text-newsroom-muted/40">
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
              />
              {story.is_sample === 1 && (
                <span className="text-[9px] uppercase tracking-wide text-newsroom-muted/65">
                  Sample
                </span>
              )}
            </div>

            <Headline className="text-[15px] font-semibold leading-snug tracking-tight text-white/95 text-balance" />

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
              breakdownHref={breakdownHref}
              sourceHref={sourceHref}
              hasPrimary={Boolean(primary)}
              compact
            />
          </div>

          {imageUrl ? (
            <div className="self-start pt-0.5">
              <StoryThumb
                src={imageUrl}
                href={storyHref}
                size="compact"
                onFail={() => setImgFailed(true)}
              />
            </div>
          ) : null}
        </div>
      </article>
    );
  }

  /* ---------- SUPPORTING (#2–#5) — float-right editorial wrap ---------- */
  return (
    <article className="group relative py-3.5 sm:py-4">
      <div className="flex gap-3 sm:gap-3.5">
        {rankLabel && (
          <span className="mt-0.5 w-7 shrink-0 font-mono text-xs tabular-nums text-newsroom-gold/65">
            {rankLabel}
          </span>
        )}

        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
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
            />
            {story.is_sample === 1 && (
              <span className="rounded border border-newsroom-border/70 px-1.5 py-0.5 text-[10px] text-newsroom-muted">
                SAMPLE
              </span>
            )}
          </div>

          {/* Float body: image upper-right; headline/summary wrap underneath */}
          <div>
            {imageUrl ? (
              <StoryThumb
                src={imageUrl}
                href={storyHref}
                size="supporting"
                onFail={() => setImgFailed(true)}
              />
            ) : null}

            <Headline className="text-[1.05rem] font-semibold leading-snug tracking-tight text-white text-balance sm:text-lg" />

            <p className="mt-1.5 text-sm leading-relaxed text-newsroom-muted line-clamp-2 sm:line-clamp-3">
              {story.summary || "information unavailable"}
            </p>
          </div>

          <div className="clear-both mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
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
            <span className="text-[11px] text-newsroom-muted/55">
              Updated {formatWhen(story.updated_at)}
            </span>
          </div>

          <StoryActions
            breakdownHref={breakdownHref}
            sourceHref={sourceHref}
            hasPrimary={Boolean(primary)}
            compact
          />
        </div>
      </div>
    </article>
  );
}
