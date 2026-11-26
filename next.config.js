/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  images: {
    formats: ["image/webp"],
  },
  // Không cần next tự sinh AGENTS.md/CLAUDE.md mỗi lần chạy `next dev`.
  agentRules: false,
  // Ẩn nút "N" của Next ở góc trái dưới khi chạy dev (đè lên nút Đăng xuất).
  devIndicators: false,
};

module.exports = nextConfig;
