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

  const INK = "#111111";
  const LABEL = "#555555";
  const RULE = "#1a1a1a";
  const HAIR = "#bdbdbd";
  const BAND = "#ececec";
  const EMPTY = "(chưa có)";

  // Chiều cao ước theo từng hàng của phiếu
  const noteLines = note ? Math.ceil(note.length / 110) : 0;
  const streetLines = Math.max(1, Math.ceil(street.length / 70));
  const height =
    40 + // lề
    112 + // đầu phiếu
    58 + // chi nhánh / dịch vụ / ngày
    28 * (note ? 4 : 3) + // thanh tiêu đề mục
    58 * 3 + (streetLines - 1) * 22 + 58 + // người nhận
    32 + Math.max(1, packages.length) * 36 + // bảng kiện
    58 + // hàng hoá
    (note ? noteLines * 22 + 18 : -24) +
    70; // lưu ý

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
        padding: "6px 10px 8px",
        borderRight: o.last ? "none" : `1px solid ${RULE}`,
      }}
    >
      <div style={{ display: "flex", fontSize: 11, color: LABEL }}>{label}</div>
      <div
        style={{
          display: "flex",
          fontSize: o.size ?? 16,
          fontWeight: o.bold && !o.empty ? 700 : 400,
          color: o.empty ? "#9a9a9a" : INK,
          marginTop: "3px",
          lineHeight: 1.35,
        }}
      >
        {o.empty ? EMPTY : value}
      </div>
    </div>
  );
  const row = (children: ReactNode, last = false) => (
    <div style={{ display: "flex", flexDirection: "row", borderBottom: last ? "none" : `1px solid ${RULE}` }}>
      {children}
    </div>
  );
  const band = (n: string, t: string) => (
    <div
      style={{
        display: "flex",
        height: "28px",
        alignItems: "center",
        padding: "0 10px",
        backgroundColor: BAND,
        borderBottom: `1px solid ${RULE}`,
        fontSize: 13,
        fontWeight: 700,
        color: INK,
      }}
    >
      {n}. {t}
    </div>
  );
  const th = (t: string, w?: number, right = false) => (
    <div
      style={{
        display: "flex",
        ...(w ? { width: `${w}px`, flexShrink: 0 } : { flexGrow: 1, flexBasis: 0 }),
        justifyContent: right ? "flex-end" : "flex-start",
        padding: "0 10px",
      }}
    >
      {t}
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
          padding: "20px",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", flex: 1, border: `1.5px solid ${RULE}` }}>
          {/* Đầu phiếu: công ty | số vận đơn */}
          <div style={{ display: "flex", flexDirection: "row", height: "112px", borderBottom: `1.5px solid ${RULE}` }}>
            <div style={{ display: "flex", flexDirection: "row", alignItems: "center", flexGrow: 1, flexBasis: 0, padding: "0 14px", borderRight: `1px solid ${RULE}` }}>
              <div style={{ display: "flex", width: "96px", height: "84px", overflow: "hidden", alignItems: "center", justifyContent: "center" }}>
                {logo ? <img src={logo} width={128} height={128} /> : null}
              </div>
              <div style={{ display: "flex", flexDirection: "column", marginLeft: "12px" }}>
                <div style={{ display: "flex", fontSize: 22, fontWeight: 700 }}>FALCO EXPRESS</div>
                <div style={{ display: "flex", fontSize: 13, color: LABEL, marginTop: "2px" }}>
                  Phiếu gửi hàng quốc tế / International Shipping Bill
                </div>
                <div style={{ display: "flex", fontSize: 13, marginTop: "6px" }}>
                  Hotline / Zalo: {SITE.hotline} · falcoexpress.com
                </div>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", width: "320px", padding: "0 16px" }}>
              <div style={{ display: "flex", fontSize: 12, color: LABEL }}>Số vận đơn / Air Waybill No.</div>
              <div style={{ display: "flex", fontSize: 38, fontWeight: 700, marginTop: "2px", color: isDraft ? "#9a9a9a" : INK }}>
                {bill.kango_bill_id || "—"}
              </div>
              {hawbs.length > 0 ? (
                <div style={{ display: "flex", fontSize: 12, color: LABEL }}>HAWB: {hawbs.join(", ")}</div>
              ) : null}
              {isDraft ? (
                <div style={{ display: "flex", fontSize: 12, fontWeight: 700, marginTop: "2px" }}>
                  BẢN NHÁP – CHƯA PHÁT HÀNH VẬN ĐƠN
                </div>
              ) : null}
            </div>
          </div>

          {row(
            <div style={{ display: "flex", flexDirection: "row", alignItems: "stretch", flexGrow: 1, flexBasis: 0 }}>
              {cell("Chi nhánh / Branch", bill.shipment_branch, { bold: true })}
              {cell("Dịch vụ / Service", bill.shipment_service, { bold: true, flex: 1.3 })}
              {cell(isDraft ? "Ngày tạo / Date" : "Ngày gửi / Date", dateText, { bold: true, last: true, width: 230 })}
            </div>
          )}

          {band("1", "NGƯỜI NHẬN / RECEIVER")}
          {row(
            <div style={{ display: "flex", flexDirection: "row", alignItems: "stretch", flexGrow: 1, flexBasis: 0 }}>
              {cell("Tên người nhận / Contact name", contactName, { bold: true, size: 18, empty: !contactName })}
              {cell("Số điện thoại / Phone", phone, { bold: true, last: true, width: 300, size: 18, empty: !phoneOk })}
            </div>
          )}
          {row(cell("Tên tiệm, công ty / Company", shopName, { last: true, empty: !shopName }))}
          {row(cell("Địa chỉ / Street address", street, { last: true, empty: !street }))}
          {row(
            <div style={{ display: "flex", flexDirection: "row", alignItems: "stretch", flexGrow: 1, flexBasis: 0 }}>
              {cell("Thành phố / City", clean(bill.receiver_city), { empty: !clean(bill.receiver_city) })}
              {cell("Bang, tỉnh / State", clean(bill.receiver_state_name) || " ")}
              {cell("Mã bưu chính / Postcode", clean(bill.receiver_postal_code), {
                bold: true,
                empty: !clean(bill.receiver_postal_code),
              })}
              {cell("Quốc gia / Country", clean(bill.receiver_country).toUpperCase(), {
                bold: true,
                last: true,
                empty: !clean(bill.receiver_country),
              })}
            </div>
          )}

          {band("2", "KIỆN HÀNG / PACKAGES")}
          <div style={{ display: "flex", flexDirection: "row", borderBottom: `1px solid ${RULE}` }}>
            <div style={{ display: "flex", flexDirection: "column", flexGrow: 1, flexBasis: 0, borderRight: `1px solid ${RULE}` }}>
              <div
                style={{
                  display: "flex",
                  flexDirection: "row",
                  alignItems: "center",
                  height: "32px",
                  fontSize: 12,
                  color: LABEL,
                  borderBottom: `1px solid ${RULE}`,
                }}
              >
                {th("STT", 60)}
                {th("SL", 60)}
                {th("Dài (cm)", 110)}
                {th("Rộng (cm)", 110)}
                {th("Cao (cm)", 110)}
                {th("Cân nặng (kg)", undefined, true)}
              </div>
              {(packages.length > 0 ? packages : [null]).map((p, idx) => (
                <div
                  key={idx}
                  style={{
                    display: "flex",
                    flexDirection: "row",
                    alignItems: "center",
                    height: "36px",
                    fontSize: 16,
                    borderBottom: idx < packages.length - 1 ? `1px solid ${HAIR}` : "none",
                  }}
                >
                  {p ? (
                    <div style={{ display: "flex", flexDirection: "row", alignItems: "stretch", flexGrow: 1, flexBasis: 0 }}>
                      {th(String(idx + 1), 60)}
                      {th(String(Number(p.packageQuantity) || 1), 60)}
                      {th(String(p.packageLength), 110)}
                      {th(String(p.packageWidth), 110)}
                      {th(String(p.packageHeight), 110)}
                      {th(
                        formatWeight(Number(p.packageWeight) || 0) +
                          ((Number(p.packageQuantity) || 1) > 1 ? ` × ${p.packageQuantity}` : ""),
                        undefined,
                        true
                      )}
                    </div>
                  ) : (
                    th(EMPTY)
                  )}
                </div>
              ))}
            </div>
            <div style={{ display: "flex", flexDirection: "column", width: "190px" }}>
              <div style={{ display: "flex", flexDirection: "column", flex: 1, justifyContent: "center", padding: "6px 10px", borderBottom: `1px solid ${RULE}` }}>
                <div style={{ display: "flex", fontSize: 11, color: LABEL }}>Tổng số kiện / Pieces</div>
                <div style={{ display: "flex", fontSize: 24, fontWeight: 700 }}>{totalPackages}</div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", flex: 1, justifyContent: "center", padding: "6px 10px" }}>
                <div style={{ display: "flex", fontSize: 11, color: LABEL }}>Tổng trọng lượng / Weight</div>
                <div style={{ display: "flex", fontSize: 24, fontWeight: 700 }}>{formatWeight(totalWeight)} kg</div>
              </div>
            </div>
          </div>

          {band("3", "HÀNG HOÁ / SHIPMENT")}
          {row(
            <div style={{ display: "flex", flexDirection: "row", alignItems: "stretch", flexGrow: 1, flexBasis: 0 }}>
              {cell("Mô tả hàng hoá / Description of goods", bill.shipment_goods_name, { flex: 2 })}
              {cell("Giá trị khai báo / Value", `${formatMoney(bill.shipment_value)} USD`, { width: 170 })}
              {cell("Ký nhận / Signature", bill.shipment_signature_flg ? "Có" : "Không", { width: 140, last: true })}
            </div>,
            !note
          )}

          {note ? band("4", "GHI CHÚ / REMARKS") : null}
          {note ? (
            <div style={{ display: "flex", padding: "8px 10px", fontSize: 15, lineHeight: 1.45 }}>{note}</div>
          ) : null}

          {/* Lưu ý */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              marginTop: "auto",
              padding: "8px 10px 10px",
              borderTop: `1px solid ${RULE}`,
              fontSize: 11.5,
              lineHeight: 1.5,
              color: "#777777",
            }}
          >
            <div style={{ display: "flex" }}>
              Quý khách vui lòng kiểm tra kỹ tên người nhận, số điện thoại, địa chỉ và mã bưu chính. Nếu có sai sót, xin báo ngay
            </div>
            <div style={{ display: "flex" }}>
              cho Falco trước khi hàng xuất kho. Thông tin không chính xác có thể khiến hàng giao chậm hoặc phát sinh phí điều
            </div>
            <div style={{ display: "flex" }}>chỉnh từ hãng vận chuyển. Cảm ơn Quý khách đã sử dụng dịch vụ của Falco Express.</div>
          </div>
        </div>
      </div>
    ),
    {
      width: 900,
      height,
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
