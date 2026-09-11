import { NextResponse } from "next/server";
import { getCurrentCtvSession } from "@/lib/ctv-auth";
import { listOrders } from "@/lib/db";
import { createManualOrder } from "@/lib/order-create";

export async function GET() {
  const session = await getCurrentCtvSession();
  if (!session) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const { orders } = await listOrders({
    search: "",
    limit: 200,
    offset: 0,
    ctvId: session.ctvId,
  });
  return NextResponse.json({ orders });
}

export async function POST(request: Request) {
  const session = await getCurrentCtvSession();
  if (!session) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const { recipientName, recipientPhone, service, destination, receivedDate, weightKg, amount } =
    await request.json();

  if (!recipientName || typeof recipientName !== "string" || !recipientName.trim()) {
    return NextResponse.json({ error: "Vui lòng nhập tên người nhận" }, { status: 400 });
  }
  if (!recipientPhone || typeof recipientPhone !== "string" || !recipientPhone.trim()) {
    return NextResponse.json({ error: "Vui lòng nhập số điện thoại người nhận" }, { status: 400 });
  }
  if (!destination || typeof destination !== "string" || !destination.trim()) {
    return NextResponse.json({ error: "Vui lòng nhập điểm đến" }, { status: 400 });
  }

  const { id, falcoCode } = await createManualOrder(
    {
      recipientName,
      recipientPhone,
      service: typeof service === "string" ? service : "",
      destination,
      receivedDate: receivedDate || null,
      weightKg: Number.isFinite(weightKg) ? Number(weightKg) : null,
      amount: Number.isFinite(amount) ? Number(amount) : null,
    },
    { source: "ctv", ctvId: session.ctvId }
  );

  return NextResponse.json({ ok: true, id, falcoCode });
}
