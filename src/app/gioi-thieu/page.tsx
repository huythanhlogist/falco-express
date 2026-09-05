import type { Metadata } from "next";
import PageHero from "@/components/PageHero";
import Reveal from "@/components/Reveal";
import BranchesSection from "@/components/BranchesSection";
import CTABanner from "@/components/CTABanner";
import { STATS } from "@/lib/constants";
import {
  BoltIcon,
  CheckCircleIcon,
  EyeIcon,
  ShieldIcon,
} from "@/components/icons";

export const metadata: Metadata = {
  title: "Giới thiệu",
  description:
    "Falco Express Logistics – đơn vị chuyển phát nhanh nội địa và quốc tế, đồng hành cùng khách hàng với sự uy tín, nhanh chóng và tận tâm.",
};

const VALUES = [
  {
    title: "Uy tín",
    description: "Giữ đúng cam kết về thời gian và chất lượng dịch vụ với từng khách hàng.",
    icon: ShieldIcon,
  },
  {
    title: "Tận tâm",
    description: "Đặt trải nghiệm khách hàng làm trung tâm trong mọi quyết định vận hành.",
    icon: CheckCircleIcon,
  },
  {
    title: "Nhanh chóng",
    description: "Tối ưu quy trình vận chuyển để rút ngắn thời gian giao nhận.",
    icon: BoltIcon,
  },
  {
    title: "Minh bạch",
    description: "Thông tin đơn hàng, chi phí và hành trình được công khai rõ ràng.",
    icon: EyeIcon,
  },
];

export default function AboutPage() {
  return (
    <>
      <PageHero
        eyebrow="Giới thiệu"
        title="Falco Express Logistics"
        description="Kết nối giá trị – Giao hàng tận tâm. Falco Express là đơn vị chuyển phát nhanh nội địa và quốc tế, đồng hành cùng hàng nghìn khách hàng cá nhân và doanh nghiệp trên khắp cả nước."
      />

      <section className="section">
        <div className="container-page grid gap-12 lg:grid-cols-2 lg:gap-16">
          <Reveal>
            <span className="eyebrow">Câu chuyện của chúng tôi</span>
            <h2 className="mt-4 text-3xl font-extrabold leading-tight tracking-tight text-navy-900 sm:text-4xl">
              Hơn 2 năm đồng hành cùng hàng hoá Việt Nam vươn xa
            </h2>
            <div className="mt-5 space-y-4 text-ink/65">
              <p>
                Được thành lập với mục tiêu trở thành cầu nối vận chuyển đáng
                tin cậy, Falco Express bắt đầu từ dịch vụ chuyển phát nội địa
                và nhanh chóng mở rộng sang mảng vận chuyển quốc tế, đáp ứng
                nhu cầu giao thương ngày càng lớn của khách hàng.
              </p>
              <p>
                Sau hơn 2 năm hoạt động, Falco Express đã xây dựng mạng lưới 3
                chi nhánh tại Hà Nội, TP. Hồ Chí Minh và Nghệ An, xử lý hàng
                chục nghìn đơn hàng mỗi năm và từng bước khẳng định vị thế là
                một trong những đơn vị chuyển phát uy tín hàng đầu khu vực.
              </p>
              <p>
                Với đội ngũ giàu kinh nghiệm cùng quy trình vận hành chặt chẽ,
                chúng tôi cam kết mang đến dịch vụ nhanh chóng, an toàn và
                minh bạch cho mọi lô hàng – từ những kiện hàng nhỏ nhất đến các
                lô hàng thương mại quy mô lớn.
              </p>
            </div>
          </Reveal>

          <Reveal delay={0.1}>
            <div className="card h-full bg-navy-gradient p-8 text-white sm:p-10">
              <p className="text-sm font-bold uppercase tracking-wider text-flame-400">
                Sứ mệnh
              </p>
              <p className="mt-3 text-2xl font-extrabold leading-snug">
                “Kết nối giá trị – Giao hàng tận tâm”
              </p>
              <p className="mt-4 text-sm leading-relaxed text-white/70">
                Chúng tôi tin rằng mỗi đơn hàng không chỉ là một kiện hàng cần
                vận chuyển, mà còn là niềm tin khách hàng gửi gắm. Falco Express
                nỗ lực mỗi ngày để niềm tin đó luôn được trân trọng.
              </p>
              <div className="mt-8 grid grid-cols-2 gap-6 border-t border-white/10 pt-6">
                {STATS.map((s) => (
                  <div key={s.label}>
                    <p className="font-display text-2xl font-extrabold">{s.value}</p>
                    <p className="mt-1 text-xs text-white/60">{s.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="section bg-mist">
        <div className="container-page">
          <Reveal>
            <span className="eyebrow">Giá trị cốt lõi</span>
            <h2 className="mt-4 max-w-lg text-3xl font-extrabold leading-tight tracking-tight text-navy-900 sm:text-4xl">
              Những điều làm nên Falco Express
            </h2>
          </Reveal>

          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {VALUES.map((v, i) => (
              <Reveal key={v.title} delay={i * 0.06}>
                <div className="card h-full p-6">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-flame-50 text-flame-600">
                    <v.icon className="h-5 w-5" />
                  </span>
                  <h3 className="mt-4 text-lg font-bold text-navy-900">{v.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-ink/60">
                    {v.description}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <BranchesSection />
      <CTABanner />
    </>
  );
}
