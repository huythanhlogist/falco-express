export type KangoTrackingEvent = {
  time: string;
  location: string | null;
  title: string;
};

export type KangoOrderNumber = {
  package_hawb_code: string;
  package_tracking_code: string;
  is_current: boolean;
  status_class: string;
  status: string;
  is_returned: boolean;
  tracking_url: string | null;
};

export type KangoTrackingResponse = {
  status: number;
  message: string;
  package_code: string;
  package_tracking_code: string;
  carrier_code: string;
  tracking_url: string | null;
  trackings: KangoTrackingEvent[];
  shipment_information: {
    order_numbers: KangoOrderNumber[];
    country: string;
  };
  additional_notes: {
    service: string;
    country: string;
    total_package: number;
    last_mile: string;
    last_mile_website: string;
    contact_information: string;
  };
};

/**
 * Gọi API tra cứu vận đơn chính thức của Kango. Trả về `null` nếu Kango
 * không tìm thấy mã (thay vì ném lỗi), để API route phân biệt được
 * "không tìm thấy" với "lỗi kết nối/cấu hình".
 */
export async function fetchKangoTracking(
  code: string
): Promise<KangoTrackingResponse | null> {
  const apiKey = process.env.KANGO_API_KEY;
  const apiUrl = process.env.KANGO_API_URL;
  if (!apiKey || !apiUrl) {
    throw new Error("Thiếu KANGO_API_KEY hoặc KANGO_API_URL");
  }

  const res = await fetch(
    `${apiUrl}?code=${encodeURIComponent(code.trim())}`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "api-key": apiKey,
      },
      // Cache kết quả 90 giây (Next.js Data Cache) — hành trình vận đơn
      // không đổi liên tục theo giây, nhưng khách hay bấm tra cứu lại
      // hoặc nhiều người cùng tra 1 mã trong thời gian ngắn. Cache giúp
      // các lượt lặp lại đó trả về gần như tức thì thay vì luôn phải chờ
      // trọn vòng gọi sang API Kango (nguồn gây delay đã quan sát được).
      next: { revalidate: 90 },
      // Giới hạn thời gian chờ để 1 request chậm không treo cả trang.
      signal: AbortSignal.timeout(8000),
    }
  );

  if (!res.ok) {
    if (res.status === 404) return null;
    throw new Error(`Kango API trả về lỗi HTTP ${res.status}`);
  }

  const data = (await res.json()) as KangoTrackingResponse;
  if (data.status !== 200) return null;

  return data;
}
