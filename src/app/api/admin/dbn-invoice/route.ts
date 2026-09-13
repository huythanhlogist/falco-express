import { NextResponse } from "next/server";
import { getCurrentAdminSession } from "@/lib/auth";
import { applyDbnInvoice } from "@/lib/dbn-invoice-import";

const MAX_FILE_BYTES = 10 * 1024 * 1024; // file DBN vài chục dòng, đủ dư.
const MAX_FILES = 20;

export async function POST(request: Request) {
  const session = await getCurrentAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  }

  const form = await request.formData();
  const mode = form.get("mode");
  if (mode !== "preview" && mode !== "commit") {
    return NextResponse.json({ error: "Thiếu mode (preview/commit)" }, { status: 400 });
  }

  const files = form.getAll("files").filter((f): f is File => f instanceof File);
  if (files.length === 0) {
    return NextResponse.json({ error: "Vui lòng chọn ít nhất 1 file DBN" }, { status: 400 });
  }
  if (files.length > MAX_FILES) {
    return NextResponse.json({ error: `Tối đa ${MAX_FILES} file mỗi lượt` }, { status: 400 });
  }
  for (const file of files) {
    if (!/\.xlsx?$/i.test(file.name)) {
      return NextResponse.json(
        { error: `File "${file.name}" không phải Excel (.xlsx/.xls)` },
        { status: 400 }
      );
    }
    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json(
        { error: `File "${file.name}" quá lớn (giới hạn 10MB) — kiểm tra lại file` },
        { status: 400 }
      );
    }
  }

  let force = new Set<string>();
  const forceRaw = form.get("force");
  if (typeof forceRaw === "string" && forceRaw.trim()) {
    try {
      const arr = JSON.parse(forceRaw);
      if (Array.isArray(arr)) force = new Set(arr.map(String));
    } catch {
      // bỏ qua nếu gửi sai định dạng — coi như không ép ghi đè dòng nào
    }
  }

  const results = [];
  for (const file of files) {
    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await applyDbnInvoice(buffer, file.name, {
      dryRun: mode === "preview",
      force,
      uploadedBy: session.email,
    });
    results.push(result);
  }

  return NextResponse.json({ results });
}
