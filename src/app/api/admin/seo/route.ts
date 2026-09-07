import { NextResponse } from "next/server";
import { listSeoSettings, upsertSeoSetting } from "@/lib/db";

export async function GET() {
  const settings = await listSeoSettings();
  return NextResponse.json({ settings });
}

export async function POST(request: Request) {
  const { pagePath, metaTitle, metaDescription } = await request.json();
  if (!pagePath) {
    return NextResponse.json({ error: "Thiếu đường dẫn trang" }, { status: 400 });
  }

  await upsertSeoSetting(pagePath, metaTitle || "", metaDescription || "");
  return NextResponse.json({ ok: true });
}
