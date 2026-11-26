import { NextResponse } from "next/server";
import { listRecentKangoReceiversSafe } from "@/lib/kango-bill-db";

export async function GET() {
  const receivers = await listRecentKangoReceiversSafe();
  return NextResponse.json({ receivers });
}
