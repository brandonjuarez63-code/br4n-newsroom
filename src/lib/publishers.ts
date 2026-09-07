/**
 * Display-only publisher identity (logos / domains).
 * Does not affect ranking, clustering, scoring, or URLs.
 */

export interface PublisherInfo {
  /** Canonical display name */
  name: string;
  /** Primary domain for favicon fallback */
  domain: string;
  /** Local asset under /public/logos/ */
  logo: string;
  /** Short initials for badge fallback */
  initials: string;
}

const BY_KEY: Record<string, PublisherInfo> = {
  variety: {
    name: "Variety",
    domain: "variety.com",
    logo: "/logos/variety.svg",
    initials: "V",
  },
  deadline: {
    name: "Deadline",
    domain: "deadline.com",
    logo: "/logos/deadline.svg",
    initials: "D",
  },
  "the hollywood reporter": {
    name: "The Hollywood Reporter",
    domain: "hollywoodreporter.com",
    logo: "/logos/thr.svg",
    initials: "THR",
  },
  thr: {
    name: "The Hollywood Reporter",
    domain: "hollywoodreporter.com",
    logo: "/logos/thr.svg",
    initials: "THR",
  },
  hollywoodreporter: {
    name: "The Hollywood Reporter",
    domain: "hollywoodreporter.com",
    logo: "/logos/thr.svg",
    initials: "THR",
  },
  indiewire: {
    name: "IndieWire",
    domain: "indiewire.com",
    logo: "/logos/indiewire.svg",
    initials: "IW",
  },
  thewrap: {
    name: "TheWrap",
    domain: "thewrap.com",
    logo: "/logos/thewrap.svg",
    initials: "TW",
  },
  ign: {
    name: "IGN",
    domain: "ign.com",
    logo: "/logos/ign.svg",
    initials: "IGN",
  },
  polygon: {
    name: "Polygon",
    domain: "polygon.com",
    logo: "/logos/polygon.svg",
    initials: "P",
  },
  eurogamer: {
    name: "Eurogamer",
    domain: "eurogamer.net",
    logo: "/logos/eurogamer.svg",
    initials: "EG",
  },
  gamespot: {
    name: "GameSpot",
    domain: "gamespot.com",
    logo: "/logos/gamespot.svg",
    initials: "GS",
  },
  vgc: {
    name: "VGC",
    domain: "videogameschronicle.com",
    logo: "/logos/vgc.svg",
    initials: "VGC",
  },
  "video games chronicle": {
    name: "VGC",
    domain: "videogameschronicle.com",
    logo: "/logos/vgc.svg",
    initials: "VGC",
  },
  videogameschronicle: {
    name: "VGC",
    domain: "videogameschronicle.com",
    logo: "/logos/vgc.svg",
    initials: "VGC",
  },
  empire: {
    name: "Empire",
    domain: "empireonline.com",
    logo: "/logos/empire.svg",
    initials: "E",
  },
};

function normalizeKey(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function compactKey(value: string): string {
  return normalizeKey(value).replace(/\s+/g, "");
}

function domainFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const host = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
    return host || null;
  } catch {
    return null;
  }
}

const DOMAIN_ALIASES: Record<string, string> = {
  "variety.com": "variety",
  "deadline.com": "deadline",
  "hollywoodreporter.com": "the hollywood reporter",
  "indiewire.com": "indiewire",
  "thewrap.com": "thewrap",
  "ign.com": "ign",
  "polygon.com": "polygon",
  "eurogamer.net": "eurogamer",
  "gamespot.com": "gamespot",
  "videogameschronicle.com": "vgc",
  "empireonline.com": "empire",
};

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) {
    const w = parts[0];
    return w.length <= 3 ? w.toUpperCase() : w.slice(0, 2).toUpperCase();
  }
  if (parts.length === 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  // Prefer acronym of significant words (skip "The", "Of")
  const significant = parts.filter(
    (p) => !["the", "of", "and", "&"].includes(p.toLowerCase())
  );
  const use = (significant.length ? significant : parts).slice(0, 3);
  return use.map((p) => p[0]).join("").toUpperCase();
}

export function resolvePublisher(
  nameOrDomain?: string | null,
  articleUrl?: string | null
): PublisherInfo {
  const raw = (nameOrDomain ?? "").trim();
  if (raw) {
    const spaced = normalizeKey(raw);
    const compact = compactKey(raw);
    const hit = BY_KEY[spaced] || BY_KEY[compact];
    if (hit) return hit;
  }

  const domain = domainFromUrl(articleUrl) || (raw.includes(".") ? raw.replace(/^www\./, "") : null);
  if (domain) {
    const alias = DOMAIN_ALIASES[domain];
    if (alias && BY_KEY[alias]) return BY_KEY[alias];
    // Unknown domain — synthesize
    const label = raw || domain.split(".")[0] || "Source";
    return {
      name: label,
      domain,
      logo: "",
      initials: initialsFromName(label),
    };
  }

  const label = raw || "Source";
  return {
    name: label,
    domain: "",
    logo: "",
    initials: initialsFromName(label),
  };
}

/** Prefer local logo; otherwise Google favicon by domain; empty if neither. */
export function publisherLogoSrc(info: PublisherInfo): string | null {
  if (info.logo) return info.logo;
  if (info.domain) {
    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(info.domain)}&sz=64`;
  }
  return null;
}
