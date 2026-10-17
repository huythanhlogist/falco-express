import { NextResponse } from "next/server";
import {
  findOrderByFalcoCode,
  findSentBillPostcodes,
  getTrackingCache,
  listOrderParcels,
  type OrderRecord,
} from "@/lib/db";
import { fetchKangoTracking } from "@/lib/kango";
import { getRouteEtas, routeKeyOf } from "@/lib/route-eta";
import {
  buildTrackingData,
  isTrackingCacheFresh,
  parseCachedKango,
  saveKangoToCache,
  type PublicTrackingData,
} from "@/lib/tracking-cache";
import {
  clientIp,
  isVerifyBlocked,
  maskName,
  postcodeMatches,
  recordVerifyFailure,
} from "@/lib/tracking-privacy";

/** Lấy dữ liệu hành trình (cache → Kango → thông tin cơ bản), giữ nguyên logic cũ. */
async function loadTracking(order: OrderRecord): Promise<PublicTrackingData> {
  // Đọc từ DB trước — cron mỗi ngày đã làm mới trạng thái từ Kango, nên
  // hầu hết lượt tra trả về tức thì thay vì chờ Kango (có lúc treo 20s+).
  const cached = await getTrackingCache(order.id, order.awb).catch((err) => {
    console.error("[tracking] Không đọc được cache:", err);
    return null;
  });
  if (cached && isTrackingCacheFresh(cached)) {
    return buildTrackingData(order, parseCachedKango(cached));
  }

  let kango;
  try {
    kango = await fetchKangoTracking(order.awb);
  } catch (kangoErr) {
    // Đơn có thật trong hệ thống Falco — nếu chỉ riêng đối tác Kango
    // đang chậm/lỗi, vẫn trả về dữ liệu cũ trong cache (nếu có) hoặc thông
    // tin cơ bản thay vì báo lỗi trắng, để khách không hiểu nhầm là mã
    // tra cứu sai.
    console.error("[tracking] Kango lỗi, dùng cache cũ/thông tin cơ bản:", kangoErr);
    return buildTrackingData(order, cached ? parseCachedKango(cached) : null);
  }

  if (kango) {
    // Ghi ngược vào cache để các lượt tra sau (và cột trạng thái ở admin)
    // nhanh, kể cả với đơn mới chưa tới lượt cron.
    await saveKangoToCache(order, kango).catch((err) =>
      console.error("[tracking] Không ghi được cache:", err)
    );
  }
  return buildTrackingData(order, kango);
}

/** Các postcode hợp lệ của người nhận: cột trên đơn + bill Kango đã gửi khớp đơn. */
async function postcodeCandidates(order: OrderRecord): Promise<string[]> {
  const list: string[] = [];
  if (order.recipient_postcode) list.push(order.recipient_postcode);
  try {
    const parcels = await listOrderParcels(order.id);
    list.push(...(await findSentBillPostcodes(order.awb, parcels.map((p) => p.hawb))));
  } catch (err) {
    console.error("[tracking] Không đọc được postcode từ bill:", err);
  }
  return list.filter((p) => p && p.trim());
}

async function finalize(
  data: PublicTrackingData,
  opts: { verified: boolean; canVerify: boolean }
): Promise<PublicTrackingData> {
  const etas = await getRouteEtas();
  return {
    ...data,
    recipientName: opts.verified ? data.recipientName : maskName(data.recipientName),
    recipientVerified: opts.verified,
    canVerifyRecipient: opts.canVerify,
    routeEta: etas[routeKeyOf(data.destination)] ?? null,
  };
}

const SERVER_ERROR = { error: "Không thể tra cứu lúc này, vui lòng thử lại sau." };

/** Tra cứu công khai — tên người nhận luôn bị che. */
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
    const [data, candidates] = await Promise.all([loadTracking(order), postcodeCandidates(order)]);
    return NextResponse.json({
      found: true,
      data: await finalize(data, { verified: false, canVerify: candidates.length > 0 }),
    });
  } catch (err) {
    console.error("[tracking] Lỗi tra cứu:", err);
    return NextResponse.json(SERVER_ERROR, { status: 500 });
  }
}

/**
 * Xác minh người nhận bằng postcode: body { code, postcode }. Đúng → trả dữ
 * liệu kèm tên đầy đủ. Sai → 401; sai quá nhiều lần → 429 (xem tracking-privacy).
 * Dùng POST để postcode không nằm trên URL/log truy cập.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const code = String(body?.code ?? "").trim();
  const postcode = String(body?.postcode ?? "").trim();
  if (!code || !postcode) {
    return NextResponse.json({ error: "Thiếu mã vận đơn hoặc mã bưu chính" }, { status: 400 });
  }

  const ip = clientIp(request);
  const codeKey = code.toUpperCase();
  if (isVerifyBlocked(ip, codeKey)) {
    return NextResponse.json(
      { error: "Bạn đã nhập sai quá nhiều lần. Vui lòng thử lại sau 15 phút hoặc liên hệ Falco để được hỗ trợ." },
      { status: 429 }
    );
  }

  try {
    const order = await findOrderByFalcoCode(code);
    if (!order) {
      recordVerifyFailure(ip, codeKey);
      return NextResponse.json({ error: "Mã bưu chính không khớp với đơn hàng này." }, { status: 401 });
    }
    const candidates = await postcodeCandidates(order);
    if (!postcodeMatches(postcode, candidates)) {
      recordVerifyFailure(ip, codeKey);
      return NextResponse.json({ error: "Mã bưu chính không khớp với đơn hàng này." }, { status: 401 });
    }
    const data = await loadTracking(order);
    return NextResponse.json({
      found: true,
      data: await finalize(data, { verified: true, canVerify: true }),
    });
  } catch (err) {
    console.error("[tracking] Lỗi xác minh:", err);
    return NextResponse.json(SERVER_ERROR, { status: 500 });
  }
}
