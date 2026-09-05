import Hero from "@/components/Hero";
import WhyChooseUs from "@/components/WhyChooseUs";
import ServicesGrid from "@/components/ServicesGrid";
import BranchesSection from "@/components/BranchesSection";
import CTABanner from "@/components/CTABanner";

export default function HomePage() {
  return (
    <>
      <Hero />
      <WhyChooseUs />
      <ServicesGrid />
      <BranchesSection />
      <CTABanner />
    </>
  );
}
