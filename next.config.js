/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  images: {
    formats: ["image/avif", "image/webp"],
  },
  // Không cần next tự sinh AGENTS.md/CLAUDE.md mỗi lần chạy `next dev`.
  agentRules: false,
};

module.exports = nextConfig;
