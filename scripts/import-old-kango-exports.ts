/**
 * Nhập đơn CŨ từ nhiều file export Kango (ListShipment*.xlsx) trong 1 thư mục.
 * CHỈ thêm đơn chưa có (theo AWB) — không cập nhật đơn đang có (file cũ có thể chứa thông tin cũ hơn).
 * File kiểu cũ (thiếu cột BAY HUB, lệch vị trí) được sắp lại cột theo tên.
 *   npx tsx scripts/import-old-kango-exports.ts "<thư mục>"          # chạy thử
 *   npx tsx scripts/import-old-kango-exports.ts "<thư mục>" --apply  # ghi thật
 */
import { config } from "dotenv"; config({ path: ".env.local" });
import dns from "node:dns"; dns.setDefaultResultOrder("ipv4first");
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import * as XLSX from "xlsx";
import { getPool } from "../src/lib/db";
import { processKangoWorkbook } from "../src/lib/kango-import";

const DIR = process.argv.find((a, i) => i > 1 && !a.startsWith("--")) ?? "";
if (!DIR) { console.error("Cách dùng: npx tsx scripts/import-old-kango-exports.ts <thư-mục-chứa-ListShipment*.xlsx> [--apply]"); process.exit(1); }
const APPLY = process.argv.includes("--apply");

async function dbSize() {
  const [r]: any = await getPool().query(
    `SELECT table_name t, table_rows n, ROUND((data_length+index_length)/1024) kb FROM information_schema.tables WHERE table_schema = DATABASE() ORDER BY (data_length+index_length) DESC`);
  return r as { t: string; n: number; kb: number }[];
}

(async () => {
  const before = await dbSize();
  console.log("DB trước:", before.reduce((a, r) => a + Number(r.kb), 0), "KB;", before.slice(0, 6).map((r) => `${r.t}=${r.kb}KB/${r.n}`).join(", "));
  const [ex]: any = await getPool().query("SELECT UPPER(awb) a FROM orders");
  const have = new Set<string>(ex.map((r: any) => r.a));

  // File mới nhất thắng (sắp theo thời gian sửa tăng dần, ghi đè dần)
  const files = readdirSync(DIR).filter((f) => /^ListShipment.*\.xlsx$/.test(f))
    .map((f) => path.join(DIR, f)).sort((a, b) => statSync(a).mtimeMs - statSync(b).mtimeMs);
  // Mỗi AWB thuộc file MỚI NHẤT chứa nó; nhập theo từng file với tiêu đề gốc của file đó.
  const owner = new Map<string, string>();
  const parsed = new Map<string, { pre: unknown[][]; header: unknown[]; byAwb: Map<string, unknown[][]> }>();
  for (const f of files) {
    const wb = XLSX.read(readFileSync(f), { type: "buffer" });
    const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: true, defval: "" });
    const hi = rows.findIndex((r) => r.some((c) => String(c).trim().toUpperCase() === "SERVICE"));
    if (hi < 0) continue;
    const awbCol = rows[hi].findIndex((c) => String(c).trim().toUpperCase() === "AWB");
    const byAwb = new Map<string, unknown[][]>();
    for (const r of rows.slice(hi + 1)) {
      const awb = String(r[awbCol] ?? "").trim().toUpperCase();
      if (!awb || have.has(awb)) continue;
      if (!byAwb.has(awb)) byAwb.set(awb, []);
      byAwb.get(awb)!.push(r);
      owner.set(awb, f);
    }
    parsed.set(f, { pre: rows.slice(0, hi), header: rows[hi], byAwb });
  }
  // Định dạng chuẩn = tiêu đề của file mới nhất; file kiểu cũ (lệch cột) được sắp lại theo TÊN cột.
  const std = parsed.get(files[files.length - 1])!;
  const norm = (c: unknown) => String(c).trim().toUpperCase();
  for (const [f, p] of parsed) {
    if (p.header.map(norm).join("|") === std.header.map(norm).join("|")) continue;
    const idx = std.header.map((h) => p.header.map(norm).indexOf(norm(h)));
    const missing = std.header.filter((_, i) => idx[i] < 0).map(norm);
    console.log(`${path.basename(f)}: sắp lại cột theo tên (thiếu: ${missing.join(", ") || "không"})`);
    for (const [awb, rs] of p.byAwb) p.byAwb.set(awb, rs.map((r) => idx.map((j) => (j < 0 ? "" : r[j]))));
    p.header = std.header; p.pre = std.pre;
  }
  console.log(`${files.length} file, ${owner.size} AWB chưa có trong DB`);
  if (!APPLY) { console.log("Chạy thử — chưa ghi. Thêm --apply để nhập."); await getPool().end(); return; }
  let ins = 0, upd = 0;
  for (const [f, p] of parsed) {
    const mine = [...p.byAwb.entries()].filter(([awb]) => owner.get(awb) === f);
    if (mine.length === 0) continue;
    const ws = XLSX.utils.aoa_to_sheet([...p.pre, p.header, ...mine.flatMap(([, r]) => r)]);
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
    const res = await processKangoWorkbook(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer);
    ins += res.inserted; upd += res.updated;
    console.log(`${path.basename(f)}: thêm ${res.inserted}, cập nhật ${res.updated}, lỗi ${res.errors.length}`, res.errors.slice(0, 2));
  }
  console.log(`TỔNG: thêm ${ins}, cập nhật ${upd}`);
  const after = await dbSize();
  console.log("DB sau:", after.reduce((a, r) => a + Number(r.kb), 0), "KB");
  await getPool().end();
})().catch((e) => { console.error("LỖI:", e.message); process.exit(1); });
