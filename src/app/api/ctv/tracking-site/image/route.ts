import { NextResponse } from "next/server";
import { getCurrentCtvSession } from "@/lib/ctv-auth";
import { getTrackingSiteByCtv, setTrackingSiteImage } from "@/lib/ctv-portal";

const MAX_BYTES = 1024 * 1024; // 1MB
const TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

// POST multipart { kind: "logo"|"banner", file } · DELETE ?kind=logo|banner
export async function POST(request: Request) {
  const session = await getCurrentCtvSession();
  if (!session) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  if (!(await getTrackingSiteByCtv(session.ctvId))) {
    return NextResponse.json({ error: "Hãy lưu theme trước rồi mới tải ảnh" }, { status: 400 });
  }
  const form = await request.formData();
  const kind = String(form.get("kind"));
  const file = form.get("file");
  if ((kind !== "logo" && kind !== "banner") || !(file instanceof File)) {
    return NextResponse.json({ error: "Yêu cầu không hợp lệ" }, { status: 400 });
  }
  if (!TYPES.has(file.type)) return NextResponse.json({ error: "Chỉ nhận ảnh PNG, JPG hoặc WebP" }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "Ảnh tối đa 1MB" }, { status: 400 });
  await setTrackingSiteImage(session.ctvId, kind, Buffer.from(await file.arrayBuffer()), file.type);
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const session = await getCurrentCtvSession();
  if (!session) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  const kind = new URL(request.url).searchParams.get("kind");
  if (kind !== "logo" && kind !== "banner") return NextResponse.json({ error: "Yêu cầu không hợp lệ" }, { status: 400 });
  await setTrackingSiteImage(session.ctvId, kind, null, null);
  return NextResponse.json({ ok: true });
}
