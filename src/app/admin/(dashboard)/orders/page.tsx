import Link from "next/link";
import { listOrders, listOrderMonths } from "@/lib/db";
import ThuStatusSelect from "@/components/admin/ThuStatusSelect";
import OrderRowActions from "@/components/admin/OrderRowActions";
import MonthFilterSelect from "@/components/admin/MonthFilterSelect";
import CopyOrderInfoButton from "@/components/admin/CopyOrderInfoButton";
import OrderEditHistory from "@/components/admin/OrderEditHistory";
import { PackageCheckIcon, ClockIcon, CargoIcon } from "@/components/icons";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

const STATUS_TABS: { value: "all" | "unpaid" | "collected_by_staff" | "paid"; label: string }[] = [
  { value: "all", label: "Tất cả" },
  { value: "unpaid", label: "Chưa thu" },
  { value: "collected_by_staff", label: "Thu hộ" },
  { value: "paid", label: "Đã thu" },
];

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string; status?: string; month?: string }>;
}) {
  const params = await searchParams;
  const search = params.q || "";
  const page = Math.max(1, Number(params.page) || 1);
  const status: "all" | "unpaid" | "collected_by_staff" | "paid" =
    params.status === "unpaid" || params.status === "collected_by_staff" || params.status === "paid"
      ? params.status
      : "all";
  const month = params.month || "";

  const [{ orders, total, paidCount, collectedByStaffCount, unpaidCount }, months] =
    await Promise.all([
      listOrders({
        search,
        status,
        month: month || undefined,
        limit: PAGE_SIZE,
        offset: (page - 1) * PAGE_SIZE,
      }),
      listOrderMonths(),
    ]);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const tabCounts: Record<"all" | "unpaid" | "collected_by_staff" | "paid", number> = {
    all: paidCount + collectedByStaffCount + unpaidCount,
    unpaid: unpaidCount,
    collected_by_staff: collectedByStaffCount,
    paid: paidCount,
  };

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-xl font-bold text-navy-900">Đơn hàng</h1>
          <p className="mt-0.5 text-sm text-ink/55">Quản lý và theo dõi toàn bộ đơn hàng</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <MonthFilterSelect months={months} />
          <form className="flex gap-2">
            {status !== "all" && <input type="hidden" name="status" value={status} />}
            {month && <input type="hidden" name="month" value={month} />}
            <input
              type="text"
              name="q"
              defaultValue={search}
              placeholder="Tìm mã Falco, AWB, tên, SĐT..."
              className="w-52 rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink focus:border-flame-400 focus:outline-none focus:ring-2 focus:ring-flame-100 sm:w-60"
            />
            <button type="submit" className="btn-outline !px-3.5 !py-2 text-sm">
              Tìm
            </button>
          </form>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
        <div className="flex items-center gap-2.5 rounded-xl border border-line bg-white px-3.5 py-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-navy-50 text-navy-700">
            <CargoIcon className="h-4 w-4" />
          </span>
          <div>
            <p className="text-xs text-ink/45">Tổng đơn hàng</p>
            <p className="font-display text-base font-bold text-navy-900">
              {paidCount + collectedByStaffCount + unpaidCount}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2.5 rounded-xl border border-line bg-white px-3.5 py-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-flame-50 text-flame-700">
            <ClockIcon className="h-4 w-4" />
          </span>
          <div>
            <p className="text-xs text-ink/45">Chưa thu</p>
            <p className="font-display text-base font-bold text-navy-900">{unpaidCount}</p>
          </div>
        </div>
        <div className="flex items-center gap-2.5 rounded-xl border border-line bg-white px-3.5 py-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
            <PackageCheckIcon className="h-4 w-4" />
          </span>
          <div>
            <p className="text-xs text-ink/45">Đã thu (kể cả thu hộ)</p>
            <p className="font-display text-base font-bold text-navy-900">
              {paidCount + collectedByStaffCount}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-4 flex gap-2 overflow-x-auto">
        {STATUS_TABS.map((tab) => (
          <Link
            key={tab.value}
            href={`/admin/orders?${new URLSearchParams({
              ...(search ? { q: search } : {}),
              ...(month ? { month } : {}),
              ...(tab.value !== "all" ? { status: tab.value } : {}),
            })}`}
            className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors ${
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

      <div className="mt-3 overflow-x-auto rounded-xl border border-line bg-white">
        <table className="w-full min-w-[1120px] text-sm">
          <thead>
            <tr className="border-b border-line bg-mist/60 text-left text-xs font-semibold uppercase tracking-wide text-ink/45">
              <th className="px-3 py-2">Mã Falco</th>
              <th className="px-3 py-2">AWB</th>
              <th className="px-3 py-2">Người nhận</th>
              <th className="px-3 py-2">Điện thoại</th>
              <th className="px-3 py-2">Điểm đến</th>
              <th className="px-3 py-2">Kiện</th>
              <th className="px-3 py-2">Ngày nhận</th>
              <th className="px-3 py-2">Trạng thái thu</th>
              <th className="px-3 py-2" />
              <th className="px-3 py-2">Gửi khách</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => {
              const copyText = `${o.falco_code} - ${o.recipient_name ?? ""} - ${o.tracking_codes ?? ""}`;
              return (
                <tr key={o.id} className="border-b border-line last:border-0 hover:bg-mist/40">
                  <td className="px-3 py-2 font-semibold text-navy-900">{o.falco_code}</td>
                  <td className="px-3 py-2 text-ink/70">{o.awb}</td>
                  <td className="px-3 py-2 text-ink/70">{o.recipient_name || "—"}</td>
                  <td className="px-3 py-2 text-ink/70">{o.recipient_phone || "—"}</td>
                  <td className="px-3 py-2 text-ink/70">{o.destination || "—"}</td>
                  <td className="px-3 py-2 text-ink/70">{o.parcel_count}</td>
                  <td className="px-3 py-2 text-ink/70">
                    {o.received_date
                      ? new Date(o.received_date).toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })
                      : "—"}
                  </td>
                  <td className="px-3 py-2">
                    <ThuStatusSelect orderId={o.id} initialStatus={o.payment_status} />
                  </td>
                  <td className="px-3 py-2">
                    <OrderRowActions orderId={o.id} falcoCode={o.falco_code} />
                  </td>
                  <td className="px-3 py-2">
                    <CopyOrderInfoButton text={copyText} />
                  </td>
                </tr>
              );
            })}
            {orders.length === 0 && (
              <tr>
                <td colSpan={10} className="px-5 py-10 text-center text-ink/45">
                  Không tìm thấy đơn hàng nào.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-2">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <Link
              key={p}
              href={`/admin/orders?${new URLSearchParams({
                ...(search ? { q: search } : {}),
                ...(month ? { month } : {}),
                ...(status !== "all" ? { status } : {}),
                page: String(p),
              })}`}
              className={`flex h-7 w-7 items-center justify-center rounded-full text-sm font-medium ${
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

      <OrderEditHistory />
    </div>
  );
}
