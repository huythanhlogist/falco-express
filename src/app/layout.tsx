import type { Metadata } from "next";
import { Be_Vietnam_Pro } from "next/font/google";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { SITE } from "@/lib/constants";

const beVietnamPro = Be_Vietnam_Pro({
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-be-vietnam",
  display: "swap",
});

const SEO_DESCRIPTION =
  "Falco Express – gửi hàng, thực phẩm và quà từ Việt Nam sang Châu Âu, Vương quốc Anh (Anh, Đức, Pháp, Hà Lan, Séc, Ba Lan...) cho người Việt xa xứ. Nhanh chóng, an toàn, minh bạch, hỗ trợ trọn gói thủ tục hải quan.";

export const metadata: Metadata = {
  metadataBase: new URL("https://falcoexpress.vn"),
  title: {
    default: `${SITE.name} – Gửi hàng Việt Nam sang Châu Âu & Anh`,
    template: `%s | ${SITE.name}`,
  },
  description: SEO_DESCRIPTION,
  keywords: [
    "Falco Express",
    "gửi hàng đi Anh",
    "gửi hàng đi Đức",
    "gửi hàng từ Việt Nam sang Châu Âu",
    "gửi thực phẩm Việt sang Anh",
    "chuyển phát nhanh quốc tế",
    "vận chuyển hàng hóa",
    "kho vận",
    "tra cứu vận đơn",
  ],
  openGraph: {
    title: `${SITE.name} – Gửi hàng Việt Nam sang Châu Âu & Anh`,
    description: SEO_DESCRIPTION,
    siteName: SITE.name,
    locale: "vi_VN",
    type: "website",
  },
  icons: {
    icon: "/icon.png",
    apple: "/apple-icon.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi" className={beVietnamPro.variable}>
      <body className="flex min-h-screen flex-col font-body">
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
