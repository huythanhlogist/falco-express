/**
 * Tính lại shipment_status của mọi dòng order_tracking_cache từ payload Kango đã lưu
 * (KHÔNG gọi Kango). Dùng sau khi đổi logic mapKangoStatus trong src/lib/shipment-status.ts.
 *
 *   npx tsx scripts/recompute-shipment-status.ts            # chạy thử, chỉ in
 *   npx tsx scripts/recompute-shipment-status.ts --apply    # ghi thật
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import dns from "node:dns";
dns.setDefaultResultOrder("ipv4first");
import { getPool } from "../src/lib/db";
import { mapKangoStatus } from "../src/lib/shipment-status";

async function main() {
  const apply = process.argv.includes("--apply");
  const [rows] = (await getPool().query(
    "SELECT c.order_id, c.shipment_status, c.payload FROM order_tracking_cache c JOIN orders o ON o.id = c.order_id WHERE c.payload IS NOT NULL AND o.falco_code NOT LIKE 'FEB%'"
  )) as any;
  const dist = new Map<string, number>();
  let changed = 0;
  for (const r of rows) {
    const next = mapKangoStatus(JSON.parse(r.payload));
    dist.set(next, (dist.get(next) ?? 0) + 1);
    if (next !== r.shipment_status) {
      changed++;
      if (apply) await getPool().query("UPDATE order_tracking_cache SET shipment_status = ? WHERE order_id = ?", [next, r.order_id]);
    }
  }
  console.log(`${rows.length} dòng, ${changed} dòng đổi trạng thái${apply ? " (đã ghi)" : " (chạy thử)"}`);
  console.log([...dist]);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
