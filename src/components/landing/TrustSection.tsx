import { WHY_CHOOSE_US } from "@/lib/constants";
import { BoltIcon, EyeIcon, LockIcon, ShieldIcon } from "@/components/icons";
import SectionHeading from "./SectionHeading";

const ICONS = { shield: ShieldIcon, bolt: BoltIcon, lock: LockIcon, eye: EyeIcon } as const;

export default function TrustSection() {
  return (
    <section className="lp-container pt-14 sm:pt-20 lg:pt-[100px]">
      <SectionHeading eyebrow="Vì sao chọn Falco" title="Giải pháp vận chuyển đáng tin cậy" />
      <div className="mt-6 grid gap-px border border-falco-border bg-falco-border sm:mt-10 sm:grid-cols-2 lg:grid-cols-4">
        {WHY_CHOOSE_US.map((item) => {
          const Icon = ICONS[item.icon as keyof typeof ICONS];
          return (
            <div key={item.title} className="bg-white p-6 sm:p-7">
              <span className="flex h-11 w-11 items-center justify-center bg-falco-navy text-white">
                <Icon className="h-5 w-5" />
              </span>
              <h3 className="mt-4 text-lg font-bold text-falco-navy">{item.title}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-falco-muted">{item.description}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
