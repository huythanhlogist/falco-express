import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { getCurrentAdminSession } from "@/lib/auth";
import { findAiIntakeImageById } from "@/lib/db";

const SAFE_SERVE_MIMES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "image/gif",
]);

function isValidAgentKey(request: Request): boolean {
  const key = request.headers.get("x-agent-api-key");
  const expected = process.env.AGENT_API_KEY;
  if (!key || !expected) return false;
  const a = Buffer.from(key);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(request: Request, { params }: { params: Promise<{ imageId: string }> }) {
  const session = await getCurrentAdminSession();
  if (!session && !isValidAgentKey(request)) {
    return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  }

  const { imageId } = await params;
  const parsedId = Number(imageId);
  if (!Number.isInteger(parsedId) || parsedId <= 0) {
    return NextResponse.json({ error: "ID không hợp lệ" }, { status: 400 });
  }

  const image = await findAiIntakeImageById(parsedId);
  if (!image) return NextResponse.json({ error: "Không tìm thấy ảnh" }, { status: 404 });

  const mimeLower = (image.mime_type || "").toLowerCase().trim();
  const isSafe = SAFE_SERVE_MIMES.has(mimeLower);

  const headers: Record<string, string> = {
    "Content-Type": isSafe ? (mimeLower === "image/jpg" ? "image/jpeg" : mimeLower) : "application/octet-stream",
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "default-src 'none'; sandbox",
    "Cache-Control": "private, max-age=3600",
  };
  if (!isSafe) {
    headers["Content-Disposition"] = "attachment";
  }

  return new NextResponse(new Uint8Array(image.data), { headers });
}
