import type { Category, StoryWithArticles } from "@/lib/types";
import { isClickableArticleUrl } from "@/lib/sources/articleUrl";
import {
  dedupeUniqueSentences,
  ensureEndsWithPeriod,
  extractUniqueFacts,
  isFillerSentence,
  isGenericWhyItMatters,
  scrubText,
  sentencesNearDuplicate,
  significantTokens,
  wordCount,
} from "@/lib/content/uniqueFacts";

function significantTokensFromFact(text: string): string[] {
  return significantTokens(text);
}

function categoryLabel(cat: Category): string {
  return cat === "movies_tv" ? "movie and TV" : "gaming";
}

function leadIn(cat: Category, count: number): string {
  if (cat === "movies_tv") {
    return count === 1
      ? "Here's a story from the movie and TV world."
      : "Let's run through some of the biggest movie and TV headlines.";
  }
  return count === 1
    ? "Here's a story from the gaming world."
    : "Here are the top gaming stories you should know about.";
}

function pubsPhrase(pubs: string[]): string {
  if (!pubs.length) return "industry outlets";
  if (pubs.length === 1) return pubs[0];
  if (pubs.length === 2) return `${pubs[0]} and ${pubs[1]}`;
  return `${pubs[0]}, ${pubs[1]}, and others`;
}

function softenHeadline(h: string): string {
  return scrubText(h.replace(/\s*\(Sample\)\s*/gi, " ").replace(/\.$/, "")).trim();
}

function uncertaintyPhrase(status: string, officialConfirmed: number): string {
  if (status === "RUMOR") {
    return "This is still in rumor territory, so treat it carefully until there's firmer confirmation.";
  }
  if (status === "UNCONFIRMED") {
    return "It's still unconfirmed, so details may shift as reporting develops.";
  }
  if (status === "REPORTED" && officialConfirmed !== 1) {
    return "Outlets are reporting it, though official confirmation may still be pending.";
  }
  return "";
}

function sentenceAddsInfo(candidate: string, already: string[]): boolean {
  const c = scrubText(candidate);
  if (!c || isFillerSentence(c)) return false;
  for (const prev of already) {
    if (sentencesNearDuplicate(prev, c)) return false;
  }
  return true;
}

/**
 * Conversational spoken paragraph built from unique facts — not a dashboard summary readback.
 * Thin stories stay short (~30–60s worth); expand only when unique info warrants.
 */
function storySpokenParagraph(story: StoryWithArticles, idx: number, total: number): string {
  const pubs = story.publications.length
    ? story.publications
    : story.articles.map((a) => a.source_name || "Source").filter(Boolean);
  const who = pubsPhrase(pubs);
  const headline = softenHeadline(story.headline);
  const facts = extractUniqueFacts(story, { max: 10 });
  const uncertainty = uncertaintyPhrase(story.status, story.official_confirmed);
  const verbAre = pubs.length === 1 ? "is" : "are";

  const used: string[] = [];
  const parts: string[] = [];

  if (idx === 0) {
    parts.push(
      pubs.length
        ? `${who} ${verbAre} out with this one: ${headline}.`
        : `Here's the headline: ${headline}.`
    );
  } else if (idx === total - 1 && total > 1) {
    parts.push(`And finally: ${headline}, according to ${who}.`);
  } else {
    parts.push(`Next up: ${headline}. That's according to ${who}.`);
  }
  // Single-story: allow more unique detail; roundups stay snappy.
  const factCap = total === 1 ? Math.min(5, Math.max(1, facts.length)) : Math.min(2, facts.length);
  const spokenFacts: string[] = [];
  const headlineToks = significantTokensFromFact(headline);
  for (const f of facts) {
    if (spokenFacts.length >= factCap) break;
    // Dedupe against already spoken facts only (headline is a teaser, not a fact dump).
    if (!sentenceAddsInfo(f, spokenFacts)) continue;
    if (sentencesNearDuplicate(headline, f)) {
      const extra = significantTokensFromFact(f).filter((w) => !headlineToks.includes(w));
      const hasExtraDetail =
        extra.length >= 2 ||
        /\b(guest|supporting|limited|anthology|category|season|episode|directed|october|prison|telluride|posthumous)\b/i.test(
          f
        );
      if (!hasExtraDetail) continue;
    }
    spokenFacts.push(f);
  }
  used.push(headline, ...spokenFacts);

  // If nothing passed filters, still speak the best unique fact once.
  if (!spokenFacts.length && facts[0]) {
    spokenFacts.push(facts[0]);
    used.push(facts[0]);
  }

  if (spokenFacts.length) {
    parts.push(spokenFacts.map((s) => ensureEndsWithPeriod(s)).join(" "));
  }

  const why = scrubText(story.why_it_matters || "");
  if (why && !isGenericWhyItMatters(why) && !/^Multiple outlets .* are covering this/i.test(why)) {
    if (sentenceAddsInfo(why, used)) {
      parts.push(ensureEndsWithPeriod(why));
      used.push(why);
    }
  }

  if (uncertainty && sentenceAddsInfo(uncertainty, used)) {
    parts.push(uncertainty);
  }

  return parts.join(" ").replace(/\s+/g, " ").trim();
}

function collectSources(stories: StoryWithArticles[]) {
  const sources: { title: string; url: string; publication?: string }[] = [];
  for (const story of stories) {
    for (const a of story.articles) {
      if (!isClickableArticleUrl(a.url)) continue;
      sources.push({
        title: a.title,
        url: a.url,
        publication: a.source_name,
      });
    }
  }
  return dedupeSources(sources);
}

function dedupeSources(
  sources: { title: string; url: string; publication?: string }[]
) {
  const seen = new Set<string>();
  const out: typeof sources = [];
  for (const s of sources) {
    if (seen.has(s.url)) continue;
    seen.add(s.url);
    out.push(s);
  }
  return out;
}

function formatSourcesBlock(
  sources: { title: string; url: string; publication?: string }[]
): string {
  const lines = ["SOURCES"];
  sources.forEach((s, i) => {
    lines.push(`${i + 1}. ${s.publication ? s.publication + " — " : ""}${s.title}`);
    lines.push(`   ${s.url}`);
  });
  return lines.join("\n");
}

/**
 * Conversational spoken-news script. No section headings, bullets, or scores.
 * SOURCES list stays at the bottom for attribution (not spoken mid-script).
 */
export function generateTemplateScript(
  category: Category,
  stories: StoryWithArticles[]
): { body: string; sources: { title: string; url: string; publication?: string }[] } {
  const sources = collectSources(stories);
  const paragraphs: string[] = [leadIn(category, stories.length)];

  stories.forEach((story, idx) => {
    paragraphs.push(storySpokenParagraph(story, idx, stories.length));
  });

  if (stories.length >= 3) {
    paragraphs.push(
      `That's your ${categoryLabel(category)} roundup for now. Details can move quickly, so check the sources below.`
    );
  } else if (stories.length === 2) {
    paragraphs.push(
      "Those are the headlines for now — more in the sources below if you want to dig in."
    );
  } else {
    paragraphs.push("That's the latest on this one. Links are below if you want to dig in.");
  }

  // Soft trim only if somehow oversized; never pad thin scripts.
  let spoken = paragraphs.join("\n\n");
  if (stories.length === 1 && wordCount(spoken) > 320) {
    const lines = spoken.split(/\n\n/);
    const core = lines.slice(0, Math.min(3, lines.length));
    spoken = core.join("\n\n");
    if (!/\blinks are below\b/i.test(spoken)) {
      spoken += "\n\nThat's the latest on this one. Links are below if you want to dig in.";
    }
  }

  const body = `${spoken}\n\n${formatSourcesBlock(sources)}`;
  return { body, sources };
}

export async function generateScript(
  category: Category,
  stories: StoryWithArticles[]
): Promise<{
  body: string;
  sources: { title: string; url: string; publication?: string }[];
  engine: string;
}> {
  const template = generateTemplateScript(category, stories);
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    return { ...template, engine: "template" };
  }
  try {
    const nicer = await openAiPolish(category, stories, template.body, key);
    return { body: nicer, sources: template.sources, engine: "openai" };
  } catch {
    return { ...template, engine: "template-fallback" };
  }
}

async function openAiPolish(
  category: Category,
  stories: StoryWithArticles[],
  fallbackBody: string,
  apiKey: string
): Promise<string> {
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  const facts = stories.map((s) => ({
    headline: s.headline,
    status: s.status,
    pubs: s.publications,
    unique_facts: extractUniqueFacts(s, { max: 10 }),
    why:
      s.why_it_matters && !isGenericWhyItMatters(s.why_it_matters)
        ? s.why_it_matters
        : null,
    dont: s.what_we_dont_know,
    official_confirmed: s.official_confirmed === 1,
  }));
  const sourceBlock = fallbackBody.includes("SOURCES")
    ? fallbackBody.slice(fallbackBody.indexOf("SOURCES"))
    : "SOURCES\n";

  const thin =
    stories.length === 1 &&
    (facts[0]?.unique_facts?.length || 0) <= 3;

  const prompt = `Write a natural spoken news segment for a ${categoryLabel(category)} roundup that a host would read aloud.

Hard rules:
- Conversational prose only. NO section headings (never write WHAT WE KNOW, WHY IT MATTERS, WHAT WE DON'T KNOW, CONFIDENCE, IMPORTANCE, or similar).
- NO bullet points or numbered lists in the spoken part.
- NO importance/confidence scores, formulas, reliability numbers, or technical scoring language.
- Do NOT read back a dashboard summary verbatim. Weave unique research into a spoken segment.
- Use each unique fact at most once. Never restate the same fact with different wording.
- Never pad with generic filler ("awards-season narratives", "career momentum", "fans will be watching", "significant for the industry", etc.).
- Prioritize UNIQUE useful story-specific info over length.
- Start with what happened. Weave why it matters and any uncertainty into the narrative naturally — only when those fields are present and non-generic.
- Attribute outlets naturally in the prose (e.g. "Variety reports…").
- Use ONLY the facts provided. Never invent quotes, names, dates, numbers, or details.
- Never make rumor/unconfirmed items sound confirmed. Flag uncertainty in plain language.
- ${
    thin
      ? "This is a THIN story: keep the spoken part short (about 30–60 seconds). Do NOT pad."
      : "Expand toward about 1–2 minutes ONLY when unique facts warrant it. Do NOT pad thin material."
  }
- After the spoken script, append the SOURCES block EXACTLY as provided (verbatim). Do not rewrite URLs or titles.

Facts JSON:
${JSON.stringify(facts, null, 2)}

SOURCES block to append verbatim:
${sourceBlock.trim()}`;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.35,
      messages: [
        {
          role: "system",
          content:
            "You are a careful entertainment news script writer. Write only spoken prose plus a verbatim SOURCES footer. Never invent facts. Never repeat facts. Never pad with filler. Never use section headings or score language.",
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

  // Light post-filter on spoken portion only.
  let spoken = text;
  let sourcesTail = "";
  const srcIdx = text.search(/\bSOURCES\b/);
  if (srcIdx >= 0) {
    spoken = text.slice(0, srcIdx).trim();
    sourcesTail = text.slice(srcIdx).trim();
  } else {
    sourcesTail = sourceBlock.trim();
  }

  const paras = spoken.split(/\n+/).map((p) => p.trim()).filter(Boolean);
  const cleaned: string[] = [];
  const seen: string[] = [];
  for (const para of paras) {
    // Keep short lead-ins even if not "facts"
    if (para.length < 90 && cleaned.length === 0) {
      cleaned.push(para);
      seen.push(para);
      continue;
    }
    const sents = dedupeUniqueSentences(
      para
        .split(/(?<=[.!?])\s+/)
        .map((s) => s.trim())
        .filter(Boolean),
      { max: 12 }
    ).filter((s) => sentenceAddsInfo(s, seen) || seen.length === 0);
    if (!sents.length) continue;
    const joined = sents.join(" ");
    cleaned.push(joined);
    seen.push(...sents);
  }

  const polished = (cleaned.join("\n\n") || spoken).trim();
  return `${polished}\n\n${sourcesTail}`;
}
