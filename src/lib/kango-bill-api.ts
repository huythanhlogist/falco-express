import type { KangoBill, KangoInvoiceItem, KangoPackage } from "./db";

export type KangoCreateBillResult =
  | { ok: true; billId: string; hawbs: string[]; redirectUrl: string }
  | { ok: false; error: string };

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

  const packages = JSON.parse(bill.packages_json) as KangoPackage[];
  const invoices = bill.invoices_json ? (JSON.parse(bill.invoices_json) as KangoInvoiceItem[]) : [];

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

  let res: Response;
  try {
    res = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", "api-key": apiKey },
      body: JSON.stringify(body),
    });
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Không kết nối được tới Kango" };
  }

  const json = await res.json().catch(() => null);
  if (!res.ok || !json || json.status !== 200) {
    const message = json?.message || `Kango trả về lỗi (HTTP ${res.status})`;
    return { ok: false, error: message };
  }

  return {
    ok: true,
    billId: String(json.data?.["ID bill"] ?? ""),
    hawbs: Array.isArray(json.data?.Hawbs) ? json.data.Hawbs.map(String) : [],
    redirectUrl: typeof json.redirect_url === "string" ? json.redirect_url : "",
  };
}
