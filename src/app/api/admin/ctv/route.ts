import { NextResponse } from "next/server";
import { getCurrentAdminSession, hashPassword } from "@/lib/auth";
import { findCtvByEmail, insertCtvUser, listCtvUsers } from "@/lib/db";

export async function GET() {
  const ctvs = await listCtvUsers();
  return NextResponse.json({ ctvs });
}

// Mọi nhân viên admin (owner lẫn staff) đều tạo được tài khoản CTV — không
// giới hạn riêng cho owner như tài khoản nhân viên.
export async function POST(request: Request) {
  const session = await getCurrentAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  }

  const { email, password, fullName, phone, cccdNumber, referredByCtvId, commissionPct, referralOverridePct } =
    await request.json();

  if (!email || typeof email !== "string" || !email.includes("@")) {
    return NextResponse.json({ error: "Email không hợp lệ" }, { status: 400 });
  }
  if (!password || typeof password !== "string" || password.length < 8) {
    return NextResponse.json({ error: "Mật khẩu phải có ít nhất 8 ký tự" }, { status: 400 });
  }
  if (!fullName || typeof fullName !== "string" || !fullName.trim()) {
    return NextResponse.json({ error: "Vui lòng nhập tên CTV" }, { status: 400 });
  }
  if (!phone || typeof phone !== "string" || !phone.trim()) {
    return NextResponse.json({ error: "Vui lòng nhập số điện thoại" }, { status: 400 });
  }
  if (!cccdNumber || typeof cccdNumber !== "string" || !cccdNumber.trim()) {
    return NextResponse.json({ error: "Vui lòng nhập số CCCD" }, { status: 400 });
  }

  const existing = await findCtvByEmail(email);
  if (existing) {
    return NextResponse.json({ error: "Email này đã có tài khoản CTV" }, { status: 409 });
  }

  const passwordHash = await hashPassword(password);
  const { id, ctvCode } = await insertCtvUser({
    email,
    passwordHash,
    fullName,
    phone,
    cccdNumber,
    referredByCtvId: Number.isFinite(referredByCtvId) ? Number(referredByCtvId) : null,
    commissionPct: Number.isFinite(commissionPct) ? Number(commissionPct) : 5,
    referralOverridePct: Number.isFinite(referralOverridePct) ? Number(referralOverridePct) : 5,
    createdBy: session.email,
  });

  return NextResponse.json({ ok: true, id, ctvCode });
}
