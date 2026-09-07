import { NextRequest, NextResponse } from "next/server";
import { ensureStoreReady, getTop5, listArchiveDates } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  await ensureStoreReady();
  const date = req.nextUrl.searchParams.get("date");
  const dates = listArchiveDates();
  if (!date) {
    return NextResponse.json({ dates });
  }
  const movies_tv = getTop5("movies_tv", date);
  const gaming = getTop5("gaming", date);
  return NextResponse.json({ date, dates, movies_tv, gaming });
}
