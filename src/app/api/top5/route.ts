import { NextRequest, NextResponse } from "next/server";
import { ensureStoreReady, getTop5 } from "@/lib/db";
import type { Category } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  await ensureStoreReady();
  const category = req.nextUrl.searchParams.get("category") as Category | null;
  if (category !== "movies_tv" && category !== "gaming") {
    return NextResponse.json({ error: "category required" }, { status: 400 });
  }
  const stories = getTop5(category);
  return NextResponse.json({ stories });
}
