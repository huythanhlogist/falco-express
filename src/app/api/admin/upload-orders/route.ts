import { NextResponse } from "next/server";
import { getCurrentAdminSession } from "@/lib/auth";
import { processKangoWorkbook } from "@/lib/kango-import";
import { insertUploadHistory } from "@/lib/db";

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10MB — file Kango vài trăm dòng, đủ dư.

export async function POST(request: Request) {
  const session = await getCurrentAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  }

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Vui lòng chọn file Excel để tải lên" }, { status: 400 });
  }
  if (!/\.xlsx?$/i.test(file.name)) {
    return NextResponse.json(
      { error: "Chỉ nhận file Excel (.xlsx/.xls) đúng định dạng Kango xuất ra" },
      { status: 400 }
    );
  }
  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json(
      { error: "File quá lớn (giới hạn 10MB) — kiểm tra lại file gửi lên" },
      { status: 400 }
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  try {
    const result = await processKangoWorkbook(buffer);
    // Chỉ lưu lại kết quả xử lý để hiện lịch sử — không lưu nội dung file,
    // tránh phình dung lượng DB vì file này upload đều đặn 2 ngày/lần.
    await insertUploadHistory({
      fileName: file.name,
      uploadedBy: session.email,
      totalBills: result.totalBills,
      inserted: result.inserted,
      updated: result.updated,
      unchanged: result.unchanged,
      errors: result.errors,
      snapshot: result.snapshot,
    });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: `Lỗi khi xử lý file: ${err instanceof Error ? err.message : String(err)}` },
      { status: 500 }
    );
  }
}
