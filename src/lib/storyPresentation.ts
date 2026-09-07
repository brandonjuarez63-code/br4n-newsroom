/**
 * Display-only helpers for Source Breakdown readability.
 * Does not change ranking, confidence, clustering, or URLs.
 */
import type { StoryWithArticles } from "@/lib/types";

const UNAVAILABLE = "information unavailable";

function trim(value: string | null | undefined): string {
  return (value ?? "").trim();
}

export function independentReputableCount(story: StoryWithArticles): number | null {
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

export function highestReliability(story: StoryWithArticles): number | null {
  const articles = Array.isArray(story.articles) ? story.articles : [];
  let best: number | null = null;
  for (const a of articles) {
    if (typeof a.source_reliability === "number") {
      best = best == null ? a.source_reliability : Math.max(best, a.source_reliability);
    }
  }
  return best;
}

export function highlyReliableSourceCount(story: StoryWithArticles): number | null {
  const articles = Array.isArray(story.articles) ? story.articles : [];
  if (!articles.length) return null;
  const ids = new Set<number>();
  for (const a of articles) {
    if (typeof a.source_reliability === "number" && a.source_reliability >= 85 && typeof a.source_id === "number") {
      ids.add(a.source_id);
    }
  }
  return ids.size;
}

/** Plain-English "what we know" from existing story fields only — no invented facts. */
export function plainWhatWeKnow(story: StoryWithArticles): string {
  const pubs = (story.publications?.length
    ? story.publications
    : (story.articles || []).map((a) => a.source_name).filter(Boolean)) as string[];
  const uniquePubs = [...new Set(pubs.map((p) => String(p).trim()).filter(Boolean))];
  const summary = trim(story.summary);
  const status = trim(story.status);

  if (!summary && !uniquePubs.length) return UNAVAILABLE;

  const who =
    uniquePubs.length === 0
      ? "Available reporting"
      : uniquePubs.length === 1
        ? uniquePubs[0]
        : uniquePubs.length === 2
          ? `${uniquePubs[0]} and ${uniquePubs[1]}`
          : `${uniquePubs.slice(0, -1).join(", ")}, and ${uniquePubs[uniquePubs.length - 1]}`;

  if (!summary || summary === "Summary not listed") {
    return `${who} ${uniquePubs.length === 1 ? "is" : "are"} covering this story. Full article details are in Source Breakdown below.`;
  }

  let lead = `According to ${who}, ${summary}`;
  if (!lead.endsWith(".") && !lead.endsWith("…") && !lead.endsWith("?")) lead += ".";

  if (status === "RUMOR" || status === "UNCONFIRMED") {
    lead += " This remains unconfirmed by an official source.";
  } else if (story.official_confirmed === 1) {
    lead += " An official source is reflected in the confidence assessment.";
  }

  return lead;
}

/** Plain-English uncertainty from status/official — no invented specifics. */
export function plainWhatWeDontKnow(story: StoryWithArticles): string {
  const stored = trim(story.what_we_dont_know);
  const status = trim(story.status);
  const official = story.official_confirmed === 1;

  if (status === "RUMOR") {
    return "This is currently treated as rumor or speculation. Key details (who confirmed it, exact terms, and timing) are not established by official confirmation.";
  }
  if (status === "UNCONFIRMED") {
    return "The reporting is still thin or unconfirmed. Official confirmation, final dates, and precise details may still be missing.";
  }
  if (status === "REPORTED" && !official) {
    return "Industry outlets are reporting this, but an official confirmation is not recorded. Secondary details (exact timing, contracts, or regional rollout) may still change.";
  }
  if (official) {
    return "An official source is noted, but secondary details (exact timing, contracts, or regional rollout) may still evolve.";
  }
  if (stored) return stored;
  return "Some details may still be pending confirmation.";
}

/** Readable importance blurb: use why_it_matters first, then a soft restatement of score context. */
export function plainWhyImportance(story: StoryWithArticles): string {
  const matters = trim(story.why_it_matters);
  const imp = story.importance;
  const parts: string[] = [];
  if (matters) parts.push(matters);
  if (typeof imp === "number") {
    parts.push(`Newsroom importance score: ${imp}/100.`);
  }
  if (!parts.length) return UNAVAILABLE;
  return parts.join(" ");
}

export function scoringDetailLines(why: string | null | undefined): string[] {
  const raw = trim(why);
  if (!raw) return [];
  return raw
    .replace(/\.$/, "")
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
}
