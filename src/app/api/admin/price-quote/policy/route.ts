import { NextResponse } from "next/server";
import { getCurrentAdminSession } from "@/lib/auth";
import { insertPolicyItem, listPolicyItems } from "@/lib/db";

export async function POST(request: Request) {
  const session = await getCurrentAdminSession();
  if (!session) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const body = await request.json();
  const content = typeof body.content === "string" ? body.content.trim() : "";
  if (!content) {
    return NextResponse.json({ error: "Nội dung không được để trống" }, { status: 400 });
  }

  const existing = await listPolicyItems();
  const nextPosition = existing.length > 0 ? Math.max(...existing.map((i) => i.position)) + 1 : 0;
  const id = await insertPolicyItem(content, nextPosition);
  return NextResponse.json({ id, position: nextPosition });
}
