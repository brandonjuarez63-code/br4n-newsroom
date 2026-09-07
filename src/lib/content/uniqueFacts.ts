/**
 * Shared anti-repetition / anti-padding helpers for summaries.
 * Presentation-only — does not change ranking, clustering, scores, or URLs.
 */
import type { Story, StoryWithArticles } from "@/lib/types";

const STOP = new Set([
  "a","an","the","and","or","but","for","of","to","in","on","at","by","from","with",
  "as","is","are","was","were","be","been","being","has","have","had","do","does","did",
  "will","would","could","should","may","might","can","that","this","these","those",
  "it","its","his","her","their","they","them","he","she","we","you","i","who","whom",
  "which","what","when","where","how","than","then","into","over","after","before",
  "about","into","onto","up","out","off","not","no","nor","so","if","also","just",
  "very","more","most","some","any","all","each","other","only","own","same","such",
  "too","both","few","many","much","said","says","say","according","reports","report",
  "reporting","new","news","story","one","two","first","second","latest","sunday",
  "monday","tuesday","wednesday","thursday","friday","saturday","night","day",
]);

/** Generic ranking templates and fluff that must never pad summaries. */
const FILLER_RES: RegExp[] = [
  /\bawards[- ]season narratives\b/i,
  /\bcareer momentum\b/i,
  /\bfans will be watching\b/i,
  /\bsignificant for the industry\b/i,
  /\brelevant to entertainment audiences\b/i,
  /\braising newsroom priority\b/i,
  /\breshape franchises and roadmaps\b/i,
  /\bchange audience expectations and competitive calendars\b/i,
  /\bsignal theatrical momentum and sequel prospects\b/i,
  /\bmarks a project moving from development into production\b/i,
  /\baffect pricing, attach rates, and holiday sales\b/i,
  /\bdrive awards and subscriber buzz\b/i,
  /\bcultural visibility\b/i,
  /\bsee source breakdown\b/i,
  /\bsource coverage currently includes\b/i,
  /^covered by .+\.$/i,
  /^this story is relevant to entertainment audiences/i,
  /^awards results shape /i,
  /^multiple outlets \(.+\) are covering this/i,
  /^studio or publisher deal activity/i,
  /^release delays change audience expectations/i,
  /^box office results signal/i,
  /^casting news often marks/i,
  /^platform and hardware moves affect/i,
  /^franchise release moves can reshape/i,
  /^high-profile casting and limited series deals/i,
  /^opening weekend figures signal/i,
  /^director attachments often greenlight/i,
  /^delays reshape release calendars/i,
  /^acquisitions can change creative independence/i,
  /^crossovers drive engagement/i,
  /^hardware refreshes affect pricing/i,
  /^official statements, final figures, or precise dates may still be pending/i,
  /^secondary details \(exact timing, contracts, regional rollout\) may still evolve/i,
  /^no official confirmation; deal terms, dates, and named parties may change/i,
  /^earliest\/recent timestamp observed/i,
  /^date not listed on some items/i,
  /^bylines noted:/i,
];

export function scrubText(text: string): string {
  return text
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\s*The post\s+.+\s+appeared first on\s+.+$/i, "")
    .replace(/\s*\[?\s*Read more\s*\]?\.?$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Extract complete sentences only. Protects common abbreviations/initials
 * so "Michael J. Fox" does not split early. Drops truncated RSS tails.
 */
export function completeSentences(text: string, max = 12): string[] {
  let cleaned = scrubText(text)
    .replace(/\u2026/g, "…")
    .replace(/\.{3}/g, "…");
  if (!cleaned) return [];

  // Syndication footers often leave a complete clause without terminal punctuation.
  if (!/[.!?…]$/.test(cleaned) && cleaned.length >= 40 && /\s/.test(cleaned)) {
    cleaned = `${cleaned}.`;
  }

  if (/…\s*$/.test(cleaned) && !/[.!?][^…]*$/.test(cleaned.replace(/…\s*$/, ""))) {
    const prior = cleaned.replace(/…\s*$/, "");
    if (!/[.!?]/.test(prior)) return [];
    cleaned = prior;
  }

  const protectedText = cleaned
    .replace(/\b([A-Z])\./g, "$1\u0000")
    .replace(/\b(Mr|Mrs|Ms|Dr|Sr|Jr|St|vs|etc|approx|Dept|No)\./gi, "$1\u0000");

  const parts = protectedText.match(/[^.!?…]+[.!?]+/g) || [];
  const out: string[] = [];
  for (const raw of parts) {
    let s = raw.replace(/\u0000/g, ".").trim();
    if (!s) continue;
    if (/…\s*$/.test(s)) continue;
    if (!/[.!?]$/.test(s)) s = `${s}.`;
    s = s.replace(/\s+/g, " ").trim();
    if (s.length < 20) continue;
    if (/appeared first on/i.test(s)) continue;
    out.push(s);
    if (out.length >= max) break;
  }
  return out;
}

export function isFillerSentence(text: string): boolean {
  const t = scrubText(text);
  if (!t) return true;
  return FILLER_RES.some((re) => re.test(t));
}

export function isGenericWhyItMatters(text: string): boolean {
  return isFillerSentence(text);
}

export function significantTokens(text: string): string[] {
  const raw = scrubText(text)
    .toLowerCase()
    .replace(/[“”"']/g, "")
    .replace(/[^a-z0-9\s’-]/g, " ")
    .split(/\s+/)
    .map((w) => w.replace(/^['’-]+|['’-]+$/g, ""))
    .filter((w) => w.length >= 3 && !STOP.has(w) && !/^\d+$/.test(w));
  return [...new Set(raw)];
}

/** Compact signature of the main claim (entities + action-ish tokens). */
export function factSignature(text: string): string {
  const tokens = significantTokens(text).slice(0, 14);
  return tokens.sort().join("|");
}

function jaccard(a: string[], b: string[]): number {
  if (!a.length || !b.length) return 0;
  const A = new Set(a);
  const B = new Set(b);
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  const union = A.size + B.size - inter;
  return union ? inter / union : 0;
}

function containment(a: string[], b: string[]): number {
  if (!a.length || !b.length) return 0;
  const smaller = a.length <= b.length ? a : b;
  const larger = a.length <= b.length ? new Set(b) : new Set(a);
  let hit = 0;
  for (const x of smaller) if (larger.has(x)) hit++;
  return hit / smaller.length;
}

const AWARD_WORDS = /^(emmy|emmys|oscar|oscars|award|awards|wins?|won|win|winning|posthumous|posthumously|guest|supporting|actor|actress|comedy|drama|series|category|nominee|nominated)$/;
const RELEASE_WORDS = /^(release|released|releases|theaters?|theatre|october|september|november|december|january|february|march|april|june|july|august|premieres?|premiered|premiere|debut|debuts|hit|hits)$/;

function isAwardWinClaim(text: string, tokens: string[]): boolean {
  const lower = text.toLowerCase();
  const hasWin = /\b(win|wins|won|winning|takes? home|took home|lands?|landed|trophy)\b/i.test(lower);
  const hasAward = tokens.some((w) =>
    /^(emmy|emmys|oscar|oscars|award|awards|trophy|trophies|supporting|guest)$/.test(w)
  ) || /\b(emmy|oscar|award|trophy)\b/i.test(lower);
  return hasWin && hasAward;
}

function isReleaseClaim(tokens: string[]): boolean {
  return tokens.filter((w) => RELEASE_WORDS.test(w)).length >= 2;
}

function informativeScore(s: string): number {
  const tokens = significantTokens(s);
  let score = tokens.length * 3 + s.length;
  // Prefer concrete award category / role details over bare "won an Emmy".
  if (/\b(guest|supporting|lead|limited|anthology|comedy series|drama series|category)\b/i.test(s)) score += 40;
  if (/\b(posthumous|posthumously)\b/i.test(s)) score += 12;
  if (/\b(season|episode|arc|directed|documentary|theater|theatres|october|telluride)\b/i.test(s)) score += 16;
  if (/\b(nine months|50 years|third|first)\b/i.test(s)) score += 20;
  // Penalize hollow teaser CTAs.
  if (/^watch a teaser\b/i.test(s)) score -= 50;
  return score;
}

function isHollowCta(text: string): boolean {
  return /^(watch a teaser|watch the trailer|click here|read more)\b/i.test(text.trim());
}

/** True when two sentences restate the same facts with different wording. */
export function sentencesNearDuplicate(
  a: string,
  b: string,
  contextEntities: string[] = []
): boolean {
  const ta = significantTokens(a);
  const tb = significantTokens(b);
  if (!ta.length || !tb.length) return false;
  const jac = jaccard(ta, tb);
  const cont = containment(ta, tb);
  if (jac >= 0.48) return true;
  if (cont >= 0.68 && Math.min(ta.length, tb.length) >= 4) return true;

  const ctx = new Set(contextEntities.map((x) => x.toLowerCase()));
  const sharesContext = (tokens: string[]) =>
    ctx.size ? tokens.some((t) => ctx.has(t)) : false;

  // Same award-win claim restated (common in multi-outlet Emmy clusters).
  if (isAwardWinClaim(a, ta) && isAwardWinClaim(b, tb)) {
    const nonAwardA = ta.filter((w) => !AWARD_WORDS.test(w));
    const nonAwardB = tb.filter((w) => !AWARD_WORDS.test(w));
    const nameJac = jaccard(nonAwardA, nonAwardB);
    // Within a story cluster, outlet blurbs almost always restate one win — collapse them.
    // If context entities exist, require at least one side to touch them, or name overlap.
    if (!ctx.size || sharesContext(ta) || sharesContext(tb) || nameJac >= 0.2) {
      return true;
    }
  }

  // Same theatrical/release claim restated.
  if (isReleaseClaim(ta) && isReleaseClaim(tb)) {
    const restA = ta.filter((w) => !RELEASE_WORDS.test(w));
    const restB = tb.filter((w) => !RELEASE_WORDS.test(w));
    if (jaccard(restA, restB) >= 0.3 || containment(restA, restB) >= 0.6) return true;
    if (sharesContext(ta) && sharesContext(tb)) return true;
  }

  // Shared title-ish quoted work + overlapping action.
  const quoted = (s: string) =>
    [...s.matchAll(/[“"']([^”"']{3,80})[”"']/g)].map((m) => m[1].toLowerCase());
  const qa = quoted(a);
  const qb = quoted(b);
  if (qa.some((x) => qb.some((y) => x.includes(y) || y.includes(x))) && jac >= 0.28) {
    return true;
  }

  const na = scrubText(a).toLowerCase().slice(0, 70);
  const nb = scrubText(b).toLowerCase().slice(0, 70);
  if (na && nb && (na === nb || na.includes(nb.slice(0, 40)) || nb.includes(na.slice(0, 40)))) {
    return true;
  }
  return false;
}

/**
 * Keep only sentences that add information not already present.
 * Prefers more specific wording when near-duplicates collide.
 */
export function dedupeUniqueSentences(
  sentences: string[],
  opts?: { max?: number; contextEntities?: string[] }
): string[] {
  const max = opts?.max ?? 24;
  const contextEntities = opts?.contextEntities ?? [];
  const kept: string[] = [];
  for (const raw of sentences) {
    const s = scrubText(raw);
    if (!s || s.length < 20) continue;
    if (isFillerSentence(s)) continue;
    if (isHollowCta(s)) continue;
    if (/^covered by /i.test(s)) continue;

    let dupIdx = -1;
    for (let i = 0; i < kept.length; i++) {
      if (sentencesNearDuplicate(kept[i], s, contextEntities)) {
        dupIdx = i;
        break;
      }
    }
    if (dupIdx >= 0) {
      const prev = kept[dupIdx];
      // Prefer the more specific wording; drop the restatement.
      if (informativeScore(s) > informativeScore(prev) + 6) {
        kept[dupIdx] = /[.!?]$/.test(s) ? s : `${s}.`;
      }
      continue;
    }
    const normalized = /[.!?]$/.test(s) ? s : `${s}.`;
    kept.push(normalized);
    if (kept.length >= max) break;
  }
  return kept;
}

/** Gather candidate story-specific sentences from local story + article fields only. */
export function collectCandidateSentences(story: StoryWithArticles): string[] {
  const raw: string[] = [];
  for (const s of completeSentences(story.summary || "", 8)) raw.push(s);
  for (const a of story.articles || []) {
    for (const s of completeSentences(a.summary || "", 5)) raw.push(s);
    // Titles sometimes carry unique category details when blurb is thin.
    const title = scrubText(a.title || "");
    if (title && title.length >= 24 && !/[.!?]$/.test(title)) {
      // Don't treat bare headlines as prose facts unless they add category/detail words.
      // Skip — headlines are usually restatements.
    }
  }
  const know = scrubText(story.what_we_know || "");
  if (know && !/^Covered by /i.test(know)) {
    for (const s of completeSentences(know, 4)) {
      if (!/^covered by /i.test(s) && !/^earliest\/recent timestamp/i.test(s) && !/^date not listed/i.test(s)) {
        raw.push(s);
      }
    }
  }
  const why = scrubText(story.why_it_matters || "");
  if (why && !isGenericWhyItMatters(why)) {
    for (const s of completeSentences(why, 2)) raw.push(s);
  }
  return raw;
}

export function extractUniqueFacts(
  story: StoryWithArticles,
  opts?: { max?: number }
): string[] {
  const entities = [
    ...headlineEntities(story.headline || ""),
    ...significantTokens(story.headline || "").slice(0, 6),
  ];
  return dedupeUniqueSentences(collectCandidateSentences(story), {
    max: opts?.max ?? 14,
    contextEntities: [...new Set(entities)],
  });
}

/** Entity-ish tokens from a headline for related-story matching. */
export function headlineEntities(headline: string): string[] {
  const tokens = significantTokens(headline).filter(
    (w) =>
      !/^(wins?|won|win|award|awards|emmy|emmys|oscar|oscars|says?|amid|over|after|guest|actor|actress|supporting|comedy|drama|series|movie|film|tv|night|creative|arts|posthumous|first)$/.test(
        w
      )
  );
  return tokens.slice(0, 8);
}

/**
 * Optional related-story context from other local stories sharing entities.
 * Cheap/safe: only existing DB story summaries; never invents trivia.
 */
export function relatedStoryContextHints(
  story: StoryWithArticles,
  peers: Pick<Story, "id" | "headline" | "summary" | "category">[],
  opts?: { maxSentences?: number }
): string[] {
  const maxSentences = opts?.maxSentences ?? 2;
  const entities = headlineEntities(story.headline || "");
  if (entities.length < 2) return [];

  const scored = peers
    .filter((p) => p.id !== story.id && p.category === story.category)
    .map((p) => {
      const ht = significantTokens(p.headline || "");
      const overlap = entities.filter((e) => ht.includes(e));
      return { peer: p, overlap };
    })
    .filter((x) => x.overlap.length >= 2)
    .sort((a, b) => b.overlap.length - a.overlap.length)
    .slice(0, 4);

  const candidates: string[] = [];
  for (const { peer } of scored) {
    for (const s of completeSentences(peer.summary || "", 2)) {
      candidates.push(s);
    }
  }
  return dedupeUniqueSentences(candidates, { max: maxSentences });
}

export function ensureEndsWithPeriod(s: string): string {
  const t = s.trim();
  if (!t) return t;
  if (/[.!?][)”"'’»]?$/.test(t)) return t;
  return `${t}.`;
}

export function wordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}
