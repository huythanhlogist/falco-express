import Link from "next/link";
import { notFound } from "next/navigation";
import AttentionRow from "@/components/admin/dashboard/AttentionRow";
import OrderTrackingButton from "@/components/admin/OrderTrackingButton";
import AdminPageTabs from "@/components/admin/AdminPageTabs";
import { getDashboardData, getDeliveredOnDate, type DashboardOrderItem } from "@/lib/dashboard";
import { vnDateString } from "@/lib/vn-date";

export const dynamic = "force-dynamic";

const GROUPS = {
  "da-giao": { title: "Đã giao hôm nay", empty: "Hôm nay chưa có đơn nào giao xong." },
  "sap-giao": { title: "Sắp giao", empty: "Không có đơn nào đang ở chặng cuối." },
  "can-chu-y": { title: "Cần chú ý", empty: "Không có đơn nào cần chú ý." },
} as const;
type GroupKey = keyof typeof GROUPS;

const REASON_LABEL = {
  failed_or_returned: "Giao thất bại / hoàn trả",
  customs_stuck: "Kẹt hải quan > 2 ngày",
  no_update: "Không có cập nhật > 3 ngày",
} as const;

function OrderRow({ item }: { item: DashboardOrderItem }) {
  return (
    <OrderTrackingButton
      falcoCode={item.falcoCode}
      className="grid w-full grid-cols-[1fr_auto] text-left items-center gap-x-2.5 rounded-lg px-1 py-[9px] transition-colors hover:bg-[#f8f8f6]"
    >
      <span className="min-w-0">
        <b className="block truncate text-[13px] font-semibold text-[#14181f] tabular-nums">{item.falcoCode}</b>
        <span className="block truncate text-xs text-[#4b5563]">
          {item.recipientName}
          {item.ctvName ? ` (FWD ${item.ctvName})` : ""} · {item.country} · {item.carrier}
        </span>
      </span>
      <span className="rounded-full bg-[#eef4ff] px-2 py-0.5 text-[11px] font-semibold text-[#2563eb]">{item.badge}</span>
    </OrderTrackingButton>
  );
}

function ddmm(ymd: string): string {
  return `${ymd.slice(8, 10)}/${ymd.slice(5, 7)}`;
}

export default async function TodayGroupPage({
  params,
  searchParams,
}: {
  params: Promise<{ nhom: string }>;
  searchParams: Promise<{ ngay?: string }>;
}) {
  const [{ nhom }, query] = await Promise.all([params, searchParams]);
  if (!(nhom in GROUPS)) notFound();
  const key = nhom as GroupKey;
  const today = vnDateString(0);
  const yesterday = vnDateString(1);
  const ngay =
    key === "da-giao" && query.ngay && /^\d{4}-\d{2}-\d{2}$/.test(query.ngay) && query.ngay <= today ? query.ngay : today;
  const [data, deliveredOnDay] = await Promise.all([
    getDashboardData(),
    key === "da-giao" && ngay !== today ? getDeliveredOnDate(ngay) : Promise.resolve(null),
  ]);
  const t = data.today;
  const deliveredItems = deliveredOnDay ?? t.delivered.allItems;
  const dayLabel = ngay === today ? "hôm nay" : ngay === yesterday ? "hôm qua" : `ngày ${ddmm(ngay)}`;

  const tabs = [
    { href: "/admin/tong-quan/da-giao", label: `Đã giao hôm nay (${t.delivered.count})` },
    { href: "/admin/tong-quan/sap-giao", label: `Sắp giao (${t.upcoming.count})` },
    { href: "/admin/tong-quan/can-chu-y", label: `Cần chú ý (${t.attention.count})` },
  ];

  return (
    <div className="mx-auto max-w-[1100px] space-y-5">
      <div>
        <Link href="/admin/tong-quan" className="text-[13px] font-semibold text-[#8b8d93] hover:text-[#132440]">
          ← Tổng quan
        </Link>
        <h1 className="mt-2 text-[28px] font-bold leading-[1.3] tracking-[-0.02em] text-[#14181f]">
          {key === "da-giao" ? `Đã giao ${dayLabel} · ${ddmm(ngay)}` : `${GROUPS[key].title} · ${data.todayDisplayShort}`}
        </h1>
      </div>
      <AdminPageTabs tabs={tabs} />

      {key === "da-giao" && (
        <form className="flex flex-wrap items-center gap-2" action="/admin/tong-quan/da-giao">
          {[
            { d: today, label: "Hôm nay" },
            { d: yesterday, label: "Hôm qua" },
          ].map((o) => (
            <Link
              key={o.d}
              href={o.d === today ? "/admin/tong-quan/da-giao" : `/admin/tong-quan/da-giao?ngay=${o.d}`}
              className={`h-9 rounded-xl px-3.5 text-[13px] font-semibold leading-9 ${
                ngay === o.d ? "bg-[#132440] text-white" : "border border-[#e7e7e3] bg-white text-[#27272a] hover:bg-[#f8f8f6]"
              }`}
            >
              {o.label}
            </Link>
          ))}
          <input
            type="date"
            name="ngay"
            defaultValue={ngay}
            max={today}
            aria-label="Chọn ngày giao"
            className="h-9 rounded-xl border border-[#e7e7e3] bg-white px-3 text-[13px] text-[#27272a]"
          />
          <button type="submit" className="h-9 rounded-xl border border-[#e7e7e3] bg-white px-3.5 text-[13px] font-semibold text-[#132440] hover:bg-[#f8f8f6]">
            Xem
          </button>
          <span className="text-[13px] text-[#8b8d93]">{deliveredItems.length} đơn</span>
        </form>
      )}

      {key === "can-chu-y" ? (
        (["failed_or_returned", "customs_stuck", "no_update"] as const).map((reason) => {
          const items = t.attention.allItems.filter((i) => i.reason === reason);
          if (items.length === 0) return null;
          return (
            <section key={reason} className="rounded-[24px] bg-white px-6 py-5 shadow-[0_1px_2px_rgba(19,36,64,0.03),0_6px_20px_rgba(19,36,64,0.028)]">
              <h2 className="mb-2 text-[15px] font-bold text-[#14181f]">
                {REASON_LABEL[reason]} <span className="text-[#ed1c24]">({items.length})</span>
              </h2>
              <div className="divide-y divide-[#ecece8]">
                {items.map((item) => (
                  <AttentionRow key={item.id} item={item} />
                ))}
              </div>
            </section>
          );
        })
      ) : (
        <section className="rounded-[24px] bg-white px-6 py-5 shadow-[0_1px_2px_rgba(19,36,64,0.03),0_6px_20px_rgba(19,36,64,0.028)]">
          <div className="divide-y divide-[#ecece8]">
            {(key === "da-giao" ? deliveredItems : t.upcoming.allItems).map((item) => (
              <OrderRow key={item.id} item={item} />
            ))}
          </div>
        </section>
      )}

      {(key === "can-chu-y" ? t.attention.count : key === "da-giao" ? deliveredItems.length : t.upcoming.count) === 0 && (
        <p className="py-10 text-center text-sm text-[#8b8d93]">
          {key === "da-giao" ? `Không có đơn nào giao ${dayLabel}.` : GROUPS[key].empty}
        </p>
      )}
      {key === "can-chu-y" && (
        <p className="text-xs text-[#8b8d93]">
          Bấm × để ẩn 1 đơn khỏi danh sách. Đơn sẽ tự hiện lại nếu trạng thái tracking thay đổi.
        </p>
      )}
    </div>
  );
}
