import { NextResponse } from "next/server";
import { getCurrentAdminSession } from "@/lib/auth";
import { bay, BayApiError } from "@/lib/bay-api";
import { findOrderByAwb } from "@/lib/db";
import { mapBayStatus, bayStatusTitle } from "@/lib/bay-tracking";
import { buildBayPdf } from "@/lib/bay-pdf";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// GET ?ref=<mã vận đơn Bay> → file PDF hành trình + ảnh (tải thẳng về máy).
export async function GET(request: Request) {
  const session = await getCurrentAdminSession();
  if (!session) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  const ref = (new URL(request.url).searchParams.get("ref") ?? "").trim();
  if (!ref) return NextResponse.json({ error: "Thiếu mã vận đơn" }, { status: 400 });
  try {
    const [tracking, shipment, order] = await Promise.all([bay.getTracking(ref), bay.getShipment(ref).catch(() => null), findOrderByAwb(ref)]);
    const falcoCode = order?.falco_code ?? ref;
    const bytes = await buildBayPdf({ falcoCode, shipment, tracking, statusLabel: bayStatusTitle(mapBayStatus(tracking)) });
    return new Response(Buffer.from(bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${falcoCode}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    const status = err instanceof BayApiError && err.status === 404 ? 404 : 502;
    return NextResponse.json({ error: status === 404 ? "Không tìm thấy vận đơn" : "Không tạo được PDF" }, { status });
  }
}
