import Link from "next/link";
import OrderTrackingButton from "@/components/admin/OrderTrackingButton";
import AttentionRow from "./AttentionRow";
import { vnDateString } from "@/lib/vn-date";
import type { AttentionSummary, DashboardOrderItem } from "@/lib/dashboard";

function formatRelativeSync(lastSyncAt: number | null): string {
  if (!lastSyncAt || lastSyncAt <= 0) return "Chưa có dữ liệu đồng bộ";
  const diffSec = Math.max(0, Math.floor((Date.now() - lastSyncAt) / 1000));
  if (diffSec < 60) return "Cập nhật vừa xong";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `Cập nhật ${diffMin} phút trước`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `Cập nhật ${diffHour} giờ trước`;
  const diffDay = Math.floor(diffHour / 24);
  return `Cập nhật ${diffDay} ngày trước`;
}

function OrderSubline({ item }: { item: DashboardOrderItem }) {
  return (
    <span className="col-span-2 truncate text-xs text-[#4b5563]">
      {item.recipientName}
      {item.ctvName ? ` (FWD ${item.ctvName})` : ""} · {item.country} · {item.carrier}
    </span>
  );
}

export default function TodayCard({
  todayDisplayShort,
  lastSyncAt,
  delivered,
  upcoming,
  attention,
}: {
  todayDisplayShort: string;
  lastSyncAt: number | null;
  delivered: { count: number; items: DashboardOrderItem[] };
  upcoming: { count: number; items: DashboardOrderItem[] };
  attention: AttentionSummary;
}) {
  return (
    <section
      id="hom-nay"
      className="rounded-[24px] border border-[#ecece8] bg-white px-5 pb-4 pt-5 shadow-[0_1px_2px_rgba(19,36,64,0.03),0_6px_20px_rgba(19,36,64,0.028)] sm:px-[26px] sm:pb-[18px] sm:pt-[22px]"
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-[17px] font-bold leading-snug tracking-[-0.02em] text-[#14181f]">
            Hôm nay · {todayDisplayShort}
          </h2>
          <p className="mt-0.5 text-[12.5px] text-[#8b8d93]">
            Cập nhật trạng thái đơn từ Kango &amp; hãng vận chuyển
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 text-[12.5px] text-[#8b8d93]">
          <span
            className="inline-block h-[7px] w-[7px] rounded-full bg-[#16a34a] shadow-[0_0_0_3px_rgba(22,163,74,0.15)]"
            aria-hidden="true"
          />
          {formatRelativeSync(lastSyncAt)}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-[18px] lg:grid-cols-3">
        {/* Cột 1: Đã giao hôm nay */}
        <div className="flex flex-col rounded-[18px] border border-[#ecece8] px-3.5 pb-2.5 pt-3.5">
          <div className="mb-2 flex items-center gap-2.5">
            <span className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[10px] bg-[#e8f6ee] text-[#16a34a]">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.9"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M20 6 9 17l-5-5" />
              </svg>
            </span>
            <span className="text-sm font-semibold text-[#14181f]">Đã giao hôm nay</span>
            <span className="ml-auto text-[22px] font-bold tracking-[-0.03em] text-[#14181f] tabular-nums">
              {delivered.count.toLocaleString("vi-VN")}
            </span>
          </div>

          <div className="divide-y divide-[#ecece8]">
            {delivered.items.length === 0 ? (
              <p className="py-5 text-center text-xs text-[#8b8d93]">
                Chưa có đơn giao thành công hôm nay
              </p>
            ) : (
              delivered.items.map((item) => (
                <OrderTrackingButton
                  key={item.id}
                  falcoCode={item.falcoCode}
                  className="grid w-full text-left grid-cols-[1fr_auto] gap-x-2.5 gap-y-0.5 rounded-lg px-1 py-[9px] transition-colors hover:bg-[#f8f8f6]"
                >
                  <b className="truncate text-[13px] font-semibold text-[#14181f] tabular-nums">
                    {item.falcoCode}
                  </b>
                  <span className="text-right text-xs text-[#8b8d93] tabular-nums">
                    {item.badge}
                  </span>
                  <OrderSubline item={item} />
                </OrderTrackingButton>
              ))
            )}
          </div>

          <Link
            href={delivered.count > 0 ? "/admin/tong-quan/da-giao" : `/admin/tong-quan/da-giao?ngay=${vnDateString(1)}`}
            className="mt-auto inline-block pt-2 text-[12.5px] font-semibold text-[#132440] hover:underline"
          >
            {delivered.count > 0
              ? `Xem ${delivered.count.toLocaleString("vi-VN")} đơn đã giao →`
              : "Xem đơn giao hôm qua →"}
          </Link>
        </div>

        {/* Cột 2: Sắp giao */}
        <div className="flex flex-col rounded-[18px] border border-[#ecece8] px-3.5 pb-2.5 pt-3.5">
          <div className="mb-2 flex items-center gap-2.5">
            <span className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[10px] bg-[#eef4ff] text-[#2563eb]">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M10 17h4V5H2v12h3" />
                <path d="M20 17h2v-3.34a4 4 0 0 0-1.17-2.83L19 9h-5v8h1" />
                <circle cx="7.5" cy="17.5" r="2.5" />
                <circle cx="17.5" cy="17.5" r="2.5" />
              </svg>
            </span>
            <span className="text-sm font-semibold text-[#14181f]">Sắp giao</span>
            <span className="ml-auto text-[22px] font-bold tracking-[-0.03em] text-[#14181f] tabular-nums">
              {upcoming.count.toLocaleString("vi-VN")}
            </span>
          </div>

          <div className="divide-y divide-[#ecece8]">
            {upcoming.items.length === 0 ? (
              <p className="py-5 text-center text-xs text-[#8b8d93]">
                Không có đơn nào đang giao chặng cuối
              </p>
            ) : (
              upcoming.items.map((item) => (
                <OrderTrackingButton
                  key={item.id}
                  falcoCode={item.falcoCode}
                  className="grid w-full text-left grid-cols-[1fr_auto] items-center gap-x-2.5 gap-y-0.5 rounded-lg px-1 py-[9px] transition-colors hover:bg-[#f8f8f6]"
                >
                  <b className="truncate text-[13px] font-semibold text-[#14181f] tabular-nums">
                    {item.falcoCode}
                  </b>
                  <span className="justify-self-end rounded-full bg-[#eef4ff] px-2 py-0.5 text-[11px] font-semibold text-[#2563eb]">
                    {item.badge}
                  </span>
                  <OrderSubline item={item} />
                </OrderTrackingButton>
              ))
            )}
          </div>

          <Link
            href="/admin/tong-quan/sap-giao"
            className="mt-auto inline-block pt-2 text-[12.5px] font-semibold text-[#132440] hover:underline"
          >
            {upcoming.count > 0
              ? `Xem ${upcoming.count.toLocaleString("vi-VN")} đơn sắp giao →`
              : "Xem tất cả đơn hàng →"}
          </Link>
        </div>

        {/* Cột 3: Cần chú ý */}
        <div className="flex flex-col rounded-[18px] border border-[#ecece8] px-3.5 pb-2.5 pt-3.5">
          <div className="mb-2 flex items-center gap-2.5">
            <span className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[10px] bg-[#fdecec] text-[#ed1c24]">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M12 9v4" />
                <path d="M12 17h.01" />
                <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
              </svg>
            </span>
            <span className="text-sm font-semibold text-[#14181f]">Cần chú ý</span>
            <span className="ml-auto text-[22px] font-bold tracking-[-0.03em] text-[#ed1c24] tabular-nums">
              {attention.count.toLocaleString("vi-VN")}
            </span>
          </div>

          <div className="divide-y divide-[#ecece8]">
            {attention.items.length === 0 ? (
              <p className="py-5 text-center text-xs text-[#8b8d93]">
                Không có đơn kẹt hải quan hay quá hạn cập nhật
              </p>
            ) : (
              attention.items.map((item) => <AttentionRow key={item.id} item={item} />)
            )}
          </div>

          <Link
            href="/admin/tong-quan/can-chu-y"
            className="mt-auto inline-block pt-2 text-[12.5px] font-semibold text-[#132440] hover:underline"
          >
            {attention.count > 0
              ? `Xem ${attention.count.toLocaleString("vi-VN")} đơn cần xử lý →`
              : "Xem tất cả đơn hàng →"}
          </Link>
        </div>
      </div>
    </section>
  );
}
