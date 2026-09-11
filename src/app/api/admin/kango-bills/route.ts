import { NextResponse } from "next/server";
import { getCurrentAdminSession } from "@/lib/auth";
import { insertKangoBill, listKangoBills } from "@/lib/db";
import { validateKangoInvoices, validateKangoPackages } from "@/lib/kango-bill-validate";

export async function GET() {
  const bills = await listKangoBills();
  return NextResponse.json({ bills });
}

function isValidAgentKey(request: Request): boolean {
  const key = request.headers.get("x-agent-api-key");
  const expected = process.env.AGENT_API_KEY;
  return Boolean(key && expected && key === expected);
}

export async function POST(request: Request) {
  const session = await getCurrentAdminSession();
  const isAgent = !session && isValidAgentKey(request);
  if (!session && !isAgent) {
    return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  }

  const body = await request.json();
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
  } = body ?? {};

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
  if (!Number.isFinite(Number(shipmentValue)) || Number(shipmentValue) < 0) {
    return NextResponse.json({ error: "Giá trị kiện hàng không hợp lệ" }, { status: 400 });
  }

  const parsedPackages = validateKangoPackages(packages);
  if (!parsedPackages) {
    return NextResponse.json({ error: "Thiếu hoặc sai thông tin kiện hàng" }, { status: 400 });
  }
  const parsedInvoices = validateKangoInvoices(invoices);
  if (parsedInvoices === null) {
    return NextResponse.json({ error: "Thông tin invoice không hợp lệ" }, { status: 400 });
  }

  const id = await insertKangoBill({
    receiverCompanyName: receiverCompanyName.trim(),
    receiverContactName: receiverContactName.trim(),
    receiverTelephone: receiverTelephone.trim(),
    receiverCountry: receiverCountry.trim(),
    receiverStateName: receiverStateName.trim(),
    receiverCity: receiverCity.trim(),
    receiverPostalCode: receiverPostalCode.trim(),
    receiverAddress1: receiverAddress1.trim(),
    receiverAddress2: typeof receiverAddress2 === "string" && receiverAddress2.trim() ? receiverAddress2.trim() : null,
    receiverAddress3: typeof receiverAddress3 === "string" && receiverAddress3.trim() ? receiverAddress3.trim() : null,
    shipmentService: shipmentService.trim(),
    shipmentSignatureFlg: Boolean(shipmentSignatureFlg),
    shipmentBranch: shipmentBranch.trim(),
    shipmentReferenceCode:
      typeof shipmentReferenceCode === "string" && shipmentReferenceCode.trim() ? shipmentReferenceCode.trim() : null,
    shipmentGoodsName: shipmentGoodsName.trim(),
    shipmentValue: Number(shipmentValue),
    shipmentExportAs: Number.isFinite(Number(shipmentExportAs)) ? Number(shipmentExportAs) : 0,
    packages: parsedPackages,
    invoices: parsedInvoices,
    createdBy: session ? session.email : "agent (API key)",
  });

  return NextResponse.json({ ok: true, id });
}
