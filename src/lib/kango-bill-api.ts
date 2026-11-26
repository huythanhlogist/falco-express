import type { KangoBill } from "./db";
import { parseKangoInvoicesJson, parseKangoPackagesJson } from "./kango-bill-validate";

export type KangoCreateBillResult =
  | { ok: true; billId: string; hawbs: string[]; redirectUrl: string }
  | { ok: false; error: string };

const KANGO_CREATE_TIMEOUT_MS = 30_000;

// Kango trả `message` dạng string khi lỗi chung, nhưng dạng object/array
// (lỗi validate theo từng field) khi lỗi input — quy về chuỗi dễ đọc cho nhân viên.
function stringifyKangoMessage(message: unknown): string {
  if (!message) return "";
  if (typeof message === "string") return message.trim();
  if (Array.isArray(message)) {
    return message.map(stringifyKangoMessage).filter(Boolean).join("; ");
  }
  if (typeof message === "object") {
    const entries = Object.entries(message as Record<string, unknown>)
      .map(([k, v]) => {
        const text = stringifyKangoMessage(v);
        return text ? `${k}: ${text}` : "";
      })
      .filter(Boolean);
    if (entries.length > 0) return entries.join("; ");
  }
  try {
    return JSON.stringify(message);
  } catch {
    return String(message);
  }
}

/**
 * Gọi thật API tạo shipment của Kango (POST /api/create-bill) — dùng CHUNG
 * api-key với tính năng tra cứu vận đơn (KANGO_API_KEY, đã xác nhận là
 * cùng 1 key cấp theo tài khoản Kango, không phải key riêng cho endpoint
 * này). Đây là hành động THẬT, không hoàn tác được (tạo vận đơn thật bên
 * Kango) — chỉ gọi từ bước "Duyệt & Gửi Kango", không bao giờ gọi tự động.
 */
export async function submitKangoBill(bill: KangoBill): Promise<KangoCreateBillResult> {
  const apiKey = process.env.KANGO_API_KEY;
  const apiUrl = process.env.KANGO_CREATE_BILL_API_URL || "https://kango-post.com/api/create-bill";
  if (!apiKey) {
    return { ok: false, error: "Thiếu biến môi trường KANGO_API_KEY" };
  }

  const packages = parseKangoPackagesJson(bill.packages_json);
  if (packages.length === 0) {
    return { ok: false, error: "Dữ liệu kiện hàng của bill không hợp lệ hoặc bị trống" };
  }
  const invoices = parseKangoInvoicesJson(bill.invoices_json);

  const body = {
    shipment: {
      receiver_company_name: bill.receiver_company_name,
      receiver_contact_name: bill.receiver_contact_name,
      receiver_telephone: bill.receiver_telephone,
      receiver_country: bill.receiver_country,
      receiver_state_name: bill.receiver_state_name,
      receiver_city: bill.receiver_city,
      receiver_postal_code: bill.receiver_postal_code,
      receiver_address_1: bill.receiver_address_1,
      receiver_address_2: bill.receiver_address_2 ?? "",
      receiver_address_3: bill.receiver_address_3 ?? "",
      shipment_service: bill.shipment_service,
      shipment_signature_flg: bill.shipment_signature_flg ? "true" : "false",
      shipment_branch: bill.shipment_branch,
      shipment_reference_code: bill.shipment_reference_code ?? "",
      agree_terms_use_service: "true",
      shipment_goods_name: bill.shipment_goods_name,
      shipment_value: String(bill.shipment_value),
      shipment_export_as: String(bill.shipment_export_as),
      packages: packages.map((p) => ({
        package_quantity: String(p.packageQuantity),
        package_type: String(p.packageType),
        package_length: String(p.packageLength),
        package_width: String(p.packageWidth),
        package_height: String(p.packageHeight),
        package_weight: String(p.packageWeight),
      })),
      invoices: invoices.map((i) => ({
        invoice_goods_details: i.invoiceGoodsDetails,
        invoice_quantity: String(i.invoiceQuantity),
        invoice_unit: String(i.invoiceUnit),
        invoice_price: String(i.invoicePrice),
        invoice_total_price: String(i.invoiceTotalPrice),
      })),
    },
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), KANGO_CREATE_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", "api-key": apiKey },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (err) {
    if (controller.signal.aborted) {
      return {
        ok: false,
        error:
          "Quá thời gian chờ phản hồi từ Kango (30 giây). Vui lòng kiểm tra trên web Kango xem vận đơn đã được tạo chưa trước khi gửi lại.",
      };
    }
    return { ok: false, error: err instanceof Error ? err.message : "Không kết nối được tới Kango" };
  } finally {
    clearTimeout(timeoutId);
  }

  const json = await res.json().catch(() => null);
  if (!res.ok || !json || json.status !== 200) {
    const message = stringifyKangoMessage(json?.message) || `Kango trả về lỗi (HTTP ${res.status})`;
    return { ok: false, error: message };
  }

  const rawBillId = json.data?.["ID bill"];
  const billId = rawBillId !== undefined && rawBillId !== null ? String(rawBillId).trim() : "";
  if (!billId) {
    return {
      ok: false,
      error:
        "Kango phản hồi thành công nhưng thiếu mã vận đơn (ID bill). Vui lòng kiểm tra trên web Kango trước khi gửi lại.",
    };
  }

  return {
    ok: true,
    billId,
    hawbs: Array.isArray(json.data?.Hawbs) ? json.data.Hawbs.map(String).filter(Boolean) : [],
    redirectUrl: typeof json.redirect_url === "string" ? json.redirect_url : "",
  };
}
