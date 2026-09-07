/**
 * Presentation-only story summary synthesis.
 * Does not change ranking, clustering, scores, URLs, or stored story fields.
 */
import type { StoryWithArticles } from "@/lib/types";

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

/** Strip HTML leftovers, syndication footers, and normalize whitespace. */
export function scrub(text: string): string {
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
  let cleaned = scrub(text)
    .replace(/\u2026/g, "…")
    .replace(/\.{3}/g, "…");
  if (!cleaned) return [];

  // If the whole blob ends with ellipsis and has no prior terminator, treat as incomplete.
  if (/…\s*$/.test(cleaned) && !/[.!?][^…]*$/.test(cleaned.replace(/…\s*$/, ""))) {
    // Keep only portions before an earlier .!? if any; else empty.
    const prior = cleaned.replace(/…\s*$/, "");
    if (!/[.!?]/.test(prior)) return [];
    cleaned = prior;
  }

  // Protect initials / abbreviations from split points.
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
    // Drop very short or boilerplate.
    if (s.length < 20) continue;
    if (/appeared first on/i.test(s)) continue;
    out.push(s);
    if (out.length >= max) break;
  }
  return out;
}

function ensureEndsWithPeriod(s: string): string {
  const t = s.trim();
  if (!t) return t;
  if (/[.!?]$/.test(t)) return t;
  return `${t}.`;
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

function articleProseFacts(story: StoryWithArticles): string[] {
  const lines: string[] = [];
  const seen = new Set<string>();
  for (const a of story.articles || []) {
    for (const s of completeSentences(a.summary || "", 4)) {
      const key = s.toLowerCase().slice(0, 60);
      if (seen.has(key)) continue;
      seen.add(key);
      lines.push(s);
    }
  }
  return lines;
}

function heuristicShort(story: StoryWithArticles): string {
  const pubs = uniquePubs(story);
  const who = pubsPhrase(pubs);
  const headline = scrub(trim(story.headline)) || "This developing story";
  const status = trim(story.status);

  const fromSummary = completeSentences(story.summary || "", 4);
  const fromArticles = articleProseFacts(story);

  const facts: string[] = [];
  for (const f of [...fromSummary, ...fromArticles]) {
    const key = f.toLowerCase().slice(0, 50);
    if (facts.some((x) => x.toLowerCase().slice(0, 50) === key)) continue;
    facts.push(f);
    if (facts.length >= 3) break;
  }

  const sentences: string[] = [];

  if (facts[0]) {
    const lead = facts[0];
    if (/^(according to|reports?\s+say|variety|deadline|the hollywood reporter|thr|ign|polygon|gamespot|eurogamer|thewrap|indiewire|vgc)\b/i.test(lead)) {
      sentences.push(lead);
    } else if (pubs.length) {
      const rest = lead.charAt(0).toLowerCase() + lead.slice(1);
      sentences.push(`According to ${who}, ${rest}`);
    } else {
      sentences.push(lead);
    }
  } else {
    // No complete RSS sentences — synthesize from headline without inventing details.
    const quoted = headline.replace(/[.“”"']+$/g, "").trim();
    sentences.push(
      pubs.length
        ? `${who} ${pubs.length === 1 ? "is" : "are"} reporting on “${quoted}.”`
        : ensureEndsWithPeriod(quoted)
    );
  }

  if (facts[1]) {
    sentences.push(facts[1]);
  } else if (pubs.length > 1 && sentences.length < 2) {
    sentences.push(`Coverage is coming from ${who}.`);
  }

  const uncertain = uncertaintyLine(story);
  if (
    uncertain &&
    (status === "RUMOR" || status === "UNCONFIRMED" || status === "REPORTED") &&
    sentences.length < 3
  ) {
    sentences.push(uncertain);
  } else if (sentences.length < 2 && trim(story.why_it_matters)) {
    sentences.push(ensureEndsWithPeriod(trim(story.why_it_matters)));
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

function heuristicLong(story: StoryWithArticles): string {
  const pubs = uniquePubs(story);
  const who = pubsPhrase(pubs);
  const paragraphs: string[] = [];

  const short = heuristicShort(story);
  paragraphs.push(short);

  const moreFacts = completeSentences(story.summary || "", 8);
  const articleFacts = articleProseFacts(story);
  const used = new Set(
    short
      .toLowerCase()
      .split(/[.!?]/)
      .map((s) => s.trim().slice(0, 50))
      .filter(Boolean)
  );

  const extra: string[] = [];
  for (const s of [...moreFacts, ...articleFacts]) {
    const key = s.toLowerCase().slice(0, 50);
    if (used.has(key)) continue;
    used.add(key);
    extra.push(s);
    if (extra.length >= 10) break;
  }

  if (extra.length) {
    paragraphs.push(extra.join(" "));
  }

  const why = trim(story.why_it_matters);
  if (why && !short.toLowerCase().includes(why.slice(0, Math.min(40, why.length)).toLowerCase())) {
    paragraphs.push(ensureEndsWithPeriod(why));
  }

  const know = trim(story.what_we_know);
  if (know && !/^Covered by /i.test(know)) {
    const knowSentences = completeSentences(know, 4);
    if (knowSentences.length) paragraphs.push(knowSentences.join(" "));
  }

  const dont = trim(story.what_we_dont_know);
  const uncertain = uncertaintyLine(story);
  if (dont && !/^Covered by /i.test(dont)) {
    paragraphs.push(ensureEndsWithPeriod(dont));
  } else if (uncertain && !short.includes(uncertain.slice(0, 30))) {
    paragraphs.push(uncertain);
  }

  if (pubs.length) {
    paragraphs.push(
      `Source coverage currently includes ${who}. See Source Breakdown below for links and outlet details.`
    );
  }

  // Target ~250–400 words when enough material; otherwise stay shorter — no padding/invention.
  let long = paragraphs.join("\n\n").replace(/[…]+/g, ".").replace(/\.{3,}/g, ".");
  const words = long.split(/\s+/).filter(Boolean);
  if (words.length > 420) {
    let count = 0;
    const kept: string[] = [];
    for (const sent of completeSentences(long.replace(/\n+/g, " "), 40)) {
      const w = sent.trim().split(/\s+/).length;
      if (count + w > 400 && kept.length >= 4) break;
      kept.push(sent.trim());
      count += w;
    }
    long = kept.join(" ");
  }

  return long || short;
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
  const payload = {
    headline: story.headline,
    status: story.status,
    official_confirmed: story.official_confirmed === 1,
    summary: story.summary,
    why_it_matters: story.why_it_matters,
    what_we_know: story.what_we_know,
    what_we_dont_know: story.what_we_dont_know,
    publications: uniquePubs(story),
    articles: (story.articles || []).map((a) => ({
      publication: a.source_name,
      title: a.title,
      summary: a.summary,
    })),
  };

  const prompt = `Synthesize two summaries for an entertainment newsroom story page from ONLY the JSON facts below.

Return strict JSON: {"short":"...","long":"..."}

short:
- Exactly 2 or 3 complete sentences (never truncated with "..." or "…").
- Answer what happened, who/what is involved, and the main news.
- Rewrite cut-off RSS blurbs into complete sentences; do not leave dangling fragments.
- Do not invent facts.

long:
- About 250–400 words WHEN there is enough reliable material; shorter is fine if material is thin.
- Pure synthesis: do not dump copyrighted article text, do not invent facts/quotes/dates.
- Note uncertainty or disagreement when status is RUMOR/UNCONFIRMED/REPORTED without official confirmation.
- Natural prose paragraphs, no section headings, no bullet lists, no scores.

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
      temperature: 0.3,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You synthesize careful newsroom summaries. Never invent facts. Always complete sentences. Return JSON only.",
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
  const short = scrub(parsed.short || "")
    .replace(/[…]+$/g, "")
    .replace(/\.{3,}$/g, "");
  // Preserve paragraph breaks in long form.
  const long = (parsed.long || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/[…]+/g, ".")
    .trim();
  if (!short || !long) throw new Error("incomplete openai summary");
  if (/…\s*$/.test(short) || /\.\.\.\s*$/.test(short)) {
    return { ...fallback, engine: "template-fallback" };
  }
  return {
    short: ensureEndsWithPeriod(short),
    long,
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
