import { NextResponse } from "next/server";
import { listCtvPayables } from "@/lib/db";

export async function GET() {
  const payables = await listCtvPayables();
  return NextResponse.json({ payables });
}
