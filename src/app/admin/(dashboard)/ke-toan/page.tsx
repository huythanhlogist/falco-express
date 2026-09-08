import Link from "next/link";
import {
  listOrders,
  listExpenses,
  getOrderFinanceTotals,
  sumExpenses,
  listOrderMonths,
  type PaymentStatus,
} from "@/lib/db";
import AccountingOrderList from "@/components/admin/AccountingOrderList";
import ExpenseManager from "@/components/admin/ExpenseManager";
import MonthFilterSelect from "@/components/admin/MonthFilterSelect";
import { WalletIcon, ClockIcon, PackageCheckIcon } from "@/components/icons";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function fmtDate(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function getWeekRange(d = new Date()) {
  const day = d.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diffToMonday);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return { start: fmtDate(monday), end: fmtDate(sunday) };
}

function getMonthRange(month: string) {
  const [y, m] = month.split("-").map(Number);
  const start = `${month}-01`;
  const lastDay = new Date(y, m, 0).getDate();
  const end = `${month}-${pad(lastDay)}`;
  return { start, end };
}

function money(n: number): string {
  return `${n.toLocaleString("vi-VN")}đ`;
}

const STATUS_TABS: { value: "all" | PaymentStatus; label: string }[] = [
  { value: "all", label: "Tất cả" },
  { value: "unpaid", label: "Chưa thu" },
  { value: "collected_by_staff", label: "Thu hộ" },
  { value: "paid", label: "Đã thu" },
];

export default async function KeToanPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; status?: string; q?: string; page?: string }>;
}) {
  const params = await searchParams;
  // Không truyền month = xem toàn bộ thời gian (khớp hành vi "Tất cả các
  // tháng" ở trang Đơn hàng) — khác với trước đây luôn ép về tháng hiện tại,
  // khiến chọn "Tất cả các tháng" không có tác dụng gì (cảm giác như lỗi).
  const month = params.month || "";
  const search = params.q || "";
  const page = Math.max(1, Number(params.page) || 1);
  const status: "all" | PaymentStatus =
    params.status === "unpaid" || params.status === "collected_by_staff" || params.status === "paid"
      ? params.status
      : "all";

  const weekRange = getWeekRange();
  const monthRange = month ? getMonthRange(month) : null;

  const [
    weekFinance,
    weekExpenseTotal,
    monthFinance,
    monthExpenseTotal,
    { orders, total },
    expenses,
    months,
  ] = await Promise.all([
    getOrderFinanceTotals(weekRange.start, weekRange.end),
    sumExpenses(weekRange.start, weekRange.end),
    getOrderFinanceTotals(monthRange?.start ?? null, monthRange?.end ?? null),
    sumExpenses(monthRange?.start ?? null, monthRange?.end ?? null),
    // Dùng chung listOrders với trang Đơn hàng để 2 danh sách luôn đồng bộ
    // (cùng cột, cùng phân trang, cùng bộ lọc) — trước đây dùng 1 hàm fetch
    // riêng khiến danh sách ở đây khác và thiếu so với trang Đơn hàng.
    listOrders({ search, status, month: month || undefined, limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE }),
    listExpenses(),
    listOrderMonths(),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const weekChi = weekFinance.chiDon + weekExpenseTotal;
  const weekLaiLo = weekFinance.thu - weekChi;
  const monthChi = monthFinance.chiDon + monthExpenseTotal;
  const monthLaiLo = monthFinance.thu - monthChi;

  return (
    <div>
      <h1 className="font-display text-xl font-bold text-navy-900">Kế toán</h1>
      <p className="mt-0.5 text-sm text-ink/55">
        Tổng kết thu chi, lãi lỗ theo tuần và theo tháng
      </p>

      <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
        <SummaryCard
          title={`Tuần này (${new Date(weekRange.start).toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })} – ${new Date(weekRange.end).toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })})`}
          thu={weekFinance.thu}
          chi={weekChi}
          laiLo={weekLaiLo}
        />
        <SummaryCard
          title={month ? `Theo tháng` : "Toàn bộ thời gian"}
          thu={monthFinance.thu}
          chi={monthChi}
          laiLo={monthLaiLo}
          monthPicker={<MonthFilterSelect months={months} value={month} />}
        />
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="font-display text-base font-bold text-navy-900">Danh sách đơn</h2>
        <form className="flex gap-2">
          {month && <input type="hidden" name="month" value={month} />}
          {status !== "all" && <input type="hidden" name="status" value={status} />}
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

      <div className="mt-3 flex gap-2 overflow-x-auto">
        {STATUS_TABS.map((tab) => (
          <Link
            key={tab.value}
            href={`/admin/ke-toan?${new URLSearchParams({
              ...(month ? { month } : {}),
              ...(search ? { q: search } : {}),
              ...(tab.value !== "all" ? { status: tab.value } : {}),
            })}`}
            className={`inline-flex shrink-0 items-center whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors ${
              status === tab.value
                ? "bg-navy-800 text-white"
                : "bg-mist text-ink/60 hover:bg-line"
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      <div className="mt-3">
        <AccountingOrderList
          key={`${month}-${status}-${search}-${page}`}
          initialRows={orders}
        />
      </div>

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-2">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <Link
              key={p}
              href={`/admin/ke-toan?${new URLSearchParams({
                ...(month ? { month } : {}),
                ...(search ? { q: search } : {}),
                ...(status !== "all" ? { status } : {}),
                page: String(p),
              })}`}
              className={`flex h-7 w-7 items-center justify-center rounded-full text-sm font-medium ${
                p === page ? "bg-navy-800 text-white" : "text-ink/60 hover:bg-mist"
              }`}
            >
              {p}
            </Link>
          ))}
        </div>
      )}

      <div className="mt-6">
        <h2 className="font-display text-base font-bold text-navy-900">Chi phí phát sinh</h2>
        <p className="mt-0.5 text-sm text-ink/55">
          Chi phí chung không gắn với đơn cụ thể — nhập tay, có thể sửa/xoá từng dòng.
        </p>
        <div className="mt-3">
          <ExpenseManager initialExpenses={expenses} />
        </div>
      </div>
    </div>
  );
}

function SummaryCard({
  title,
  thu,
  chi,
  laiLo,
  monthPicker,
}: {
  title: string;
  thu: number;
  chi: number;
  laiLo: number;
  monthPicker?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-line bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-display text-sm font-bold text-navy-900">{title}</p>
        {monthPicker}
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2.5">
        <div className="rounded-lg bg-emerald-50 px-3 py-2.5">
          <p className="flex items-center gap-1 text-xs text-emerald-700">
            <PackageCheckIcon className="h-3.5 w-3.5" /> Thu
          </p>
          <p className="mt-1 font-display text-sm font-bold text-emerald-800">{money(thu)}</p>
        </div>
        <div className="rounded-lg bg-flame-50 px-3 py-2.5">
          <p className="flex items-center gap-1 text-xs text-flame-700">
            <ClockIcon className="h-3.5 w-3.5" /> Chi
          </p>
          <p className="mt-1 font-display text-sm font-bold text-flame-800">{money(chi)}</p>
        </div>
        <div className={`rounded-lg px-3 py-2.5 ${laiLo >= 0 ? "bg-navy-50" : "bg-flame-50"}`}>
          <p
            className={`flex items-center gap-1 text-xs ${laiLo >= 0 ? "text-navy-700" : "text-flame-700"}`}
          >
            <WalletIcon className="h-3.5 w-3.5" /> {laiLo >= 0 ? "Lãi" : "Lỗ"}
          </p>
          <p
            className={`mt-1 font-display text-sm font-bold ${laiLo >= 0 ? "text-navy-900" : "text-flame-800"}`}
          >
            {money(Math.abs(laiLo))}
          </p>
        </div>
      </div>
    </div>
  );
}
