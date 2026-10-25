import { NextResponse } from "next/server";
import { findOrderByFalcoCode } from "@/lib/db";
import { loadPublicTracking } from "@/lib/public-tracking";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code") || "";

  if (!code.trim()) {
    return NextResponse.json({ error: "Thiếu mã vận đơn" }, { status: 400 });
  }

  try {
    const order = await findOrderByFalcoCode(code);
    if (!order) {
      return NextResponse.json({ found: false, data: null });
    }
    return NextResponse.json({ found: true, data: await loadPublicTracking(order) });
  } catch (err) {
    console.error("[tracking] Lỗi tra cứu:", err);
    return NextResponse.json(
      { error: "Không thể tra cứu lúc này, vui lòng thử lại sau." },
      { status: 500 }
    );
  }
}
