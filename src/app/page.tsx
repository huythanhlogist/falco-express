import type { Metadata } from "next";
import Hero from "@/components/Hero";
import WhyChooseUs from "@/components/WhyChooseUs";
import ServicesGrid from "@/components/ServicesGrid";
import BranchesSection from "@/components/BranchesSection";
import FaqSection from "@/components/FaqSection";
import CTABanner from "@/components/CTABanner";
import { SITE } from "@/lib/constants";
import { resolveMetadataOverride } from "@/lib/seo";

export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  // title dùng "absolute" để không bị layout.tsx nối thêm "| FALCO EXPRESS"
  // vào trang chủ (trang chủ đã có tên thương hiệu trong tiêu đề rồi).
  const { title, description } = await resolveMetadataOverride("/", {
    title: `${SITE.name} – Gửi hàng Việt Nam sang Châu Âu & Anh`,
    description:
      "Falco Express – gửi hàng, thực phẩm và quà từ Việt Nam sang Châu Âu, Vương quốc Anh (Anh, Đức, Pháp, Hà Lan, Séc, Ba Lan...) cho người Việt xa xứ. Nhanh chóng, an toàn, minh bạch, hỗ trợ trọn gói thủ tục hải quan.",
  });
  return { title: { absolute: title }, description };
}

export default function HomePage() {
  return (
    <>
      <Hero />
      <WhyChooseUs />
      <ServicesGrid />
      <BranchesSection />
      <FaqSection />
      <CTABanner />
    </>
  );
}
