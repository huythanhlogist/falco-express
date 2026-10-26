import { NextResponse } from "next/server";
import { getCurrentAdminSession } from "@/lib/auth";
import { findCtvById } from "@/lib/db";
import { assignOrdersToCtv } from "@/lib/ctv-portal";

// POST { orderIds: number[], ctvId: number | null } — gán đơn cho FWD (null = bỏ gán).
export async function POST(request: Request) {
  const session = await getCurrentAdminSession();
  if (!session) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { orderIds?: unknown; ctvId?: unknown } | null;
  const orderIds = Array.isArray(body?.orderIds) ? body.orderIds.map(Number) : [];
  if (!orderIds.length) return NextResponse.json({ error: "Chưa chọn đơn nào" }, { status: 400 });

  let ctvId: number | null = null;
  if (body?.ctvId !== null && body?.ctvId !== undefined) {
    ctvId = Number(body.ctvId);
    const ctv = await findCtvById(ctvId);
    if (!ctv || ctv.status !== "active") return NextResponse.json({ error: "FWD không hợp lệ hoặc đã tắt" }, { status: 400 });
  }
  const changed = await assignOrdersToCtv(orderIds, ctvId);
  return NextResponse.json({ ok: true, changed });
}
