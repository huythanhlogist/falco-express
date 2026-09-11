import Link from "next/link";
import { listOrders, listOrderMonths } from "@/lib/db";
import MonthFilterSelect from "@/components/admin/MonthFilterSelect";
import OrdersTable from "@/components/admin/OrdersTable";
import OrderEditHistory from "@/components/admin/OrderEditHistory";
import CreateOrderButton from "@/components/admin/CreateOrderButton";
import { PackageCheckIcon, ClockIcon, CargoIcon } from "@/components/icons";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

const STATUS_TABS: { value: "all" | "unpaid" | "collected_by_staff" | "collected_by_ctv" | "paid"; label: string }[] = [
  { value: "all", label: "Tất cả" },
  { value: "unpaid", label: "Chưa thu" },
  { value: "collected_by_staff", label: "Thu hộ" },
  { value: "collected_by_ctv", label: "Thu hộ (CTV)" },
  { value: "paid", label: "Đã thu" },
];

const SOURCE_TABS: { value: "all" | "staff" | "ctv"; label: string }[] = [
  { value: "all", label: "Tất cả nguồn" },
  { value: "staff", label: "Của mình" },
  { value: "ctv", label: "Của CTV" },
];

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string; status?: string; month?: string; source?: string }>;
}) {
  const params = await searchParams;
  const search = params.q || "";
  const page = Math.max(1, Number(params.page) || 1);
  const status: "all" | "unpaid" | "collected_by_staff" | "collected_by_ctv" | "paid" =
    params.status === "unpaid" ||
    params.status === "collected_by_staff" ||
    params.status === "collected_by_ctv" ||
    params.status === "paid"
      ? params.status
      : "all";
  const source: "all" | "staff" | "ctv" =
    params.source === "staff" || params.source === "ctv" ? params.source : "all";
  const month = params.month || "";

  const [
    { orders, total, paidCount, collectedByStaffCount, collectedByCtvCount, unpaidCount, pendingReviewCount },
    months,
  ] = await Promise.all([
    listOrders({
      search,
      status,
      source,
      month: month || undefined,
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
    }),
    listOrderMonths(),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const tabCounts: Record<"all" | "unpaid" | "collected_by_staff" | "collected_by_ctv" | "paid", number> = {
    all: paidCount + collectedByStaffCount + collectedByCtvCount + unpaidCount,
    unpaid: unpaidCount,
    collected_by_staff: collectedByStaffCount,
    collected_by_ctv: collectedByCtvCount,
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
          <CreateOrderButton />
          <MonthFilterSelect months={months} />
          <form className="flex gap-2">
            {status !== "all" && <input type="hidden" name="status" value={status} />}
            {source !== "all" && <input type="hidden" name="source" value={source} />}
            {month && <input type="hidden" name="month" value={month} />}
            <input
              type="text"
              name="q"
              defaultValue={search}
              placeholder="Tìm mã Falco, AWB, mã tracking, tên, SĐT..."
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
              {paidCount + collectedByStaffCount + collectedByCtvCount + unpaidCount}
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
              {paidCount + collectedByStaffCount + collectedByCtvCount}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-4 flex gap-2 overflow-x-auto">
        {SOURCE_TABS.map((tab) => (
          <Link
            key={tab.value}
            href={`/admin/orders?${new URLSearchParams({
              ...(search ? { q: search } : {}),
              ...(month ? { month } : {}),
              ...(status !== "all" ? { status } : {}),
              ...(tab.value !== "all" ? { source: tab.value } : {}),
            })}`}
            className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors ${
              source === tab.value ? "bg-flame-600 text-white" : "bg-mist text-ink/60 hover:bg-line"
            }`}
          >
            {tab.label}
            {tab.value === "ctv" && pendingReviewCount > 0 && (
              <span className="rounded-full bg-flame-600 px-1.5 text-xs text-white">
                {pendingReviewCount} chờ duyệt
              </span>
            )}
          </Link>
        ))}
      </div>

      <div className="mt-2 flex gap-2 overflow-x-auto">
        {STATUS_TABS.map((tab) => (
          <Link
            key={tab.value}
            href={`/admin/orders?${new URLSearchParams({
              ...(search ? { q: search } : {}),
              ...(month ? { month } : {}),
              ...(source !== "all" ? { source } : {}),
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

      <OrdersTable orders={orders} />

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-2">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <Link
              key={p}
              href={`/admin/orders?${new URLSearchParams({
                ...(search ? { q: search } : {}),
                ...(month ? { month } : {}),
                ...(status !== "all" ? { status } : {}),
                ...(source !== "all" ? { source } : {}),
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
