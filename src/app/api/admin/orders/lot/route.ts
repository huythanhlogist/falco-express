import { NextResponse } from "next/server";
import { listOrdersByLot } from "@/lib/shipment-notify";

// GET ?date=YYYY-MM-DD → các đơn thuộc lô rời kho VN ngày đó + đã thông quan chưa (chỉ đọc).
export async function GET(request: Request) {
  const date = new URL(request.url).searchParams.get("date") ?? "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "Thiếu hoặc sai date (YYYY-MM-DD)" }, { status: 400 });
  }
  try {
    return NextResponse.json(await listOrdersByLot(date));
  } catch (err) {
    console.error("[orders/lot]", err);
    return NextResponse.json({ error: "Không tra được lô" }, { status: 500 });
  }
}
