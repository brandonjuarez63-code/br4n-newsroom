import type { Category, Story } from "@/lib/types";
import {
  createRefreshRun,
  finishRefreshRun,
  getDb,
  listSources,
  replaceStoriesForCategory,
  saveDb,
  todayArchiveDate,
  upsertArticle,
} from "@/lib/db";
import { fetchCategoryFeeds } from "@/lib/sources/rss";
import { clusterArticles } from "@/lib/clustering";
import { scoreCluster } from "@/lib/ranking";

export async function refreshCategory(category: Category) {
  const run = createRefreshRun(category);
  try {
    const sources = listSources(category);
    const { articles: fetched, errors, skipped_irrelevant } = await fetchCategoryFeeds(sources);
    const db = getDb();
    const saved = fetched.map((a) => upsertArticle(db, a));
    saveDb(db);

    const sourcesById = new Map(db.sources.map((s) => [s.id, s]));
    const archiveDate = todayArchiveDate();
    const now = new Date().toISOString();

    let storyCount = 0;
    if (saved.length > 0) {
      const clusters = clusterArticles(saved);
      const scored = clusters
        .map((c) => scoreCluster(c, sourcesById))
        .sort((a, b) => b.importance - a.importance);

      const stories: Omit<Story, "id">[] = scored.map((s) => ({
        category,
        headline: s.headline,
        summary: s.summary,
        why_it_matters: s.why_it_matters,
        importance: s.importance,
        confidence: s.confidence,
        status: s.status,
        official_confirmed: s.official_confirmed,
        what_we_know: s.what_we_know,
        what_we_dont_know: s.what_we_dont_know,
        why_importance: s.why_importance,
        why_confidence: s.why_confidence,
        primary_article_id: s.primary_article_id,
        created_at: now,
        updated_at: now,
        archive_date: archiveDate,
        is_sample: 0,
      }));

      const links = scored.map((s, storyIndex) => ({
        storyIndex,
        articleIds: s.articleIds,
      }));

      replaceStoriesForCategory(db, category, archiveDate, stories, links);
      saveDb(db);
      storyCount = stories.length;
    }

    const errMsg = errors.length ? errors.map((e) => e.error).join("; ") : null;
    finishRefreshRun(run.id, {
      status: saved.length > 0 ? "ok" : errors.length ? "partial" : "ok",
      article_count: saved.length,
      story_count: storyCount,
      error: errMsg,
    });

    return {
      category,
      article_count: saved.length,
      story_count: storyCount,
      errors,
      skipped_irrelevant: skipped_irrelevant || 0,
      kept_samples: saved.length === 0,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "refresh failed";
    finishRefreshRun(run.id, {
      status: "error",
      article_count: 0,
      story_count: 0,
      error: msg,
    });
    throw e;
  }
}

export async function refreshAll(categories: Category[] = ["movies_tv", "gaming"]) {
  const results = [];
  for (const cat of categories) {
    results.push(await refreshCategory(cat));
  }
  return results;
}
