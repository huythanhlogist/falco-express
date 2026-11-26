import type { RouteBreakdownItem } from "@/lib/dashboard";
import EuropeOrdersMap from "./EuropeOrdersMap";

function RouteIcon({ index, isOther }: { index: number; isOther: boolean }) {
  const baseProps = {
    width: 16,
    height: 16,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.6,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true as const,
  };

  if (isOther) {
    return (
      <svg {...baseProps}>
        <polygon points="12 2 2 7 12 12 22 7 12 2" />
        <polyline points="2 17 12 22 22 17" />
        <polyline points="2 12 12 17 22 12" />
      </svg>
    );
  }

  switch (index) {
    case 0:
      return (
        <svg {...baseProps}>
          <path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z" />
        </svg>
      );
    case 1:
      return (
        <svg {...baseProps}>
          <circle cx="12" cy="12" r="10" />
          <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
        </svg>
      );
    case 2:
      return (
        <svg {...baseProps}>
          <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
          <circle cx="12" cy="10" r="3" />
        </svg>
      );
    case 3:
      return (
        <svg {...baseProps}>
          <circle cx="12" cy="12" r="10" />
          <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
          <path d="M2 12h20" />
        </svg>
      );
    case 4:
      return (
        <svg {...baseProps}>
          <polygon points="3 11 22 2 13 21 11 13 3 11" />
        </svg>
      );
    default:
      return (
        <svg {...baseProps}>
          <circle cx="12" cy="5" r="3" />
          <line x1="12" y1="22" x2="12" y2="8" />
          <path d="M5 12H2a10 10 0 0 0 20 0h-3" />
        </svg>
      );
  }
}

export default function RoutesBreakdownCard({
  total,
  rangeShortLabel,
  items,
}: {
  total: number;
  rangeShortLabel: string;
  items: RouteBreakdownItem[];
}) {
  const maxCount = Math.max(...items.map((item) => item.count), 1);

  return (
    <div className="rounded-[24px] border border-[#ecece8] bg-white p-5 shadow-[0_1px_2px_rgba(19,36,64,0.03),0_6px_20px_rgba(19,36,64,0.028)] sm:px-[26px] sm:py-6">
      <div className="flex items-start justify-between gap-4">
        <h2 className="text-[17px] font-bold leading-snug tracking-[-0.02em] text-[#14181f]">
          Đơn theo nước
        </h2>
        <span className="whitespace-nowrap pt-0.5 text-[12.5px] font-medium text-[#8b8d93] tabular-nums">
          {total.toLocaleString("vi-VN")} đơn {rangeShortLabel}
        </span>
      </div>

      {items.length === 0 ? (
        <p className="py-10 text-center text-xs text-[#8b8d93]">
          Chưa có đơn hàng nào trong khoảng thời gian này
        </p>
      ) : (
        <div className="mt-4 grid grid-cols-1 items-center gap-5 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div className="overflow-hidden rounded-[18px] bg-[#f8f8f6] p-2">
          <EuropeOrdersMap items={items} />
        </div>
        <div className="flex flex-col gap-3.5">
          {items.map((item, idx) => {
            const widthPct = Math.max(4, Math.round((item.count / maxCount) * 90));
            const isLeader = idx === 0 && !item.isOther;
            return (
              <div
                key={item.country}
                className="grid grid-cols-[108px_1fr_40px_38px] items-center gap-3"
              >
                <div className="flex min-w-0 items-center gap-2.5 text-[13.5px] font-medium text-[#27272a]">
                  <span className="inline-flex shrink-0 text-[#5b616e]">
                    <RouteIcon index={idx} isOther={item.isOther} />
                  </span>
                  <span className="truncate">{item.country}</span>
                </div>

                <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#f2f2ef]">
                  <div
                    className={`h-full rounded-full ${
                      isLeader
                        ? "bg-gradient-to-r from-[#f7941d] to-[#e05a0c]"
                        : "bg-[#132440]"
                    }`}
                    style={{ width: `${widthPct}%` }}
                  />
                </div>

                <div className="text-right text-[13px] font-medium text-[#71717a] tabular-nums">
                  {item.count.toLocaleString("vi-VN")}
                </div>

                <div className="text-right text-[13px] font-bold text-[#14181f] tabular-nums">
                  {item.pct}%
                </div>
              </div>
            );
          })}
        </div>
        </div>
      )}
    </div>
  );
}
