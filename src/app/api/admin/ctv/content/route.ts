import { NextResponse } from "next/server";
import { getCurrentAdminSession } from "@/lib/auth";
import { insertCtvContentItem, listCtvContentItems, type CtvContentKind } from "@/lib/db";

function parseKind(value: string | null): CtvContentKind | null {
  return value === "guide" || value === "channel" ? value : null;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const kind = parseKind(searchParams.get("kind"));
  if (!kind) return NextResponse.json({ error: "Thiếu hoặc sai tham số kind" }, { status: 400 });

  const items = await listCtvContentItems(kind);
  return NextResponse.json({ items });
}

export async function POST(request: Request) {
  const session = await getCurrentAdminSession();
  if (!session) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const { kind, title, content } = await request.json();
  const parsedKind = parseKind(kind);
  if (!parsedKind) return NextResponse.json({ error: "Thiếu hoặc sai tham số kind" }, { status: 400 });
  if (!title || typeof title !== "string" || !title.trim()) {
    return NextResponse.json({ error: "Vui lòng nhập tiêu đề" }, { status: 400 });
  }
  if (!content || typeof content !== "string" || !content.trim()) {
    return NextResponse.json({ error: "Vui lòng nhập nội dung" }, { status: 400 });
  }

  const id = await insertCtvContentItem(parsedKind, title.trim(), content.trim());
  return NextResponse.json({ ok: true, id });
}
