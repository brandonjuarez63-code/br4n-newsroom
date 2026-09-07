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

/** Tokens that look like name parts but are not people. */
const REJECT_NAME_PART = new Set([
  "Emmy","Emmys","Oscar","Oscars","Grammy","Grammys","Creative","Arts","Night",
  "Winners","Winner","Full","List","Review","Trailer","Documentary","Secret",
  "Screening","Telluride","Festival","Outstanding","Supporting","Actress","Actor",
  "Guest","Comedy","Drama","Limited","Series","Award","Awards","Posthumous","First",
  "Movie","Movies","Film","Films","Television","Best","Deals","Today","Box","Office",
  "New","York","Los","Angeles","How","Here","Watch","Now","Theaters","October",
  "About","Revealed","Surprise","Weird","For","The","And","With","Over","Her","His",
  "Their","Our","Support","Palestine","Roles","Still","Taken","Away","Amid",
  "Cancellation","Canceled","Cancelled","Perfect","One","Season","Run","Section",
  "Competition","Honoring","Human","Wish","Make","Romance","Must","Invent","Sublime",
  "Brooding","Addiction","Story","Midlife","Reinvention","Community","Worthy","Manic",
  "Poem","Accept","Lean","Towards","Toward","Less","Cloud","Shoutout","Mom","Dad",
  "Tons","Notes","Real","Dream","Come","True","Live","Lead","Leads","HBO","Netflix",
  "Disney","Amazon","Apple","Variety","Deadline","NatGeo","Doc","Holmes","Everything",
  "Made","Stuff","Echo","Chamber","Debut","Tokyo","Nippon","Cinema","Crosscut","Asia",
  "Universe","Super","Bowl","Halftime","Show","Other","Musicians","Historic","Hops",
  "Seven","Several","Days","After","Being","Strong","Showings","Muppets","Traitors",
  "Despite","Its","Updating","Acting","You","Can","See","If","To","We","Are","Of",
  "Star","In","From","As","He","She","They","An","A","Or","At","By","On","Into",
  "Via","Than","Then","This","That","These","Those","What","When","Where","Which",
  "Who","Whom","Whose","Why","Will","Would","Could","Should","May","Might","Shall",
  "Need","All","Any","Some","No","Not","Only","Just","Also","Very","More","Most",
  "Such","Own","Same","Each","Every","Both","Few","Many","Much","Little","Big",
  "Small","Long","High","Low","Early","Late","Young","Old","Good","Bad","Great",
  "Right","Left","Next","Last","Second","Third","Gives","Calls","Thanks","Wins",
  "Win","Lands","Scores","Makes","Reacts","Drops","Reveals","Opens","Wants","Had",
  "Serves","Shines","Earns","Hits","Adds","Launches","Relaunches","Prioritizes",
  "Dominate","Rakes","Tearfully","Recites","Dedicates","Says","Say","Said",
  "Announces","Announce","Confirms","Confirm","Reports","Report","Exclusive",
  "Breaking","Update","Official","Casting","Premiere","Elizabeth","Carl","Sagan",
  "Spider","Noir","Widow","Bay","Pitt","Paradise","Bear","Louis","Let","Lets",
  "Sam","Shepard","Altman","Bette","Davis","It",
  "January","February","March","April","June","July","August","September",
  "November","December","Monday","Tuesday","Wednesday","Thursday","Friday",
  "Saturday","Sunday",
]);

const ACTION_RE =
  /\b(Wins?|Says?|Thanks|Tearfully|Recites|Lands?|Dedicates?|Gives?|Calls?|Scores?|Makes?|Reacts?|Drops?|Reveals?|Opens?|Wants?|Had|Are|Is|On|Serves?|Shines|Earns?|Hits|Adds|Launches|Relaunches|Prioritizes|Dominate|Lead|Leads|Rakes|Updating|Announces?|Confirms?|Reports?)\b/;

const NAME_PART = String.raw`[A-Z][a-z]+(?:['\u2019][A-Z]?[a-z]+)?`;
const NAME_SEQ_SRC = String.raw`\b((?:${NAME_PART})(?:\s+(?:${NAME_PART})){1,2})(?:\s+(?:Jr\.?|Sr\.?|II|III|IV))?`;

export interface TitleEntities {
  persons: Set<string>;
  shows: Set<string>;
  awardCategories: Set<string>;
  /** Ceremony roundup / winners-list style, not a single-winner story. */
  isCeremonyRoundup: boolean;
}

function normPerson(s: string): string {
  return s
    .replace(/\./g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function normShow(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Extract show/work titles from typographic or straight single quotes. */
export function extractShows(title: string): Set<string> {
  const shows = new Set<string>();
  // Curly singles: allow apostrophe-s inside (U+2019 before 's')
  const curly = /\u2018((?:[^\u2019]|\u2019(?=s))+)\u2019/g;
  let m: RegExpExecArray | null;
  while ((m = curly.exec(title))) {
    const n = normShow(m[1]);
    if (n.length >= 2 && n.length < 80) shows.add(n);
  }
  // Straight singles used as title quotes (avoid matching apostrophe-s alone)
  const straight = /(?<![a-z])'([^']{2,80})'(?![a-z])/gi;
  while ((m = straight.exec(title))) {
    const n = normShow(m[1]);
    if (n.length >= 2) shows.add(n);
  }
  return shows;
}

function acceptPersonParts(parts: string[]): string | null {
  const cleaned = [...parts];
  while (cleaned.length && REJECT_NAME_PART.has(cleaned[cleaned.length - 1])) {
    cleaned.pop();
  }
  if (cleaned.length < 2) return null;
  if (cleaned.some((p) => REJECT_NAME_PART.has(p))) return null;
  return normPerson(cleaned.join(" "));
}

export function extractPersons(title: string): Set<string> {
  const persons = new Set<string>();
  // Remove quoted spans so show titles are not parsed as names
  const unquoted = title
    .replace(/\u2018((?:[^\u2019]|\u2019(?=s))+)\u2019/g, " ")
    .replace(/[\u201C\u201D"][^"\u201C\u201D]*[\u201C\u201D"]/g, " ");

  const pushFrom = (chunk: string) => {
    const re = new RegExp(NAME_SEQ_SRC, "g");
    let m: RegExpExecArray | null;
    while ((m = re.exec(chunk))) {
      const parts = m[0].replace(/\./g, "").split(/\s+/).filter(Boolean);
      const n = acceptPersonParts(parts);
      if (n) persons.add(n);
    }
  };

  // Lede before the primary action verb (e.g. "David Harbour Wins …")
  const actionMatch = ACTION_RE.exec(unquoted);
  if (actionMatch && actionMatch.index > 0) {
    pushFrom(unquoted.slice(0, actionMatch.index));
  }

  // After colons: "Review: Julianne Moore Shines…" / "Screening: It's Nathan Fielder…"
  for (const part of unquoted.split(":")) {
    const cleaned = part.replace(/^\s*It[\u2019']s\s+/i, " ");
    pushFrom(cleaned);
  }

  // Possessives: "Lance Oppenheim's Documentary", "Jesse Eisenberg's Story"
  const poss = new RegExp(`(${NAME_PART}(?:\\s+${NAME_PART}){1,2})(?:['\u2019]s)\\b`, "g");
  let pm: RegExpExecArray | null;
  while ((pm = poss.exec(unquoted))) {
    const parts = pm[1].split(/\s+/);
    const n = acceptPersonParts(parts);
    if (n) persons.add(n);
  }

  return persons;
}

export function extractAwardCategories(title: string): Set<string> {
  const cats = new Set<string>();
  const t = title.toLowerCase().replace(/\u00a0/g, " ");
  const patterns = [
    /supporting\s+(?:actor|actress)(?:\s+in\s+(?:a\s+)?(?:limited\s+series|comedy\s+series|drama\s+series))?/g,
    /guest\s+(?:actor|actress|acting)(?:\s+in\s+(?:a\s+)?(?:limited\s+series|comedy\s+series|drama\s+series))?/g,
    /outstanding\s+[a-z0-9][a-z0-9\s-]{2,50}?(?=\s+for\b|\s+emmy|\s*$|[,.:–—])/g,
  ];
  for (const re of patterns) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(t))) {
      cats.add(m[0].replace(/\s+/g, " ").trim());
    }
  }
  return cats;
}

export function isCeremonyRoundup(title: string): boolean {
  return (
    /\bwinners?\s+list\b/i.test(title) ||
    /\bfull\s+list\b/i.test(title) ||
    /\bcreative\s+arts\s+emmys?\b/i.test(title) ||
    /\bdominate\b.*\bemmys?\b/i.test(title) ||
    /\bemmys?\s+night\s+\d\b/i.test(title)
  );
}

export function extractEntities(title: string): TitleEntities {
  return {
    persons: extractPersons(title),
    shows: extractShows(title),
    awardCategories: extractAwardCategories(title),
    isCeremonyRoundup: isCeremonyRoundup(title),
  };
}

function setsIntersect(a: Set<string>, b: Set<string>): boolean {
  for (const x of a) if (b.has(x)) return true;
  return false;
}

/**
 * Entity gate for clustering: different primary people / award categories
 * must not merge even when token Jaccard is high (classic Emmy false merge).
 * Shared ceremony words like "Emmy" alone never force a merge.
 */
export function entitiesCompatible(a: TitleEntities, b: TitleEntities): boolean {
  // Specific winner vs specific winner: require person overlap when both name people
  if (a.persons.size > 0 && b.persons.size > 0 && !setsIntersect(a.persons, b.persons)) {
    return false;
  }

  // Conflicting award categories (Supporting Actor vs Supporting Actress, etc.)
  if (
    a.awardCategories.size > 0 &&
    b.awardCategories.size > 0 &&
    !setsIntersect(a.awardCategories, b.awardCategories)
  ) {
    return false;
  }

  // Different named shows when at least one side has a person and neither is a roundup
  if (
    !a.isCeremonyRoundup &&
    !b.isCeremonyRoundup &&
    a.shows.size > 0 &&
    b.shows.size > 0 &&
    !setsIntersect(a.shows, b.shows) &&
    (a.persons.size > 0 || b.persons.size > 0)
  ) {
    return false;
  }

  return true;
}

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

export function shouldMergeArticles(
  tokensA: Set<string>,
  tokensB: Set<string>,
  entitiesA: TitleEntities,
  entitiesB: TitleEntities,
  threshold = 0.4
): boolean {
  if (!entitiesCompatible(entitiesA, entitiesB)) return false;
  return shouldMergeTitles(tokensA, tokensB, threshold);
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
  const entities = articles.map((a) => extractEntities(a.title));
  const assigned = new Array(articles.length).fill(false);
  const clusters: ArticleCluster[] = [];

  for (let i = 0; i < articles.length; i++) {
    if (assigned[i]) continue;
    const group = [articles[i]];
    const groupTok = [tokens[i]];
    const groupEnt = [entities[i]];
    assigned[i] = true;
    // Greedy: compare against any member so chains of near-dups merge
    let grew = true;
    while (grew) {
      grew = false;
      for (let j = i + 1; j < articles.length; j++) {
        if (assigned[j]) continue;
        const match = groupTok.some((gt, gi) =>
          shouldMergeArticles(gt, tokens[j], groupEnt[gi], entities[j], threshold)
        );
        if (match) {
          group.push(articles[j]);
          groupTok.push(tokens[j]);
          groupEnt.push(entities[j]);
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
