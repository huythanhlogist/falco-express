import { NextResponse } from "next/server";
import { getCurrentAdminSession } from "@/lib/auth";
import { insertOrderWithGeneratedFalcoCode } from "@/lib/db";
import { isValidIsoDate } from "@/lib/vn-date";

function parseOptionalNonNegativeNumber(
  value: unknown
): { ok: true; value: number | null } | { ok: false } {
  if (value === undefined || value === null || value === "") return { ok: true, value: null };
  if (typeof value === "boolean") return { ok: false };
  if (typeof value === "string" && value.trim() === "") return { ok: true, value: null };
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return { ok: false };
  return { ok: true, value: n };
}

export async function POST(request: Request) {
  const session = await getCurrentAdminSession();
  if (!session) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

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

  const { recipientName, recipientPhone, service, destination, receivedDate, weightKg, amount } = body;

  if (!recipientName || typeof recipientName !== "string" || !recipientName.trim()) {
    return NextResponse.json({ error: "Vui lòng nhập tên người nhận" }, { status: 400 });
  }
  if (!recipientPhone || typeof recipientPhone !== "string" || !recipientPhone.trim()) {
    return NextResponse.json({ error: "Vui lòng nhập số điện thoại người nhận" }, { status: 400 });
  }
  if (!destination || typeof destination !== "string" || !destination.trim()) {
    return NextResponse.json({ error: "Vui lòng nhập điểm đến" }, { status: 400 });
  }

  let parsedDate: string | null = null;
  if (receivedDate !== undefined && receivedDate !== null && receivedDate !== "") {
    if (typeof receivedDate !== "string" || !isValidIsoDate(receivedDate)) {
      return NextResponse.json({ error: "Ngày nhận không hợp lệ" }, { status: 400 });
    }
    parsedDate = receivedDate;
  }

  const parsedWeight = parseOptionalNonNegativeNumber(weightKg);
  if (!parsedWeight.ok) {
    return NextResponse.json({ error: "Cân nặng phải là số không âm hợp lệ" }, { status: 400 });
  }

  const parsedAmount = parseOptionalNonNegativeNumber(amount);
  if (!parsedAmount.ok) {
    return NextResponse.json({ error: "Số tiền thu phải là số không âm hợp lệ" }, { status: 400 });
  }

  const { id, falcoCode } = await insertOrderWithGeneratedFalcoCode({
    recipientName: recipientName.trim(),
    recipientPhone: recipientPhone.trim(),
    service: typeof service === "string" ? service.trim() : "",
    destination: destination.trim(),
    receivedDate: parsedDate,
    weightKg: parsedWeight.value,
    amount: parsedAmount.value,
    source: "staff",
    ctvId: null,
    reviewStatus: "auto_approved",
  });

  return NextResponse.json({ ok: true, id, falcoCode });
}
