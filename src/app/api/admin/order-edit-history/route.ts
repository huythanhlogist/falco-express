import { NextResponse } from "next/server";
import { getCurrentAdminSession } from "@/lib/auth";
import { listOrderEditHistory } from "@/lib/db";

export async function GET() {
  const session = await getCurrentAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  }
  const history = await listOrderEditHistory(30);
  return NextResponse.json({ history });
}
