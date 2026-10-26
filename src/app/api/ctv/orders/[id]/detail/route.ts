import { NextResponse } from "next/server";
import { getCurrentCtvSession } from "@/lib/ctv-auth";
import { findOrderById } from "@/lib/db";
import { bay, BayApiError } from "@/lib/bay-api";
import { bayTrackingToKango } from "@/lib/bay-tracking";
import { saveKangoToCache } from "@/lib/tracking-cache";
import { isBayOrderCode } from "@/lib/bay-sync";
import { shipmentStatusLabel } from "@/lib/shipment-status";

export const dynamic = "force-dynamic";

// Chi tiết kiện hàng (người nhận, cân nặng, kích thước, hàng hoá, hành trình, ảnh) cho đơn FEB… của FWD.
// Chỉ trả cho đơn thuộc đúng FWD đang đăng nhập; không lộ mã nguồn đối tác hay địa chỉ ảnh gốc.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getCurrentCtvSession();
  if (!session) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const { id } = await params;
  const order = await findOrderById(Number(id));
  if (!order || order.ctv_id !== session.ctvId) {
    return NextResponse.json({ error: "Không tìm thấy đơn hàng" }, { status: 404 });
  }
  if (!isBayOrderCode(order.falco_code)) {
    return NextResponse.json({ error: "Đơn này không có thông tin chi tiết kiện hàng" }, { status: 404 });
  }

  try {
    const [t, s] = await Promise.all([bay.getTracking(order.awb), bay.getShipment(order.awb)]);
    const { kango, status } = bayTrackingToKango(t, s);
    await saveKangoToCache(order, kango, status).catch(() => {});
    const a = s.recipient.address;
    return NextResponse.json({
      code: order.falco_code,
      status: shipmentStatusLabel(status),
      service: kango.additional_notes?.service ?? order.service,
      recipient: {
        name: s.recipient.name,
        company: s.recipient.company,
        phone: s.recipient.phone,
        email: s.recipient.email,
        address: [a.line1, a.houseNumber, a.line2, a.line3, a.postalCode, a.city, a.state, a.countryCode].filter(Boolean).join(", "),
      },
      parcel: {
        weightKg: s.parcel.weightKg,
        dimensionsCm: s.parcel.dimensionsCm,
        volumetricWeightKg: s.parcel.volumetricWeightKg,
      },
      items: s.items,
      carrier: { name: kango.additional_notes?.last_mile ?? "", trackingNumber: kango.package_tracking_code, trackingUrl: kango.tracking_url },
      timeline: kango.trackings,
      photos: (kango.falco_photos ?? []).map((p, i) => ({
        label: p.label,
        time: p.time,
        url: `/api/ctv/orders/${order.id}/photo?n=${i}`,
      })),
    });
  } catch (err) {
    const msg = err instanceof BayApiError && err.status === 404 ? "Chưa có dữ liệu kiện hàng" : "Không tải được chi tiết, thử lại sau";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
