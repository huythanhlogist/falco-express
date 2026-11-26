import { NextResponse } from "next/server";
import { getCurrentAdminSession } from "@/lib/auth";
import { dismissAlert, undismissAlert } from "@/lib/alert-dismissals";

export const dynamic = "force-dynamic";

/** Ẩn 1 đơn khỏi "Cần chú ý" (body: { orderId, shipmentStatus, undo? }). */
export async function POST(req: Request) {
  const session = await getCurrentAdminSession();
  if (!session) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  let body: { orderId?: unknown; shipmentStatus?: unknown; undo?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Dữ liệu không hợp lệ" }, { status: 400 });
  }
  const orderId = Number(body.orderId);
  if (!Number.isInteger(orderId) || orderId <= 0) {
    return NextResponse.json({ error: "Mã đơn không hợp lệ" }, { status: 400 });
  }
  const status = typeof body.shipmentStatus === "string" && body.shipmentStatus ? body.shipmentStatus : null;

  if (body.undo === true) await undismissAlert(orderId);
  else await dismissAlert(orderId, status, session.email ?? null);
  return NextResponse.json({ ok: true });
}
