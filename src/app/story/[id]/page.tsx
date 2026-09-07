import Link from "next/link";
import { notFound } from "next/navigation";
import { getStoryByIdAsync } from "@/lib/db";
import { StatusBadge } from "@/components/StatusBadge";
import { StorySummary } from "@/components/StorySummary";
import { PublisherLogo, SourceRow } from "@/components/PublisherLogo";
import { formatWhen, safeArticleHref, cn } from "@/lib/utils";
import {
  confidenceScoreLine,
  importanceScoreLine,
  plainWhyConfidence,
  plainWhyImportance,
  scoringDetailLines,
} from "@/lib/storyPresentation";
import { synthesizeStorySummaries } from "@/lib/summary/synthesize";

export const dynamic = "force-dynamic";

const UNAVAILABLE = "information unavailable";

function textOrUnavailable(value: string | null | undefined): string {
  const t = (value ?? "").trim();
  return t ? t : UNAVAILABLE;
}

export default async function StoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const numericId = Number(id);
  if (!Number.isFinite(numericId) || numericId <= 0) notFound();

  const story = await getStoryByIdAsync(numericId);
  if (!story || story.id !== numericId) notFound();

  const articles = Array.isArray(story.articles) ? story.articles : [];
  const importanceDetails = scoringDetailLines(story.why_importance);
  const confidenceDetails = scoringDetailLines(story.why_confidence);
  const summaries = await synthesizeStorySummaries(story);
  const isGaming = story.category === "gaming";
  const primary =
    articles.find((a) => a?.id === story.primary_article_id) || articles[0];
  const primaryHref = safeArticleHref(primary?.url);

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <Link
        href="/"
        className="text-sm text-newsroom-gold transition-colors hover:text-newsroom-gold/80"
      >
        ← Back to newsroom
      </Link>

      {/* Headline first */}
      <h1 className="mt-5 text-balance text-3xl font-bold tracking-tight text-white md:text-[2rem] md:leading-tight">
        {textOrUnavailable(story.headline)}
      </h1>

      {/* Source / pub / date */}
      <div className="mt-3">
        {primary ? (
          <SourceRow
            publication={primary.source_name}
            author={primary.author}
            date={formatWhen(primary.published_at || story.updated_at)}
            url={primary.url}
            twoLine
          />
        ) : (
          <p className="text-sm text-newsroom-muted">{UNAVAILABLE}</p>
        )}
      </div>

      {/* Status + confidence (visible, not dominating) */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span
          className={cn(
            "rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em]",
            isGaming
              ? "border-newsroom-electric/25 bg-newsroom-electric/5 text-newsroom-electric/90"
              : "border-newsroom-gold/25 bg-newsroom-gold/5 text-newsroom-gold/90"
          )}
        >
          {isGaming ? "Gaming" : "Movies & TV"}
        </span>
        <StatusBadge status={story.status} />
        <span className="text-[11px] tabular-nums text-newsroom-muted">
          Importance {story.importance ?? UNAVAILABLE}
          <span className="mx-1 opacity-40">·</span>
          Confidence {story.confidence ?? UNAVAILABLE}
        </span>
        {story.is_sample === 1 && (
          <span className="rounded border border-newsroom-border px-1.5 py-0.5 text-[10px] text-newsroom-muted">
            SAMPLE
          </span>
        )}
      </div>

      <section className="mt-6 space-y-7 rounded-xl border border-newsroom-border bg-newsroom-card p-5 sm:p-6">
        {/* Short summary → Read more */}
        <StorySummary
          shortSummary={summaries.short}
          longSummary={summaries.long}
        />

        {primaryHref && (
          <a
            href={primaryHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex text-xs font-semibold tracking-wide text-newsroom-electric transition-colors hover:text-newsroom-electric/80"
          >
            Read source →
          </a>
        )}

        {/* Why it matters */}
        <div>
          <h2
            className={cn(
              "text-[11px] font-semibold uppercase tracking-[0.14em]",
              isGaming ? "text-newsroom-electric" : "text-newsroom-gold"
            )}
          >
            Why it matters
          </h2>
          <p className="mt-2 text-lg font-semibold tabular-nums text-white">
            {importanceScoreLine(story)}
          </p>
          <p className="mt-2 text-sm leading-relaxed text-newsroom-muted">
            {plainWhyImportance(story)}
          </p>
        </div>

        <div>
          <h2
            className={cn(
              "text-[11px] font-semibold uppercase tracking-[0.14em]",
              isGaming ? "text-newsroom-electric" : "text-newsroom-gold"
            )}
          >
            Confidence
          </h2>
          <p className="mt-2 text-lg font-semibold tabular-nums text-white">
            {confidenceScoreLine(story)}
          </p>
          <p className="mt-2 text-sm leading-relaxed text-newsroom-muted">
            {plainWhyConfidence(story)}
          </p>
        </div>

        <details className="rounded-lg border border-newsroom-border bg-newsroom-panel/80 p-3.5">
          <summary className="cursor-pointer text-sm font-semibold text-newsroom-gold">
            Technical details
          </summary>
          <div className="mt-3 space-y-3 text-xs text-newsroom-muted">
            <div>
              <p className="font-semibold text-white/70">Importance factors</p>
              {importanceDetails.length ? (
                <ul className="mt-1 list-inside list-disc">
                  {importanceDetails.map((line) => (
                    <li key={`imp-${line}`}>{line}</li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1">{UNAVAILABLE}</p>
              )}
            </div>
            <div>
              <p className="font-semibold text-white/70">Confidence factors</p>
              {confidenceDetails.length ? (
                <ul className="mt-1 list-inside list-disc">
                  {confidenceDetails.map((line) => (
                    <li key={`conf-${line}`}>{line}</li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1">{UNAVAILABLE}</p>
              )}
            </div>
            <p className="text-[11px] opacity-70">
              Stored technical strings are for transparency only. Scores themselves are
              unchanged.
            </p>
          </div>
        </details>
      </section>

      <section id="source-breakdown" className="mt-8 scroll-mt-6">
        <h2 className="mb-3 text-lg font-bold tracking-tight text-white">
          Source Breakdown
        </h2>
        {!articles.length ? (
          <p className="rounded-lg border border-newsroom-border bg-newsroom-panel p-3.5 text-sm text-newsroom-muted">
            Source Breakdown {UNAVAILABLE} for this story.
          </p>
        ) : (
          <ul className="space-y-2.5">
            {articles.map((a) => {
              const href = safeArticleHref(a?.url);
              const publication =
                (a?.source_name && String(a.source_name).trim()) || UNAVAILABLE;
              const author =
                a?.author && String(a.author).trim()
                  ? String(a.author).trim()
                  : "Author not listed";
              const reliability =
                typeof a?.source_reliability === "number"
                  ? `${a.source_reliability}/100`
                  : UNAVAILABLE;
              const sourceType = a?.source_type || UNAVAILABLE;
              const title = textOrUnavailable(a?.title);
              return (
                <li
                  key={a?.id ?? `${publication}-${title}`}
                  className="rounded-xl border border-newsroom-border bg-newsroom-panel/90 p-3.5 transition-colors hover:border-newsroom-border-strong"
                >
                  <div className="flex flex-wrap items-center gap-2 text-xs text-newsroom-muted">
                    <span className="inline-flex items-center gap-1.5 font-semibold text-white/90">
                      <PublisherLogo name={publication} url={a?.url} size="sm" />
                      {publication}
                    </span>
                    <span className="opacity-50">·</span>
                    <span>Reliability {reliability}</span>
                    <span className="opacity-50">·</span>
                    <span>{sourceType}</span>
                  </div>
                  {href ? (
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1.5 block text-sm font-medium leading-snug text-white transition-colors hover:text-newsroom-gold"
                    >
                      {title}
                    </a>
                  ) : (
                    <p className="mt-1.5 text-sm font-medium text-white">
                      {title}
                      <span className="ml-2 text-xs font-normal text-newsroom-muted">
                        (source link unavailable)
                      </span>
                    </p>
                  )}
                  <p className="mt-1 text-[11px] text-newsroom-muted">
                    {author} · {formatWhen(a?.published_at)}
                  </p>
                  {href && (
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2.5 inline-block text-xs font-semibold tracking-wide text-newsroom-gold transition-colors hover:text-newsroom-gold/80"
                    >
                      Read source →
                    </a>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
