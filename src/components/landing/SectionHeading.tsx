import type { ReactNode } from "react";

// Eyebrow + H2 (+ vạch accent ngắn dưới tiêu đề trên mobile) + khối bên phải tuỳ chọn.
export default function SectionHeading({
  eyebrow,
  title,
  tone = "light",
  right,
}: {
  eyebrow: string;
  title: string;
  tone?: "light" | "dark";
  right?: ReactNode;
}) {
  const dark = tone === "dark";
  return (
    <div className="flex flex-wrap items-end justify-between gap-5">
      <div className="max-w-[640px]">
        <p className={`lp-eyebrow ${dark ? "lp-eyebrow-soft" : ""}`}>{eyebrow}</p>
        <h2 className={`lp-h2 mt-2.5 ${dark ? "!text-white" : ""}`}>{title}</h2>
        <div className="mb-1 mt-2.5 h-[3px] w-12 bg-falco-accent sm:hidden" aria-hidden />
      </div>
      {right}
    </div>
  );
}
