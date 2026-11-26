import type mysql from "mysql2/promise";
import { getPool } from "@/lib/db";

/**
 * Đơn "Cần chú ý" mà nhân viên đã bấm Ẩn trên trang Tổng quan.
 * Lưu kèm trạng thái lúc ẩn: khi trạng thái tracking đổi, cảnh báo tự hiện lại.
 */
let tableReady: Promise<void> | null = null;

function ensureTable(): Promise<void> {
  if (!tableReady) {
    tableReady = getPool()
      .query(
        `CREATE TABLE IF NOT EXISTS dashboard_alert_dismissals (
           order_id INT NOT NULL PRIMARY KEY,
           status_at_dismiss VARCHAR(40) NOT NULL,
           dismissed_by VARCHAR(190) NULL,
           dismissed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
         )`
      )
      .then(() => undefined)
      .catch((err) => {
        tableReady = null;
        throw err;
      });
  }
  return tableReady;
}

export function statusKey(status: string | null | undefined): string {
  return status ?? "none";
}

/** order_id → trạng thái lúc bấm ẩn */
export async function loadAlertDismissals(): Promise<Map<number, string>> {
  await ensureTable();
  const [rows] = await getPool().query<mysql.RowDataPacket[]>(
    "SELECT order_id, status_at_dismiss FROM dashboard_alert_dismissals"
  );
  return new Map(rows.map((r) => [Number(r.order_id), String(r.status_at_dismiss)]));
}

export async function dismissAlert(orderId: number, status: string | null, by: string | null): Promise<void> {
  await ensureTable();
  await getPool().query(
    `INSERT INTO dashboard_alert_dismissals (order_id, status_at_dismiss, dismissed_by)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE status_at_dismiss = VALUES(status_at_dismiss),
       dismissed_by = VALUES(dismissed_by), dismissed_at = CURRENT_TIMESTAMP`,
    [orderId, statusKey(status), by]
  );
}

export async function undismissAlert(orderId: number): Promise<void> {
  await ensureTable();
  await getPool().query("DELETE FROM dashboard_alert_dismissals WHERE order_id = ?", [orderId]);
}
