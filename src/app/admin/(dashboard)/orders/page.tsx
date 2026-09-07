import Link from "next/link";
import { listOrders } from "@/lib/db";
import PaymentToggle from "@/components/admin/PaymentToggle";
import {
  classifyShipmentStage,
  fetchKangoTracking,
  shipmentStageLabel,
  type ShipmentStage,
} from "@/lib/kango";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

const STAGE_BADGE_CLASS: Record<ShipmentStage, string> = {
  delivered: "bg-emerald-50 text-emerald-700",
  customs_cleared: "bg-sky-50 text-sky-700",
  in_transit: "bg-flame-50 text-flame-700",
};

// Cache trạng thái Kango trong bộ nhớ tiến trình Node — trang admin trước
// đây gọi Kango cho cả 20 đơn trên MỖI lần tải trang (kể cả khi chỉ chuyển
// trang/tìm kiếm lại đơn cũ), gây trang bị lag và một số đơn timeout thành
// "Chưa cập nhật" khi 20 request chạy song song. Cache theo AWB trong vài
// phút giúp các lần tải sau gần như tức thì; lỗi/timeout được cache ngắn
// hơn để tự thử lại sớm thay vì lỗi cố định.
const STAGE_CACHE_TTL_MS = 3 * 60 * 1000;
const STAGE_ERROR_CACHE_TTL_MS = 20 * 1000;
const stageCache = new Map<string, { stage: ShipmentStage | null; expiresAt: number }>();

async function fetchStage(awb: string): Promise<ShipmentStage | null> {
  const cached = stageCache.get(awb);
  if (cached && cached.expiresAt > Date.now()) return cached.stage;

  try {
    const kango = await fetchKangoTracking(awb);
    const stage = kango ? classifyShipmentStage(kango.trackings[0]?.title) : null;
    stageCache.set(awb, { stage, expiresAt: Date.now() + STAGE_CACHE_TTL_MS });
    return stage;
  } catch {
    stageCache.set(awb, { stage: null, expiresAt: Date.now() + STAGE_ERROR_CACHE_TTL_MS });
    return null;
  }
}

const STATUS_TABS: { value: "all" | "paid" | "unpaid"; label: string }[] = [
  { value: "all", label: "Tất cả" },
  { value: "unpaid", label: "Chưa thanh toán" },
  { value: "paid", label: "Đã thanh toán" },
];

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string; status?: string }>;
}) {
  const params = await searchParams;
  const search = params.q || "";
  const page = Math.max(1, Number(params.page) || 1);
  const status: "all" | "paid" | "unpaid" =
    params.status === "paid" || params.status === "unpaid" ? params.status : "all";

  const { orders, total, paidCount, unpaidCount } = await listOrders({
    search,
    status,
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
  });
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const tabCounts: Record<"all" | "paid" | "unpaid", number> = {
    all: paidCount + unpaidCount,
    paid: paidCount,
    unpaid: unpaidCount,
  };

  // Chỉ gọi Kango cho các đơn đang hiển thị trên trang hiện tại (tối đa
  // PAGE_SIZE) — không gọi cho toàn bộ đơn hàng để tránh trang admin bị
  // chậm khi số lượng đơn lớn.
  const stages = await Promise.all(orders.map((o) => fetchStage(o.awb)));

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-navy-900">Đơn hàng</h1>
          <p className="mt-1 text-sm text-ink/55">{total} đơn hàng</p>
        </div>
        <form className="flex gap-2">
          {status !== "all" && <input type="hidden" name="status" value={status} />}
          <input
            type="text"
            name="q"
            defaultValue={search}
            placeholder="Tìm mã Falco, AWB, tên, SĐT..."
            className="w-64 rounded-full border border-line bg-white px-4 py-2 text-sm text-ink focus:border-flame-400"
          />
          <button type="submit" className="btn-outline">
            Tìm
          </button>
        </form>
      </div>

      <div className="mt-5 flex gap-2">
        {STATUS_TABS.map((tab) => (
          <Link
            key={tab.value}
            href={`/admin/orders?${new URLSearchParams({
              ...(search ? { q: search } : {}),
              ...(tab.value !== "all" ? { status: tab.value } : {}),
            })}`}
            className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
              status === tab.value
                ? "bg-navy-800 text-white"
                : "bg-mist text-ink/60 hover:bg-line"
            }`}
          >
            {tab.label}
            <span
              className={`rounded-full px-1.5 text-xs ${
                status === tab.value ? "bg-white/20" : "bg-white text-ink/45"
              }`}
            >
              {tabCounts[tab.value]}
            </span>
          </Link>
        ))}
      </div>

      <div className="mt-4 overflow-x-auto rounded-2xl border border-line bg-white">
        <table className="w-full min-w-[960px] text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs font-semibold uppercase tracking-wide text-ink/45">
              <th className="px-5 py-3">Mã Falco</th>
              <th className="px-5 py-3">AWB</th>
              <th className="px-5 py-3">Người nhận</th>
              <th className="px-5 py-3">Điện thoại</th>
              <th className="px-5 py-3">Điểm đến</th>
              <th className="px-5 py-3">Kiện</th>
              <th className="px-5 py-3">Ngày nhận</th>
              <th className="px-5 py-3">Trạng thái</th>
              <th className="px-5 py-3">Thanh toán</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o, i) => {
              const stage = stages[i];
              return (
                <tr key={o.id} className="border-b border-line last:border-0">
                  <td className="px-5 py-3 font-semibold text-navy-900">{o.falco_code}</td>
                  <td className="px-5 py-3 text-ink/70">{o.awb}</td>
                  <td className="px-5 py-3 text-ink/70">{o.recipient_name || "—"}</td>
                  <td className="px-5 py-3 text-ink/70">{o.recipient_phone || "—"}</td>
                  <td className="px-5 py-3 text-ink/70">{o.destination || "—"}</td>
                  <td className="px-5 py-3 text-ink/70">{o.parcel_count}</td>
                  <td className="px-5 py-3 text-ink/70">
                    {o.received_date
                      ? new Date(o.received_date).toLocaleDateString("vi-VN")
                      : "—"}
                  </td>
                  <td className="px-5 py-3">
                    {stage ? (
                      <span
                        className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold ${STAGE_BADGE_CLASS[stage]}`}
                      >
                        {shipmentStageLabel(stage)}
                      </span>
                    ) : (
                      <span className="text-xs text-ink/40">Chưa cập nhật</span>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <PaymentToggle orderId={o.id} initialStatus={o.payment_status} />
                  </td>
                </tr>
              );
            })}
            {orders.length === 0 && (
              <tr>
                <td colSpan={9} className="px-5 py-10 text-center text-ink/45">
                  Không tìm thấy đơn hàng nào.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="mt-5 flex items-center justify-center gap-2">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <Link
              key={p}
              href={`/admin/orders?${new URLSearchParams({
                ...(search ? { q: search } : {}),
                ...(status !== "all" ? { status } : {}),
                page: String(p),
              })}`}
              className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${
                p === page
                  ? "bg-navy-800 text-white"
                  : "text-ink/60 hover:bg-mist"
              }`}
            >
              {p}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
