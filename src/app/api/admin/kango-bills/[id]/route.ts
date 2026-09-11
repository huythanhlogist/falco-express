import { NextResponse } from "next/server";
import { getCurrentAdminSession } from "@/lib/auth";
import { deleteKangoBill, findKangoBillById, updateKangoBill, type KangoBillEditableFields } from "@/lib/db";
import { validateKangoInvoices, validateKangoPackages } from "@/lib/kango-bill-validate";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getCurrentAdminSession();
  if (!session) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const { id } = await params;
  const bill = await findKangoBillById(Number(id));
  if (!bill) return NextResponse.json({ error: "Không tìm thấy bill" }, { status: 404 });
  return NextResponse.json({ bill });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getCurrentAdminSession();
  if (!session) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const { id } = await params;
  const body = await request.json();
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
      if (typeof body[key] !== "string" || !body[key].trim()) {
        return NextResponse.json({ error: `Thiếu trường bắt buộc: ${key}` }, { status: 400 });
      }
      (fields as Record<string, unknown>)[key] = body[key].trim();
    }
  }
  if (body.receiverAddress2 !== undefined) {
    fields.receiverAddress2 = typeof body.receiverAddress2 === "string" && body.receiverAddress2.trim() ? body.receiverAddress2.trim() : null;
  }
  if (body.receiverAddress3 !== undefined) {
    fields.receiverAddress3 = typeof body.receiverAddress3 === "string" && body.receiverAddress3.trim() ? body.receiverAddress3.trim() : null;
  }
  if (body.shipmentReferenceCode !== undefined) {
    fields.shipmentReferenceCode =
      typeof body.shipmentReferenceCode === "string" && body.shipmentReferenceCode.trim()
        ? body.shipmentReferenceCode.trim()
        : null;
  }
  if (body.shipmentSignatureFlg !== undefined) fields.shipmentSignatureFlg = Boolean(body.shipmentSignatureFlg);
  if (body.shipmentValue !== undefined) {
    if (!Number.isFinite(Number(body.shipmentValue)) || Number(body.shipmentValue) < 0) {
      return NextResponse.json({ error: "Giá trị kiện hàng không hợp lệ" }, { status: 400 });
    }
    fields.shipmentValue = Number(body.shipmentValue);
  }
  if (body.shipmentExportAs !== undefined) fields.shipmentExportAs = Number(body.shipmentExportAs) || 0;
  if (body.packages !== undefined) {
    const parsed = validateKangoPackages(body.packages);
    if (!parsed) return NextResponse.json({ error: "Thiếu hoặc sai thông tin kiện hàng" }, { status: 400 });
    fields.packages = parsed;
  }
  if (body.invoices !== undefined) {
    const parsed = validateKangoInvoices(body.invoices);
    if (parsed === null) return NextResponse.json({ error: "Thông tin invoice không hợp lệ" }, { status: 400 });
    fields.invoices = parsed;
  }

  const ok = await updateKangoBill(Number(id), fields);
  if (!ok) return NextResponse.json({ error: "Không tìm thấy bill" }, { status: 404 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getCurrentAdminSession();
  if (!session) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const { id } = await params;
  const ok = await deleteKangoBill(Number(id));
  if (!ok) return NextResponse.json({ error: "Không tìm thấy bill" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
