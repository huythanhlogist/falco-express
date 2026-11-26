import { NextResponse } from "next/server";
import {
  deleteOrderWithHistoryTx,
  findOrderById,
  listOrderParcels,
  updateOrderWithHistoryTx,
  type OrderEditableFields,
  type PaymentStatus,
} from "@/lib/db";
import { syncAccountingRow } from "@/lib/accounting-sync";
import { getCurrentAdminSession } from "@/lib/auth";
import { isValidIsoDate } from "@/lib/vn-date";

const VALID_STATUSES: PaymentStatus[] = ["unpaid", "collected_by_staff", "collected_by_ctv", "paid"];

function parsePositiveId(raw: string): number | null {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function parseOptionalNonNegativeNumber(
  value: unknown
): { ok: true; value: number | null } | { ok: false } {
  if (value === null || value === "") return { ok: true, value: null };
  if (typeof value === "boolean") return { ok: false };
  if (typeof value === "string" && value.trim() === "") return { ok: true, value: null };
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return { ok: false };
  return { ok: true, value: n };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const orderId = parsePositiveId(id);
  if (orderId === null) {
    return NextResponse.json({ error: "ID không hợp lệ" }, { status: 400 });
  }

  const order = await findOrderById(orderId);
  if (!order) {
    return NextResponse.json({ error: "Không tìm thấy đơn hàng" }, { status: 404 });
  }

  const parcels = await listOrderParcels(orderId);
  return NextResponse.json({ order, parcels });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const orderId = parsePositiveId(id);
  if (orderId === null) {
    return NextResponse.json({ error: "ID không hợp lệ" }, { status: 400 });
  }

  let body: Record<string, unknown>;
  try {
    const parsed = await request.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return NextResponse.json({ error: "Dữ liệu không hợp lệ" }, { status: 400 });
    }
    body = parsed as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Dữ liệu JSON không hợp lệ" }, { status: 400 });
  }

  const {
    paymentStatus,
    amount,
    cost,
    weightKg,
    awb,
    recipientName,
    recipientPhone,
    recipientPostcode,
    service,
    destination,
    receivedDate,
    collectedDate,
    trackingCodes,
  } = body;

  if (paymentStatus !== undefined && !VALID_STATUSES.includes(paymentStatus as PaymentStatus)) {
    return NextResponse.json(
      { error: "Trạng thái thu tiền không hợp lệ" },
      { status: 400 }
    );
  }

  if (receivedDate !== undefined && receivedDate !== null && receivedDate !== "") {
    if (typeof receivedDate !== "string" || !isValidIsoDate(receivedDate)) {
      return NextResponse.json({ error: "Ngày nhận không hợp lệ" }, { status: 400 });
    }
  }

  if (collectedDate !== undefined && collectedDate !== null && collectedDate !== "") {
    if (typeof collectedDate !== "string" || !isValidIsoDate(collectedDate)) {
      return NextResponse.json({ error: "Ngày thu không hợp lệ" }, { status: 400 });
    }
  }

  if (trackingCodes !== undefined && !Array.isArray(trackingCodes)) {
    return NextResponse.json({ error: "Danh sách mã tracking không hợp lệ" }, { status: 400 });
  }

  const fields: OrderEditableFields = {};
  if (paymentStatus !== undefined) fields.paymentStatus = paymentStatus as PaymentStatus;

  if (amount !== undefined) {
    const parsed = parseOptionalNonNegativeNumber(amount);
    if (!parsed.ok) {
      return NextResponse.json({ error: "Số tiền thu phải là số không âm hợp lệ" }, { status: 400 });
    }
    fields.amount = parsed.value;
  }

  if (cost !== undefined) {
    const parsed = parseOptionalNonNegativeNumber(cost);
    if (!parsed.ok) {
      return NextResponse.json({ error: "Chi phí phải là số không âm hợp lệ" }, { status: 400 });
    }
    fields.cost = parsed.value;
    // Sửa CHI bằng tay (ở đây hoặc Kế toán) nghĩa là giá trị không còn hoàn
    // toàn đến từ 1 hoá đơn DBN đã upload nữa — bỏ tag nguồn để lần upload
    // DBN sau không hiểu nhầm là "đã khớp hoá đơn X", tránh bị ghi đè âm
    // thầm giá trị người dùng vừa tự sửa.
    fields.chiSourceInvoice = null;
  }

  if (weightKg !== undefined) {
    const parsed = parseOptionalNonNegativeNumber(weightKg);
    if (!parsed.ok) {
      return NextResponse.json({ error: "Cân nặng phải là số không âm hợp lệ" }, { status: 400 });
    }
    fields.weightKg = parsed.value;
  }

  if (awb !== undefined) {
    const trimmedAwb = String(awb).trim();
    if (!trimmedAwb) {
      return NextResponse.json({ error: "AWB không được để trống" }, { status: 400 });
    }
    fields.awb = trimmedAwb;
  }

  if (recipientName !== undefined) fields.recipientName = String(recipientName).trim();
  if (recipientPhone !== undefined) fields.recipientPhone = String(recipientPhone).trim();
  if (recipientPostcode !== undefined) fields.recipientPostcode = String(recipientPostcode).trim() || null;
  if (service !== undefined) fields.service = String(service).trim();
  if (destination !== undefined) fields.destination = String(destination).trim();
  if (receivedDate !== undefined) {
    fields.receivedDate = typeof receivedDate === "string" && receivedDate ? receivedDate : null;
  }
  if (collectedDate !== undefined) {
    fields.collectedDate = typeof collectedDate === "string" && collectedDate ? collectedDate : null;
  }

  const session = await getCurrentAdminSession();
  const { found } = await updateOrderWithHistoryTx({
    orderId,
    fields,
    trackingCodes: Array.isArray(trackingCodes) ? trackingCodes.map(String) : undefined,
    changedBy: session?.email ?? "unknown",
  });

  if (!found) {
    return NextResponse.json({ error: "Không tìm thấy đơn hàng" }, { status: 404 });
  }

  // Đồng bộ NGAY (await trong cùng request, không phải job nền) sang tab
  // "Kế toán" trên Google Sheet mỗi khi Thu/Chi/trạng thái thu đổi — để
  // Sheet luôn khớp dữ liệu với DB, không có độ trễ.
  let sheetSyncError: string | undefined;
  if (
    fields.amount !== undefined ||
    fields.cost !== undefined ||
    fields.paymentStatus !== undefined ||
    fields.collectedDate !== undefined
  ) {
    const fresh = await findOrderById(orderId);
    if (fresh) {
      try {
        await syncAccountingRow(fresh);
      } catch (err) {
        // Sheet chỉ là bản mirror để xem — DB vẫn là nguồn thật đã lưu
        // đúng, không chặn phản hồi thành công vì lỗi đồng bộ Sheet.
        sheetSyncError = err instanceof Error ? err.message : String(err);
      }
    }
  }

  return NextResponse.json({ ok: true, ...(sheetSyncError ? { sheetSyncError } : {}) });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const orderId = parsePositiveId(id);
  if (orderId === null) {
    return NextResponse.json({ error: "ID không hợp lệ" }, { status: 400 });
  }

  const session = await getCurrentAdminSession();
  const ok = await deleteOrderWithHistoryTx({
    orderId,
    changedBy: session?.email ?? "unknown",
  });
  if (!ok) {
    return NextResponse.json({ error: "Không tìm thấy đơn hàng" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
