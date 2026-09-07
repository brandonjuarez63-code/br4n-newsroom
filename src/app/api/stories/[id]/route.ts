import { NextRequest, NextResponse } from "next/server";
import { getStoryByIdAsync } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const numericId = Number(id);
  if (!Number.isFinite(numericId) || numericId <= 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const story = await getStoryByIdAsync(numericId);
  if (!story) return NextResponse.json({ error: "Not found" }, { status: 404 });
  // Guard: never return another story's payload
  if (story.id !== numericId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ story });
}
