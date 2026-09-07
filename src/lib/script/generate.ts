import type { Category, StoryWithArticles } from "@/lib/types";

function categoryLabel(cat: Category): string {
  return cat === "movies_tv" ? "movie and TV" : "gaming";
}

function leadIn(cat: Category, count: number): string {
  if (cat === "movies_tv") {
    return count === 1
      ? "Let's start with some movie news."
      : "Let's run through some of the biggest movie and TV headlines.";
  }
  return count === 1
    ? "Let's jump into some gaming news."
    : "Here are the top gaming stories you should know about.";
}

function rumorNote(status: string): string {
  if (status === "RUMOR" || status === "UNCONFIRMED") {
    return " This is still unconfirmed, so treat it carefully.";
  }
  if (status === "REPORTED") {
    return " Multiple reports are circulating, but official confirmation may still be pending.";
  }
  return "";
}

function pubsPhrase(pubs: string[]): string {
  if (!pubs.length) return "Industry outlets are reporting";
  if (pubs.length === 1) return `${pubs[0]} is reporting`;
  if (pubs.length === 2) return `${pubs[0]} and ${pubs[1]} are reporting`;
  return `${pubs[0]}, ${pubs[1]}, and others are reporting`;
}

export function generateTemplateScript(
  category: Category,
  stories: StoryWithArticles[]
): { body: string; sources: { title: string; url: string; publication?: string }[] } {
  const lines: string[] = [leadIn(category, stories.length), ""];
  const sources: { title: string; url: string; publication?: string }[] = [];

  stories.forEach((story, idx) => {
    const pubs = story.publications.length
      ? story.publications
      : story.articles.map((a) => a.source_name || "Source").filter(Boolean);
    const opener =
      idx === 0
        ? `${pubsPhrase(pubs)} that ${softenHeadline(story.headline)}.`
        : `Next up: ${pubsPhrase(pubs)} that ${softenHeadline(story.headline)}.`;
    lines.push(opener + rumorNote(story.status));
    if (story.why_it_matters) {
      lines.push(`Why it matters: ${story.why_it_matters}`);
    }
    if (story.what_we_know) {
      lines.push(`What we know so far: ${story.what_we_know}`);
    }
    lines.push("");

    for (const a of story.articles) {
      sources.push({
        title: a.title,
        url: a.url,
        publication: a.source_name,
      });
    }
  });

  lines.push(
    `That's your ${categoryLabel(category)} roundup for now. As always, details can move quickly — check the sources below.`
  );
  lines.push("");
  lines.push("SOURCES");
  const unique = dedupeSources(sources);
  unique.forEach((s, i) => {
    lines.push(`${i + 1}. ${s.publication ? s.publication + " — " : ""}${s.title}`);
    lines.push(`   ${s.url}`);
  });

  return { body: lines.join("\n"), sources: unique };
}

function softenHeadline(h: string): string {
  return h.replace(/\s*\(Sample\)\s*/gi, " ").replace(/\.$/, "").trim().toLowerCase();
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

export async function generateScript(
  category: Category,
  stories: StoryWithArticles[]
): Promise<{ body: string; sources: { title: string; url: string; publication?: string }[]; engine: string }> {
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
  }));
  const sourceBlock = fallbackBody.split("SOURCES")[1] || "";

  const prompt = `Write a conversational spoken script (about 1-2 minutes when read aloud) for a ${categoryLabel(category)} news roundup.
Constraints:
- Use ONLY the facts provided. Do not invent quotes, names, dates, or details.
- Clearly distinguish rumors / unconfirmed items.
- Friendly newsroom host tone.
- Do not fabricate authors.
- End with a SOURCES section exactly as provided after the script.

Facts JSON:
${JSON.stringify(facts, null, 2)}

SOURCES block to append verbatim after the spoken script:
SOURCES
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
        { role: "system", content: "You are a careful entertainment news script writer. Never invent facts." },
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
  return text;
}
