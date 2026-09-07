import type {
  Article,
  Category,
  DbData,
  RefreshRun,
  Source,
  Story,
  StoryArticle,
  StoryWithArticles,
} from "@/lib/types";
import { SEED_SOURCES, SAMPLE_BUNDLE, SOURCE_RENAMES } from "@/lib/sources/seed";
import {
  ensureHydrated,
  getStorageMode,
  invalidateMemoryCache,
  peekMemoryCache,
  readStoreSync,
  writeStoreAsync,
  writeStoreSync,
} from "@/lib/db/store";

function readRaw(): DbData {
  return readStoreSync();
}

function writeRaw(db: DbData) {
  writeStoreSync(db);
}

function nextId(db: DbData, key: string): number {
  db.sequences[key] = (db.sequences[key] || 0) + 1;
  return db.sequences[key];
}

export function todayArchiveDate(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

export function getDb(): DbData {
  const db = readRaw();
  if (!db.meta.seeded || db.sources.length === 0) {
    seedDatabase(db);
    writeRaw(db);
  } else if (reconcileSources(db)) {
    writeRaw(db);
  }
  return db;
}

/** Sync feed URLs / renames from SEED_SOURCES into an existing JSON store. */
function reconcileSources(db: DbData): boolean {
  let changed = false;
  for (const s of db.sources) {
    const renamed = SOURCE_RENAMES[s.name];
    if (renamed && renamed !== s.name) {
      s.name = renamed;
      changed = true;
    }
  }
  for (const seed of SEED_SOURCES) {
    let existing = db.sources.find((x) => x.name === seed.name && x.category === seed.category);
    if (!existing) {
      // Try reverse rename match (old name still in DB somehow)
      const oldName = Object.entries(SOURCE_RENAMES).find(([, n]) => n === seed.name)?.[0];
      if (oldName) {
        existing = db.sources.find((x) => x.name === oldName && x.category === seed.category);
        if (existing) {
          existing.name = seed.name;
          changed = true;
        }
      }
    }
    if (existing) {
      if (existing.feed_url !== seed.feed_url) {
        existing.feed_url = seed.feed_url;
        existing.unavailable = 0;
        changed = true;
      }
      if (existing.reliability !== seed.reliability) {
        existing.reliability = seed.reliability;
        changed = true;
      }
      if (existing.type !== seed.type) {
        existing.type = seed.type;
        changed = true;
      }
    } else {
      const id = nextId(db, "sources");
      db.sources.push({
        id,
        name: seed.name,
        category: seed.category,
        feed_url: seed.feed_url,
        reliability: seed.reliability,
        type: seed.type,
        enabled: 1,
        unavailable: 0,
      });
      changed = true;
    }
  }
  return changed;
}

export function saveDb(db: DbData) {
  writeRaw(db);
}

/** Persist and await remote (Blob/Turso) so other isolates can read fresh data. */
export async function saveDbAsync(db: DbData) {
  await writeStoreAsync(db);
}

/** Hydrate remote store (Turso/Blob) once per isolate, then return ready db. */
export async function ensureStoreReady(): Promise<DbData> {
  await ensureHydrated();
  return getDb();
}

export function storageBackend(): string {
  return getStorageMode();
}

function seedDatabase(db: DbData) {
  db.sources = [];
  db.articles = [];
  db.stories = [];
  db.story_articles = [];
  db.sequences = { sources: 0, articles: 0, stories: 0, refresh_runs: 0 };

  for (const s of SEED_SOURCES) {
    const id = nextId(db, "sources");
    db.sources.push({
      id,
      name: s.name,
      category: s.category,
      feed_url: s.feed_url,
      reliability: s.reliability,
      type: s.type,
      enabled: 1,
      unavailable: 0,
    });
  }

  const now = new Date().toISOString();
  const archive = todayArchiveDate();

  for (const sample of SAMPLE_BUNDLE) {
    const source = db.sources.find((x) => x.name === sample.sourceName && x.category === sample.category);
    if (!source) continue;
    const articleId = nextId(db, "articles");
    db.articles.push({
      id: articleId,
      source_id: source.id,
      title: sample.title,
      url: sample.url,
      author: sample.author,
      published_at: sample.published_at,
      summary: sample.summary,
      fetched_at: now,
      category: sample.category,
      tags: sample.tags,
      is_sample: 1,
    });

    const storyId = nextId(db, "stories");
    db.stories.push({
      id: storyId,
      category: sample.category,
      headline: sample.headline,
      summary: sample.summary,
      why_it_matters: sample.why_it_matters,
      importance: sample.importance,
      confidence: sample.confidence,
      status: sample.status,
      official_confirmed: sample.official_confirmed,
      what_we_know: sample.what_we_know,
      what_we_dont_know: sample.what_we_dont_know,
      why_importance: sample.why_importance,
      why_confidence: sample.why_confidence,
      primary_article_id: articleId,
      created_at: now,
      updated_at: now,
      archive_date: archive,
      is_sample: 1,
    });
    db.story_articles.push({ story_id: storyId, article_id: articleId });
  }

  db.meta.seeded = true;
  db.meta.last_updated = now;
}

export function listSources(category?: Category): Source[] {
  const db = getDb();
  return db.sources.filter((s) => (category ? s.category === category : true));
}

export function markSourceUnavailable(sourceId: number, unavailable: boolean) {
  const db = getDb();
  const s = db.sources.find((x) => x.id === sourceId);
  if (s) {
    s.unavailable = unavailable ? 1 : 0;
    saveDb(db);
  }
}

export function upsertArticle(
  db: DbData,
  input: Omit<Article, "id"> & { id?: number }
): Article {
  const existing = db.articles.find((a) => a.url === input.url);
  if (existing) {
    Object.assign(existing, { ...input, id: existing.id });
    return existing;
  }
  const article: Article = { ...input, id: nextId(db, "articles") };
  db.articles.push(article);
  return article;
}

export function replaceStoriesForCategory(
  db: DbData,
  category: Category,
  archiveDate: string,
  stories: Omit<Story, "id">[],
  links: { storyIndex: number; articleIds: number[] }[]
) {
  // Keep older archive dates; replace today's non-sample live stories for category
  const keepStories = db.stories.filter(
    (s) => !(s.category === category && s.archive_date === archiveDate && s.is_sample === 0)
  );
  const keepIds = new Set(keepStories.map((s) => s.id));
  db.story_articles = db.story_articles.filter((sa) => keepIds.has(sa.story_id));
  db.stories = keepStories;

  // If we have live stories, drop sample stories for this category/date
  if (stories.length > 0) {
    const remaining = db.stories.filter(
      (s) => !(s.category === category && s.archive_date === archiveDate && s.is_sample === 1)
    );
    const remIds = new Set(remaining.map((s) => s.id));
    db.story_articles = db.story_articles.filter((sa) => remIds.has(sa.story_id));
    db.stories = remaining;
  }

  stories.forEach((story, idx) => {
    const id = nextId(db, "stories");
    db.stories.push({ ...story, id });
    for (const articleId of links[idx]?.articleIds || []) {
      db.story_articles.push({ story_id: id, article_id: articleId });
    }
  });
}

export function createRefreshRun(category: string): RefreshRun {
  const db = getDb();
  const run: RefreshRun = {
    id: nextId(db, "refresh_runs"),
    category,
    started_at: new Date().toISOString(),
    finished_at: null,
    status: "running",
    article_count: 0,
    story_count: 0,
    error: null,
  };
  db.refresh_runs.push(run);
  saveDb(db);
  return run;
}

export async function finishRefreshRun(
  id: number,
  patch: Partial<RefreshRun>
) {
  const db = getDb();
  const run = db.refresh_runs.find((r) => r.id === id);
  if (run) {
    Object.assign(run, patch, { finished_at: new Date().toISOString() });
    if (patch.status === "ok" || patch.status === "partial") {
      db.meta.last_updated = run.finished_at;
    }
    await saveDbAsync(db);
  }
}

export function getStories(opts: {
  category?: Category;
  sort?: string;
  tag?: string;
  archiveDate?: string;
  limit?: number;
}): StoryWithArticles[] {
  const db = getDb();
  const archiveDate = opts.archiveDate || todayArchiveDate();
  let stories = db.stories.filter((s) => s.archive_date === archiveDate);
  if (opts.category) stories = stories.filter((s) => s.category === opts.category);
  if (opts.tag) {
    const tag = opts.tag.toLowerCase();
    stories = stories.filter((s) => {
      const arts = articlesForStory(db, s.id);
      return arts.some((a) => a.tags.some((t) => t.toLowerCase().includes(tag)));
    });
  }

  const sort = opts.sort || "importance";
  stories = [...stories].sort((a, b) => {
    if (sort === "newest") return (b.updated_at || "").localeCompare(a.updated_at || "");
    if (sort === "confidence") return b.confidence - a.confidence || b.importance - a.importance;
    if (sort === "reported") return (b.created_at || "").localeCompare(a.created_at || "");
    return b.importance - a.importance || b.confidence - a.confidence;
  });

  if (opts.limit) stories = stories.slice(0, opts.limit);
  return stories.map((s) => hydrateStory(db, s));
}

export function getStoryById(id: number): StoryWithArticles | null {
  const db = getDb();
  const s = db.stories.find((x) => x.id === id);
  if (!s) return null;
  return hydrateStory(db, s);
}

/**
 * Story lookup with remote rehydrate-on-miss.
 * Fixes Source Breakdown 404s when a warm isolate still has stale/empty memory
 * while Blob/Turso already has the refreshed story.
 */
export async function getStoryByIdAsync(id: number): Promise<StoryWithArticles | null> {
  if (!Number.isFinite(id) || id <= 0) return null;
  await ensureStoreReady();
  let hit = getStoryById(id);
  if (hit) return hit;

  const mode = getStorageMode();
  if (mode !== "blob" && mode !== "turso") return null;

  invalidateMemoryCache();
  await ensureHydrated({ force: true });
  const raw = peekMemoryCache();
  if (raw?.meta?.seeded && raw.stories?.length) {
    // Use remote snapshot directly — do not seed-overwrite a populated store
    const s = raw.stories.find((x) => x.id === id);
    if (s) return hydrateStory(raw, s);
    return null;
  }
  // Remote empty: fall back to normal getDb seeding for bootstrap only
  return getStoryById(id);
}

function articlesForStory(db: DbData, storyId: number): Article[] {
  const ids = db.story_articles.filter((sa) => sa.story_id === storyId).map((sa) => sa.article_id);
  return db.articles.filter((a) => ids.includes(a.id));
}

function hydrateStory(db: DbData, s: Story): StoryWithArticles {
  const articles = articlesForStory(db, s.id).map((a) => {
    const source = db.sources.find((x) => x.id === a.source_id);
    return {
      ...a,
      source_name: source?.name,
      source_reliability: source?.reliability,
      source_type: source?.type,
    };
  });
  const publications = [...new Set(articles.map((a) => a.source_name).filter(Boolean) as string[])];
  return { ...s, articles, publications };
}

export function getTop5(category: Category, archiveDate?: string): StoryWithArticles[] {
  return getStories({ category, sort: "importance", archiveDate, limit: 5 });
}

export function listArchiveDates(): string[] {
  const db = getDb();
  const dates = [...new Set(db.stories.map((s) => s.archive_date))];
  return dates.sort().reverse();
}

export function getLastUpdated(): string | null {
  return getDb().meta.last_updated;
}

export function getArticlesSince(db: DbData, category: Category, hours = 72): Article[] {
  const cutoff = Date.now() - hours * 3600 * 1000;
  return db.articles.filter((a) => {
    if (a.category !== category) return false;
    const t = a.published_at || a.fetched_at;
    return new Date(t).getTime() >= cutoff || a.is_sample === 1;
  });
}
