import { NextResponse } from "next/server";
import { getCurrentAdminSession } from "@/lib/auth";
import { findKangoBillById, type KangoBillEditableFields } from "@/lib/db";
import {
  AGENT_CREATED_BY,
  deleteKangoBillIfDraft,
  isValidAgentKey,
  updateKangoBillIfEditable,
} from "@/lib/kango-bill-db";
import {
  parsePositiveId,
  validateCustomerNote,
  validateKangoInvoices,
  validateKangoPackages,
  validateShipmentExportAs,
  validateShipmentValue,
} from "@/lib/kango-bill-validate";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getCurrentAdminSession();
  if (!session) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const { id } = await params;
  const billId = parsePositiveId(id);
  if (!billId) return NextResponse.json({ error: "ID bill không hợp lệ" }, { status: 400 });

  const bill = await findKangoBillById(billId);
  if (!bill) return NextResponse.json({ error: "Không tìm thấy bill" }, { status: 404 });
  return NextResponse.json({ bill });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getCurrentAdminSession();
  const isAgent = !session && isValidAgentKey(request);
  if (!session && !isAgent) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const { id } = await params;
  const billId = parsePositiveId(id);
  if (!billId) return NextResponse.json({ error: "ID bill không hợp lệ" }, { status: 400 });

  const rawBody = await request.json().catch(() => null);
  if (!rawBody || typeof rawBody !== "object") {
    return NextResponse.json({ error: "Body JSON không hợp lệ" }, { status: 400 });
  }
  const body = rawBody as Record<string, unknown>;

  const existing = await findKangoBillById(billId);
  if (!existing) return NextResponse.json({ error: "Không tìm thấy bill" }, { status: 404 });
  if (isAgent && existing.created_by !== AGENT_CREATED_BY) {
    return NextResponse.json({ error: "Agent chỉ được sửa bill do agent tạo" }, { status: 403 });
  }
  if ((existing.status as string) !== "draft") {
    return NextResponse.json(
      { error: "Bill đã gửi hoặc đang gửi lên Kango, không thể sửa" },
      { status: 409 }
    );
  }

  const fields: KangoBillEditableFields = {};

  const stringFields: (keyof KangoBillEditableFields)[] = [
    "receiverCompanyName",
    "receiverContactName",
    "receiverTelephone",
    "receiverCountry",
    "receiverStateName",
    "receiverCity",
    "receiverPostalCode",
    "receiverAddress1",
    "shipmentService",
    "shipmentBranch",
    "shipmentGoodsName",
  ];
  for (const key of stringFields) {
    if (body[key] !== undefined) {
      const val = body[key];
      if (typeof val !== "string" || !val.trim()) {
        return NextResponse.json({ error: `Thiếu trường bắt buộc: ${key}` }, { status: 400 });
      }
      (fields as Record<string, unknown>)[key] = val.trim();
    }
  }
  if (body.receiverAddress2 !== undefined) {
    fields.receiverAddress2 =
      typeof body.receiverAddress2 === "string" && body.receiverAddress2.trim()
        ? body.receiverAddress2.trim()
        : null;
  }
  if (body.receiverAddress3 !== undefined) {
    fields.receiverAddress3 =
      typeof body.receiverAddress3 === "string" && body.receiverAddress3.trim()
        ? body.receiverAddress3.trim()
        : null;
  }
  if (body.shipmentReferenceCode !== undefined) {
    fields.shipmentReferenceCode =
      typeof body.shipmentReferenceCode === "string" && body.shipmentReferenceCode.trim()
        ? body.shipmentReferenceCode.trim()
        : null;
  }
  if (body.shipmentSignatureFlg !== undefined) fields.shipmentSignatureFlg = Boolean(body.shipmentSignatureFlg);
  if (body.shipmentValue !== undefined) {
    const parsedValue = validateShipmentValue(body.shipmentValue);
    if (parsedValue === null) {
      return NextResponse.json({ error: "Giá trị kiện hàng (USD) phải lớn hơn 0" }, { status: 400 });
    }
    fields.shipmentValue = parsedValue;
  }
  if (body.shipmentExportAs !== undefined) {
    const parsedExportAs = validateShipmentExportAs(body.shipmentExportAs);
    if (parsedExportAs === null) {
      return NextResponse.json({ error: "Lý do gửi hàng không hợp lệ" }, { status: 400 });
    }
    fields.shipmentExportAs = parsedExportAs;
  }
  if (body.packages !== undefined) {
    const parsed = validateKangoPackages(body.packages);
    if (!parsed) {
      return NextResponse.json(
        { error: "Thiếu hoặc sai thông tin kiện hàng (SL nguyên ≥ 1, kích thước & cân nặng > 0)" },
        { status: 400 }
      );
    }
    fields.packages = parsed;
  }
  if (body.invoices !== undefined) {
    const parsed = validateKangoInvoices(body.invoices);
    if (parsed === null) return NextResponse.json({ error: "Thông tin invoice không hợp lệ" }, { status: 400 });
    fields.invoices = parsed;
  }
  if (body.customerNote !== undefined) {
    const parsed = validateCustomerNote(body.customerNote);
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
    fields.customerNote = parsed.value;
  }

  if (Object.keys(fields).length === 0) {
    return NextResponse.json({ error: "Không có dữ liệu nào để cập nhật" }, { status: 400 });
  }

  const outcome = await updateKangoBillIfEditable(billId, fields);
  if (outcome === "not_found") return NextResponse.json({ error: "Không tìm thấy bill" }, { status: 404 });
  if (outcome === "locked") {
    return NextResponse.json(
      { error: "Bill đã gửi hoặc đang gửi lên Kango, không thể sửa" },
      { status: 409 }
    );
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getCurrentAdminSession();
  if (!session) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const { id } = await params;
  const billId = parsePositiveId(id);
  if (!billId) return NextResponse.json({ error: "ID bill không hợp lệ" }, { status: 400 });

  const outcome = await deleteKangoBillIfDraft(billId);
  if (outcome === "not_found") return NextResponse.json({ error: "Không tìm thấy bill" }, { status: 404 });
  if (outcome === "locked") {
    return NextResponse.json(
      { error: "Không thể xoá bill đã gửi hoặc đang gửi lên Kango" },
      { status: 409 }
    );
  }
  return NextResponse.json({ ok: true });
}
