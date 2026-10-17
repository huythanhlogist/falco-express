import { LANDING_ROUTES } from "@/lib/landing-content";
import type { RouteEta } from "@/lib/route-eta";
import { LAND_PATH, ROUTE_POINTS } from "./route-map-geo";

/**
 * Bản đồ tuyến Việt Nam → châu Âu trên nền navy của mục "Tuyến phổ biến".
 * SVG tĩnh, không thư viện bản đồ, không tải dữ liệu lúc chạy: đường bờ biển
 * sinh sẵn trong route-map-geo.ts (Natural Earth 1:110m). Thời gian giao trên
 * nhãn lấy từ dữ liệu đơn thật (getRouteEtas) — tuyến chưa đủ mẫu thì chỉ hiện tên.
 * Chuyển động (máy bay chạy trên tuyến) tắt khi người dùng bật "giảm chuyển động".
 */

const VIEW_W = 1000;
const VIEW_H = 452;

// Vị trí nhãn so với chấm thành phố (đơn vị viewBox) — chỉnh tay để các nước
// châu Âu nằm sát nhau không đè chữ lên nhau.
const LABEL_OFFSET: Record<string, { dx: number; dy: number; anchor: "start" | "middle" | "end" }> = {
  anh: { dx: -12, dy: 4, anchor: "end" },
  phap: { dx: -10, dy: 26, anchor: "end" },
  "ha-lan": { dx: -6, dy: -16, anchor: "middle" },
  duc: { dx: 4, dy: -16, anchor: "middle" },
  sec: { dx: 4, dy: 30, anchor: "middle" },
  "ba-lan": { dx: 14, dy: 4, anchor: "start" },
};

function arcPath(from: [number, number], to: [number, number]): string {
  const [x1, y1] = from;
  const [x2, y2] = to;
  // Điểm điều khiển nằm phía trên trung điểm → đường cong như tuyến bay.
  const cx = (x1 + x2) / 2;
  const cy = Math.min(y1, y2) - Math.abs(x1 - x2) * 0.22;
  return `M${x1},${y1} Q${cx},${cy} ${x2},${y2}`;
}

export default function RouteMap({ etas }: { etas: Record<string, RouteEta> }) {
  const origin = ROUTE_POINTS.hanoi;
  const hasEta = LANDING_ROUTES.some((r) => etas[r.slug]);

  return (
    <figure className="relative mt-6 sm:mt-8" aria-label="Bản đồ tuyến gửi hàng từ Việt Nam đi châu Âu">
      <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} className="block h-auto w-full" role="img">
        <title>Tuyến gửi hàng Falco Express từ Việt Nam đi Anh, Đức, Pháp, Hà Lan, Séc, Ba Lan</title>
        <defs>
          <linearGradient id="route-line" x1="1" y1="0" x2="0" y2="0">
            <stop offset="0%" stopColor="#ff9a3d" />
            <stop offset="100%" stopColor="#d92a0a" />
          </linearGradient>
        </defs>

        <path d={LAND_PATH} fill="#1d3253" stroke="#2a4066" strokeWidth={1} />

        {LANDING_ROUTES.map((route, i) => {
          const to = ROUTE_POINTS[route.slug];
          if (!to) return null;
          const d = arcPath(origin, to);
          return (
            <g key={`arc-${route.slug}`}>
              <path d={d} fill="none" stroke="url(#route-line)" strokeWidth={2} strokeLinecap="round" className="route-map-arc" />
              <circle r={4} fill="#fff" className="route-map-plane">
                <animateMotion dur={`${6 + i * 0.7}s`} begin={`${i * 0.9}s`} repeatCount="indefinite" path={d} />
              </circle>
            </g>
          );
        })}

        {LANDING_ROUTES.map((route) => {
          const pt = ROUTE_POINTS[route.slug];
          if (!pt) return null;
          const off = LABEL_OFFSET[route.slug] ?? { dx: 10, dy: 4, anchor: "start" as const };
          const eta = etas[route.slug];
          return (
            <a key={`pt-${route.slug}`} href={`/gui-hang-di-${route.slug}`} aria-label={`Gửi hàng đi ${route.label}`}>
              <circle cx={pt[0]} cy={pt[1]} r={6} fill="#d92a0a" stroke="#fff" strokeWidth={2} />
              <text
                x={pt[0] + off.dx}
                y={pt[1] + off.dy}
                textAnchor={off.anchor}
                className="hidden fill-white text-[15px] font-bold sm:block"
              >
                {route.short}
                {eta && (
                  <tspan className="fill-[#ff9a3d] font-semibold">{` · ${eta.fromDays}–${eta.toDays} ngày`}</tspan>
                )}
              </text>
            </a>
          );
        })}

        <circle cx={origin[0]} cy={origin[1]} r={14} fill="#d92a0a" opacity={0.25} className="route-map-pulse" />
        <circle cx={origin[0]} cy={origin[1]} r={7} fill="#d92a0a" stroke="#fff" strokeWidth={2} />
        <text x={origin[0] - 14} y={origin[1] + 30} textAnchor="end" className="hidden fill-white text-[15px] font-bold sm:block">
          Việt Nam
        </text>
      </svg>

      {hasEta && (
        <figcaption className="mt-2 text-xs text-[#c9d1e0]">
          Thời gian giao thường gặp, tính từ ngày Falco nhận hàng trên các đơn đã giao gần đây.
        </figcaption>
      )}
    </figure>
  );
}
