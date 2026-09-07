import Link from "next/link";
import { listOrders } from "@/lib/db";
import PaymentToggle from "@/components/admin/PaymentToggle";
import { PackageCheckIcon, ClockIcon, CargoIcon } from "@/components/icons";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

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

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-xl font-bold text-navy-900 sm:text-2xl">
            Đơn hàng
          </h1>
          <p className="mt-1 text-sm text-ink/55">Quản lý và theo dõi toàn bộ đơn hàng</p>
        </div>
        <form className="flex gap-2">
          {status !== "all" && <input type="hidden" name="status" value={status} />}
          <input
            type="text"
            name="q"
            defaultValue={search}
            placeholder="Tìm mã Falco, AWB, tên, SĐT..."
            className="w-56 rounded-lg border border-line bg-white px-3.5 py-2 text-sm text-ink focus:border-flame-400 focus:outline-none focus:ring-2 focus:ring-flame-100 sm:w-64"
          />
          <button type="submit" className="btn-outline !px-4 !py-2 text-sm">
            Tìm
          </button>
        </form>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="flex items-center gap-3 rounded-xl border border-line bg-white px-4 py-3.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-navy-50 text-navy-700">
            <CargoIcon className="h-5 w-5" />
          </span>
          <div>
            <p className="text-xs text-ink/45">Tổng đơn hàng</p>
            <p className="font-display text-lg font-bold text-navy-900">
              {paidCount + unpaidCount}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-line bg-white px-4 py-3.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-flame-50 text-flame-700">
            <ClockIcon className="h-5 w-5" />
          </span>
          <div>
            <p className="text-xs text-ink/45">Chưa thanh toán</p>
            <p className="font-display text-lg font-bold text-navy-900">{unpaidCount}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-line bg-white px-4 py-3.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
            <PackageCheckIcon className="h-5 w-5" />
          </span>
          <div>
            <p className="text-xs text-ink/45">Đã thanh toán</p>
            <p className="font-display text-lg font-bold text-navy-900">{paidCount}</p>
          </div>
        </div>
      </div>

      <div className="mt-5 flex gap-2 overflow-x-auto">
        {STATUS_TABS.map((tab) => (
          <Link
            key={tab.value}
            href={`/admin/orders?${new URLSearchParams({
              ...(search ? { q: search } : {}),
              ...(tab.value !== "all" ? { status: tab.value } : {}),
            })}`}
            className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
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

      <div className="mt-4 overflow-x-auto rounded-xl border border-line bg-white">
        <table className="w-full min-w-[960px] text-sm">
          <thead>
            <tr className="border-b border-line bg-mist/60 text-left text-xs font-semibold uppercase tracking-wide text-ink/45">
              <th className="px-4 py-2.5">Mã Falco</th>
              <th className="px-4 py-2.5">AWB</th>
              <th className="px-4 py-2.5">Người nhận</th>
              <th className="px-4 py-2.5">Điện thoại</th>
              <th className="px-4 py-2.5">Điểm đến</th>
              <th className="px-4 py-2.5">Kiện</th>
              <th className="px-4 py-2.5">Ngày nhận</th>
              <th className="px-4 py-2.5">Thanh toán</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id} className="border-b border-line last:border-0 hover:bg-mist/40">
                <td className="px-4 py-2.5 font-semibold text-navy-900">{o.falco_code}</td>
                <td className="px-4 py-2.5 text-ink/70">{o.awb}</td>
                <td className="px-4 py-2.5 text-ink/70">{o.recipient_name || "—"}</td>
                <td className="px-4 py-2.5 text-ink/70">{o.recipient_phone || "—"}</td>
                <td className="px-4 py-2.5 text-ink/70">{o.destination || "—"}</td>
                <td className="px-4 py-2.5 text-ink/70">{o.parcel_count}</td>
                <td className="px-4 py-2.5 text-ink/70">
                  {o.received_date
                    ? new Date(o.received_date).toLocaleDateString("vi-VN")
                    : "—"}
                </td>
                <td className="px-4 py-2.5">
                  <PaymentToggle orderId={o.id} initialStatus={o.payment_status} />
                </td>
              </tr>
            ))}
            {orders.length === 0 && (
              <tr>
                <td colSpan={8} className="px-5 py-10 text-center text-ink/45">
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
