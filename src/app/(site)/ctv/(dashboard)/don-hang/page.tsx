import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentCtvSession } from "@/lib/ctv-auth";
import { getTrackingSiteByCtv, listCtvOrders } from "@/lib/ctv-portal";
import { SHIPMENT_STATUS_OPTIONS, shipmentStatusClassName, shipmentStatusLabel } from "@/lib/shipment-status";
import { reviewStatusClassName, reviewStatusLabel } from "@/lib/review-status";

export const dynamic = "force-dynamic";
const PAGE_SIZE = 20;

const STATUS_FILTERS = [
  { value: "all", label: "Tất cả" },
  { value: "received", label: "Đã nhận" },
  { value: "exported", label: "Đã xuất" },
  { value: "customs_processing", label: "Đang thông quan" },
  { value: "customs_released", label: "Đã thông quan" },
  { value: "last_mile", label: "Đang giao" },
  { value: "delivered", label: "Đã giao" },
  { value: "returned", label: "Hoàn trả" },
  { value: "pending", label: "Chờ duyệt" },
];

const money = (v: string | null) => (v ? `${Number(v).toLocaleString("vi-VN")}đ` : "—");

export default async function CtvOrdersPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; page?: string }> }) {
  const session = await getCurrentCtvSession();
  if (!session) redirect("/ctv/login");
  const sp = await searchParams;
  const search = sp.q ?? "";
  const status = STATUS_FILTERS.some((f) => f.value === sp.status) ? (sp.status as string) : "all";
  const page = Math.max(1, Number(sp.page) || 1);

  const [{ orders, total }, site] = await Promise.all([
    listCtvOrders(session.ctvId, { search, status, limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE }),
    getTrackingSiteByCtv(session.ctvId),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const qs = (extra: Record<string, string>) => new URLSearchParams({ ...(search ? { q: search } : {}), ...(status !== "all" ? { status } : {}), ...extra }).toString();
  void SHIPMENT_STATUS_OPTIONS;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold text-navy-900 sm:text-2xl">Đơn hàng</h1>
          <p className="mt-1 text-sm text-ink/55">Đơn bạn tạo và đơn được Falco gán cho bạn — {total} đơn</p>
        </div>
        <Link href="/ctv/tao-don" className="btn-primary !px-4 !py-2 text-sm">
          + Tạo đơn mới
        </Link>
      </div>

      <form className="mt-4 flex flex-wrap gap-2">
        {status !== "all" && <input type="hidden" name="status" value={status} />}
        <input name="q" defaultValue={search} placeholder="Tìm mã đơn, tên, SĐT, mã tracking…" className="w-64 rounded-lg border border-line bg-white px-3 py-2 text-sm" />
        <button type="submit" className="btn-outline !px-3.5 !py-2 text-sm">Tìm</button>
      </form>

      <div className="mt-3 flex gap-2 overflow-x-auto">
        {STATUS_FILTERS.map((f) => (
          <Link
            key={f.value}
            href={`/ctv/don-hang?${new URLSearchParams({ ...(search ? { q: search } : {}), ...(f.value !== "all" ? { status: f.value } : {}) })}`}
            className={`shrink-0 whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-semibold ${status === f.value ? "bg-navy-800 text-white" : "bg-white text-ink/60 hover:bg-line"}`}
          >
            {f.label}
          </Link>
        ))}
      </div>

      <div className="mt-4 overflow-x-auto rounded-xl border border-line bg-white">
        <table className="w-full min-w-[980px] text-sm">
          <thead>
            <tr className="border-b border-line bg-mist/60 text-left text-xs font-semibold uppercase tracking-wide text-ink/45">
              <th className="px-3 py-2">Mã đơn</th>
              <th className="px-3 py-2">Người nhận</th>
              <th className="px-3 py-2">SĐT</th>
              <th className="px-3 py-2">Điểm đến</th>
              <th className="px-3 py-2">Ngày</th>
              <th className="px-3 py-2">Cân (kg)</th>
              <th className="px-3 py-2">Tiền thu</th>
              <th className="px-3 py-2">Vận chuyển</th>
              <th className="px-3 py-2">Tracking</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id} className="border-b border-line last:border-0 hover:bg-mist/40">
                <td className="px-3 py-2 font-semibold text-navy-900">
                  {o.falco_code}
                  {o.review_status !== "approved" && o.review_status !== "auto_approved" && (
                    <span className={`ml-2 rounded-full px-2 py-0.5 text-xs font-bold ${reviewStatusClassName(o.review_status)}`}>{reviewStatusLabel(o.review_status)}</span>
                  )}
                </td>
                <td className="px-3 py-2 text-ink/70">{o.recipient_name || "—"}</td>
                <td className="px-3 py-2 text-ink/70">{o.recipient_phone || "—"}</td>
                <td className="px-3 py-2 text-ink/70">{o.destination || "—"}</td>
                <td className="px-3 py-2 text-ink/70">{o.received_date ? new Date(o.received_date).toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" }) : "—"}</td>
                <td className="px-3 py-2 text-ink/70">{o.weight_kg ?? "—"}</td>
                <td className="px-3 py-2 text-ink/70">{money(o.amount)}</td>
                <td className="px-3 py-2">
                  {o.shipment_status ? (
                    <span title={o.shipment_current ?? ""} className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-bold ${shipmentStatusClassName(o.shipment_status)}`}>
                      {shipmentStatusLabel(o.shipment_status)}
                    </span>
                  ) : (
                    <span className="text-ink/30">—</span>
                  )}
                </td>
                <td className="px-3 py-2">
                  {site?.enabled ? (
                    <a href={`/t/${site.slug}?code=${encodeURIComponent(o.falco_code)}`} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-navy-800 underline">
                      Xem tra cứu
                    </a>
                  ) : (
                    <span className="text-xs text-ink/35">Bật Tracking Site</span>
                  )}
                </td>
              </tr>
            ))}
            {orders.length === 0 && (
              <tr>
                <td colSpan={9} className="px-5 py-10 text-center text-ink/45">Chưa có đơn nào.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <div className="mt-4 flex justify-center gap-2">
          {Array.from({ length: pages }, (_, i) => i + 1).map((p) => (
            <Link key={p} href={`/ctv/don-hang?${qs({ page: String(p) })}`} className={`flex h-7 w-7 items-center justify-center rounded-full text-sm font-medium ${p === page ? "bg-navy-800 text-white" : "text-ink/60 hover:bg-line"}`}>
              {p}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
