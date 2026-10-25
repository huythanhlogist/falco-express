import { getTrackingCache, type OrderRecord } from "./db";
import {
  buildTrackingData,
  fetchTrackingFor,
  isTrackingCacheFresh,
  parseCachedKango,
  saveKangoToCache,
  type PublicTrackingData,
} from "./tracking-cache";

/**
 * Hành trình công khai của 1 đơn: ưu tiên cache DB, thiếu/cũ thì gọi nguồn (Kango/đối tác) rồi ghi
 * cache; nguồn lỗi thì trả cache cũ hoặc thông tin cơ bản. Dùng chung cho trang tra cứu Falco
 * (/api/tracking) và trang thương hiệu riêng của CTV (/t/<slug>).
 */
export async function loadPublicTracking(order: OrderRecord): Promise<PublicTrackingData> {
  const cached = await getTrackingCache(order.id, order.awb).catch((err) => {
    console.error("[tracking] Không đọc được cache:", err);
    return null;
  });
  // Bản cache của đơn FEB… tạo bởi phiên bản cũ (chưa có danh sách ảnh/tên chuẩn hoá) thì làm mới ngay.
  const cachedKango = cached ? parseCachedKango(cached) : null;
  const staleFormat = order.falco_code.toUpperCase().startsWith("FEB") && !!cachedKango && !cachedKango.falco_photos;
  if (cached && isTrackingCacheFresh(cached) && !staleFormat) {
    return buildTrackingData(order, cachedKango);
  }

  let kango;
  let status;
  try {
    ({ kango, status } = await fetchTrackingFor(order));
  } catch (err) {
    console.error("[tracking] Nguồn tracking lỗi, dùng cache cũ/thông tin cơ bản:", err);
    return buildTrackingData(order, cachedKango);
  }
  if (kango) {
    await saveKangoToCache(order, kango, status).catch((err) => console.error("[tracking] Không ghi được cache:", err));
  }
  return buildTrackingData(order, kango);
}

const BRAND_WORDS = /falco|kango|ksn\s?post|bay\s?online|koko/gi;

/** Bản dùng cho trang thương hiệu riêng của CTV: bỏ mọi thông tin dẫn về Falco/đối tác. */
export function whiteLabel(data: PublicTrackingData): PublicTrackingData {
  const clean = (s: string) => s.replace(BRAND_WORDS, "").replace(/\s{2,}/g, " ").trim();
  return {
    ...data,
    awb: data.falcoCode,
    currentStatus: clean(data.currentStatus),
    steps: data.steps.map((s) => ({ ...s, title: clean(s.title) })),
    lastMileWebsite: "",
    contactInformation: "",
    ksnPostUrl: "",
  };
}
