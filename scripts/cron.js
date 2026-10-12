// Chạy bằng cron "Node.js" của Hostinger (node --env-file=<.env của app> scripts/cron.js):
// gọi endpoint làm mới cache tracking, lấy CRON_SECRET từ biến môi trường của app
// nên không phải gõ secret vào cấu hình cron.
const secret = process.env.CRON_SECRET;
if (!secret) {
  console.error("Thiếu CRON_SECRET trong biến môi trường");
  process.exit(1);
}

const base = process.env.CRON_BASE_URL || "https://falcoexpress.com";

fetch(`${base}/api/cron/refresh-tracking`, {
  method: "POST",
  headers: { "x-cron-secret": secret },
  signal: AbortSignal.timeout(30000),
})
  .then(async (res) => {
    console.log(new Date().toISOString(), res.status, await res.text());
    process.exit(res.ok ? 0 : 1);
  })
  .catch((err) => {
    console.error(new Date().toISOString(), "Lỗi:", err.message);
    process.exit(1);
  });
