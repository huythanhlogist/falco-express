"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { STATS } from "@/lib/constants";

// Nhãn ngắn theo thiết kế (cùng số liệu với STATS trong constants).
const SHORT_LABELS: Record<string, string> = {
  "Năm hoạt động": "Năm hoạt động",
  "Chi nhánh toàn quốc": "Chi nhánh",
  "Đơn hàng đã xử lý": "Đơn đã xử lý",
  "Đơn giao đúng hẹn": "Giao đúng hẹn",
};
const shortLabel = (label: string) => SHORT_LABELS[label] ?? label;

// Form tra cứu nổi đè mép hero + số liệu. Logic giữ nguyên bản cũ: chuyển
// sang /tra-cuu-van-don?ma=<mã> (trang đó tự gọi API tra cứu).
export default function TrackingStats() {
  const [code, setCode] = useState("");
  const router = useRouter();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = code.trim();
    router.push(trimmed ? `/tra-cuu-van-don?ma=${encodeURIComponent(trimmed)}` : "/tra-cuu-van-don");
  }

  const desktopStats = ["50.000+", "99%", "3"].map((value) => STATS.find((s) => s.value === value)).filter(Boolean);

  return (
    <section className="relative z-10 -mt-10 lg:-mt-[70px]" aria-label="Tra cứu vận đơn">
      <div className="lp-container">
        <div className="overflow-hidden bg-white shadow-float-sm lg:flex lg:shadow-float">
          <form onSubmit={handleSubmit} className="min-w-0 lg:flex-[999_1_520px]">
            <label
              htmlFor="home-tracking"
              className="block bg-falco-navy px-4 py-3 text-sm font-bold uppercase text-white lg:bg-transparent lg:px-8 lg:pb-3 lg:pt-7 lg:text-lg lg:normal-case lg:text-falco-navy"
            >
              Tra cứu vận đơn
            </label>
            <div className="flex flex-col gap-2.5 px-4 pb-4 pt-3.5 sm:flex-row sm:gap-2.5 lg:px-8 lg:pb-7 lg:pt-0">
              <input
                id="home-tracking"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Nhập mã vận đơn, ví dụ FL261012004"
                autoComplete="off"
                className="h-12 min-w-0 flex-1 border border-[#cdd3de] bg-white px-3.5 text-[15px] text-falco-text placeholder:text-[#8a93a5] focus:border-falco-navy lg:h-[54px] lg:border-[1.5px] lg:border-[#dde2ea] lg:bg-[#f8f9fb] lg:px-[18px]"
              />
              <button
                type="submit"
                className="h-12 bg-falco-accent px-8 text-sm font-bold uppercase tracking-wide text-white transition-colors hover:bg-falco-accent-dark lg:h-[54px] lg:bg-falco-navy lg:text-[15px] lg:normal-case lg:tracking-normal lg:hover:bg-falco-navy-dark"
              >
                Tra cứu
              </button>
            </div>
          </form>

          <div className="hidden grid-cols-3 border-l border-[#edf0f4] bg-[#f6f7f9] lg:grid lg:flex-[1_1_420px]">
            {desktopStats.map((s) => (
              <div key={s!.label} className="px-5 py-[26px]">
                <p className="text-[30px] font-extrabold leading-tight tracking-[-0.02em] text-falco-navy">{s!.value}</p>
                <p className="text-[13px] text-[#6a7385]">
                  {s!.label}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-x-3 gap-y-5 px-1 pb-2 pt-8 text-center lg:hidden">
          {STATS.map((s) => (
            <div key={s.label}>
              <p className="text-[28px] font-extrabold leading-tight text-falco-accent">{s.value}</p>
              <p className="text-[13px] text-falco-muted">{shortLabel(s.label)}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
