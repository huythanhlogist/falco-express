import { servePhoto } from "@/lib/tracking-photo";

// Ảnh hàng của đơn FEB… cho khách: /api/tracking/photo?code=FEB…&n=<số thứ tự> (xem src/lib/tracking-photo.ts).
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  return servePhoto((searchParams.get("code") ?? "").trim(), Number(searchParams.get("n")));
}
