import { NextResponse } from "next/server";
import { getCurrentAdminSession } from "@/lib/auth";
import { parseKangoPriceWorkbook } from "@/lib/price-quote-import";
import { replaceAllPriceQuoteCategories } from "@/lib/db";

const MAX_FILE_BYTES = 10 * 1024 * 1024;

export async function POST(request: Request) {
  const session = await getCurrentAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  }

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Vui lòng chọn file Excel bảng giá Kango để tải lên" }, { status: 400 });
  }
  if (!/\.xlsx?$/i.test(file.name)) {
    return NextResponse.json({ error: "Chỉ nhận file Excel (.xlsx/.xls)" }, { status: 400 });
  }
  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: "File quá lớn (giới hạn 10MB)" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const result = parseKangoPriceWorkbook(buffer);

  if (result.errors.length > 0) {
    return NextResponse.json({ error: "File không đúng định dạng — chưa cập nhật gì cả:", errors: result.errors }, { status: 400 });
  }

  await replaceAllPriceQuoteCategories(result.categories, {
    sourceFileName: file.name,
    uploadedBy: session.email,
  });

  const totalLines = result.categories.reduce((sum, c) => sum + c.lines.length, 0);
  return NextResponse.json({
    categories: result.categories.length,
    lines: totalLines,
    warnings: result.warnings,
  });
}
