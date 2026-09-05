import Reveal from "@/components/Reveal";
import { WHY_CHOOSE_US } from "@/lib/constants";
import { ShieldIcon, BoltIcon, LockIcon, EyeIcon } from "@/components/icons";

const ICONS = {
  shield: ShieldIcon,
  bolt: BoltIcon,
  lock: LockIcon,
  eye: EyeIcon,
} as const;

export default function WhyChooseUs() {
  return (
    <section className="section">
      <div className="container-page">
        <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
          <Reveal>
            <span className="eyebrow">Vì sao chọn Falco</span>
            <h2 className="mt-4 text-3xl font-extrabold leading-tight tracking-tight text-navy-900 sm:text-4xl">
              Giải pháp vận chuyển đáng tin cậy cho mọi hành trình
            </h2>
            <p className="mt-4 max-w-md text-ink/60">
              Dù là đơn hàng nội địa hay lô hàng xuyên biên giới, Falco Express
              đồng hành cùng bạn với quy trình rõ ràng và đội ngũ tận tâm ở
              từng chặng.
            </p>
          </Reveal>

          <div className="grid gap-5 sm:grid-cols-2">
            {WHY_CHOOSE_US.map((item, i) => {
              const Icon = ICONS[item.icon as keyof typeof ICONS];
              return (
                <Reveal key={item.title} delay={i * 0.06}>
                  <div className="card h-full p-6">
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-flame-50 text-flame-600">
                      <Icon className="h-5 w-5" />
                    </span>
                    <h3 className="mt-4 text-lg font-bold text-navy-900">
                      {item.title}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-ink/60">
                      {item.description}
                    </p>
                  </div>
                </Reveal>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
