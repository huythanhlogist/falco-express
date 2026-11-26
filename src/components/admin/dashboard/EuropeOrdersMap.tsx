import type { RouteBreakdownItem } from "@/lib/dashboard";
import { EUROPE_PATHS, EUROPE_VIEWBOX } from "./europe-map-paths";

/** tên trong dữ liệu bản đồ Natural Earth. */
/** Tên nước trên dashboard (tiếng Anh) → tên trong dữ liệu bản đồ Natural Earth, khi khác nhau. */
const TO_MAP_NAME: Record<string, string> = { "Czech Republic": "Czechia" };

/** Bản đồ châu Âu tô màu theo số đơn: nước nhiều nhất màu cam, các nước khác navy đậm nhạt theo tỷ lệ. */
export default function EuropeOrdersMap({ items }: { items: RouteBreakdownItem[] }) {
  const real = items.filter((i) => !i.isOther);
  const max = Math.max(...real.map((i) => i.count), 1);
  const byMapName = new Map(
    real.map((i, idx) => [TO_MAP_NAME[i.country] ?? i.country, { ...i, leader: idx === 0 }])
  );

  return (
    <svg viewBox={EUROPE_VIEWBOX} className="h-auto w-full" role="img" aria-label="Bản đồ số đơn theo nước">
      {Object.entries(EUROPE_PATHS).map(([name, d]) => {
        const hit = byMapName.get(name);
        const fill = !hit
          ? "#ecece9"
          : hit.leader
            ? "#f7941d"
            : `rgba(19, 36, 64, ${(0.25 + 0.65 * (hit.count / max)).toFixed(2)})`;
        return (
          <path key={name} d={d} fill={fill} stroke="#ffffff" strokeWidth={1.5} strokeLinejoin="round">
            {hit && <title>{`${hit.country}: ${hit.count.toLocaleString("vi-VN")} đơn (${hit.pct}%)`}</title>}
          </path>
        );
      })}
    </svg>
  );
}
