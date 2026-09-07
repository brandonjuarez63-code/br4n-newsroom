import { NextRequest, NextResponse } from "next/server";
import { ensureStoreReady, storageBackend } from "@/lib/db";
import { refreshAll, refreshCategory } from "@/lib/sources/refresh";
import type { Category } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const category = (req.nextUrl.searchParams.get("category") || "all") as Category | "all";
  try {
    await ensureStoreReady();
    if (category === "all") {
      const results = await refreshAll();
      return NextResponse.json({ ok: true, storage: storageBackend(), results });
    }
    if (category !== "movies_tv" && category !== "gaming") {
      return NextResponse.json({ ok: false, error: "Invalid category" }, { status: 400 });
    }
    const result = await refreshCategory(category);
    return NextResponse.json({ ok: true, storage: storageBackend(), results: [result] });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Refresh failed";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
