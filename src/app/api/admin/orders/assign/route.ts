import { NextResponse } from "next/server";
import { getCurrentAdminSession } from "@/lib/auth";
import { findCtvById } from "@/lib/db";
import { assignOrdersToCtv } from "@/lib/ctv-portal";

// POST { orderIds: number[], ctvId: number | null } — gán đơn cho FWD (null = bỏ gán).
export async function POST(request: Request) {
  const session = await getCurrentAdminSession();
  if (!session) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { orderIds?: unknown; ctvId?: unknown } | null;
  if (!Array.isArray(body?.orderIds) || body.orderIds.length === 0) {
    return NextResponse.json({ error: "Chưa chọn đơn nào" }, { status: 400 });
  }

  const rawIds = body.orderIds.map(Number);
  if (rawIds.some((n) => !Number.isInteger(n) || n <= 0)) {
    return NextResponse.json({ error: "Danh sách ID đơn hàng không hợp lệ" }, { status: 400 });
  }
  const orderIds = [...new Set(rawIds)];

  let ctvId: number | null = null;
  if (body?.ctvId !== null && body?.ctvId !== undefined) {
    const parsedCtvId = Number(body.ctvId);
    if (!Number.isInteger(parsedCtvId) || parsedCtvId <= 0) {
      return NextResponse.json({ error: "ID FWD không hợp lệ" }, { status: 400 });
    }
    const ctv = await findCtvById(parsedCtvId);
    if (!ctv || ctv.status !== "active") {
      return NextResponse.json({ error: "FWD không hợp lệ hoặc đã tắt" }, { status: 400 });
    }
    ctvId = parsedCtvId;
  }

  const changed = await assignOrdersToCtv(orderIds, ctvId);
  return NextResponse.json({ ok: true, changed });
}
