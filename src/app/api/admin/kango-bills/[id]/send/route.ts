import { NextResponse } from "next/server";
import { getCurrentAdminSession } from "@/lib/auth";
import { findKangoBillById } from "@/lib/db";
import { submitKangoBill } from "@/lib/kango-bill-api";
import {
  acquireKangoBillSendLock,
  AGENT_CREATED_BY,
  isValidAgentKey,
  releaseKangoBillSendLock,
  saveKangoBillSentWithRetry,
} from "@/lib/kango-bill-db";
import { parsePositiveId } from "@/lib/kango-bill-validate";
import { notifyN8nKangoBillSent } from "@/lib/n8n-webhook";

// "Duyệt & Gửi Kango" gộp làm 1 bước — nhân viên xem lại thông tin trên
// trang chi tiết bill rồi bấm nút này, KHÔNG có bước tự động nào khác gọi
// tới API tạo shipment thật của Kango (xem submitKangoBill).
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getCurrentAdminSession();
  const isAgent = !session && isValidAgentKey(request);
  if (!session && !isAgent) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const { id } = await params;
  const billId = parsePositiveId(id);
  if (!billId) return NextResponse.json({ error: "ID bill không hợp lệ" }, { status: 400 });

  const bill = await findKangoBillById(billId);
  if (!bill) return NextResponse.json({ error: "Không tìm thấy bill" }, { status: 404 });
  if (isAgent && bill.created_by !== AGENT_CREATED_BY) {
    return NextResponse.json({ error: "Agent chỉ được gửi bill do agent tạo" }, { status: 403 });
  }

  const currentStatus = bill.status as string;
  if (currentStatus === "sent") {
    return NextResponse.json({ error: "Bill này đã được gửi lên Kango rồi" }, { status: 409 });
  }
  if (currentStatus === "sending") {
    return NextResponse.json(
      { error: "Bill này đang được gửi lên Kango, vui lòng chờ và tải lại trang" },
      { status: 409 }
    );
  }

  // Khoá nguyên tử: chỉ request chuyển được draft -> sending (affectedRows === 1) mới gọi Kango.
  const locked = await acquireKangoBillSendLock(bill.id);
  if (!locked) {
    const latest = await findKangoBillById(bill.id).catch(() => null);
    const latestStatus = (latest?.status as string) ?? "";
    const msg =
      latestStatus === "sent"
        ? "Bill này đã được gửi lên Kango rồi"
        : "Bill này đang được gửi lên Kango bởi một yêu cầu khác, vui lòng tải lại trang";
    return NextResponse.json({ error: msg }, { status: 409 });
  }

  let result: Awaited<ReturnType<typeof submitKangoBill>>;
  try {
    result = await submitKangoBill(bill);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Lỗi không xác định khi gọi Kango";
    await releaseKangoBillSendLock(bill.id, "draft", errorMsg).catch((e) =>
      console.error(`[kango-bills/send] Không thể trả trạng thái draft cho bill #${bill.id}:`, e)
    );
    return NextResponse.json({ error: errorMsg }, { status: 502 });
  }

  if (!result.ok) {
    await releaseKangoBillSendLock(bill.id, "draft", result.error).catch((e) =>
      console.error(`[kango-bills/send] Không thể trả trạng thái draft cho bill #${bill.id}:`, e)
    );
    return NextResponse.json({ error: result.error }, { status: 502 });
  }

  const sentBy = session ? session.email : AGENT_CREATED_BY;
  const saveOutcome = await saveKangoBillSentWithRetry(bill.id, {
    sentBy,
    kangoBillId: result.billId,
    hawbs: result.hawbs,
    redirectUrl: result.redirectUrl,
  });

  if (!saveOutcome.saved) {
    // Giữ trạng thái 'sending' (KHÔNG trả về 'draft') để tránh nhân viên bấm gửi lại tạo đơn trùng trên Kango.
    return NextResponse.json(
      {
        error: `Kango đã tạo vận đơn ${result.billId} nhưng không lưu được vào DB (${saveOutcome.error}). KHÔNG gửi lại — vui lòng báo kỹ thuật cập nhật mã ${result.billId}.`,
        kangoBillId: result.billId,
        hawbs: result.hawbs,
        redirectUrl: result.redirectUrl,
      },
      { status: 500 }
    );
  }

  await notifyN8nKangoBillSent({
    billId: bill.id,
    kangoBillId: result.billId,
    hawbs: result.hawbs,
    receiverName: bill.receiver_contact_name,
    sentBy,
  });

  return NextResponse.json({
    ok: true,
    billId: result.billId,
    hawbs: result.hawbs,
    redirectUrl: result.redirectUrl,
  });
}
