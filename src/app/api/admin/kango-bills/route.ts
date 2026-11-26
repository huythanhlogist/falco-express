import { NextResponse } from "next/server";
import { getCurrentAdminSession } from "@/lib/auth";
import { insertKangoBill, listKangoBills } from "@/lib/db";
import { AGENT_CREATED_BY, isValidAgentKey } from "@/lib/kango-bill-db";
import {
  validateCustomerNote,
  validateKangoInvoices,
  validateKangoPackages,
  validateShipmentExportAs,
  validateShipmentValue,
} from "@/lib/kango-bill-validate";

export async function GET() {
  const bills = await listKangoBills();
  return NextResponse.json({ bills });
}

export async function POST(request: Request) {
  const session = await getCurrentAdminSession();
  const isAgent = !session && isValidAgentKey(request);
  if (!session && !isAgent) {
    return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Body JSON không hợp lệ" }, { status: 400 });
  }

  const {
    receiverCompanyName,
    receiverContactName,
    receiverTelephone,
    receiverCountry,
    receiverStateName,
    receiverCity,
    receiverPostalCode,
    receiverAddress1,
    receiverAddress2,
    receiverAddress3,
    shipmentService,
    shipmentSignatureFlg,
    shipmentBranch,
    shipmentReferenceCode,
    shipmentGoodsName,
    shipmentValue,
    shipmentExportAs,
    packages,
    invoices,
    customerNote,
  } = body as Record<string, unknown>;

  const requiredStrings: Record<string, unknown> = {
    receiverCompanyName,
    receiverContactName,
    receiverTelephone,
    receiverCountry,
    receiverStateName,
    receiverCity,
    receiverPostalCode,
    receiverAddress1,
    shipmentService,
    shipmentBranch,
    shipmentGoodsName,
  };
  for (const [key, value] of Object.entries(requiredStrings)) {
    if (typeof value !== "string" || !value.trim()) {
      return NextResponse.json({ error: `Thiếu trường bắt buộc: ${key}` }, { status: 400 });
    }
  }

  const parsedValue = validateShipmentValue(shipmentValue);
  if (parsedValue === null) {
    return NextResponse.json({ error: "Giá trị kiện hàng (USD) phải lớn hơn 0" }, { status: 400 });
  }

  const parsedExportAs =
    shipmentExportAs === undefined || shipmentExportAs === null || shipmentExportAs === ""
      ? 0
      : validateShipmentExportAs(shipmentExportAs);
  if (parsedExportAs === null) {
    return NextResponse.json({ error: "Lý do gửi hàng không hợp lệ" }, { status: 400 });
  }

  const parsedPackages = validateKangoPackages(packages);
  if (!parsedPackages) {
    return NextResponse.json(
      { error: "Thiếu hoặc sai thông tin kiện hàng (SL nguyên ≥ 1, kích thước & cân nặng > 0)" },
      { status: 400 }
    );
  }
  const parsedInvoices = validateKangoInvoices(invoices);
  if (parsedInvoices === null) {
    return NextResponse.json({ error: "Thông tin invoice không hợp lệ" }, { status: 400 });
  }
  const parsedCustomerNote = validateCustomerNote(customerNote);
  if (!parsedCustomerNote.ok) {
    return NextResponse.json({ error: parsedCustomerNote.error }, { status: 400 });
  }

  const id = await insertKangoBill({
    receiverCompanyName: (receiverCompanyName as string).trim(),
    receiverContactName: (receiverContactName as string).trim(),
    receiverTelephone: (receiverTelephone as string).trim(),
    receiverCountry: (receiverCountry as string).trim(),
    receiverStateName: (receiverStateName as string).trim(),
    receiverCity: (receiverCity as string).trim(),
    receiverPostalCode: (receiverPostalCode as string).trim(),
    receiverAddress1: (receiverAddress1 as string).trim(),
    receiverAddress2: typeof receiverAddress2 === "string" && receiverAddress2.trim() ? receiverAddress2.trim() : null,
    receiverAddress3: typeof receiverAddress3 === "string" && receiverAddress3.trim() ? receiverAddress3.trim() : null,
    shipmentService: (shipmentService as string).trim(),
    shipmentSignatureFlg: Boolean(shipmentSignatureFlg),
    shipmentBranch: (shipmentBranch as string).trim(),
    shipmentReferenceCode:
      typeof shipmentReferenceCode === "string" && shipmentReferenceCode.trim() ? shipmentReferenceCode.trim() : null,
    shipmentGoodsName: (shipmentGoodsName as string).trim(),
    shipmentValue: parsedValue,
    shipmentExportAs: parsedExportAs,
    packages: parsedPackages,
    invoices: parsedInvoices,
    customerNote: parsedCustomerNote.value,
    createdBy: session ? session.email : AGENT_CREATED_BY,
  });

  return NextResponse.json({ ok: true, id });
}
