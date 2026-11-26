import type { DashboardData, FunnelStepItem } from "@/lib/dashboard";

function FunnelIcon({ stepKey }: { stepKey: FunnelStepItem["key"] }) {
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

  switch (stepKey) {
    case "received":
      return (
        <svg {...baseProps}>
          <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
          <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
        </svg>
      );
    case "exported":
      return (
        <svg {...baseProps}>
          <path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2" />
          <path d="M15 18H9" />
          <path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14" />
          <circle cx="17" cy="18" r="2" />
          <circle cx="7" cy="18" r="2" />
        </svg>
      );
    case "customs_released":
      return (
        <svg {...baseProps}>
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
          <path d="m9 12 2 2 4-4" />
        </svg>
      );
    case "last_mile":
      return (
        <svg {...baseProps}>
          <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
        </svg>
      );
    case "delivered":
      return (
        <svg {...baseProps}>
          <circle cx="12" cy="12" r="10" />
          <path d="m9 12 2 2 4-4" />
        </svg>
      );
  }
}

export default function DeliveryFunnelCard({
  funnel,
}: {
  funnel: DashboardData["funnel"];
}) {
  const { steps, bottlenecks } = funnel;
  const extraParts: string[] = [];
  if (bottlenecks.inFlight > 0) {
    extraParts.push(`${bottlenecks.inFlight.toLocaleString("vi-VN")} đang bay`);
  }
  if (bottlenecks.customsReleased > 0) {
    extraParts.push(`${bottlenecks.customsReleased.toLocaleString("vi-VN")} chờ hãng nhận`);
  }
  if (bottlenecks.returned > 0) {
    extraParts.push(`${bottlenecks.returned.toLocaleString("vi-VN")} hoàn trả`);
  }

  return (
    <div className="rounded-[24px] border border-[#ecece8] bg-white p-5 shadow-[0_1px_2px_rgba(19,36,64,0.03),0_6px_20px_rgba(19,36,64,0.028)] sm:px-[26px] sm:py-6">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-[17px] font-bold leading-snug tracking-[-0.02em] text-[#14181f]">
          Từ nhận hàng đến giao
        </h2>
        <span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-[#eef4ff] px-2.5 py-1 text-xs font-semibold text-[#2563eb]">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#2563eb]" />
          Theo dõi Kango
        </span>
      </div>

      <div className="mt-5 flex flex-col gap-3.5">
        {steps.map((step) => {
          const barWidth = step.count > 0 ? Math.max(2, step.pct) : 0;
          const isDelivered = step.key === "delivered";
          return (
            <div
              key={step.key}
              className="grid grid-cols-[124px_1fr_44px_38px] items-center gap-2.5 sm:grid-cols-[142px_1fr_48px_42px] sm:gap-3"
            >
              <div className="flex min-w-0 items-center gap-2.5 text-[13.5px] font-medium text-[#27272a]">
                <span className="inline-flex shrink-0 text-[#5b616e]">
                  <FunnelIcon stepKey={step.key} />
                </span>
                <span className="truncate">{step.label}</span>
              </div>

              <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#f2f2ef]">
                <div
                  className={`h-full rounded-full ${isDelivered ? "bg-[#2563eb]" : "bg-[#132440]"}`}
                  style={{ width: `${barWidth}%` }}
                />
              </div>

              <div className="text-right text-[13px] font-medium text-[#71717a] tabular-nums">
                {step.count.toLocaleString("vi-VN")}
              </div>

              <div className="text-right text-[13px] font-bold text-[#14181f] tabular-nums">
                {step.pct}%
              </div>
            </div>
          );
        })}
      </div>

      <hr className="my-5 border-0 border-t border-[#efefea]" />

      <div className="mb-3.5 text-xs font-medium text-[#8b8d93]">Đơn đang kẹt ở đâu</div>
      <div className="grid grid-cols-3 gap-4">
        <div title="Đơn ở trạng thái received, imported hoặc chưa có bản cache tracking">
          <div className="text-2xl font-bold leading-tight tracking-[-0.03em] text-[#14181f] tabular-nums">
            {bottlenecks.waitingExport.toLocaleString("vi-VN")}
          </div>
          <div className="mt-1 text-xs leading-snug text-[#8b8d93]">chờ xuất kho</div>
        </div>

        <div title="Đơn ở trạng thái customs_processing hoặc customs">
          <div className="text-2xl font-bold leading-tight tracking-[-0.03em] text-[#14181f] tabular-nums">
            {bottlenecks.inCustoms.toLocaleString("vi-VN")}
          </div>
          <div className="mt-1 text-xs leading-snug text-[#8b8d93]">đang thông quan</div>
        </div>

        <div title="Đơn ở trạng thái last_mile (đang giao chặng cuối)">
          <div className="text-2xl font-bold leading-tight tracking-[-0.03em] text-[#14181f] tabular-nums">
            {bottlenecks.lastMile.toLocaleString("vi-VN")}
          </div>
          <div className="mt-1 text-xs leading-snug text-[#8b8d93]">đang giao chặng cuối</div>
        </div>
      </div>

      {extraParts.length > 0 && (
        <p className="mt-3.5 border-t border-[#f3f3ef] pt-2.5 text-[11.5px] text-[#8b8d93]">
          Ngoài ra: {extraParts.join(" · ")}
        </p>
      )}
    </div>
  );
}
