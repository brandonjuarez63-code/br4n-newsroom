/**
 * Persistence for newsroom JSON.
 * - Local/dev: ./data/newsroom.json (or DATA_PATH)
 * - Vercel: prefer Blob (BLOB_READ_WRITE_TOKEN) or Turso (TURSO_*),
 *   else /tmp + in-memory (ephemeral per isolate — Refresh rehydrates live)
 */
import fs from "fs";
import path from "path";
import type { DbData } from "@/lib/types";

const BLOB_PATHNAME = "newsroom/newsroom.json";
const TMP_FILE = "/tmp/br4n-newsroom/newsroom.json";

let memoryCache: DbData | null = null;
let blobUrlCache: string | null = null;

function isVercel(): boolean {
  return process.env.VERCEL === "1" || !!process.env.VERCEL_ENV;
}

function localFilePath(): string {
  if (process.env.DATA_PATH) return process.env.DATA_PATH;
  return path.join(process.cwd(), "data", "newsroom.json");
}

function storageMode(): "blob" | "turso" | "tmp" | "fs" {
  if (process.env.TURSO_DATABASE_URL && process.env.TURSO_AUTH_TOKEN) return "turso";
  if (process.env.BLOB_READ_WRITE_TOKEN) return "blob";
  if (isVercel()) return "tmp";
  return "fs";
}

export function getStorageMode(): string {
  return storageMode();
}

function emptyDb(): DbData {
  return {
    sources: [],
    articles: [],
    stories: [],
    story_articles: [],
    refresh_runs: [],
    scripts: [],
    meta: { last_updated: null, seeded: false },
    sequences: {
      sources: 0,
      articles: 0,
      stories: 0,
      refresh_runs: 0,
      scripts: 0,
    },
  };
}

function ensureParentDir(file: string) {
  const dir = path.dirname(file);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function readFs(file: string): DbData {
  try {
    if (!fs.existsSync(file)) return emptyDb();
    return JSON.parse(fs.readFileSync(file, "utf8")) as DbData;
  } catch {
    return emptyDb();
  }
}

function writeFs(file: string, db: DbData) {
  ensureParentDir(file);
  fs.writeFileSync(file, JSON.stringify(db, null, 2), "utf8");
}

async function readBlob(): Promise<DbData> {
  const token = process.env.BLOB_READ_WRITE_TOKEN!;
  // List blobs with prefix, or try known URL from env / cache
  const url =
    process.env.NEWSROOM_BLOB_URL ||
    blobUrlCache ||
    (await findBlobUrl(token));
  if (!url) return emptyDb();
  blobUrlCache = url;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return emptyDb();
  try {
    return (await res.json()) as DbData;
  } catch {
    return emptyDb();
  }
}

async function findBlobUrl(token: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://blob.vercel-storage.com?prefix=${encodeURIComponent(BLOB_PATHNAME)}`,
      {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      }
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { blobs?: { pathname: string; url: string }[] };
    const hit = data.blobs?.find((b) => b.pathname === BLOB_PATHNAME || b.pathname.endsWith("newsroom.json"));
    return hit?.url || null;
  } catch {
    return null;
  }
}

async function writeBlob(db: DbData): Promise<void> {
  const token = process.env.BLOB_READ_WRITE_TOKEN!;
  const body = JSON.stringify(db);
  const res = await fetch(
    `https://blob.vercel-storage.com/${BLOB_PATHNAME}?overwrite=true`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "x-vercel-blob-access": "public",
      },
      body,
    }
  );
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Blob write failed: ${res.status} ${text.slice(0, 200)}`);
  }
  const data = (await res.json()) as { url?: string };
  if (data.url) blobUrlCache = data.url;
}

async function readTurso(): Promise<DbData> {
  const { createClient } = await import("@libsql/client");
  const client = createClient({
    url: process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN!,
  });
  await client.execute(`
    CREATE TABLE IF NOT EXISTS kv (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);
  const rs = await client.execute({
    sql: "SELECT value FROM kv WHERE key = ?",
    args: ["newsroom"],
  });
  const row = rs.rows[0];
  if (!row || row.value == null) return emptyDb();
  try {
    return JSON.parse(String(row.value)) as DbData;
  } catch {
    return emptyDb();
  }
}

async function writeTurso(db: DbData): Promise<void> {
  const { createClient } = await import("@libsql/client");
  const client = createClient({
    url: process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN!,
  });
  await client.execute(`
    CREATE TABLE IF NOT EXISTS kv (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);
  await client.execute({
    sql: `INSERT INTO kv (key, value) VALUES (?, ?)
          ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    args: ["newsroom", JSON.stringify(db)],
  });
}

/** Sync read — uses memory/fs/tmp. Blob/Turso hydrate via ensureHydrated(). */
export function readStoreSync(): DbData {
  if (memoryCache) return memoryCache;
  const mode = storageMode();
  if (mode === "fs") {
    memoryCache = readFs(localFilePath());
    return memoryCache;
  }
  if (mode === "tmp") {
    memoryCache = readFs(TMP_FILE);
    return memoryCache;
  }
  // blob/turso: return empty until async hydrate; callers use getDb which seeds
  return emptyDb();
}

export function writeStoreSync(db: DbData) {
  memoryCache = db;
  const mode = storageMode();
  if (mode === "fs") {
    writeFs(localFilePath(), db);
    return;
  }
  if (mode === "tmp") {
    writeFs(TMP_FILE, db);
    return;
  }
  // blob/turso: fire-and-forget persist (sync API surface)
  void persistRemote(db).catch((err) => {
    console.error("[newsroom store] remote persist failed", err);
  });
}

async function persistRemote(db: DbData) {
  const mode = storageMode();
  if (mode === "blob") await writeBlob(db);
  else if (mode === "turso") await writeTurso(db);
}

let hydratePromise: Promise<void> | null = null;

/** Load remote store into memory once per isolate (Blob / Turso). */
export async function ensureHydrated(): Promise<void> {
  const mode = storageMode();
  if (mode === "fs" || mode === "tmp") {
    if (!memoryCache) memoryCache = readStoreSync();
    return;
  }
  if (memoryCache?.meta?.seeded) return;
  if (!hydratePromise) {
    hydratePromise = (async () => {
      try {
        memoryCache = mode === "blob" ? await readBlob() : await readTurso();
      } catch (e) {
        console.error("[newsroom store] hydrate failed", e);
        memoryCache = emptyDb();
      }
    })();
  }
  await hydratePromise;
}

export function invalidateMemoryCache() {
  memoryCache = null;
  hydratePromise = null;
}
