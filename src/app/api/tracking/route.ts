import { NextResponse } from "next/server";
import { findOrderByFalcoCode, getTrackingCache } from "@/lib/db";
import {
  buildTrackingData,
  fetchTrackingFor,
  isTrackingCacheFresh,
  parseCachedKango,
  saveKangoToCache,
} from "@/lib/tracking-cache";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code") || "";

  if (!code.trim()) {
    return NextResponse.json({ error: "Thiếu mã vận đơn" }, { status: 400 });
  }

  try {
    const order = await findOrderByFalcoCode(code);
    if (!order) {
      return NextResponse.json({ found: false, data: null });
    }

    // Đọc từ DB trước — cron mỗi ngày đã làm mới trạng thái từ Kango, nên
    // hầu hết lượt tra trả về tức thì thay vì chờ Kango (có lúc treo 20s+).
    const cached = await getTrackingCache(order.id, order.awb).catch((err) => {
      console.error("[tracking] Không đọc được cache:", err);
      return null;
    });
    // Bản cache của đơn FEB… tạo bởi phiên bản cũ (chưa có danh sách ảnh/tên chuẩn hoá) thì làm mới ngay.
    const cachedKango = cached ? parseCachedKango(cached) : null;
    const staleFormat = order.falco_code.toUpperCase().startsWith("FEB") && !!cachedKango && !cachedKango.falco_photos;
    if (cached && isTrackingCacheFresh(cached) && !staleFormat) {
      return NextResponse.json({
        found: true,
        data: buildTrackingData(order, parseCachedKango(cached)),
      });
    }

    let kango;
    let bayStatus;
    try {
      ({ kango, status: bayStatus } = await fetchTrackingFor(order));
    } catch (kangoErr) {
      // Đơn có thật trong hệ thống Falco — nếu chỉ riêng đối tác Kango
      // đang chậm/lỗi (đã quan sát thực tế: Kango thỉnh thoảng treo
      // request), vẫn nên trả về dữ liệu cũ trong cache (nếu có) hoặc thông
      // tin cơ bản thay vì báo lỗi trắng, để khách không hiểu nhầm là mã
      // tra cứu sai.
      console.error("[tracking] Kango lỗi, dùng cache cũ/thông tin cơ bản:", kangoErr);
      return NextResponse.json({
        found: true,
        data: buildTrackingData(order, cached ? parseCachedKango(cached) : null),
      });
    }

    if (kango) {
      // Ghi ngược vào cache để các lượt tra sau (và cột trạng thái ở admin)
      // nhanh, kể cả với đơn mới chưa tới lượt cron.
      await saveKangoToCache(order, kango, bayStatus).catch((err) =>
        console.error("[tracking] Không ghi được cache:", err)
      );
    }

    return NextResponse.json({ found: true, data: buildTrackingData(order, kango) });
  } catch (err) {
    console.error("[tracking] Lỗi tra cứu:", err);
    return NextResponse.json(
      { error: "Không thể tra cứu lúc này, vui lòng thử lại sau." },
      { status: 500 }
    );
  }
}
