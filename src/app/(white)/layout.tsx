import "@fontsource-variable/plus-jakarta-sans";
import "../globals.css";

// Layout gốc RIÊNG cho trang tra cứu thương hiệu FWD (/t/<slug> và <slug>.<tên-miền-tracking>):
// không có SiteChrome, JSON-LD, metadata, favicon hay bất kỳ thứ gì của Falco.
export default function WhiteLabelRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body className="font-body">{children}</body>
    </html>
  );
}
