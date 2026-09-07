import type { Article, Source, StoryStatus } from "@/lib/types";
import type { ArticleCluster } from "@/lib/clustering";
import { detectOfficial, publicationNames } from "@/lib/clustering";

const IMPORTANCE_KEYWORDS: { re: RegExp; weight: number; label: string }[] = [
  { re: /\b(acquisition|acquire|acquires|merger)\b/i, weight: 14, label: "acquisition/merger" },
  { re: /\b(delay|delayed|delays|postponed)\b/i, weight: 12, label: "delay" },
  { re: /\bbox\s*office\b/i, weight: 12, label: "box office" },
  { re: /\b(casting|cast members?|actor|actress)\b/i, weight: 10, label: "casting/actor" },
  { re: /\b(movie stars?|tv stars?|cast in)\b/i, weight: 6, label: "star casting" },
  { re: /\b(marvel|star wars|dc comics|\bdc\b|harry potter|lord of the rings)\b/i, weight: 12, label: "major franchise" },
  { re: /\b(playstation|xbox|nintendo|steam deck)\b/i, weight: 11, label: "platform" },
  { re: /\b(franchise|sequel|reboot|remake)\b/i, weight: 9, label: "franchise/sequel" },
  { re: /\b(layoff|layoffs|lawsuit|sued)\b/i, weight: 10, label: "layoff/lawsuit" },
  { re: /\b(trailer|premiere|release date)\b/i, weight: 8, label: "trailer/premiere/date" },
  { re: /\b(live[- ]service|crossover|hardware)\b/i, weight: 9, label: "live-service/hardware" },
];

function hoursSince(iso: string | null): number {
  if (!iso) return 72;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return 72;
  return Math.max(0, (Date.now() - t) / 3600000);
}

function keywordBoost(text: string): { score: number; hits: string[] } {
  let score = 0;
  const hits: string[] = [];
  for (const { re, weight, label } of IMPORTANCE_KEYWORDS) {
    if (re.test(text)) {
      score += weight;
      hits.push(`${label}+${weight}`);
    }
  }
  return { score: Math.min(score, 36), hits };
}

/** Soft actor-quote / wishful interview — not hard casting or deal news. */
function isSoftInterview(blob: string): boolean {
  const hardNews = /\b(cast as|joins the cast|cast in|casting news|hired to play|signed to play|lands role|officially cast)\b/i.test(
    blob
  );
  if (hardNews) return false;
  if (/\b(wants more|ready to dig in|opens up about|exclusive interview|sits down with)\b/i.test(blob)) {
    return true;
  }
  // e.g. "Star X wants more Y" without a casting announcement
  if (/\bwants\b/i.test(blob) && /\b(actor|actress|star)\b/i.test(blob)) return true;
  return false;
}

function isSpeculative(blob: string): boolean {
  return (
    /\b\d+\s+predictions?\b/i.test(blob) ||
    /\b(predictions? for|we predict|fan speculation)\b/i.test(blob) ||
    /\bbest deals today\b/i.test(blob)
  );
}

function isRumorLanguage(headline: string, blob: string): boolean {
  // Headline-forward: "reportedly" / "alleged" in the lede is a real uncertainty signal
  if (
    /\b(rumor|rumour|rumored|rumoured|allegedly|unconfirmed|reportedly|speculation|speculated)\b/i.test(
      headline
    )
  ) {
    return true;
  }
  // Body-only mentions often narrate past speculation that is now confirmed
  const bodyHit = /\b(rumor|rumour|rumored|rumoured|allegedly|leak|unconfirmed|reportedly|speculation|speculated)\b/i.test(
    blob
  );
  if (!bodyHit) return false;
  const confirmedNow =
    /\b(revealed|reveals|premiered|premieres|wins?|won|confirms?|confirmed|clarifies|clarified|officially)\b/i.test(
      blob
    ) || /\b(updating live|winners list)\b/i.test(blob);
  if (confirmedNow) return false;
  return true;
}

function mapStatus(confidence: number, official: boolean, rumorish: boolean): StoryStatus {
  // Never label rumors/leaks as CONFIRMED without an official source type
  if (official && !rumorish) return "CONFIRMED";
  if (rumorish) {
    if (confidence >= 65) return "UNCONFIRMED";
    return "RUMOR";
  }
  if (confidence >= 80) return "HIGH CONFIDENCE";
  if (confidence >= 65) return "REPORTED";
  if (confidence < 45) return "RUMOR";
  return "UNCONFIRMED";
}

export interface ScoredStoryDraft {
  headline: string;
  summary: string;
  why_it_matters: string;
  importance: number;
  confidence: number;
  status: StoryStatus;
  official_confirmed: number;
  what_we_know: string;
  what_we_dont_know: string;
  why_importance: string;
  why_confidence: string;
  primary_article_id: number | null;
  articleIds: number[];
  publications: string[];
}

export function scoreCluster(
  cluster: ArticleCluster,
  sourcesById: Map<number, Source>
): ScoredStoryDraft {
  const { articles, headline } = cluster;
  const pubs = publicationNames(articles, sourcesById);
  const reliabilities = articles
    .map((a) => sourcesById.get(a.source_id)?.reliability || 40)
    .sort((a, b) => b - a);
  const bestRel = reliabilities[0] || 40;
  const highRelCount = reliabilities.filter((r) => r >= 85).length;
  const reputableMulti = new Set(
    articles
      .filter((a) => {
        const src = sourcesById.get(a.source_id);
        const rel = src?.reliability || 0;
        return rel >= 80 || src?.type === "industry" || src?.type === "official";
      })
      .map((a) => a.source_id)
  ).size;

  const newest = articles
    .map((a) => a.published_at || a.fetched_at)
    .sort()
    .reverse()[0];
  const hours = hoursSince(newest);
  const hoursRounded = Math.round(hours * 10) / 10;
  const recencyBoost = hours < 6 ? 18 : hours < 24 ? 12 : hours < 48 ? 6 : hours < 72 ? 2 : 0;
  const agePenalty = hours > 96 ? 16 : hours > 72 ? 10 : hours > 48 ? 4 : 0;

  const blob = `${headline} ${articles.map((a) => a.summary).join(" ")}`;
  const { score: kw, hits: kwHits } = keywordBoost(blob);
  const multiBoost = reputableMulti >= 3 ? 14 : reputableMulti === 2 ? 8 : 0;
  const official = detectOfficial(articles, sourcesById);
  const softInterview = isSoftInterview(blob);
  const speculative = isSpeculative(blob);
  const softPenalty = softInterview ? 18 : 0;
  const specPenalty = speculative ? 14 : 0;
  const pureReview =
    /\breview\s*:/i.test(headline) &&
    !/\b(box\s*office|emmys?|oscars?|wins?|delay|acquires?)\b/i.test(blob);
  const reviewPenalty = pureReview ? 12 : 0;

  let importance = Math.round(
    Math.min(
      99,
      Math.max(
        25,
        35 +
          bestRel * 0.25 +
          recencyBoost +
          kw +
          multiBoost +
          (official ? 8 : 0) -
          agePenalty -
          softPenalty -
          specPenalty -
          reviewPenalty
      )
    )
  );

  let confidence = Math.round(
    Math.min(
      99,
      bestRel * 0.7 +
        Math.min(highRelCount, 3) * 8 +
        (official ? 15 : 0) +
        (reputableMulti >= 2 ? 6 : 0)
    )
  );

  const rumorish = isRumorLanguage(headline, blob) || speculative;
  let rumorPenalty = 0;
  if (rumorish) {
    rumorPenalty = 18;
    confidence = Math.max(25, confidence - rumorPenalty);
  }
  if (softInterview && confidence > 60) {
    confidence = Math.max(45, confidence - 8);
  }

  // Criterion 9: do not let soft/single-source quote pieces sit at top-tier importance
  if (importance >= 85 && confidence < 60 && reputableMulti < 2) {
    importance = Math.min(importance, 78);
  }

  const status = mapStatus(confidence, official, rumorish);
  const summary = pickSummary(articles);
  const why = whyItMatters(blob, pubs);
  const primary = [...articles].sort(
    (a, b) =>
      (sourcesById.get(b.source_id)?.reliability || 0) -
      (sourcesById.get(a.source_id)?.reliability || 0)
  )[0];

  const whyImportanceParts: string[] = [
    `score≈35 base + rel ${bestRel}×0.25=${(bestRel * 0.25).toFixed(1)}`,
    `recency ${hoursRounded}h → +${recencyBoost}`,
  ];
  if (kw) whyImportanceParts.push(`keywords +${kw} (${kwHits.join(", ") || "hits"})`);
  if (multiBoost)
    whyImportanceParts.push(`${reputableMulti} independent reputable sources → +${multiBoost}`);
  if (official) whyImportanceParts.push("official source +8");
  if (agePenalty) whyImportanceParts.push(`age penalty −${agePenalty}`);
  if (softPenalty) whyImportanceParts.push(`soft-interview penalty −${softPenalty}`);
  if (specPenalty) whyImportanceParts.push(`speculation/deals penalty −${specPenalty}`);
  if (reviewPenalty) whyImportanceParts.push(`pure-review penalty −${reviewPenalty}`);
  whyImportanceParts.push(`final importance ${importance} (not mention-count; n_articles=${articles.length})`);

  const whyConfParts: string[] = [
    `best reliability ${bestRel}×0.7=${(bestRel * 0.7).toFixed(1)}`,
  ];
  if (highRelCount) whyConfParts.push(`${highRelCount} source(s) with reliability≥85 → +${Math.min(highRelCount, 3) * 8}`);
  if (reputableMulti >= 2) whyConfParts.push(`${reputableMulti} independent reputable outlets → +6`);
  if (official) whyConfParts.push("official confirmation +15");
  if (rumorish) whyConfParts.push(`rumor/speculation language −${rumorPenalty || 18}`);
  if (softInterview) whyConfParts.push("soft-interview confidence trim");
  whyConfParts.push(`final confidence ${confidence}`);

  return {
    headline,
    summary,
    why_it_matters: why,
    importance,
    confidence,
    status,
    official_confirmed: official ? 1 : 0,
    what_we_know: buildKnown(articles, pubs),
    what_we_dont_know: buildUnknown(status, official),
    why_importance: whyImportanceParts.join("; ") + ".",
    why_confidence: whyConfParts.join("; ") + ".",
    primary_article_id: primary?.id ?? null,
    articleIds: articles.map((a) => a.id),
    publications: pubs,
  };
}

function pickSummary(articles: Article[]): string {
  const withSum = articles.find((a) => a.summary && a.summary !== "Summary not listed");
  return (withSum?.summary || articles[0]?.summary || "Summary not listed").slice(0, 500);
}

function whyItMatters(blob: string, pubs: string[]): string {
  if (/\b(acquisition|acquire|acquires|acquired)\b/i.test(blob))
    return "Studio or publisher deal activity can reshape franchises and roadmaps.";
  if (/\b(delay|delayed|delays|postponed)\b/i.test(blob))
    return "Release delays change audience expectations and competitive calendars.";
  if (/\bbox\s*office\b/i.test(blob))
    return "Box office results signal theatrical momentum and sequel prospects.";
  if (/\b(emmy|emmys|oscar|oscars|creative arts)\b/i.test(blob))
    return "Awards results shape awards-season narratives and career momentum.";
  if (/\b(casting|cast members?)\b/i.test(blob))
    return "Casting news often marks a project moving from development into production.";
  if (/\b(hardware|playstation|xbox|nintendo|switch)\b/i.test(blob))
    return "Platform and hardware moves affect pricing, attach rates, and holiday sales.";
  if (pubs.length > 1)
    return `Multiple outlets (${pubs.slice(0, 3).join(", ")}) are covering this, raising newsroom priority.`;
  return "This story is relevant to entertainment audiences following film, TV, or games.";
}

function buildKnown(articles: Article[], pubs: string[]): string {
  const authors = articles.map((a) => a.author).filter((a) => a && a !== "Author not listed");
  const date = articles.map((a) => a.published_at).find(Boolean);
  const parts = [
    `Covered by ${pubs.join(", ") || "listed sources"}.`,
    date ? `Earliest/recent timestamp observed: ${date}.` : "Date not listed on some items.",
  ];
  if (authors.length) parts.push(`Bylines noted: ${[...new Set(authors)].slice(0, 3).join(", ")}.`);
  return parts.join(" ");
}

function buildUnknown(status: StoryStatus, official: boolean): string {
  if (official) return "Secondary details (exact timing, contracts, regional rollout) may still evolve.";
  if (status === "RUMOR" || status === "UNCONFIRMED")
    return "No official confirmation; deal terms, dates, and named parties may change.";
  return "Official statements, final figures, or precise dates may still be pending.";
}
