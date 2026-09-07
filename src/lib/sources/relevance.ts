import type { Category } from "@/lib/types";

/** Strong signals that an item belongs in movies/TV (not pure gaming). */
const MOVIE_TV_STRONG = [
  "box office",
  "oscars",
  "oscar",
  "emmys",
  "emmy",
  "golden globe",
  "sundance",
  "telluride",
  "venice film",
  "cannes",
  "theatrical",
  "wide release",
  "limited release",
  "film festival",
  "movie review",
  "film review",
  "tv review",
  "season finale",
  "season premiere",
  "showrunner",
  "netflix series",
  "hbo series",
  "disney+",
  "max series",
  "prime video series",
  "marvel studios",
  "dc studios",
  "warner bros pictures",
  "wonder woman",
  "christopher nolan",
  "james gunn",
  "dceu",
  "mcu film",
  "box-office",
  "episode explained",
  "thriller movies",
  "movies of all time",
  "free to watch on youtube",
  "inception",
  "silence of the lambs",
  "a24",
  "searchlight pictures",
];

/** Soft movie/TV tokens. */
const MOVIE_TV_SOFT = [
  "movie",
  "movies",
  "film",
  "films",
  "cinema",
  "actress",
  "actor",
  "screenplay",
  "hollywood",
  "tv series",
  "television",
  "miniseries",
  "limited series",
  "episode",
  "episodes",
  "sitcom",
  "docuseries",
  "documentary",
  "oscars",
  "emmy",
  "premiere",
];

/** Strong gaming signals — must be present to keep gaming items that also mention film/TV. */
const GAMING_STRONG = [
  "playstation",
  "xbox",
  "nintendo",
  "switch 2",
  "switch",
  "steam",
  "steam deck",
  "pc game",
  "video game",
  "videogame",
  "videogames",
  "esports",
  "game pass",
  "ps5",
  "ps4",
  "xbox series",
  "nintendo direct",
  "state of play",
  "gamescom",
  "tokyo game show",
  "dlc",
  "patch notes",
  "live service",
  "battle pass",
  "early access",
  "gameplay",
  "speedrun",
  "modding",
  "indie game",
  "open-world game",
  "metroidvania",
  "roguelike",
  "souls-like",
  "gta",
  "call of duty",
  "fortnite",
  "minecraft",
  "zelda",
  "final fantasy",
  "assassin's creed",
  "elder scrolls",
  "blizzard",
  "ubisoft",
  "rockstar",
  "valve",
  "epic games",
  "unity engine",
  "unreal engine",
  "game studio",
  "game publisher",
  "gaming",
  "gamers",
  "multiplayer",
  "co-op",
  "boss fight",
  "playtest",
  "insomniac",
  "naughty dog",
  "fromsoftware",
  "capcom",
  "square enix",
  "bandai namco",
  "riot games",
  "league of legends",
  "wolverine",
  "marvel's",
  "arkham",
];

const GAMING_SOFT = [
  "game",
  "games",
  "gamer",
  "console",
  "npc",
  "level design",
  "beta",
  "alpha",
];

const MOVIES_OFFTOPIC = [
  "expecting another baby",
  "expecting a baby",
  "gives birth",
  "wedding photos",
  "divorcing",
];

function countHits(text: string, terms: string[]): number {
  let n = 0;
  for (const t of terms) {
    if (text.includes(t)) n += 1;
  }
  return n;
}

/**
 * Rule-based category relevance.
 * Prefer dropping cross-category leakage (Polygon movie/TV pieces in gaming).
 */
export function isRelevantToCategory(
  category: Category,
  title: string,
  summary: string
): boolean {
  const text = `${title} ${summary}`.toLowerCase();

  if (category === "gaming") {
    const gStrong = countHits(text, GAMING_STRONG);
    const gSoft = countHits(text, GAMING_SOFT);
    const mStrong = countHits(text, MOVIE_TV_STRONG);
    const mSoft = countHits(text, MOVIE_TV_SOFT);

    // Any strong movie/TV signal without a strong gaming signal → drop
    if (mStrong > 0 && gStrong === 0) return false;

    // Film-studio packaging with no game hooks (e.g. A24 sequel / director deals on gaming feeds)
    if (
      /\b(a24|searchlight|blumhouse|legendary pictures)\b/i.test(text) &&
      /\b(director|documentary|film|movie|theatrical|screening)\b/i.test(text) &&
      gStrong === 0 &&
      gSoft === 0
    ) {
      return false;
    }

    // Listicles / explainers about film & TV
    if (
      /\b(movies? of all time|films? to watch|episode \d+\s+explained|free to watch on youtube|thriller movies)\b/i.test(
        text
      ) &&
      gStrong === 0
    ) {
      return false;
    }

    // Soft movie tokens dominate, no real gaming hook
    if (mSoft >= 2 && gStrong === 0 && gSoft === 0) return false;
    if (mSoft >= 3 && gStrong === 0) return false;

    // Title is clearly a film/TV piece (director's movie, HBO episode) with no game words
    if (
      /\b(hbo|netflix|disney\+|prime video)\b/i.test(text) &&
      /\b(episode|season|series|film|movie)\b/i.test(text) &&
      gStrong === 0 &&
      gSoft === 0
    ) {
      return false;
    }

    return true;
  }

  // movies_tv — soft-drop pure celebrity baby/gossip with no entertainment keywords
  if (MOVIES_OFFTOPIC.some((t) => text.includes(t))) {
    const entertainment =
      countHits(text, MOVIE_TV_STRONG) +
      countHits(text, MOVIE_TV_SOFT) +
      countHits(text, ["franchise", "netflix", "hbo", "disney", "casting", "box office"]);
    if (entertainment === 0) return false;
  }
  return true;
}

export function filterArticlesForCategory<
  T extends { title: string; summary: string; category: Category },
>(articles: T[], category: Category): T[] {
  return articles.filter(
    (a) => a.category === category && isRelevantToCategory(category, a.title, a.summary)
  );
}
