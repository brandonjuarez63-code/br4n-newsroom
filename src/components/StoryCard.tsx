"use client";

import Link from "next/link";
import type { StoryWithArticles } from "@/lib/types";
import { StatusBadge } from "./StatusBadge";
import { formatWhen } from "@/lib/utils";

export function StoryCard({
  story,
  rank,
  compact,
}: {
  story: StoryWithArticles;
  rank?: number;
  compact?: boolean;
}) {
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
          Importance {story.importance} · Confidence {story.confidence}
        </span>
        {story.is_sample === 1 && (
          <span className="rounded border border-newsroom-border px-1.5 py-0.5 text-[10px] text-newsroom-muted">
            SAMPLE
          </span>
        )}
      </div>
      <h3 className="text-lg font-semibold leading-snug text-white">
        <Link href={`/story/${story.id}`} className="hover:text-newsroom-gold">
          {story.headline}
        </Link>
      </h3>
      {!compact && (
        <>
          <p className="mt-2 text-sm text-newsroom-muted line-clamp-3">{story.summary}</p>
          <p className="mt-2 text-sm text-newsroom-electric/90">
            <span className="font-medium text-newsroom-electric">Why it matters:</span>{" "}
            {story.why_it_matters}
          </p>
        </>
      )}
      <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-newsroom-muted">
        {story.publications.map((p) => (
          <span key={p} className="rounded-md border border-newsroom-border px-2 py-0.5">
            {p}
          </span>
        ))}
        <span>Updated {formatWhen(story.updated_at)}</span>
      </div>
      <div className="mt-3">
        <Link
          href={`/story/${story.id}`}
          className="text-xs font-semibold uppercase tracking-wider text-newsroom-gold hover:underline"
        >
          Open detail →
        </Link>
      </div>
    </article>
  );
}
