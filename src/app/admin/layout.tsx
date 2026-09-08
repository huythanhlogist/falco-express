import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "FALCO Admin",
  manifest: "/admin-manifest.json",
  icons: {
    icon: "/falco-icon.png",
    apple: "/falco-icon.png",
  },
  appleWebApp: {
    capable: true,
    title: "FALCO Admin",
    statusBarStyle: "default",
  },
  other: {
    // Next chỉ tự sinh "mobile-web-app-capable" (chuẩn mới) — thêm thẻ cũ
    // này để các bản iOS cũ hơn (trước khi Safari hỗ trợ chuẩn mới) vẫn
    // nhận đúng chế độ standalone khi "Thêm vào MH chính".
    "apple-mobile-web-app-capable": "yes",
  },
  // Trang quản trị nội bộ — không cần Google lập chỉ mục.
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#122844",
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-mist">{children}</div>;
}
