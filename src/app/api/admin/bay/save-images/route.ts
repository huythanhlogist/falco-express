import { NextResponse } from "next/server";
import { getCurrentAdminSession } from "@/lib/auth";
import { bayImageUuid, saveBayImage } from "@/lib/bay-images";

const MAX_PER_REQUEST = 60;

// Nút "Lưu ảnh về server": body { urls: string[] } (URL ảnh Bay hoặc uuid).
export async function POST(request: Request) {
  const session = await getCurrentAdminSession();
  if (!session) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { urls?: unknown } | null;
  const urls = Array.isArray(body?.urls) ? body.urls.filter((u): u is string => typeof u === "string") : [];
  const ids = [...new Set(urls.map((u) => bayImageUuid(u) ?? (/^[0-9a-f-]{36}$/i.test(u) ? u.toLowerCase() : null)).filter((x): x is string => !!x))];
  if (!ids.length) return NextResponse.json({ error: "Không có ảnh hợp lệ" }, { status: 400 });
  if (ids.length > MAX_PER_REQUEST) return NextResponse.json({ error: `Tối đa ${MAX_PER_REQUEST} ảnh mỗi lần` }, { status: 400 });

  let saved = 0;
  let exists = 0;
  let failed = 0;
  for (let i = 0; i < ids.length; i += 3) {
    const results = await Promise.allSettled(ids.slice(i, i + 3).map(saveBayImage));
    for (const r of results) {
      if (r.status === "rejected") failed++;
      else if (r.value === "saved") saved++;
      else exists++;
    }
  }
  return NextResponse.json({ saved, exists, failed, total: ids.length });
}
