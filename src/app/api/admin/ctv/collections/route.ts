import { NextResponse } from "next/server";
import { listOutstandingCtvCollections } from "@/lib/db";

export async function GET() {
  const collections = await listOutstandingCtvCollections();
  return NextResponse.json({ collections });
}
