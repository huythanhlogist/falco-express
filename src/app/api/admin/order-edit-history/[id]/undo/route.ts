import { NextResponse } from "next/server";
import { getCurrentAdminSession } from "@/lib/auth";
import { findOrderById, undoOrderEditHistoryTx } from "@/lib/db";
import { syncAccountingRow } from "@/lib/accounting-sync";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getCurrentAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  }

  const { id } = await params;
  const historyId = Number(id);
  if (!Number.isInteger(historyId) || historyId <= 0) {
    return NextResponse.json({ error: "ID không hợp lệ" }, { status: 400 });
  }

  try {
    const result = await undoOrderEditHistoryTx(historyId);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    try {
      const restored = await findOrderById(result.restoredOrderId);
      if (restored) {
        await syncAccountingRow(restored);
      }
    } catch {
      // Không chặn hoàn tác vì lỗi đồng bộ Sheet — DB đã đúng là quan trọng nhất.
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: `Hoàn tác thất bại: ${err instanceof Error ? err.message : String(err)}` },
      { status: 500 }
    );
  }
}
