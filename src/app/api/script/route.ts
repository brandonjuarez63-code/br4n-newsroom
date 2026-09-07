import { NextRequest, NextResponse } from "next/server";
import { ensureStoreReady, getTop5, saveScript, todayArchiveDate } from "@/lib/db";
import { generateScript } from "@/lib/script/generate";
import type { Category } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    await ensureStoreReady();
    const body = await req.json();
    const category = body.category as Category;
    const count = Number(body.count) as 1 | 3 | 5;
    if (category !== "movies_tv" && category !== "gaming") {
      return NextResponse.json({ error: "Invalid category" }, { status: 400 });
    }
    if (![1, 3, 5].includes(count)) {
      return NextResponse.json({ error: "count must be 1, 3, or 5" }, { status: 400 });
    }
    const stories = getTop5(category).slice(0, count);
    if (!stories.length) {
      return NextResponse.json({ error: "No stories available" }, { status: 404 });
    }
    const generated = await generateScript(category, stories);
    const saved = saveScript({
      category,
      story_count: count,
      body: generated.body,
      sources_json: JSON.stringify(generated.sources),
      created_at: new Date().toISOString(),
      archive_date: todayArchiveDate(),
    });
    return NextResponse.json({
      script: saved,
      engine: generated.engine,
      body: generated.body,
      sources: generated.sources,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Script failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
