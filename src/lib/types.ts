export type Category = "movies_tv" | "gaming";

export type SourceType = "official" | "industry" | "general" | "low";

export type StoryStatus =
  | "CONFIRMED"
  | "HIGH CONFIDENCE"
  | "REPORTED"
  | "UNCONFIRMED"
  | "RUMOR";

export interface Source {
  id: number;
  name: string;
  category: Category;
  feed_url: string;
  reliability: number;
  type: SourceType;
  enabled: number;
  unavailable: number;
}

export interface Article {
  id: number;
  source_id: number;
  title: string;
  url: string;
  author: string;
  published_at: string | null;
  summary: string;
  fetched_at: string;
  category: Category;
  tags: string[];
  is_sample: number;
  /** Optional OG/RSS media URL when present in feed (enclosure / media:thumbnail). */
  image_url?: string | null;
}

export interface Story {
  id: number;
  category: Category;
  headline: string;
  summary: string;
  why_it_matters: string;
  importance: number;
  confidence: number;
  status: StoryStatus;
  official_confirmed: number;
  what_we_know: string;
  what_we_dont_know: string;
  why_importance: string;
  why_confidence: string;
  primary_article_id: number | null;
  created_at: string;
  updated_at: string;
  archive_date: string;
  is_sample: number;
}

export interface StoryArticle {
  story_id: number;
  article_id: number;
}

export interface RefreshRun {
  id: number;
  category: string;
  started_at: string;
  finished_at: string | null;
  status: string;
  article_count: number;
  story_count: number;
  error: string | null;
}

export interface StoryWithArticles extends Story {
  articles: (Article & { source_name?: string; source_reliability?: number; source_type?: SourceType })[];
  publications: string[];
}

export interface DbData {
  sources: Source[];
  articles: Article[];
  stories: Story[];
  story_articles: StoryArticle[];
  refresh_runs: RefreshRun[];
  meta: { last_updated: string | null; seeded: boolean };
  sequences: Record<string, number>;
}
