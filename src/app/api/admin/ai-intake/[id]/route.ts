import { NextResponse } from "next/server";
import { getCurrentAdminSession } from "@/lib/auth";
import { deleteAiIntakeOrder, markAiIntakeOrderProcessed } from "@/lib/db";

function isValidAgentKey(request: Request): boolean {
  const key = request.headers.get("x-agent-api-key");
  const expected = process.env.AGENT_API_KEY;
  return Boolean(key && expected && key === expected);
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getCurrentAdminSession();
  if (!session) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const { id } = await params;
  const ok = await deleteAiIntakeOrder(Number(id));
  if (!ok) return NextResponse.json({ error: "Không tìm thấy đơn" }, { status: 404 });
  return NextResponse.json({ ok: true });
}

// Đánh dấu 1 đơn "AI nhập đơn" là đã xử lý (agent đã tạo bill nháp từ đơn
// này) — KHÔNG xoá dữ liệu, chỉ đổi status để giữ lại lịch sử. Cho phép cả
// session admin lẫn agent key gọi (agent tự đánh dấu sau khi tạo bill xong).
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getCurrentAdminSession();
  if (!session && !isValidAgentKey(request)) {
    return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  }

  const { id } = await params;
  await markAiIntakeOrderProcessed(Number(id));
  return NextResponse.json({ ok: true });
}
