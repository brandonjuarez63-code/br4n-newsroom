import type { Article, Source } from "@/lib/types";

const STOP = new Set([
  "a","an","the","and","or","but","in","on","at","to","for","of","with","from",
  "by","as","is","are","was","were","be","been","being","it","its","this","that",
  "these","those","after","before","over","under","about","into","via","new",
  "says","say","report","reports","reporting","exclusive","wins","win","first",
]);

const SITE_SUFFIXES = [
  /\s*[-–—|]\s*variety\s*$/i,
  /\s*[-–—|]\s*deadline\s*$/i,
  /\s*[-–—|]\s*hollywood\s*reporter\s*$/i,
  /\s*[-–—|]\s*thr\s*$/i,
  /\s*[-–—|]\s*empire\s*$/i,
  /\s*[-–—|]\s*ew\.?\s*$/i,
  /\s*[-–—|]\s*entertainment weekly\s*$/i,
  /\s*[-–—|]\s*indiewire\s*$/i,
  /\s*[-–—|]\s*thewrap\s*$/i,
  /\s*[-–—|]\s*ign\s*$/i,
  /\s*[-–—|]\s*polygon\s*$/i,
  /\s*[-–—|]\s*eurogamer\s*$/i,
  /\s*[-–—|]\s*gamespot\s*$/i,
  /\s*[-–—|]\s*vgc\s*$/i,
  /\s*[-–—|]\s*videogameschronicle\s*$/i,
];

export function normalizeTitle(title: string): string {
  let t = title.toLowerCase();
  for (const re of SITE_SUFFIXES) t = t.replace(re, "");
  t = t.replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
  return t;
}

export function tokenize(title: string): Set<string> {
  const norm = normalizeTitle(title);
  const tokens = norm.split(" ").filter((w) => w.length > 2 && !STOP.has(w));
  return new Set(tokens);
}

export function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

function intersectionSize(a: Set<string>, b: Set<string>): number {
  let n = 0;
  for (const x of a) if (b.has(x)) n++;
  return n;
}

/** True when titles likely cover the same story (near-dup / multi-outlet). */
export function shouldMergeTitles(a: Set<string>, b: Set<string>, threshold = 0.4): boolean {
  const jac = jaccard(a, b);
  if (jac >= threshold) return true;
  // Near-miss: many shared content tokens (feature vs review, same named package)
  const inter = intersectionSize(a, b);
  if (inter >= 5 && jac >= 0.25) return true;
  if (inter >= 4 && jac >= 0.34) return true;
  return false;
}

export interface ArticleCluster {
  articles: Article[];
  headline: string;
}

export function clusterArticles(
  articles: Article[],
  threshold = 0.4
): ArticleCluster[] {
  const tokens = articles.map((a) => tokenize(a.title));
  const assigned = new Array(articles.length).fill(false);
  const clusters: ArticleCluster[] = [];

  for (let i = 0; i < articles.length; i++) {
    if (assigned[i]) continue;
    const group = [articles[i]];
    const groupTok = [tokens[i]];
    assigned[i] = true;
    // Greedy: compare against any member so chains of near-dups merge
    let grew = true;
    while (grew) {
      grew = false;
      for (let j = i + 1; j < articles.length; j++) {
        if (assigned[j]) continue;
        const match = groupTok.some((gt) => shouldMergeTitles(gt, tokens[j], threshold));
        if (match) {
          group.push(articles[j]);
          groupTok.push(tokens[j]);
          assigned[j] = true;
          grew = true;
        }
      }
    }
    const headline = [...group].sort((a, b) => b.title.length - a.title.length)[0].title;
    clusters.push({ articles: group, headline: stripSiteSuffix(headline) });
  }
  return clusters;
}

function stripSiteSuffix(title: string): string {
  let t = title;
  for (const re of SITE_SUFFIXES) t = t.replace(re, "");
  return t.trim();
}

export function detectOfficial(articles: Article[], sourcesById: Map<number, Source>): boolean {
  return articles.some((a) => sourcesById.get(a.source_id)?.type === "official");
}

export function publicationNames(articles: Article[], sourcesById: Map<number, Source>): string[] {
  const names = articles
    .map((a) => sourcesById.get(a.source_id)?.name)
    .filter(Boolean) as string[];
  return [...new Set(names)];
}
