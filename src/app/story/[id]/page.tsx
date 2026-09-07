import Link from "next/link";
import { notFound } from "next/navigation";
import { getStoryByIdAsync } from "@/lib/db";
import { StatusBadge } from "@/components/StatusBadge";
import { formatWhen, safeArticleHref } from "@/lib/utils";
import type { StoryWithArticles } from "@/lib/types";

export const dynamic = "force-dynamic";

const UNAVAILABLE = "information unavailable";

function textOrUnavailable(value: string | null | undefined): string {
  const t = (value ?? "").trim();
  return t ? t : UNAVAILABLE;
}

/** Count independent reputable outlets from stored article/source fields only. */
function independentReputableCount(story: StoryWithArticles): number | null {
  const articles = Array.isArray(story.articles) ? story.articles : [];
  if (!articles.length) return null;
  const ids = new Set<number>();
  for (const a of articles) {
    const rel = a.source_reliability;
    const type = a.source_type;
    const reputable =
      (typeof rel === "number" && rel >= 80) ||
      type === "industry" ||
      type === "official";
    if (reputable && typeof a.source_id === "number") ids.add(a.source_id);
  }
  return ids.size;
}

/** Split stored why_confidence into factor lines — no new scoring. */
function confidenceFactorLines(why: string | null | undefined): string[] {
  const raw = (why ?? "").trim();
  if (!raw) return [];
  return raw
    .replace(/\.$/, "")
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
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
  const pubs = Array.isArray(story.publications) ? story.publications : [];
  const indieCount = independentReputableCount(story);
  const confFactors = confidenceFactorLines(story.why_confidence);

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
        Importance {story.importance ?? UNAVAILABLE} · Confidence{" "}
        {story.confidence ?? UNAVAILABLE} · Status {story.status || UNAVAILABLE} ·
        Updated {formatWhen(story.updated_at)}
      </p>

      <section className="mt-6 space-y-4 rounded-xl border border-newsroom-border bg-newsroom-card p-5">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-newsroom-gold">
            Summary
          </h2>
          <p className="mt-1 text-sm text-newsroom-muted">
            {textOrUnavailable(story.summary)}
          </p>
        </div>
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-newsroom-gold">
            Why it matters
          </h2>
          <p className="mt-1 text-sm">{textOrUnavailable(story.why_it_matters)}</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-newsroom-electric">
              What we know
            </h2>
            <p className="mt-1 text-sm text-newsroom-muted">
              {textOrUnavailable(story.what_we_know)}
            </p>
          </div>
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-newsroom-muted">
              What we don&apos;t know
            </h2>
            <p className="mt-1 text-sm text-newsroom-muted">
              {textOrUnavailable(story.what_we_dont_know)}
            </p>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-newsroom-gold">
              Why importance
            </h2>
            <p className="mt-1 text-sm text-newsroom-muted">
              {textOrUnavailable(story.why_importance)}
            </p>
          </div>
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-newsroom-gold">
              Why confidence / status
            </h2>
            <p className="mt-1 text-sm text-newsroom-muted">
              {textOrUnavailable(story.why_confidence)}
            </p>
            <p className="mt-1 text-xs text-newsroom-muted">
              Status label: {story.status || UNAVAILABLE}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-4 text-xs text-newsroom-muted">
          <span>
            Official confirmation:{" "}
            {story.official_confirmed === 1
              ? "Yes"
              : story.official_confirmed === 0
                ? "No"
                : UNAVAILABLE}
          </span>
          <span>
            Independent reputable outlets:{" "}
            {indieCount == null ? UNAVAILABLE : indieCount}
          </span>
          <span>
            Publications: {pubs.length ? pubs.join(", ") : UNAVAILABLE}
          </span>
        </div>
        {confFactors.length > 0 && (
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-newsroom-gold">
              Confidence factors / penalties
            </h2>
            <ul className="mt-1 list-inside list-disc text-sm text-newsroom-muted">
              {confFactors.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
        )}
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
                  ? a.source_reliability
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
