import { Plus_Jakarta_Sans } from "next/font/google";
import "../globals.css";

// Layout gốc RIÊNG cho trang tra cứu thương hiệu CTV (/t/<slug> và <slug>.<tên-miền-tracking>):
// không có SiteChrome, JSON-LD, metadata, favicon hay bất kỳ thứ gì của Falco.
const font = Plus_Jakarta_Sans({
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-jakarta",
  display: "swap",
});

export default function WhiteLabelRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" className={font.variable}>
      <body className="font-body">{children}</body>
    </html>
  );
}
