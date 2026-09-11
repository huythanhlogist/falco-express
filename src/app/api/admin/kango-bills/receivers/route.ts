import { NextResponse } from "next/server";
import { listRecentKangoReceivers } from "@/lib/db";

export async function GET() {
  const receivers = await listRecentKangoReceivers();
  return NextResponse.json({ receivers });
}
