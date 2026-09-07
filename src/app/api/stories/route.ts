import { NextRequest, NextResponse } from "next/server";
import { ensureStoreReady, getStories } from "@/lib/db";
import type { Category } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  await ensureStoreReady();
  const sp = req.nextUrl.searchParams;
  const category = sp.get("category") as Category | null;
  const sort = sp.get("sort") || "importance";
  const tag = sp.get("tag") || undefined;
  const stories = getStories({
    category: category === "movies_tv" || category === "gaming" ? category : undefined,
    sort,
    tag,
  });
  return NextResponse.json({ stories });
}
