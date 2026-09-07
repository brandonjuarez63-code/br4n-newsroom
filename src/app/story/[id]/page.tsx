import Link from "next/link";
import { notFound } from "next/navigation";
import { ensureStoreReady, getStoryById } from "@/lib/db";
import { StatusBadge } from "@/components/StatusBadge";
import { formatWhen } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function StoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await ensureStoreReady();
  const story = getStoryById(Number(id));
  if (!story) notFound();

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
      <h1 className="mt-3 text-3xl font-bold text-white">{story.headline}</h1>
      <p className="mt-2 text-sm text-newsroom-muted">
        Importance {story.importance} · Confidence {story.confidence} · Updated{" "}
        {formatWhen(story.updated_at)}
      </p>

      <section className="mt-6 space-y-4 rounded-xl border border-newsroom-border bg-newsroom-card p-5">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-newsroom-gold">Summary</h2>
          <p className="mt-1 text-sm text-newsroom-muted">{story.summary}</p>
        </div>
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-newsroom-gold">Why it matters</h2>
          <p className="mt-1 text-sm">{story.why_it_matters}</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-newsroom-electric">What we know</h2>
            <p className="mt-1 text-sm text-newsroom-muted">{story.what_we_know}</p>
          </div>
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-newsroom-muted">What we don&apos;t know</h2>
            <p className="mt-1 text-sm text-newsroom-muted">{story.what_we_dont_know}</p>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-newsroom-gold">Why importance</h2>
            <p className="mt-1 text-sm text-newsroom-muted">{story.why_importance}</p>
          </div>
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-newsroom-gold">Why confidence</h2>
            <p className="mt-1 text-sm text-newsroom-muted">{story.why_confidence}</p>
          </div>
        </div>
        <p className="text-xs text-newsroom-muted">
          Official confirmed: {story.official_confirmed ? "Yes" : "No"}
        </p>
      </section>

      <section className="mt-6">
        <h2 className="mb-3 text-lg font-bold text-white">Source breakdown</h2>
        <ul className="space-y-3">
          {story.articles.map((a) => (
            <li key={a.id} className="rounded-lg border border-newsroom-border bg-newsroom-panel p-3">
              <div className="flex flex-wrap items-center gap-2 text-xs text-newsroom-muted">
                <span className="font-semibold text-newsroom-electric">{a.source_name || "Source"}</span>
                <span>rel {a.source_reliability ?? "—"}</span>
                <span>{a.source_type}</span>
              </div>
              <a
                href={a.url}
                target="_blank"
                rel="noreferrer"
                className="mt-1 block text-sm font-medium text-white hover:text-newsroom-gold"
              >
                {a.title}
              </a>
              <p className="mt-1 text-xs text-newsroom-muted">
                {a.author || "Author not listed"} · {formatWhen(a.published_at)}
              </p>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
