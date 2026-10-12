/**
 * Ghi lại toàn bộ tab "Kế toán" (mirror trên Google Sheet) từ DB theo header
 * mới (có cột "Ngày thu"). Cần chạy 1 lần khi thêm cột, vì ensureAccountingSheet
 * không tự sửa header của tab đã tồn tại. Tab này chỉ là bản mirror để xem,
 * DB mới là nguồn thật.
 *
 * Tập đơn ghi lại = các dòng đã có sẵn trên tab + mọi đơn đã có Thu/Chi/ngày
 * thu hoặc trạng thái khác "chưa thu" (vá luôn các dòng mirror còn thiếu).
 * Nội dung cũ của tab luôn được sao lưu ra file JSON trước khi ghi.
 *
 *   npx tsx scripts/resync-accounting-sheet.ts            # chạy thử, chỉ in kế hoạch
 *   npx tsx scripts/resync-accounting-sheet.ts --apply    # ghi thật
 *   npx tsx scripts/resync-accounting-sheet.ts --apply --backup-dir <thư mục>
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import dns from "node:dns";
dns.setDefaultResultOrder("ipv4first");
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { getPool, type OrderRecord } from "../src/lib/db";
import { getSheetsClient, ACCOUNTING_HEADER } from "../src/lib/sheets";
import { toAccountingRow } from "../src/lib/accounting-sync";

const TITLE = "Kế toán";

async function main() {
  const apply = process.argv.includes("--apply");
  const backupDirIdx = process.argv.indexOf("--backup-dir");
  const backupDir = backupDirIdx >= 0 ? process.argv[backupDirIdx + 1] : process.cwd();

  const sheetId = process.env.GOOGLE_SHEET_ID;
  if (!sheetId) throw new Error("Thiếu GOOGLE_SHEET_ID");
  const sheets = await getSheetsClient();

  const meta = await sheets.spreadsheets.get({ spreadsheetId: sheetId });
  const tabExists = meta.data.sheets?.some((s) => s.properties?.title === TITLE) ?? false;

  let oldValues: string[][] = [];
  if (tabExists) {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: `'${TITLE}'!A1:Z5000`,
      valueRenderOption: "FORMATTED_VALUE",
    });
    oldValues = (res.data.values as string[][]) || [];
  }
  const existingCodes = new Set(
    oldValues.slice(1).map((r) => (r[0] || "").trim().toUpperCase()).filter(Boolean)
  );
  console.log(`Tab hiện tại: ${tabExists ? `${oldValues.length} dòng (gồm header)` : "chưa tồn tại"}`);
  console.log("Header cũ:", JSON.stringify(oldValues[0] ?? []));

  const [rows] = await getPool().query("SELECT * FROM orders ORDER BY received_date ASC, id ASC");
  const orders = (rows as OrderRecord[]).filter(
    (o) =>
      existingCodes.has(o.falco_code.toUpperCase()) ||
      o.amount !== null ||
      o.cost !== null ||
      o.collected_date !== null ||
      o.payment_status !== "unpaid"
  );
  const values = orders.map((o) => {
    const r = toAccountingRow(o);
    return [
      r.falcoCode,
      r.awb,
      r.recipientName,
      r.destination,
      r.receivedDate,
      r.paymentStatusLabel,
      r.collectedDate,
      r.amount,
      r.cost,
      r.amount - r.cost,
      new Date().toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" }),
    ];
  });

  const missingFromSheet = orders.filter((o) => !existingCodes.has(o.falco_code.toUpperCase())).length;
  const notInDb = [...existingCodes].filter((c) => !orders.some((o) => o.falco_code.toUpperCase() === c));
  console.log(`Sẽ ghi ${values.length} dòng (${missingFromSheet} dòng mới bù vào, ${existingCodes.size - notInDb.length} dòng giữ lại).`);
  if (notInDb.length) console.log(`Dòng có trên Sheet nhưng không còn đơn tương ứng trong DB (sẽ bị bỏ): ${notInDb.join(", ")}`);
  console.log("Header mới:", JSON.stringify(ACCOUNTING_HEADER));

  if (!apply) {
    console.log("\nChạy thử — chưa ghi gì. Thêm --apply để ghi thật.");
    return;
  }

  const backupFile = join(backupDir, `ke-toan-sheet-backup-${Date.now()}.json`);
  writeFileSync(backupFile, JSON.stringify(oldValues, null, 1));
  console.log("Đã sao lưu nội dung cũ:", backupFile);

  if (!tabExists) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: sheetId,
      requestBody: { requests: [{ addSheet: { properties: { title: TITLE } } }] },
    });
  } else {
    await sheets.spreadsheets.values.clear({ spreadsheetId: sheetId, range: `'${TITLE}'!A1:Z5000` });
  }
  await sheets.spreadsheets.values.update({
    spreadsheetId: sheetId,
    range: `'${TITLE}'!A1:K${values.length + 1}`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [ACCOUNTING_HEADER, ...values] },
  });
  console.log(`OK: đã ghi header + ${values.length} dòng.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
