import { NextResponse } from "next/server";
import { getCurrentAdminSession } from "@/lib/auth";
import { ackEvents, isValidNotifyAgentKey } from "@/lib/shipment-notify";

export const dynamic = "force-dynamic";

const MAX_ACK_BATCH = 5000;

/**
 * Đánh dấu các sự kiện thông báo đã được n8n gửi thành công lên Zalo (notified_at = NOW()).
 * Body JSON: `{ eventIds: number[] }` (mảng các số nguyên dương).
 */
export async function POST(request: Request) {
  const session = await getCurrentAdminSession();
  if (!session && !isValidNotifyAgentKey(request)) {
    return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  }

  const body: unknown = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || !Array.isArray((body as { eventIds?: unknown }).eventIds)) {
    return NextResponse.json(
      { error: "Trường eventIds phải là mảng số nguyên dương" },
      { status: 400 }
    );
  }

  const rawIds = (body as { eventIds: unknown[] }).eventIds;
  if (rawIds.length > MAX_ACK_BATCH) {
    return NextResponse.json(
      { error: `Số lượng eventIds vượt quá giới hạn (${MAX_ACK_BATCH})` },
      { status: 400 }
    );
  }

  const eventIds: number[] = [];
  for (const item of rawIds) {
    if (typeof item !== "number" || !Number.isSafeInteger(item) || item <= 0) {
      return NextResponse.json(
        { error: "Mọi phần tử trong eventIds phải là số nguyên dương" },
        { status: 400 }
      );
    }
    eventIds.push(item);
  }

  try {
    const { updated } = await ackEvents(eventIds);
    return NextResponse.json(
      { ok: true, updated },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (err) {
    console.error("[admin/notify/ack] Lỗi xác nhận sự kiện đã gửi:", err);
    return NextResponse.json(
      { error: "Không cập nhật được trạng thái thông báo" },
      { status: 500 }
    );
  }
}
