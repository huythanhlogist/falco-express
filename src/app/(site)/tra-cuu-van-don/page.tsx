import type { Metadata } from "next";
import { Suspense } from "react";
import PageHero from "@/components/PageHero";
import TrackingLookup from "@/components/TrackingLookup";
import CTABanner from "@/components/CTABanner";
import { resolveMetadataOverride } from "@/lib/seo";

export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  return resolveMetadataOverride("/tra-cuu-van-don", {
    title: "Tra cứu vận đơn",
    description: "Tra cứu trạng thái vận đơn Falco Express theo mã vận đơn.",
  });
}

export default function TrackingPage() {
  return (
    <>
      <PageHero
        eyebrow="Tra cứu vận đơn"
        title="Theo dõi hành trình đơn hàng của bạn"
        description="Nhập mã vận đơn để xem trạng thái mới nhất của đơn hàng."
      />

      <section className="section">
        <div className="container-page">
          <Suspense fallback={null}>
            <TrackingLookup />
          </Suspense>
        </div>
      </section>

      <CTABanner />
    </>
  );
}
