import { NextRequest, NextResponse } from "next/server";
import { ensureStoreReady, getStoryById } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  await ensureStoreReady();
  const { id } = await ctx.params;
  const story = getStoryById(Number(id));
  if (!story) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ story });
}
