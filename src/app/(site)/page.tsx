import type { Metadata } from "next";
import Hero from "@/components/landing/Hero";
import TrackingStats from "@/components/landing/TrackingStats";
import ServicesSection from "@/components/landing/ServicesSection";
import RoutesSection from "@/components/landing/RoutesSection";
import TrustSection from "@/components/landing/TrustSection";
import ProcessSection from "@/components/landing/ProcessSection";
import BlogSection from "@/components/landing/BlogSection";
import CtaBand from "@/components/landing/CtaBand";
import FaqBranches from "@/components/landing/FaqBranches";
import { SITE } from "@/lib/constants";
import { LANDING_FAQS } from "@/lib/landing-content";
import { resolveMetadataOverride } from "@/lib/seo";

export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  // title dùng "absolute" để không bị layout.tsx nối thêm "| FALCO EXPRESS"
  // vào trang chủ (trang chủ đã có tên thương hiệu trong tiêu đề rồi).
  const { title, description, alternates } = await resolveMetadataOverride("/", {
    title: `${SITE.name} – Gửi hàng Việt Nam sang Châu Âu & Anh`,
    description:
      "Falco Express – gửi hàng, thực phẩm và quà từ Việt Nam sang Châu Âu, Vương quốc Anh (Anh, Đức, Pháp, Hà Lan, Séc, Ba Lan...) cho người Việt xa xứ. Nhanh chóng, an toàn, minh bạch, hỗ trợ trọn gói thủ tục hải quan.",
  });
  return { title: { absolute: title }, description, alternates };
}

const FAQ_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: LANDING_FAQS.map((faq) => ({
    "@type": "Question",
    name: faq.question,
    acceptedAnswer: { "@type": "Answer", text: faq.answer },
  })),
};

export default function HomePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ_JSON_LD) }}
      />
      <Hero />
      <TrackingStats />
      <ServicesSection />
      <RoutesSection />
      <TrustSection />
      <ProcessSection />
      <BlogSection />
      <CtaBand />
      <FaqBranches />
    </>
  );
}
