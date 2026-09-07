import Parser from "rss-parser";
import type { Article, Category, Source } from "@/lib/types";
import { markSourceUnavailable } from "@/lib/db";
import { isRelevantToCategory } from "@/lib/sources/relevance";
import { mapPool, pickArticleUrl, validateAndCanonicalizeUrl } from "@/lib/sources/articleUrl";

const parser = new Parser({
  timeout: 12000,
  headers: {
    "User-Agent": "BR4N-Newsroom/1.0 (+local MVP research bot)",
    Accept: "application/rss+xml, application/xml, text/xml, */*",
  },
  customFields: {
    item: [
      ["media:content", "mediaContent", { keepArray: true }],
      ["media:thumbnail", "mediaThumbnail", { keepArray: true }],
      ["itunes:image", "itunesImage"],
    ],
  },
});

const PUB_PREFIXES = [
  "Variety",
  "Deadline",
  "Hollywood Reporter",
  "The Hollywood Reporter",
  "THR",
  "Empire",
  "Entertainment Weekly",
  "EW",
  "IndieWire",
  "TheWrap",
  "The Wrap",
  "IGN",
  "Polygon",
  "Eurogamer",
  "GameSpot",
  "VGC",
  "Video Games Chronicle",
  "Videogameschronicle",
];

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

/** Pick a legitimate image URL from RSS enclosure / media fields only — never scrape HTML. */
function extractImageUrl(item: Parser.Item): string | null {
  const extra = item as Parser.Item & {
    enclosure?: { url?: string; type?: string };
    mediaContent?: unknown;
    mediaThumbnail?: unknown;
    itunesImage?: unknown;
  };

  const tryUrl = (raw: unknown): string | null => {
    if (!raw) return null;
    if (typeof raw === "string") {
      const u = raw.trim();
      if (/^https?:\/\//i.test(u)) return u;
      return null;
    }
    if (typeof raw === "object") {
      const o = raw as Record<string, unknown>;
      const attrs = (o.$ || o) as Record<string, unknown>;
      const url = attrs.url || attrs.href || o.url;
      if (typeof url === "string" && /^https?:\/\//i.test(url.trim())) return url.trim();
    }
    return null;
  };

  const enclosure = extra.enclosure || item.enclosure;
  if (enclosure?.url) {
    const type = String(enclosure.type || "").toLowerCase();
    if (!type || type.startsWith("image/") || /\.(jpe?g|png|gif|webp|avif)(\?|$)/i.test(enclosure.url)) {
      const u = tryUrl(enclosure.url);
      if (u) return u;
    }
  }

  const thumbs = extra.mediaThumbnail;
  if (Array.isArray(thumbs)) {
    for (const t of thumbs) {
      const u = tryUrl(t);
      if (u) return u;
    }
  } else {
    const u = tryUrl(thumbs);
    if (u) return u;
  }

  const contents = extra.mediaContent;
  if (Array.isArray(contents)) {
    for (const c of contents) {
      const o = c as Record<string, unknown>;
      const attrs = (o?.$ || o || {}) as Record<string, unknown>;
      const type = String(attrs.type || attrs.medium || "").toLowerCase();
      const url = tryUrl(c);
      if (!url) continue;
      if (!type || type === "image" || type.startsWith("image/")) return url;
      if (/\.(jpe?g|png|gif|webp|avif)(\?|$)/i.test(url)) return url;
    }
  } else {
    const u = tryUrl(contents);
    if (u) return u;
  }

  // itunes:image (podcast-style / some news feeds)
  const itunes = (extra as { itunesImage?: unknown }).itunesImage
    ?? (item as Parser.Item & { itunes?: { image?: string } }).itunes?.image;
  {
    const u = tryUrl(itunes);
    if (u) return u;
  }

  return null;
}

/** Clean CMS glitches like "Varietyschneider" (pub name concatenated with byline). */
export function cleanAuthor(raw: string, sourceName?: string): string {
  let a = String(raw || "").trim();
  if (!a) return "Author not listed";

  // email-style "Name <email>" or "email (Name)"
  const angle = a.match(/^([^<]+)\s*<[^>]+>$/);
  if (angle) a = angle[1].trim();

  // Strip leading publication name glued on without space: Varietyschneider
  const pubs = [
    ...(sourceName ? [sourceName] : []),
    ...PUB_PREFIXES,
  ].sort((x, y) => y.length - x.length);

  for (const pub of pubs) {
    if (a.length <= pub.length) continue;
    if (a.toLowerCase().startsWith(pub.toLowerCase())) {
      const rest = a.slice(pub.length).replace(/^[\s\-–—:,]+/, "").trim();
      if (!rest) return "Author not listed";
      // "Varietyschneider" → "Schneider"; "Variety Schneider" already spaced handled above
      if (/^[A-Z]/.test(rest) || /^[a-z]/.test(rest)) {
        a = rest.charAt(0).toUpperCase() + rest.slice(1);
        break;
      }
    }
  }

  // Reject leftover garbage: all-one-word pub+name still matching known pubs loosely
  if (/^(variety|deadline|polygon|ign|eurogamer|gamespot|thr|empire)$/i.test(a)) {
    return "Author not listed";
  }

  // Reject obvious non-bylines (handles / CMS junk like "Atingley4")
  if (/^@/.test(a)) return "Author not listed";
  if (/^[A-Za-z]+\d+$/.test(a) && a.length <= 24) return "Author not listed";

  // Collapse internal whitespace; never invent a name
  a = a.replace(/\s+/g, " ").trim();
  if (!a || a.length < 2) return "Author not listed";
  return a;
}

function authorOf(item: Parser.Item, sourceName: string): string {
  const extra = item as Parser.Item & { author?: string; creator?: string };
  const raw = String(item.creator || extra.creator || extra.author || "").trim();
  return cleanAuthor(raw, sourceName);
}

function extractTags(title: string, summary: string): string[] {
  const text = `${title} ${summary}`.toLowerCase();
  const keywords = [
    "casting", "cast", "acquisition", "acquire", "delay", "delayed",
    "box office", "franchise", "marvel", "star wars", "dc", "sequel",
    "reboot", "remake", "streaming", "netflix", "disney", "hbo",
    "playstation", "xbox", "nintendo", "steam", "live service",
    "crossover", "hardware", "layoff", "lawsuit", "trailer", "premiere",
  ];
  return keywords.filter((k) => text.includes(k));
}

export interface FetchResult {
  articles: Omit<Article, "id">[];
  errors: { source: string; error: string }[];
  skipped_irrelevant: number;
  skipped_bad_url: number;
}

export async function fetchSourceFeed(
  source: Source
): Promise<{
  articles: Omit<Article, "id">[];
  error?: string;
  skipped?: number;
  skipped_bad_url?: number;
}> {
  try {
    const feed = await parser.parseURL(source.feed_url);
    markSourceUnavailable(source.id, false);
    const now = new Date().toISOString();
    const pending: Omit<Article, "id">[] = [];
    let skipped = 0;
    let skipped_bad_url = 0;

    for (const item of feed.items.slice(0, 25)) {
      const title = (item.title || "").trim();
      if (!title) continue;

      const url = pickArticleUrl(
        {
          link: item.link,
          guid: typeof item.guid === "string" ? item.guid : undefined,
          id: (item as Parser.Item & { id?: string }).id,
        },
        source.feed_url
      );
      if (!url) {
        skipped_bad_url += 1;
        continue;
      }

      const summary = stripHtml(
        item.contentSnippet ||
          item.content ||
          String((item as Parser.Item & { summary?: string }).summary || "")
      );
      if (!isRelevantToCategory(source.category as Category, title, summary)) {
        skipped += 1;
        continue;
      }
      pending.push({
        source_id: source.id,
        title,
        url,
        author: authorOf(item, source.name),
        published_at: item.isoDate || item.pubDate || null,
        summary: summary.slice(0, 800) || "Summary not listed",
        fetched_at: now,
        category: source.category as Category,
        tags: extractTags(title, summary),
        is_sample: 0,
        image_url: extractImageUrl(item),
      });
    }

    // HTTP-validate only suspicious URLs (WP shortlinks / Deadline tk- slugs)
    const checked = await mapPool(pending, 4, async (article) => {
      let needsCheck = false;
      try {
        const u = new URL(article.url);
        if (u.searchParams.has("p") && (u.pathname === "/" || u.pathname === "")) needsCheck = true;
        if (/\/tk-[a-z0-9-]+/i.test(u.pathname)) needsCheck = true;
      } catch {
        return null;
      }
      if (!needsCheck) return article;
      const canonical = await validateAndCanonicalizeUrl(article.url, { timeoutMs: 6000 });
      if (!canonical) return null;
      return { ...article, url: canonical };
    });
    const articles = checked.filter(Boolean) as Omit<Article, "id">[];
    skipped_bad_url += pending.length - articles.length;

    return { articles, skipped, skipped_bad_url };
  } catch (e) {
    markSourceUnavailable(source.id, true);
    const msg = e instanceof Error ? e.message : "Unknown fetch error";
    return { articles: [], error: `${source.name}: ${msg}` };
  }
}

export async function fetchCategoryFeeds(sources: Source[]): Promise<FetchResult> {
  const enabled = sources.filter((s) => s.enabled);
  const results = await Promise.all(enabled.map((s) => fetchSourceFeed(s)));
  const articles = results.flatMap((r) => r.articles);
  const skipped_irrelevant = results.reduce((n, r) => n + (r.skipped || 0), 0);
  const skipped_bad_url = results.reduce((n, r) => n + (r.skipped_bad_url || 0), 0);
  const errList: { source: string; error: string }[] = [];
  enabled.forEach((s, i) => {
    if (results[i].error) errList.push({ source: s.name, error: results[i].error! });
  });
  return { articles, errors: errList, skipped_irrelevant, skipped_bad_url };
}
