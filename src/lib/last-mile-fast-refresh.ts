import type mysql from "mysql2/promise";
import { getPool } from "@/lib/db";
import { fetchTrackingFor, saveKangoToCache } from "@/lib/tracking-cache";

/**
 * "Làn nhanh" cho tin Zalo "Sắp giao": mỗi lần n8n hỏi tin (5 phút/lần), lấy lại tracking cho vài
 * đơn ĐANG Ở CHẶNG CUỐI có dữ liệu cũ nhất (cron giờ vẫn lo các đơn khác). Gọi tuần tự, có ngân sách
 * thời gian, và chỉ 1 lượt chạy cùng lúc.
 */
let running = false;

export async function refreshLastMileFast(opts?: {
  maxOrders?: number;
  staleAfterMs?: number;
  budgetMs?: number;
}): Promise<{ candidates: number; refreshed: number; failed: number; skipped?: "busy" }> {
  if (running) return { candidates: 0, refreshed: 0, failed: 0, skipped: "busy" };
  running = true;
  const maxOrders = opts?.maxOrders ?? 15;
  const staleAfterMs = opts?.staleAfterMs ?? 10 * 60 * 1000;
  const budgetMs = opts?.budgetMs ?? 45 * 1000;
  const startedAt = Date.now();
  let refreshed = 0;
  let failed = 0;
  try {
    const [rows] = await getPool().query<mysql.RowDataPacket[]>(
      `SELECT o.id, o.awb, o.falco_code
       FROM orders o
       JOIN order_tracking_cache tc ON tc.order_id = o.id AND tc.awb = o.awb
       WHERE o.review_status IN ('auto_approved', 'approved')
         AND tc.shipment_status = 'last_mile'
         AND tc.fetched_at < ?
         AND COALESCE(o.received_date, DATE(o.created_at)) >= CURDATE() - INTERVAL 30 DAY
       ORDER BY tc.fetched_at ASC
       LIMIT ?`,
      [Date.now() - staleAfterMs, maxOrders]
    );
    const orders = rows as { id: number; awb: string; falco_code: string }[];
    for (const order of orders) {
      if (Date.now() - startedAt > budgetMs) break;
      try {
        const { kango, status } = await fetchTrackingFor(order);
        await saveKangoToCache(order, kango, status);
        refreshed++;
      } catch (err) {
        failed++;
        console.error(`[last-mile-fast] Lỗi làm mới ${order.falco_code}:`, err instanceof Error ? err.message : err);
        if (failed >= 3) break; // Kango đang lỗi → để lượt sau
      }
    }
    return { candidates: orders.length, refreshed, failed };
  } finally {
    running = false;
  }
}
