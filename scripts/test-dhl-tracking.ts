/**
 * Script thử nghiệm key DHL Shipment Tracking Unified API với 1 mã vận đơn thật.
 * In ra JSON đã chuẩn hoá từ `fetchDhlTracking(code)`.
 *
 *   npx tsx scripts/test-dhl-tracking.ts <mã_vận_đơn_DHL>
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config();

import { DhlConfigError, DhlRateLimitError, fetchDhlTracking } from "../src/lib/dhl-tracking";

async function main() {
  const code = process.argv[2]?.trim();
  if (!code) {
    console.error("Cách dùng: npx tsx scripts/test-dhl-tracking.ts <mã_vận_đơn_DHL>");
    process.exit(1);
  }

  const result = await fetchDhlTracking(code);
  if (result === "notFound") {
    console.log(JSON.stringify({ code, notFound: true }, null, 2));
    return;
  }

  console.log(JSON.stringify(result, null, 2));
}

main().catch((err) => {
  if (err instanceof DhlConfigError) {
    console.error("Lỗi cấu hình:", err.message);
  } else if (err instanceof DhlRateLimitError) {
    console.error("Vượt hạn mức DHL (429):", err.message);
  } else {
    console.error("Lỗi gọi DHL API:", err instanceof Error ? err.message : String(err));
  }
  process.exit(1);
});
