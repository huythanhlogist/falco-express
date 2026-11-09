import { NextResponse } from "next/server";
import { getCurrentAdminSession } from "@/lib/auth";
import { findKangoBillById, markKangoBillSendFailed, markKangoBillSent } from "@/lib/db";
import { submitKangoBill } from "@/lib/kango-bill-api";

// Agent (n8n) được phép gửi khi có AGENT_API_KEY đúng, nhưng CHỈ với bill do chính agent tạo
// (createdBy = AGENT_CREATED_BY). Bill nhân viên tạo tay vẫn phải do nhân viên đăng nhập duyệt.
const AGENT_CREATED_BY = "agent (API key)";

function isValidAgentKey(request: Request): boolean {
  const key = request.headers.get("x-agent-api-key");
  const expected = process.env.AGENT_API_KEY;
  return Boolean(key && expected && key === expected);
}

// "Duyệt & Gửi Kango" gộp làm 1 bước — nhân viên xem lại thông tin trên
// trang chi tiết bill rồi bấm nút này, KHÔNG có bước tự động nào khác gọi
// tới API tạo shipment thật của Kango (xem submitKangoBill).
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getCurrentAdminSession();
  const isAgent = !session && isValidAgentKey(request);
  if (!session && !isAgent) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const { id } = await params;
  const bill = await findKangoBillById(Number(id));
  if (!bill) return NextResponse.json({ error: "Không tìm thấy bill" }, { status: 404 });
  if (isAgent && bill.created_by !== AGENT_CREATED_BY) {
    return NextResponse.json({ error: "Agent chỉ được gửi bill do agent tạo" }, { status: 403 });
  }
  if (bill.status === "sent") {
    return NextResponse.json({ error: "Bill này đã được gửi lên Kango rồi" }, { status: 409 });
  }

  const result = await submitKangoBill(bill);
  if (!result.ok) {
    await markKangoBillSendFailed(bill.id, result.error);
    return NextResponse.json({ error: result.error }, { status: 502 });
  }

  await markKangoBillSent(bill.id, {
    sentBy: session ? session.email : AGENT_CREATED_BY,
    kangoBillId: result.billId,
    hawbs: result.hawbs,
    redirectUrl: result.redirectUrl,
  });

  return NextResponse.json({ ok: true, billId: result.billId, hawbs: result.hawbs, redirectUrl: result.redirectUrl });
}
