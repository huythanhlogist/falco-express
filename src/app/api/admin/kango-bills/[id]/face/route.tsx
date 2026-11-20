import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import { NextResponse } from "next/server";
import type { ReactNode } from "react";
import { getCurrentAdminSession } from "@/lib/auth";
import { SITE } from "@/lib/constants";
import { findKangoBillById, type KangoPackage } from "@/lib/db";

export const runtime = "nodejs";

let cachedFonts: { regular: ArrayBuffer; bold: ArrayBuffer } | null = null;

function toArrayBuffer(buf: Buffer): ArrayBuffer {
  const ab = new ArrayBuffer(buf.byteLength);
  new Uint8Array(ab).set(buf);
  return ab;
}

async function loadRobotoFonts(): Promise<{ regular: ArrayBuffer; bold: ArrayBuffer }> {
  if (cachedFonts) return cachedFonts;
  const fontsDir = path.join(process.cwd(), "public/fonts");
  const [regularBuf, boldBuf] = await Promise.all([
    readFile(path.join(fontsDir, "Roboto-Regular.ttf")),
    readFile(path.join(fontsDir, "Roboto-Bold.ttf")),
  ]);
  cachedFonts = {
    regular: toArrayBuffer(regularBuf),
    bold: toArrayBuffer(boldBuf),
  };
  return cachedFonts;
}

function isValidAgentKey(request: Request): boolean {
  const key = request.headers.get("x-agent-api-key");
  const expected = process.env.AGENT_API_KEY;
  return Boolean(key && expected && key === expected);
}

function parseHawbs(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String).filter(Boolean) : [];
  } catch {
    return [];
  }
}

function parsePackages(raw: string): KangoPackage[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as KangoPackage[]) : [];
  } catch {
    return [];
  }
}

function formatWeight(n: number): string {
  if (!Number.isFinite(n)) return "0";
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, "");
}

function formatMoney(raw: string): string {
  const n = Number(raw);
  if (!Number.isFinite(n)) return raw || "0";
  return n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function formatVnDateTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getCurrentAdminSession();
  if (!session && !isValidAgentKey(request)) {
    return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  }

  const { id } = await params;
  const billId = Number(id);
  if (!Number.isInteger(billId) || billId <= 0) {
    return NextResponse.json({ error: "ID bill không hợp lệ" }, { status: 400 });
  }

  const bill = await findKangoBillById(billId);
  if (!bill) {
    return NextResponse.json({ error: "Không tìm thấy bill" }, { status: 404 });
  }

  const [fonts, logo] = await Promise.all([loadRobotoFonts(), loadLogoDataUri()]);
  const allHawbs = parseHawbs(bill.kango_hawbs_json);
  // Kango thường trả HAWB = chính số Air waybill → khỏi in 2 lần
  const hawbs = allHawbs.filter((h) => h !== bill.kango_bill_id);
  const packages = parsePackages(bill.packages_json);
  const isDraft = bill.status !== "sent";

  const totalPackages = packages.reduce((sum, p) => sum + (Number(p.packageQuantity) || 1), 0);
  const totalWeight = packages.reduce(
    (sum, p) => sum + (Number(p.packageQuantity) || 1) * (Number(p.packageWeight) || 0),
    0
  );

  const clean = (s: string | null | undefined) => {
    const v = (s ?? "").trim();
    return v && !/^[.\-–—]+$/.test(v) ? v : "";
  };
  const street = [bill.receiver_address_1, bill.receiver_address_2, bill.receiver_address_3]
    .map(clean)
    .filter(Boolean)
    .join(", ");
  const contactName = clean(bill.receiver_contact_name);
  // Kango bắt buộc có "company" nên nhân viên hay chép tên người nhận vào → coi như chưa có tên tiệm
  const rawCompany = clean(bill.receiver_company_name);
  const shopName = rawCompany.toLowerCase() === contactName.toLowerCase() ? "" : rawCompany;
  const phone = clean(bill.receiver_telephone);
  const phoneOk = phone.replace(/\D/g, "").length >= 6;
  const note = clean(bill.customer_note);
  const dateText = formatVnDateTime(isDraft ? bill.created_at : bill.sent_at || bill.created_at);

  // Khổ A4 dọc (tỉ lệ 1 : 1,414) ở ~150 dpi
  const W = 1240;
  const H = 1754;
  const MAX_ROWS = 12;
  const shownPackages = packages.slice(0, MAX_ROWS);
  const tableRows = Math.max(6, shownPackages.length);

  const NAVY = "#1f3354";
  const TINT = "#edf1f7";
  const LINE = "#9fabbd";
  const INK = "#141a24";
  const LABEL = "#5b6577";
  const ACCENT = "#d0451b";
  const EMPTY = "(chưa có)";

  const cell = (
    label: string,
    value: string,
    o: { flex?: number; width?: number; last?: boolean; size?: number; bold?: boolean; empty?: boolean } = {}
  ) => (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        ...(o.width
          ? { width: `${o.width}px`, flexShrink: 0 }
          : { flexGrow: o.flex ?? 1, flexShrink: 1, flexBasis: 0, minWidth: 0 }),
        padding: "10px 16px 12px",
        borderRight: o.last ? "none" : `1px solid ${LINE}`,
      }}
    >
      <div style={{ display: "flex", fontSize: 15, color: LABEL }}>{label}</div>
      <div
        style={{
          display: "flex",
          fontSize: o.size ?? 22,
          fontWeight: o.bold && !o.empty ? 700 : 400,
          color: o.empty ? "#a3abb8" : INK,
          marginTop: "4px",
          lineHeight: 1.35,
        }}
      >
        {o.empty ? EMPTY : value}
      </div>
    </div>
  );
  const row = (children: ReactNode, last = false) => (
    <div
      style={{
        display: "flex",
        flexDirection: "row",
        alignItems: "stretch",
        borderBottom: last ? "none" : `1px solid ${LINE}`,
      }}
    >
      {children}
    </div>
  );
  const group = (...children: ReactNode[]) => (
    <div style={{ display: "flex", flexDirection: "row", alignItems: "stretch", flexGrow: 1, flexBasis: 0 }}>
      {children}
    </div>
  );
  const band = (n: string, vi: string, en: string) => (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        height: "40px",
        padding: "0 16px",
        backgroundColor: NAVY,
        color: "#FFFFFF",
        fontSize: 17,
      }}
    >
      <div style={{ display: "flex", fontWeight: 700 }}>
        {n}. {vi}
      </div>
      <div style={{ display: "flex", marginLeft: "8px", color: "#b9c4d6" }}>/ {en}</div>
    </div>
  );
  const td = (t: string, w?: number, o: { right?: boolean; bold?: boolean; color?: string } = {}) => (
    <div
      style={{
        display: "flex",
        ...(w ? { width: `${w}px`, flexShrink: 0 } : { flexGrow: 1, flexBasis: 0 }),
        justifyContent: o.right ? "flex-end" : "flex-start",
        padding: "0 16px",
        fontWeight: o.bold ? 700 : 400,
        color: o.color ?? INK,
      }}
    >
      {t}
    </div>
  );
  const summary = (label: string, value: string, last = false) => (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        flexGrow: 1,
        flexBasis: 0,
        padding: "0 18px",
        backgroundColor: TINT,
        borderBottom: last ? "none" : `1px solid ${LINE}`,
      }}
    >
      <div style={{ display: "flex", fontSize: 15, color: LABEL }}>{label}</div>
      <div style={{ display: "flex", fontSize: 36, fontWeight: 700, color: NAVY, marginTop: "2px" }}>{value}</div>
    </div>
  );
  const signBox = (title: string, sub: string, last = false) => (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        flexGrow: 1,
        flexBasis: 0,
        padding: "12px 16px",
        borderRight: last ? "none" : `1px solid ${LINE}`,
      }}
    >
      <div style={{ display: "flex", fontSize: 17, fontWeight: 700, color: INK }}>{title}</div>
      <div style={{ display: "flex", fontSize: 14, color: LABEL, marginTop: "2px" }}>{sub}</div>
      <div style={{ display: "flex", marginTop: "auto", borderBottom: `1px dashed ${LINE}`, height: "1px" }} />
      <div style={{ display: "flex", fontSize: 13, color: LABEL, marginTop: "6px" }}>Ký, ghi rõ họ tên / Signature &amp; full name</div>
    </div>
  );

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          backgroundColor: "#FFFFFF",
          color: INK,
          fontFamily: "Roboto",
          padding: "48px 52px",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", flexGrow: 1, border: `2px solid ${NAVY}` }}>
          {/* Đầu phiếu */}
          <div style={{ display: "flex", flexDirection: "row", height: "170px", borderBottom: `2px solid ${NAVY}` }}>
            <div
              style={{
                display: "flex",
                flexDirection: "row",
                alignItems: "center",
                flexGrow: 1,
                flexBasis: 0,
                padding: "0 20px",
                borderRight: `1px solid ${LINE}`,
              }}
            >
              <div style={{ display: "flex", width: "140px", height: "130px", overflow: "hidden", alignItems: "center", justifyContent: "center" }}>
                {logo ? <img src={logo} width={190} height={190} /> : null}
              </div>
              <div style={{ display: "flex", flexDirection: "column", marginLeft: "18px" }}>
                <div style={{ display: "flex", fontSize: 34, fontWeight: 700, color: NAVY }}>FALCO EXPRESS</div>
                <div style={{ display: "flex", fontSize: 18, color: LABEL, marginTop: "4px" }}>
                  Phiếu gửi hàng quốc tế / International Shipping Bill
                </div>
                <div style={{ display: "flex", fontSize: 18, marginTop: "10px" }}>
                  <span style={{ color: ACCENT, fontWeight: 700, marginRight: "8px" }}>Hotline / Zalo {SITE.hotline}</span>
                  <span style={{ color: LABEL }}>· falcoexpress.com</span>
                </div>
              </div>
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                width: "420px",
                padding: "0 24px",
                backgroundColor: TINT,
              }}
            >
              <div style={{ display: "flex", fontSize: 16, color: LABEL }}>Số vận đơn / Air Waybill No.</div>
              <div style={{ display: "flex", fontSize: 54, fontWeight: 700, color: isDraft ? "#a3abb8" : NAVY, marginTop: "2px" }}>
                {bill.kango_bill_id || "—"}
              </div>
              {hawbs.length > 0 ? (
                <div style={{ display: "flex", fontSize: 15, color: LABEL }}>HAWB: {hawbs.join(", ")}</div>
              ) : null}
              {isDraft ? (
                <div style={{ display: "flex", fontSize: 15, fontWeight: 700, color: ACCENT, marginTop: "4px" }}>
                  BẢN NHÁP – CHƯA PHÁT HÀNH VẬN ĐƠN
                </div>
              ) : null}
            </div>
          </div>

          {row(
            group(
              
                cell("Chi nhánh / Branch", bill.shipment_branch, { bold: true }),
                cell("Dịch vụ / Service", bill.shipment_service, { bold: true, flex: 1.4 }),
                cell(isDraft ? "Ngày tạo / Date" : "Ngày gửi / Date", dateText, { bold: true, last: true, width: 300 }),
              
            )
          )}

          {band("1", "NGƯỜI NHẬN", "RECEIVER")}
          {row(
            group(
              
                cell("Tên người nhận / Contact name", contactName, { bold: true, size: 26, empty: !contactName }),
                cell("Số điện thoại / Phone", phone, { bold: true, last: true, width: 400, size: 26, empty: !phoneOk }),
              
            )
          )}
          {row(cell("Tên tiệm, công ty / Company", shopName, { last: true, bold: true, empty: !shopName }))}
          {row(cell("Địa chỉ / Street address", street, { last: true, empty: !street }))}
          {row(
            group(
              
                cell("Thành phố / City", clean(bill.receiver_city), { empty: !clean(bill.receiver_city) }),
                cell("Bang, tỉnh / State", clean(bill.receiver_state_name) || " "),
                cell("Mã bưu chính / Postcode", clean(bill.receiver_postal_code), {
                  bold: true,
                  empty: !clean(bill.receiver_postal_code),
                }),
                cell("Quốc gia / Country", clean(bill.receiver_country).toUpperCase(), {
                  bold: true,
                  last: true,
                  empty: !clean(bill.receiver_country),
                }),
              
            )
          )}

          {band("2", "KIỆN HÀNG", "PACKAGES")}
          <div style={{ display: "flex", flexDirection: "row", borderBottom: `1px solid ${LINE}` }}>
            <div style={{ display: "flex", flexDirection: "column", flexGrow: 1, flexBasis: 0, borderRight: `1px solid ${LINE}` }}>
              <div
                style={{
                  display: "flex",
                  flexDirection: "row",
                  alignItems: "center",
                  height: "40px",
                  fontSize: 16,
                  backgroundColor: TINT,
                  borderBottom: `1px solid ${LINE}`,
                }}
              >
                {td("STT", 80, { color: LABEL })}
                {td("SL", 80, { color: LABEL })}
                {td("Dài (cm)", 150, { color: LABEL })}
                {td("Rộng (cm)", 150, { color: LABEL })}
                {td("Cao (cm)", 150, { color: LABEL })}
                {td("Cân nặng (kg)", undefined, { right: true, color: LABEL })}
              </div>
              {Array.from({ length: tableRows }).map((_, idx) => {
                const p = shownPackages[idx];
                const qty = p ? Number(p.packageQuantity) || 1 : 0;
                return (
                  <div
                    key={idx}
                    style={{
                      display: "flex",
                      flexDirection: "row",
                      alignItems: "center",
                      height: "44px",
                      fontSize: 21,
                      borderBottom: idx < tableRows - 1 ? `1px solid #dde2ea` : "none",
                    }}
                  >
                    {p ? (
                      group(
                        
                          td(String(idx + 1), 80, { color: LABEL }),
                          td(String(qty), 80),
                          td(String(p.packageLength), 150),
                          td(String(p.packageWidth), 150),
                          td(String(p.packageHeight), 150),
                          td(formatWeight(Number(p.packageWeight) || 0) + (qty > 1 ? ` × ${qty}` : ""), undefined, {
                            right: true,
                            bold: true,
                          }),
                        
                      )
                    ) : (
                      td(" ")
                    )}
                  </div>
                );
              })}
              {packages.length > MAX_ROWS ? (
                <div style={{ display: "flex", padding: "6px 16px", fontSize: 15, color: LABEL, borderTop: `1px solid ${LINE}` }}>
                  … và {packages.length - MAX_ROWS} kiện khác
                </div>
              ) : null}
            </div>
            <div style={{ display: "flex", flexDirection: "column", width: "260px" }}>
              {summary("Tổng số kiện / Pieces", String(totalPackages))}
              {summary("Tổng trọng lượng / Weight", `${formatWeight(totalWeight)} kg`, true)}
            </div>
          </div>

          {band("3", "HÀNG HOÁ", "SHIPMENT")}
          {row(
            group(
              
                cell("Mô tả hàng hoá / Description of goods", bill.shipment_goods_name, { flex: 2 }),
                cell("Giá trị khai báo / Value", `${formatMoney(bill.shipment_value)} USD`, { width: 240, bold: true }),
                cell("Ký nhận / Signature required", bill.shipment_signature_flg ? "Có" : "Không", { width: 240, last: true }),
              
            ),
            true
          )}

          {band("4", "GHI CHÚ", "REMARKS")}
          <div
            style={{
              display: "flex",
              flexGrow: 1,
              padding: "14px 16px",
              fontSize: 21,
              lineHeight: 1.5,
              color: note ? INK : "#a3abb8",
              backgroundColor: note ? "#fff8ef" : "#FFFFFF",
            }}
          >
            {note || " "}
          </div>

          {band("5", "XÁC NHẬN", "CONFIRMATION")}
          <div style={{ display: "flex", flexDirection: "row", height: "170px" }}>
            {signBox("Khách hàng / Shipper", "Đã kiểm tra và xác nhận thông tin trên phiếu")}
            {signBox("Falco Express", "Nhân viên tiếp nhận hàng / Received by", true)}
          </div>

          {/* Lưu ý */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              padding: "12px 16px 14px",
              borderTop: `1px solid ${LINE}`,
              backgroundColor: TINT,
              fontSize: 15,
              lineHeight: 1.55,
              color: LABEL,
            }}
          >
            <div style={{ display: "flex" }}>
              Quý khách vui lòng kiểm tra kỹ tên người nhận, số điện thoại, địa chỉ và mã bưu chính. Nếu có sai sót, xin báo ngay cho
            </div>
            <div style={{ display: "flex" }}>
              Falco trước khi hàng xuất kho. Thông tin không chính xác có thể khiến hàng giao chậm hoặc phát sinh phí điều chỉnh từ hãng
            </div>
            <div style={{ display: "flex" }}>vận chuyển. Cảm ơn Quý khách đã sử dụng dịch vụ của Falco Express.</div>
          </div>
        </div>
      </div>
    ),
    {
      width: W,
      height: H,
      fonts: [
        { name: "Roboto", data: fonts.regular, weight: 400, style: "normal" },
        { name: "Roboto", data: fonts.bold, weight: 700, style: "normal" },
      ],
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}

let cachedLogo: string | null = null;

async function loadLogoDataUri(): Promise<string | null> {
  if (cachedLogo) return cachedLogo;
  try {
    const buf = await readFile(path.join(process.cwd(), "public/falco-logo-512.png"));
    cachedLogo = `data:image/png;base64,${buf.toString("base64")}`;
    return cachedLogo;
  } catch {
    return null;
  }
}
