import type { Category, SourceType, StoryStatus } from "@/lib/types";

export interface SeedSource {
  name: string;
  category: Category;
  feed_url: string;
  reliability: number;
  type: SourceType;
}

export const SEED_SOURCES: SeedSource[] = [
  { name: "Variety", category: "movies_tv", feed_url: "https://variety.com/feed/", reliability: 90, type: "industry" },
  { name: "Deadline", category: "movies_tv", feed_url: "https://deadline.com/feed/", reliability: 92, type: "industry" },
  { name: "The Hollywood Reporter", category: "movies_tv", feed_url: "https://www.hollywoodreporter.com/feed/", reliability: 90, type: "industry" },
  // Empire/EW public feeds 404; IndieWire + TheWrap are working industry/general substitutes
  { name: "IndieWire", category: "movies_tv", feed_url: "https://www.indiewire.com/feed/", reliability: 84, type: "industry" },
  { name: "TheWrap", category: "movies_tv", feed_url: "https://www.thewrap.com/feed/", reliability: 80, type: "general" },
  { name: "IGN", category: "gaming", feed_url: "https://www.ign.com/rss/articles/feed?tags=games", reliability: 88, type: "industry" },
  { name: "Polygon", category: "gaming", feed_url: "https://www.polygon.com/rss/index.xml", reliability: 86, type: "industry" },
  { name: "Eurogamer", category: "gaming", feed_url: "https://www.eurogamer.net/feed", reliability: 87, type: "industry" },
  { name: "GameSpot", category: "gaming", feed_url: "https://www.gamespot.com/feeds/news/", reliability: 84, type: "industry" },
  // VGC often 403 from datacenter IPs — kept enabled; refresh skips gracefully
  { name: "VGC", category: "gaming", feed_url: "https://www.videogameschronicle.com/feed/", reliability: 89, type: "industry" },
];

/** Old seed names → new names when reconciling an existing JSON store. */
export const SOURCE_RENAMES: Record<string, string> = {
  Empire: "IndieWire",
  "Entertainment Weekly": "TheWrap",
};

export interface SampleItem {
  sourceName: string;
  category: Category;
  title: string;
  url: string;
  author: string;
  published_at: string;
  summary: string;
  tags: string[];
  headline: string;
  why_it_matters: string;
  importance: number;
  confidence: number;
  status: StoryStatus;
  official_confirmed: number;
  what_we_know: string;
  what_we_dont_know: string;
  why_importance: string;
  why_confidence: string;
}

const recent = (hoursAgo: number) => new Date(Date.now() - hoursAgo * 3600 * 1000).toISOString();

export const SAMPLE_BUNDLE: SampleItem[] = [
  {
    sourceName: "Variety",
    category: "movies_tv",
    title: "Marvel Studios Sets New Release Window for Major Franchise Title (Sample)",
    url: "https://variety.com/sample/marvel-release-window",
    author: "Author not listed",
    published_at: recent(6),
    summary: "Sample story: a major Marvel title is reportedly shifting its theatrical window amid slate adjustments.",
    tags: ["marvel", "franchise", "release", "box office"],
    headline: "Marvel franchise title reportedly shifts theatrical release window",
    why_it_matters: "Franchise release moves can reshape box office calendars and streaming windows.",
    importance: 86,
    confidence: 74,
    status: "REPORTED",
    official_confirmed: 0,
    what_we_know: "Industry outlets report a scheduling change for a major Marvel title.",
    what_we_dont_know: "Exact dates, title confirmation, and studio comment are not fully locked.",
    why_importance: "Major franchise + release timing + multi-outlet interest.",
    why_confidence: "Strong industry pubs, but no official studio confirmation yet.",
  },
  {
    sourceName: "Deadline",
    category: "movies_tv",
    title: "Streaming Giant In Talks For Prestige Limited Series Package (Sample)",
    url: "https://deadline.com/sample/streaming-limited-series",
    author: "Author not listed",
    published_at: recent(10),
    summary: "Sample story: a streamer is in talks for a high-profile limited series with A-list attachments.",
    tags: ["streaming", "casting", "limited series"],
    headline: "Streamer in talks for prestige limited series with A-list attachments",
    why_it_matters: "High-profile casting and limited series deals drive awards and subscriber buzz.",
    importance: 78,
    confidence: 68,
    status: "UNCONFIRMED",
    official_confirmed: 0,
    what_we_know: "Talks are reported; packaging appears underway.",
    what_we_dont_know: "Deal status, cast contracts, and premiere targets remain unclear.",
    why_importance: "Casting + streaming competition keywords.",
    why_confidence: "Single primary industry report in sample seed.",
  },
  {
    sourceName: "The Hollywood Reporter",
    category: "movies_tv",
    title: "Box Office: Tentpole Opens Strong Over Opening Weekend (Sample)",
    url: "https://www.hollywoodreporter.com/sample/box-office-tentpole",
    author: "Author not listed",
    published_at: recent(4),
    summary: "Sample story: a tentpole film posts a strong opening weekend domestically.",
    tags: ["box office", "opening weekend"],
    headline: "Tentpole film posts strong opening weekend at domestic box office",
    why_it_matters: "Opening weekend figures signal theatrical health and sequel viability.",
    importance: 82,
    confidence: 88,
    status: "HIGH CONFIDENCE",
    official_confirmed: 0,
    what_we_know: "Reported grosses and comparisons to recent tentpoles.",
    what_we_dont_know: "Final audited totals and international splits may still move.",
    why_importance: "Box office is a high-signal entertainment metric.",
    why_confidence: "Multiple tracking-style reports typically converge quickly.",
  },
  {
    sourceName: "IndieWire",
    category: "movies_tv",
    title: "Director Attached To Reboot Of Classic Sci-Fi Property (Sample)",
    url: "https://www.indiewire.com/sample/scifi-reboot",
    author: "Author not listed",
    published_at: recent(20),
    summary: "Sample story: a noted director is attached to reboot a classic sci-fi property.",
    tags: ["reboot", "director", "sci-fi"],
    headline: "Noted director attached to classic sci-fi reboot",
    why_it_matters: "Director attachments often greenlight long-gestating reboots.",
    importance: 71,
    confidence: 62,
    status: "REPORTED",
    official_confirmed: 0,
    what_we_know: "Attachment reported by entertainment press.",
    what_we_dont_know: "Studio greenlight, script status, and casting.",
    why_importance: "Franchise reboot + director name recognition.",
    why_confidence: "Early-stage reporting without official confirmation.",
  },
  {
    sourceName: "IGN",
    category: "gaming",
    title: "Major Studio Delays Open-World Sequel Into Next Year (Sample)",
    url: "https://www.ign.com/sample/open-world-delay",
    author: "Author not listed",
    published_at: recent(5),
    summary: "Sample story: a major studio delays a highly anticipated open-world sequel.",
    tags: ["delay", "sequel", "open world"],
    headline: "Major studio delays anticipated open-world sequel",
    why_it_matters: "Delays reshape release calendars and player expectations for big sequels.",
    importance: 88,
    confidence: 80,
    status: "HIGH CONFIDENCE",
    official_confirmed: 0,
    what_we_know: "A new target window has been reported by gaming press.",
    what_we_dont_know: "Exact day-one details and platform specifics may still change.",
    why_importance: "Delay + major sequel keywords score highly.",
    why_confidence: "Industry gaming outlets with solid reliability.",
  },
  {
    sourceName: "Polygon",
    category: "gaming",
    title: "Publisher In Advanced Talks To Acquire Indie Studio (Sample)",
    url: "https://www.polygon.com/sample/publisher-acquisition",
    author: "Author not listed",
    published_at: recent(8),
    summary: "Sample story: a publisher is in advanced talks to acquire a breakout indie studio.",
    tags: ["acquisition", "indie", "publisher"],
    headline: "Publisher in advanced talks to acquire breakout indie studio",
    why_it_matters: "Acquisitions can change creative independence and franchise roadmaps.",
    importance: 84,
    confidence: 66,
    status: "UNCONFIRMED",
    official_confirmed: 0,
    what_we_know: "Talks are described as advanced by industry reporting.",
    what_we_dont_know: "Price, close timeline, and studio autonomy terms.",
    why_importance: "Acquisition is a high-impact industry keyword.",
    why_confidence: "Deal talks remain fluid without official statements.",
  },
  {
    sourceName: "Eurogamer",
    category: "gaming",
    title: "Live-Service Title Adds Major Crossover Event This Season (Sample)",
    url: "https://www.eurogamer.net/sample/crossover-event",
    author: "Author not listed",
    published_at: recent(3),
    summary: "Sample story: a live-service game launches a major crossover event this season.",
    tags: ["live service", "crossover", "event"],
    headline: "Live-service game launches major crossover event",
    why_it_matters: "Crossovers drive engagement spikes and cultural visibility.",
    importance: 73,
    confidence: 85,
    status: "HIGH CONFIDENCE",
    official_confirmed: 0,
    what_we_know: "Event timing and crossover partner reported.",
    what_we_dont_know: "Full reward structure and longevity of collaboration.",
    why_importance: "Live-ops events move player counts quickly.",
    why_confidence: "Event coverage usually aligns with patch notes soon after.",
  },
  {
    sourceName: "VGC",
    category: "gaming",
    title: "Platform Holder Teases New Hardware Revision For Holidays (Sample)",
    url: "https://www.videogameschronicle.com/sample/hardware-revision",
    author: "Author not listed",
    published_at: recent(12),
    summary: "Sample story: a platform holder teases a hardware revision aimed at the holidays.",
    tags: ["hardware", "platform", "holiday"],
    headline: "Platform holder teases holiday hardware revision",
    why_it_matters: "Hardware refreshes affect pricing, attach rates, and holiday sales.",
    importance: 90,
    confidence: 70,
    status: "REPORTED",
    official_confirmed: 0,
    what_we_know: "Holiday timing and revision framing reported by industry press.",
    what_we_dont_know: "Specs, price, and regional rollout details.",
    why_importance: "Hardware news is top-tier gaming industry signal.",
    why_confidence: "Tease-level reporting pending official confirmation.",
  },
];
