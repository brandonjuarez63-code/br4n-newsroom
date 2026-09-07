/**
 * Presentation-only story summary synthesis.
 * Does not change ranking, clustering, scores, URLs, or stored story fields.
 * Prioritizes unique story-specific info; never pads to hit word counts.
 */
import type { StoryWithArticles } from "@/lib/types";
import { getDb } from "@/lib/db";
import {
  completeSentences as extractCompleteSentences,
  dedupeUniqueSentences,
  ensureEndsWithPeriod,
  extractUniqueFacts,
  isFillerSentence,
  isGenericWhyItMatters,
  relatedStoryContextHints,
  scrubText,
  sentencesNearDuplicate,
  wordCount,
} from "@/lib/content/uniqueFacts";

export interface SynthesizedSummaries {
  short: string;
  long: string;
  engine: "template" | "openai" | "template-fallback";
}

function trim(value: string | null | undefined): string {
  return (value ?? "").trim();
}

function uniquePubs(story: StoryWithArticles): string[] {
  const pubs = story.publications?.length
    ? story.publications
    : (story.articles || []).map((a) => a.source_name).filter(Boolean);
  return [...new Set((pubs as string[]).map((p) => String(p).trim()).filter(Boolean))];
}

function pubsPhrase(pubs: string[]): string {
  if (!pubs.length) return "Available reporting";
  if (pubs.length === 1) return pubs[0];
  if (pubs.length === 2) return `${pubs[0]} and ${pubs[1]}`;
  return `${pubs.slice(0, -1).join(", ")}, and ${pubs[pubs.length - 1]}`;
}

/** Re-export scrub / sentence split for script + callers. */
export function scrub(text: string): string {
  return scrubText(text);
}

export function completeSentences(text: string, max = 12): string[] {
  return extractCompleteSentences(text, max);
}

function uncertaintyLine(story: StoryWithArticles): string | null {
  const status = trim(story.status);
  if (status === "RUMOR") {
    return "This remains rumor or speculation until firmer confirmation arrives.";
  }
  if (status === "UNCONFIRMED") {
    return "The story is still unconfirmed, and details may change as reporting develops.";
  }
  if (status === "REPORTED" && story.official_confirmed !== 1) {
    return "Industry outlets are reporting this, but official confirmation is not yet on record.";
  }
  return null;
}

function sentenceAddsInfo(candidate: string, already: string[]): boolean {
  const c = scrubText(candidate);
  if (!c || isFillerSentence(c)) return false;
  for (const prev of already) {
    if (sentencesNearDuplicate(prev, c)) return false;
  }
  return true;
}

function softenForAttribution(lead: string): string {
  const first = (lead.match(/^[A-Za-z’']+/) || [""])[0];
  if (/^(The|A|An|On|In|At|For|After|Before|During|With|As|When|While|And|But)$/.test(first)) {
    return lead.charAt(0).toLowerCase() + lead.slice(1);
  }
  return lead;
}

function attributeLead(lead: string, pubs: string[], who: string): string {
  if (/^(according to|reports?\s+say|variety|deadline|the hollywood reporter|thr|ign|polygon|gamespot|eurogamer|thewrap|indiewire|vgc)\b/i.test(lead)) {
    return lead;
  }
  if (!pubs.length) return lead;
  return `According to ${who}, ${softenForAttribution(lead)}`;
}

function heuristicShort(story: StoryWithArticles): string {
  const pubs = uniquePubs(story);
  const who = pubsPhrase(pubs);
  const headline = scrubText(trim(story.headline)) || "This developing story";
  const status = trim(story.status);
  const facts = extractUniqueFacts(story, { max: 6 });

  const sentences: string[] = [];

  if (facts[0]) {
    sentences.push(attributeLead(facts[0], pubs, who));
  } else {
    const quoted = headline.replace(/[.“”"']+$/g, "").trim();
    sentences.push(
      pubs.length
        ? `${who} ${pubs.length === 1 ? "is" : "are"} reporting on “${quoted}.”`
        : ensureEndsWithPeriod(quoted)
    );
  }

  for (const f of facts.slice(1)) {
    if (sentences.length >= 3) break;
    if (!sentenceAddsInfo(f, sentences)) continue;
    sentences.push(f);
  }

  // Only add uncertainty when it adds status signal and we still have room —
  // never pad with generic "why it matters" templates.
  const uncertain = uncertaintyLine(story);
  if (
    uncertain &&
    (status === "RUMOR" || status === "UNCONFIRMED" || status === "REPORTED") &&
    sentences.length < 3 &&
    sentenceAddsInfo(uncertain, sentences)
  ) {
    sentences.push(uncertain);
  }

  const out = sentences
    .slice(0, 3)
    .map((s) =>
      ensureEndsWithPeriod(
        s.replace(/[…]+$/g, "").replace(/\.{3,}$/g, "").trim()
      )
    )
    .filter(Boolean)
    .join(" ");

  return out || "Information unavailable for a summary of this story.";
}

function loadRelatedHints(story: StoryWithArticles): string[] {
  try {
    const db = getDb();
    return relatedStoryContextHints(story, db.stories, { maxSentences: 2 });
  } catch {
    return [];
  }
}

/**
 * Expanded summary: what happened; important details; who/what; current context;
 * historical/related context ONLY from local data; unknowns when applicable.
 * Stops when unique facts are exhausted — never pads to a word target.
 */
function heuristicLong(story: StoryWithArticles): string {
  const pubs = uniquePubs(story);
  const who = pubsPhrase(pubs);
  const facts = extractUniqueFacts(story, { max: 14 });
  const used: string[] = [];
  const paragraphs: string[] = [];

  // 1) What happened (+ attribution)
  const leadBits: string[] = [];
  if (facts[0]) {
    const lead = attributeLead(facts[0], pubs, who);
    leadBits.push(lead);
    used.push(facts[0], lead);
  } else {
    leadBits.push(heuristicShort(story));
    used.push(...completeSentences(leadBits[0], 4));
  }

  // 2) Important unique details (stop when exhausted)
  const detailBits: string[] = [];
  for (const f of facts.slice(1)) {
    if (!sentenceAddsInfo(f, [...used, ...detailBits])) continue;
    detailBits.push(f);
    // Thin stories: keep expansion short; rich multi-source can take more.
    const cap = Math.max(2, Math.min(8, facts.length));
    if (detailBits.length >= cap) break;
  }

  if (leadBits.length) {
    paragraphs.push(
      leadBits
        .concat(detailBits.slice(0, 2))
        .map((s) => ensureEndsWithPeriod(s))
        .join(" ")
    );
    used.push(...detailBits.slice(0, 2));
  }

  // Remaining unique details as a second paragraph when warranted
  const more = detailBits.slice(2).filter((f) => sentenceAddsInfo(f, used));
  if (more.length) {
    paragraphs.push(more.map((s) => ensureEndsWithPeriod(s)).join(" "));
    used.push(...more);
  }

  // 3) Non-generic why / current context (skip ranking filler templates)
  const why = trim(story.why_it_matters);
  if (why && !isGenericWhyItMatters(why)) {
    for (const s of completeSentences(why, 2)) {
      if (sentenceAddsInfo(s, used)) {
        paragraphs.push(ensureEndsWithPeriod(s));
        used.push(s);
      }
    }
  }

  // 4) Historical / related context from local DB peers only
  const related = loadRelatedHints(story).filter((s) => sentenceAddsInfo(s, used));
  if (related.length) {
    const cleaned = dedupeUniqueSentences(related, { max: 2 });
    if (cleaned.length) {
      paragraphs.push(cleaned.map((s) => ensureEndsWithPeriod(s)).join(" "));
      used.push(...cleaned);
    }
  }

  // 5) Unknowns — prefer story field when substantive; else status line once
  const dont = trim(story.what_we_dont_know);
  const uncertain = uncertaintyLine(story);
  if (dont && !/^Covered by /i.test(dont) && !isFillerSentence(dont)) {
    const dontSentences = completeSentences(dont, 3).filter((s) =>
      sentenceAddsInfo(s, used)
    );
    if (dontSentences.length) {
      paragraphs.push(dontSentences.map((s) => ensureEndsWithPeriod(s)).join(" "));
      used.push(...dontSentences);
    } else if (sentenceAddsInfo(dont, used)) {
      paragraphs.push(ensureEndsWithPeriod(dont));
      used.push(dont);
    }
  } else if (
    uncertain &&
    (story.status === "RUMOR" ||
      story.status === "UNCONFIRMED" ||
      (story.status === "REPORTED" && story.official_confirmed !== 1)) &&
    sentenceAddsInfo(uncertain, used)
  ) {
    // Only add when status actually warrants it — skip for HIGH CONFIDENCE / CONFIRMED.
    paragraphs.push(uncertain);
    used.push(uncertain);
  }

  // Soft hard-cap only to avoid runaway; never pad upward.
  let long = paragraphs.join("\n\n").replace(/[…]+/g, ".").replace(/\.{3,}/g, ".");
  if (wordCount(long) > 420) {
    let count = 0;
    const kept: string[] = [];
    for (const sent of completeSentences(long.replace(/\n+/g, " "), 40)) {
      const w = sent.trim().split(/\s+/).length;
      if (count + w > 400 && kept.length >= 3) break;
      if (!sentenceAddsInfo(sent, kept) && kept.length) continue;
      kept.push(sent.trim());
      count += w;
    }
    long = kept.join(" ");
  }

  return long || heuristicShort(story);
}

function templateSynthesize(story: StoryWithArticles): SynthesizedSummaries {
  return {
    short: heuristicShort(story),
    long: heuristicLong(story),
    engine: "template",
  };
}

async function openAiSynthesize(
  story: StoryWithArticles,
  fallback: SynthesizedSummaries,
  apiKey: string
): Promise<SynthesizedSummaries> {
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  const uniqueFacts = extractUniqueFacts(story, { max: 14 });
  const related = loadRelatedHints(story).filter((s) =>
    sentenceAddsInfo(s, uniqueFacts)
  );
  const payload = {
    headline: story.headline,
    status: story.status,
    official_confirmed: story.official_confirmed === 1,
    unique_facts: uniqueFacts,
    related_local_context: related,
    why_it_matters: isGenericWhyItMatters(story.why_it_matters || "")
      ? null
      : story.why_it_matters,
    what_we_dont_know: story.what_we_dont_know,
    publications: uniquePubs(story),
  };

  const prompt = `Synthesize two summaries for an entertainment newsroom story page from ONLY the JSON facts below.

Return strict JSON: {"short":"...","long":"..."}

Hard anti-repetition / anti-padding rules:
- Prioritize UNIQUE useful story-specific information over length. Never pad to hit a word count.
- Before adding any sentence: does it give information not already given? If no, omit it.
- Never restate the same fact with different wording (e.g. do not say a first Emmy win three ways).
- Never invent trivia. Never use generic filler ("awards-season narratives", "career momentum", "significant for the industry", "fans will be watching", "relevant to entertainment audiences", etc.).
- Multi-source: synthesize unique bits into one coherent piece — never concatenate per-source restatements.
- If material is thin, keep the long summary short. Expand only when unique facts warrant it.
- related_local_context is optional historical/peer context from the same newsroom DB — use ONLY if genuinely helpful and not duplicative; otherwise omit.

short:
- Exactly 2 or 3 complete sentences (never truncated with "..." or "…").
- Answer what happened, who/what is involved, and the main news.
- Do not invent facts.

long:
- Structure when info exists: what happened; important details; who/what involved; relevant current context; historical/previous context ONLY if provided in related_local_context and helpful; unknowns when applicable.
- Pure synthesis from unique_facts. No section headings, bullets, or scores.
- Note uncertainty when status is RUMOR/UNCONFIRMED/REPORTED without official confirmation — once, not repeatedly.

Facts:
${JSON.stringify(payload)}`;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.25,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You synthesize careful newsroom summaries. Never invent facts. Never repeat the same fact. Never pad with filler. Always complete sentences. Return JSON only.",
        },
        { role: "user", content: prompt },
      ],
    }),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}`);
  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("empty openai");
  const parsed = JSON.parse(text) as { short?: string; long?: string };
  const short = scrubText(parsed.short || "")
    .replace(/[…]+$/g, "")
    .replace(/\.{3,}$/g, "");
  let long = (parsed.long || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/[…]+/g, ".")
    .trim();
  if (!short || !long) throw new Error("incomplete openai summary");
  if (/…\s*$/.test(short) || /\.\.\.\s*$/.test(short)) {
    return { ...fallback, engine: "template-fallback" };
  }

  // Post-filter: drop filler / near-dup sentences the model may still emit.
  const longParas = long.split(/\n+/).map((p) => p.trim()).filter(Boolean);
  const cleanedParas: string[] = [];
  const seen: string[] = [];
  for (const para of longParas) {
    const kept = dedupeUniqueSentences(
      completeSentences(para, 20).filter((s) => sentenceAddsInfo(s, seen)),
      { max: 12 }
    );
    if (!kept.length) continue;
    cleanedParas.push(kept.map((s) => ensureEndsWithPeriod(s)).join(" "));
    seen.push(...kept);
  }
  if (cleanedParas.length) long = cleanedParas.join("\n\n");

  const shortClean = dedupeUniqueSentences(completeSentences(short, 6), {
    max: 3,
  });
  const shortOut = shortClean.length
    ? shortClean.map((s) => ensureEndsWithPeriod(s)).join(" ")
    : ensureEndsWithPeriod(short);

  return {
    short: shortOut,
    long: long || fallback.long,
    engine: "openai",
  };
}

/** Build short + long display summaries server-side from existing story metadata. */
export async function synthesizeStorySummaries(
  story: StoryWithArticles
): Promise<SynthesizedSummaries> {
  const fallback = templateSynthesize(story);
  const key = process.env.OPENAI_API_KEY;
  if (!key) return fallback;
  try {
    return await openAiSynthesize(story, fallback, key);
  } catch {
    return { ...fallback, engine: "template-fallback" };
  }
}
