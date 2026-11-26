import { NextResponse } from "next/server";
import { getCurrentAdminSession } from "@/lib/auth";
import { undoUploadHistoryTx } from "@/lib/db";
import { removeOrderRowsByFalcoCodes } from "@/lib/sheets";

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
    // Hoàn tác MySQL trong 1 transaction có khoá dòng (FOR UPDATE):
    // nếu có lỗi DB sẽ rollback và KHÔNG đánh dấu undone_at để cho phép thử lại.
    const result = await undoUploadHistoryTx(historyId);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    const errors: string[] = [];
    // Gỡ các dòng mirror tương ứng khỏi Google Sheet sau khi DB đã hoàn tác thành công.
    if (result.insertedFalcoCodes.length > 0) {
      try {
        await removeOrderRowsByFalcoCodes(result.insertedFalcoCodes);
      } catch (err) {
        errors.push(
          `Gỡ mirror trên Google Sheet thất bại (dữ liệu MySQL đã hoàn tác đúng): ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }

    return NextResponse.json({ ok: true, errors });
  } catch (err) {
    return NextResponse.json(
      { error: `Hoàn tác thất bại (dữ liệu chưa bị đánh dấu hoàn tác, có thể thử lại): ${err instanceof Error ? err.message : String(err)}` },
      { status: 500 }
    );
  }
}
