import { NextResponse } from "next/server";
import { findOrderByTrackingCode } from "@/lib/sheets";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code") || "";

  if (!code.trim()) {
    return NextResponse.json({ error: "Thiếu mã vận đơn" }, { status: 400 });
  }

  try {
    const order = await findOrderByTrackingCode(code);
    return NextResponse.json({ found: !!order, data: order });
  } catch (err) {
    console.error("[tracking] Lỗi truy vấn Google Sheet:", err);
    return NextResponse.json(
      { error: "Không thể tra cứu lúc này, vui lòng thử lại sau." },
      { status: 500 }
    );
  }
}
