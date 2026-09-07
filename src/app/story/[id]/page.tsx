import Link from "next/link";
import { notFound } from "next/navigation";
import { getStoryByIdAsync } from "@/lib/db";
import { StatusBadge } from "@/components/StatusBadge";
import { formatWhen, safeArticleHref } from "@/lib/utils";
import {
  highlyReliableSourceCount,
  highestReliability,
  independentReputableCount,
  plainWhatWeDontKnow,
  plainWhatWeKnow,
  plainWhyImportance,
  scoringDetailLines,
} from "@/lib/storyPresentation";

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
  const indieCount = independentReputableCount(story);
  const bestRel = highestReliability(story);
  const highRelCount = highlyReliableSourceCount(story);
  const importanceDetails = scoringDetailLines(story.why_importance);
  const confidenceDetails = scoringDetailLines(story.why_confidence);
  const officialYesNo =
    story.official_confirmed === 1
      ? "Yes"
      : story.official_confirmed === 0
        ? "No"
        : UNAVAILABLE;

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <Link href="/" className="text-sm text-newsroom-gold hover:underline">
        ← Back to newsroom
      </Link>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <StatusBadge status={story.status} />
        <span className="text-xs text-newsroom-muted">
          {story.category === "movies_tv" ? "Movies & TV" : "Gaming"}
        </span>
        {story.is_sample === 1 && (
          <span className="rounded border border-newsroom-border px-1.5 py-0.5 text-[10px] text-newsroom-muted">
            SAMPLE
          </span>
        )}
      </div>
      <h1 className="mt-3 text-3xl font-bold text-white">
        {textOrUnavailable(story.headline)}
      </h1>
      <p className="mt-2 text-sm text-newsroom-muted">
        Importance {story.importance ?? UNAVAILABLE}/100 · Confidence{" "}
        {story.confidence ?? UNAVAILABLE}/100 · {story.status || UNAVAILABLE}
      </p>

      <section className="mt-6 space-y-5 rounded-xl border border-newsroom-border bg-newsroom-card p-5">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-newsroom-gold">
            Summary
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-newsroom-muted">
            {textOrUnavailable(story.summary)}
          </p>
        </div>

        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-newsroom-gold">
            Why it matters
          </h2>
          <p className="mt-1 text-sm leading-relaxed">
            {textOrUnavailable(story.why_it_matters)}
          </p>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-newsroom-electric">
              What we know
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-newsroom-muted">
              {plainWhatWeKnow(story)}
            </p>
          </div>
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-newsroom-muted">
              What we don&apos;t know
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-newsroom-muted">
              {plainWhatWeDontKnow(story)}
            </p>
          </div>
        </div>

        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-newsroom-gold">
            Why importance
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-newsroom-muted">
            {plainWhyImportance(story)}
          </p>
        </div>

        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-newsroom-gold">
            Why confidence / status
          </h2>
          <ul className="mt-2 space-y-1.5 text-sm text-newsroom-muted">
            <li>
              <span className="text-white/80">Independent reputable outlets:</span>{" "}
              {indieCount == null ? UNAVAILABLE : indieCount}
            </li>
            <li>
              <span className="text-white/80">Highest source reliability:</span>{" "}
              {bestRel == null ? UNAVAILABLE : `${bestRel}/100`}
            </li>
            <li>
              <span className="text-white/80">Highly reliable sources (≥85):</span>{" "}
              {highRelCount == null ? UNAVAILABLE : highRelCount}
            </li>
            <li>
              <span className="text-white/80">Official confirmation:</span>{" "}
              {officialYesNo}
            </li>
            <li>
              <span className="text-white/80">Confidence:</span>{" "}
              {typeof story.confidence === "number"
                ? `${story.confidence}/100`
                : UNAVAILABLE}
            </li>
            <li>
              <span className="text-white/80">Status:</span>{" "}
              {story.status || UNAVAILABLE}
            </li>
          </ul>
        </div>

        <details className="rounded-lg border border-newsroom-border bg-newsroom-panel p-3">
          <summary className="cursor-pointer text-sm font-semibold text-newsroom-gold">
            Show scoring details
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
              <p className="font-semibold text-white/70">Confidence factors / penalties</p>
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

      <section id="source-breakdown" className="mt-6">
        <h2 className="mb-3 text-lg font-bold text-white">Source Breakdown</h2>
        {!articles.length ? (
          <p className="rounded-lg border border-newsroom-border bg-newsroom-panel p-3 text-sm text-newsroom-muted">
            Source Breakdown {UNAVAILABLE} for this story.
          </p>
        ) : (
          <ul className="space-y-3">
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
                  className="rounded-lg border border-newsroom-border bg-newsroom-panel p-3"
                >
                  <div className="flex flex-wrap items-center gap-2 text-xs text-newsroom-muted">
                    <span className="font-semibold text-newsroom-electric">
                      {publication}
                    </span>
                    <span>Reliability {reliability}</span>
                    <span>{sourceType}</span>
                  </div>
                  {href ? (
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 block text-sm font-medium text-white hover:text-newsroom-gold"
                    >
                      {title}
                    </a>
                  ) : (
                    <p className="mt-1 text-sm font-medium text-white">
                      {title}
                      <span className="ml-2 text-xs font-normal text-newsroom-muted">
                        (source link unavailable)
                      </span>
                    </p>
                  )}
                  <p className="mt-1 text-xs text-newsroom-muted">
                    {author} · {formatWhen(a?.published_at)}
                  </p>
                  {href && (
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-block text-xs font-semibold uppercase tracking-wider text-newsroom-gold hover:underline"
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
