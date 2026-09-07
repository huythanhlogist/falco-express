import { NextResponse } from "next/server";
import { getCurrentAdminSession } from "@/lib/auth";
import { listUploadHistory } from "@/lib/db";

export async function GET() {
  const session = await getCurrentAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  }
  const history = await listUploadHistory(20);
  return NextResponse.json({ history });
}
