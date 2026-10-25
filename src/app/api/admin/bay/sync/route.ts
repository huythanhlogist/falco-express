import { NextResponse } from "next/server";
import { getCurrentAdminSession } from "@/lib/auth";
import { BayApiError, isBayConfigured } from "@/lib/bay-api";
import { findOrderByAwb } from "@/lib/db";
import { syncBayShipments } from "@/lib/bay-sync";

export const dynamic = "force-dynamic";

// Đồng bộ vận đơn BayOnline → đơn Falco mã FEB… (idempotent, chạy lại không sinh trùng).
export async function POST(request: Request) {
  const session = await getCurrentAdminSession();
  if (!session) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  if (!isBayConfigured()) {
    return NextResponse.json({ error: "Chưa cấu hình BAY_API_KEY" }, { status: 503 });
  }
  try {
    const force = new URL(request.url).searchParams.get("force") === "1";
    return NextResponse.json(await syncBayShipments(20, force));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Đồng bộ thất bại";
    console.error("[bay/sync] Lỗi:", err);
    return NextResponse.json({ error: message }, { status: err instanceof BayApiError ? err.status : 500 });
  }
}

// GET ?refs=2410-0887,C2410-0070 → { "2410-0887": "FEB261024001", ... } (mã FEB đã có của các vận đơn Bay).
export async function GET(request: Request) {
  const session = await getCurrentAdminSession();
  if (!session) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  const refs = (new URL(request.url).searchParams.get("refs") ?? "").split(",").map((r) => r.trim()).filter(Boolean).slice(0, 100);
  const map: Record<string, string> = {};
  for (const ref of refs) {
    const order = await findOrderByAwb(ref);
    if (order) map[ref] = order.falco_code;
  }
  return NextResponse.json(map);
}
