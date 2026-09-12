import { NextResponse } from "next/server";
import nodemailer from "nodemailer";

export async function POST(request: Request) {
  let body: {
    name?: string;
    phone?: string;
    email?: string;
    message?: string;
    sourcePage?: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Dữ liệu không hợp lệ" }, { status: 400 });
  }

  const { name, phone, email, message, sourcePage } = body;

  if (!name || !phone || !message) {
    return NextResponse.json(
      { error: "Vui lòng điền đầy đủ họ tên, số điện thoại và nội dung" },
      { status: 400 }
    );
  }

  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, CONTACT_TO_EMAIL } = process.env;

  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    console.log(
      "[contact] SMTP chưa được cấu hình. Nội dung liên hệ:",
      body,
      "| Trang nguồn:",
      sourcePage || "(không rõ)"
    );
    return NextResponse.json({
      ok: true,
      note: "Đã ghi nhận (SMTP chưa cấu hình trên server).",
    });
  }

  try {
    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: Number(SMTP_PORT) || 465,
      secure: Number(SMTP_PORT) !== 587,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });

    await transporter.sendMail({
      from: `"Website Falco Express" <${SMTP_USER}>`,
      to: CONTACT_TO_EMAIL || SMTP_USER,
      replyTo: email || undefined,
      subject: `Liên hệ mới từ website${sourcePage ? ` (${sourcePage})` : ""} – ${name}`,
      text: `Họ tên: ${name}\nSĐT: ${phone}\nEmail: ${email || "(không có)"}\nTrang nguồn: ${sourcePage || "(không rõ)"}\n\nNội dung:\n${message}`,
      html: `
        <p><strong>Họ tên:</strong> ${escapeHtml(name)}</p>
        <p><strong>SĐT:</strong> ${escapeHtml(phone)}</p>
        <p><strong>Email:</strong> ${escapeHtml(email || "(không có)")}</p>
        <p><strong>Trang nguồn:</strong> ${escapeHtml(sourcePage || "(không rõ)")}</p>
        <p><strong>Nội dung:</strong></p>
        <p>${escapeHtml(message).replace(/\n/g, "<br/>")}</p>
      `,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[contact] Gửi email thất bại:", err);
    return NextResponse.json(
      { error: "Không thể gửi email lúc này, vui lòng thử lại sau." },
      { status: 500 }
    );
  }
}

function escapeHtml(input: string) {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
