import { NextResponse } from "next/server";
import { findOrderByFalcoCode } from "@/lib/db";
import { fetchKangoTracking } from "@/lib/kango";

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

    const kango = await fetchKangoTracking(order.awb);
    if (!kango) {
      // Đơn có trong hệ thống Falco nhưng Kango chưa có dữ liệu (đơn quá
      // mới, chưa được quét lần đầu) — vẫn trả về thông tin cơ bản.
      return NextResponse.json({
        found: true,
        data: {
          falcoCode: order.falco_code,
          awb: order.awb,
          service: order.service || "",
          destination: order.destination || "",
          currentStatus: "Đã tiếp nhận, đang chờ cập nhật từ đối tác vận chuyển",
          steps: [],
          parcels: [],
          lastMileCarrier: "",
          lastMileWebsite: "",
          contactInformation: "",
          ksnPostUrl: `https://www.ksnpost.com/?code=${encodeURIComponent(order.awb)}`,
        },
      });
    }

    const currentParcel =
      kango.shipment_information.order_numbers.find((p) => p.is_current) ??
      kango.shipment_information.order_numbers[0];

    const data = {
      falcoCode: order.falco_code,
      awb: order.awb,
      service: kango.additional_notes.service || order.service || "",
      destination: kango.additional_notes.country || order.destination || "",
      currentStatus: currentParcel?.status || kango.trackings[0]?.title || "Chưa cập nhật",
      steps: kango.trackings.map((t) => ({
        title: t.title,
        time: t.time,
        location: t.location,
      })),
      parcels: kango.shipment_information.order_numbers.map((p) => ({
        hawb: p.package_hawb_code,
        trackingCode: p.package_tracking_code,
        status: p.status,
        trackingUrl: p.tracking_url,
      })),
      lastMileCarrier: kango.additional_notes.last_mile || "",
      lastMileWebsite: kango.additional_notes.last_mile_website || "",
      contactInformation: kango.additional_notes.contact_information || "",
      ksnPostUrl: `https://www.ksnpost.com/?code=${encodeURIComponent(order.awb)}`,
    };

    return NextResponse.json({ found: true, data });
  } catch (err) {
    console.error("[tracking] Lỗi tra cứu:", err);
    return NextResponse.json(
      { error: "Không thể tra cứu lúc này, vui lòng thử lại sau." },
      { status: 500 }
    );
  }
}
