/**
 * Article URL extraction / normalization for RSS items.
 * Prefer real publisher article URLs; reject feed/junk/internal links.
 */

const TRACKING_PARAM_RE =
  /^(utm_.*|fbclid|gclid|mc_eid|mc_cid|ncid|cmpid|ito|ns_.*|ref|ref_src|sref|sr_share|share_id|smid|smtyp|ocid|source|rss|feed|amp|outputType)$/i;

const FEED_PATH_RE =
  /\/(feed|rss|atom)(\/|\.xml)?$/i;
const FEED_SEGMENT_RE =
  /\/(feeds?|rss)\b/i;

export function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)));
}

export function stripTrackingParams(url: URL): void {
  const drop: string[] = [];
  url.searchParams.forEach((_, key) => {
    if (TRACKING_PARAM_RE.test(key)) drop.push(key);
  });
  for (const key of drop) url.searchParams.delete(key);
}

function isLikelyHttpUrl(raw: string): boolean {
  return /^https?:\/\//i.test(raw) || raw.startsWith("//") || raw.startsWith("/");
}

/** True for publisher article URLs safe to show as external links. */
export function isClickableArticleUrl(raw: string | null | undefined): boolean {
  if (!raw || typeof raw !== "string") return false;
  const normalized = normalizeArticleUrl(raw);
  return normalized != null;
}

export function isJunkArticleUrl(url: URL, feedOrigin?: string): boolean {
  const host = url.hostname.toLowerCase();
  if (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host.endsWith(".local") ||
    host === "0.0.0.0"
  ) {
    return true;
  }

  const path = url.pathname || "/";
  const fullPath = `${path}${url.search}`;

  // Internal app / API routes
  if (/^\/api(\/|$)/i.test(path)) return true;
  if (/^\/(story|archive)(\/|$)/i.test(path) && (!feedOrigin || url.origin === feedOrigin)) {
    // only treat as internal if same-origin as our app — hard to know; skip path-only
  }

  // Feed endpoints
  if (FEED_PATH_RE.test(path)) return true;
  if (FEED_SEGMENT_RE.test(path) && !/\/articles?\//i.test(path)) return true;

  // Comment RSS / reply anchors that aren't the article
  if (/\/feed\/?$/i.test(path)) return true;
  if (/#respond$/i.test(url.hash)) return true;

  // Bare homepage (no article path)
  if ((path === "/" || path === "") && !url.search) return true;

  // WordPress shortlink alone is OK (redirects) — not junk
  // Sample / placeholder paths that we know 404
  if (/\/sample(\/|$)/i.test(path)) return true;

  // Non-article assets
  if (/\.(xml|json|css|js|png|jpe?g|gif|webp|svg|ico)(\?|$)/i.test(fullPath)) return true;

  return false;
}

/** Prefer a real article path over WP ?p= shortlinks when both exist. */
export function articleUrlScore(url: URL): number {
  let score = 0;
  const path = url.pathname || "/";
  if (/^https?:$/i.test(url.protocol)) score += 10;
  if (path.length > 1) score += 20;
  if (/\d{5,}/.test(path) || /\/\d{4}\/\d{2}\//.test(path)) score += 15; // WP date+id style
  if (/\/articles?\//i.test(path)) score += 12;
  if (url.searchParams.has("p") && (path === "/" || path === "")) score -= 25; // shortlink
  if (FEED_PATH_RE.test(path) || FEED_SEGMENT_RE.test(path)) score -= 50;
  if (/\/tk-[a-z0-9-]+/i.test(path)) score -= 5; // Deadline CMS placeholder slug
  if ([...url.searchParams.keys()].some((k) => TRACKING_PARAM_RE.test(k))) score -= 2;
  return score;
}

export function normalizeArticleUrl(
  raw: string | null | undefined,
  feedUrl?: string | null
): string | null {
  if (!raw) return null;
  let s = decodeHtmlEntities(String(raw).trim());
  if (!s) return null;

  // Reject obvious non-URLs (IGN UUID guid, GameSpot numeric guid)
  if (!isLikelyHttpUrl(s)) {
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)) return null;
    if (/^\d{4,}$/.test(s)) return null;
    if (!s.includes(".") && !s.includes("/")) return null;
    // bare domain-ish without scheme
    if (/^[a-z0-9.-]+\.[a-z]{2,}(\/|$)/i.test(s)) s = `https://${s}`;
    else return null;
  }

  let base: URL | undefined;
  try {
    if (feedUrl) base = new URL(feedUrl);
  } catch {
    base = undefined;
  }

  let url: URL;
  try {
    if (s.startsWith("//")) {
      url = new URL(`${base?.protocol || "https:"}${s}`);
    } else if (s.startsWith("/")) {
      if (!base) return null;
      url = new URL(s, base);
    } else {
      url = base ? new URL(s, base) : new URL(s);
    }
  } catch {
    return null;
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") return null;

  stripTrackingParams(url);
  // Drop hash noise except meaningful anchors we keep none for articles
  url.hash = "";

  if (isJunkArticleUrl(url, base?.origin)) return null;

  // Normalize trailing noise
  let out = url.toString();
  // Avoid trailing `?` with empty query
  if (out.endsWith("?")) out = out.slice(0, -1);
  return out;
}

type RssLikeItem = {
  link?: string;
  guid?: string;
  id?: string;
  title?: string;
};

/**
 * Pick the best article URL from RSS item fields.
 * Prefer link over non-permalink guid; reject feed/junk.
 */
export function pickArticleUrl(
  item: RssLikeItem,
  feedUrl?: string | null
): string | null {
  const candidates: string[] = [];
  const push = (v: unknown) => {
    if (typeof v === "string" && v.trim()) candidates.push(v.trim());
    else if (Array.isArray(v)) {
      for (const x of v) {
        if (typeof x === "string" && x.trim()) candidates.push(x.trim());
        else if (x && typeof x === "object" && "href" in (x as object)) {
          const href = (x as { href?: string }).href;
          if (href) candidates.push(String(href).trim());
        }
      }
    } else if (v && typeof v === "object" && "href" in (v as object)) {
      const href = (v as { href?: string }).href;
      if (href) candidates.push(String(href).trim());
    }
  };

  push(item.link);
  push(item.guid);
  push(item.id);

  const scored: { url: string; score: number }[] = [];
  for (const c of candidates) {
    const n = normalizeArticleUrl(c, feedUrl);
    if (!n) continue;
    try {
      scored.push({ url: n, score: articleUrlScore(new URL(n)) });
    } catch {
      /* skip */
    }
  }
  if (!scored.length) return null;
  scored.sort((a, b) => b.score - a.score);
  return scored[0].url;
}

const SOFT_404_RE =
  /page not found|404: not found|404 \| |article not found|we couldn.?t find|sorry,? this page|doesn.?t exist|error.?404|not found - variety|not found<\/title>/i;

/**
 * Follow redirects and verify the URL is a live article page.
 * Returns canonical final URL, or null if dead/junk.
 */
export async function validateAndCanonicalizeUrl(
  url: string,
  opts?: { timeoutMs?: number }
): Promise<string | null> {
  const timeoutMs = opts?.timeoutMs ?? 7000;
  const structural = normalizeArticleUrl(url);
  if (!structural) return null;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(structural, {
      method: "GET",
      redirect: "follow",
      signal: ctrl.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; BR4N-Newsroom/1.0; +local research bot)",
        Accept: "text/html,application/xhtml+xml",
      },
    });

    if (res.status === 404 || res.status === 410) return null;
    if (res.status >= 400) {
      // Soft-block / auth walls — keep structural URL rather than hiding a real article
      return structural;
    }

    const text = (await res.text()).slice(0, 4000);
    const title = (text.match(/<title[^>]*>([^<]+)/i) || [])[1] || "";
    if (SOFT_404_RE.test(text) || /\b404\b/.test(title) || /page not found/i.test(title)) {
      return null;
    }

    const finalUrl = normalizeArticleUrl(res.url);
    // Never replace a good article URL with homepage / feed after redirects
    if (!finalUrl) return structural;
    return finalUrl;
  } catch {
    // Network blip: keep structurally-valid URL rather than dropping everything
    return structural;
  } finally {
    clearTimeout(timer);
  }
}

/** Bound concurrency for URL checks during refresh. */
export async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  }
  const n = Math.min(concurrency, Math.max(1, items.length));
  await Promise.all(Array.from({ length: n }, () => worker()));
  return results;
}
