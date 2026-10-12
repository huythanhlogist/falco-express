"use client";

import { useState } from "react";
import { BRANCHES, SITE } from "@/lib/constants";
import { LANDING_FAQS } from "@/lib/landing-content";

export default function FaqBranches() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section className="lp-container flex flex-wrap gap-8 py-14 sm:gap-12 sm:py-20 lg:py-[100px]">
      <div className="min-w-0 flex-[999_1_560px]">
        <p className="lp-eyebrow">Câu hỏi thường gặp</p>
        <h2 className="lp-h2 mb-1 mt-2.5 lg:text-[38px]">Giải đáp trước khi gửi</h2>
        <div className="mb-5 mt-2.5 h-[3px] w-12 bg-falco-accent sm:hidden" aria-hidden />
        <div className="mt-5 flex flex-col gap-2.5 sm:mt-6">
          {LANDING_FAQS.map((faq, i) => {
            const open = openIndex === i;
            return (
              <div key={faq.question} className="border border-falco-border">
                <h3>
                  <button
                    type="button"
                    onClick={() => setOpenIndex(open ? null : i)}
                    className="flex min-h-[56px] w-full items-center justify-between gap-4 px-[22px] py-[18px] text-left font-bold text-falco-navy"
                    aria-expanded={open}
                    aria-controls={`faq-panel-${i}`}
                    id={`faq-btn-${i}`}
                  >
                    <span>{faq.question}</span>
                    <span aria-hidden className="shrink-0 text-xl leading-none text-falco-accent">
                      {open ? "−" : "+"}
                    </span>
                  </button>
                </h3>
                {open && (
                  <div id={`faq-panel-${i}`} role="region" aria-labelledby={`faq-btn-${i}`} className="px-[22px] pb-[18px]">
                    <p className="text-[15px] leading-relaxed text-falco-muted">{faq.answer}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <aside className="min-w-0 flex-[1_1_320px] self-start bg-falco-surface p-6 sm:p-7">
        <h3 className="mb-4 text-xl font-extrabold text-falco-navy">Hệ thống chi nhánh</h3>
        <ul>
          {BRANCHES.map((b, i) => (
            <li key={b.code} className={`py-3.5 ${i < BRANCHES.length - 1 ? "border-b border-[#e3e7ed]" : ""}`}>
              <p className="font-bold text-falco-navy">{b.city}</p>
              <p className="text-sm text-falco-muted">{b.address}</p>
            </li>
          ))}
        </ul>
        <a href={SITE.hotlineHref} className="lp-btn-navy mt-3.5 w-full">
          Gọi {SITE.hotline}
        </a>
      </aside>
    </section>
  );
}
