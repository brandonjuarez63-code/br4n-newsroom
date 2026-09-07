import { NextResponse } from "next/server";
import { ensureStoreReady, getLastUpdated, storageBackend } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  await ensureStoreReady();
  return NextResponse.json({
    last_updated: getLastUpdated(),
    storage: storageBackend(),
  });
}
