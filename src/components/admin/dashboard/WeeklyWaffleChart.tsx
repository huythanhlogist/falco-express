import type { WeeklyWafflePoint } from "@/lib/dashboard";

const ROWS = 15;
const COLS = 4;
const TOTAL_CELLS = ROWS * COLS; // 60 ô / tuần như mockup
const MAX_FILLED_CELLS = 52; // giữ 2 hàng trống phía trên cho cột cao nhất

type CellTone = "empty" | "orange" | "peach" | "blue";

function buildCells(point: WeeklyWafflePoint, maxTotal: number): CellTone[] {
  const filled =
    point.total <= 0
      ? 0
      : Math.max(1, Math.min(TOTAL_CELLS, Math.round((point.total / maxTotal) * MAX_FILLED_CELLS)));

  const deliveredCells = point.isCurrent
    ? 0
    : Math.min(filled, Math.round((point.delivered / Math.max(point.total, 1)) * filled));

  const cells: CellTone[] = new Array<CellTone>(TOTAL_CELLS);
  for (let i = 0; i < TOTAL_CELLS; i++) {
    const rowFromTop = Math.floor(i / COLS);
    const col = i % COLS;
    const rowFromBottom = ROWS - 1 - rowFromTop;
    // Đánh số từ đáy lên đỉnh, trái sang phải trên từng hàng (khớp out/dashboard.html)
    const rankFromBottom = rowFromBottom * COLS + col;

    if (rankFromBottom >= filled) {
      cells[i] = "empty";
    } else if (point.isCurrent) {
      cells[i] = "blue";
    } else if (rankFromBottom < deliveredCells) {
      cells[i] = "orange";
    } else {
      cells[i] = "peach";
    }
  }
  return cells;
}

const CELL_CLASS: Record<CellTone, string> = {
  empty: "bg-[#ecece9]",
  orange: "bg-[#f7941d]",
  peach: "bg-[#fde7c8]",
  blue: "bg-[#2563eb]",
};

function formatRangeShort(startYmd: string, endYmd: string): string {
  const [, sm, sd] = startYmd.split("-");
  const [, em, ed] = endYmd.split("-");
  return `${sd}/${sm} – ${ed}/${em}`;
}

export default function WeeklyWaffleChart({
  weeks,
  subtitle = "11 tuần gần nhất · Đơn / tuần",
}: {
  weeks: WeeklyWafflePoint[];
  subtitle?: string;
}) {
  const maxTotal = Math.max(...weeks.map((w) => w.total), 1);

  return (
    <div className="flex flex-col justify-between gap-5 rounded-[24px] border border-[#ecece8] bg-white p-5 shadow-[0_1px_2px_rgba(19,36,64,0.03),0_6px_20px_rgba(19,36,64,0.028)] sm:px-[26px] sm:py-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-[17px] font-bold leading-snug tracking-[-0.02em] text-[#14181f]">
            Sản lượng đơn theo tuần
          </h2>
          <p className="mt-0.5 text-[12.5px] text-[#8b8d93]">
            {subtitle}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4 pt-0.5">
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#52525b]">
            <span className="inline-block h-2.5 w-2.5 rounded-[3px] bg-[#fde7c8]" />
            Chưa giao
          </span>
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#52525b]">
            <span className="inline-block h-2.5 w-2.5 rounded-[3px] bg-[#f7941d]" />
            Đã giao
          </span>
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#52525b]">
            <span className="inline-block h-2.5 w-2.5 rounded-[3px] bg-[#2563eb]" />
            Tuần này
          </span>
        </div>
      </div>

      <div className="overflow-x-auto pb-1">
        <div
          className="grid min-w-[660px] items-end justify-items-center gap-[11px] pt-1.5"
          style={{ gridTemplateColumns: `repeat(${weeks.length}, minmax(0, 1fr))` }}
          aria-label="Biểu đồ sản lượng đơn theo tuần"
        >
          {weeks.map((week) => {
            const cells = buildCells(week, maxTotal);
            const tooltip = `Tuần ${formatRangeShort(week.weekStart, week.weekEnd)}: ${week.total.toLocaleString("vi-VN")} đơn (${week.delivered.toLocaleString("vi-VN")} đã giao, ${week.inProgress.toLocaleString("vi-VN")} chưa giao)`;
            return (
              <div
                key={week.weekStart}
                title={tooltip}
                className="flex flex-col items-center gap-2.5"
              >
                <div
                  className={`text-xs leading-none tabular-nums ${
                    week.isCurrent
                      ? "font-bold text-[#14181f]"
                      : "font-medium text-[#71717a]"
                  }`}
                >
                  {week.total.toLocaleString("vi-VN")}
                </div>

                <div className="grid grid-cols-[repeat(4,11px)] gap-x-[3px] gap-y-[4px]">
                  {cells.map((tone, idx) => (
                    <span
                      key={idx}
                      className={`block h-[11px] w-[11px] rounded-[3px] ${CELL_CLASS[tone]}`}
                    />
                  ))}
                </div>

                <div
                  className={`text-[11.5px] leading-none tabular-nums ${
                    week.isCurrent
                      ? "font-semibold text-[#14181f]"
                      : "text-[#8b8d93]"
                  }`}
                >
                  {week.label}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
