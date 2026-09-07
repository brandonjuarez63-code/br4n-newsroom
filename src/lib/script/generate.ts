import type { Category, StoryWithArticles } from "@/lib/types";
import { isClickableArticleUrl } from "@/lib/sources/articleUrl";
import { completeSentences, scrub } from "@/lib/summary/synthesize";

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
  return scrub(h.replace(/\s*\(Sample\)\s*/gi, " ").replace(/\.$/, "")).trim();
}

function uncertaintyPhrase(status: string): string {
  if (status === "RUMOR") {
    return "This is still in rumor territory, so treat it carefully until there's firmer confirmation.";
  }
  if (status === "UNCONFIRMED") {
    return "It's still unconfirmed, so details may shift as reporting develops.";
  }
  if (status === "REPORTED") {
    return "Outlets are reporting it, though official confirmation may still be pending.";
  }
  return "";
}

function storySpokenParagraph(story: StoryWithArticles, idx: number, total: number): string {
  const pubs = story.publications.length
    ? story.publications
    : story.articles.map((a) => a.source_name || "Source").filter(Boolean);
  const who = pubsPhrase(pubs);
  const headline = softenHeadline(story.headline);
  const summarySentences = completeSentences(story.summary || "", 3);
  const why = scrub(story.why_it_matters || "");
  const uncertainty = uncertaintyPhrase(story.status);
  const verbAre = pubs.length === 1 ? "is" : "are";

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

  if (summarySentences.length) {
    // Cap spoken detail so thin stories stay short; multi-story roundups stay snappy.
    const take = total === 1 ? summarySentences.slice(0, 3) : summarySentences.slice(0, 2);
    parts.push(take.join(" "));
  }

  if (why) {
    if (/Multiple outlets .* are covering this/i.test(why)) {
      parts.push("It's drawing attention because several outlets are on it.");
    } else {
      parts.push(why.endsWith(".") ? why : `${why}.`);
    }
  }

  if (uncertainty) parts.push(uncertainty);

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

  const spoken = paragraphs.join("\n\n");
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
    summary: s.summary,
    why: s.why_it_matters,
    know: s.what_we_know,
    dont: s.what_we_dont_know,
    official_confirmed: s.official_confirmed === 1,
  }));
  const sourceBlock = fallbackBody.includes("SOURCES")
    ? fallbackBody.slice(fallbackBody.indexOf("SOURCES"))
    : "SOURCES\n";

  const prompt = `Write a natural spoken news segment for a ${categoryLabel(category)} roundup that a host would read aloud.

Hard rules:
- Conversational prose only. NO section headings (never write WHAT WE KNOW, WHY IT MATTERS, WHAT WE DON'T KNOW, CONFIDENCE, IMPORTANCE, or similar).
- NO bullet points or numbered lists in the spoken part.
- NO importance/confidence scores, formulas, reliability numbers, or technical scoring language.
- Start with what happened. Weave why it matters and any uncertainty into the narrative naturally.
- Attribute outlets naturally in the prose (e.g. "Variety reports…").
- Use ONLY the facts provided. Never invent quotes, names, dates, numbers, or details.
- Never make rumor/unconfirmed items sound confirmed. Flag uncertainty in plain language.
- Aim for about 1–2 minutes when there is enough material across the stories. Do NOT pad thin or single short stories.
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
      temperature: 0.4,
      messages: [
        {
          role: "system",
          content:
            "You are a careful entertainment news script writer. Write only spoken prose plus a verbatim SOURCES footer. Never invent facts. Never use section headings or score language.",
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

  if (!/\bSOURCES\b/.test(text)) {
    return `${text}\n\n${sourceBlock.trim()}`;
  }
  return text;
}
