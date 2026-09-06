"use client";

import { useState } from "react";
import Reveal from "@/components/Reveal";
import { SITE } from "@/lib/constants";
import { ArrowRightIcon } from "@/components/icons";

const FAQS = [
  {
    question: "Gửi thực phẩm Việt Nam sang Anh, Đức có được không?",
    answer:
      "Có. Falco Express nhận gửi thực phẩm khô, đặc sản, gia vị và đồ ăn đóng gói sẵn sang Anh, Đức, Pháp, Hà Lan, Séc, Ba Lan và nhiều nước Châu Âu khác. Đội ngũ Falco sẽ tư vấn loại thực phẩm được phép gửi và cách đóng gói đúng quy định hải quan của từng nước.",
  },
  {
    question: "Gửi hàng từ Việt Nam sang Châu Âu mất bao lâu?",
    answer:
      "Tuỳ tuyến và dịch vụ, thời gian vận chuyển thường dao động vài ngày đến khoảng 1-2 tuần kể từ khi bàn giao cho đối tác vận chuyển quốc tế. Bạn có thể theo dõi hành trình đơn hàng theo thời gian thực ngay trên trang Tra cứu vận đơn.",
  },
  {
    question: "Có cần lo thủ tục hải quan không?",
    answer:
      "Không. Falco Express hỗ trợ trọn gói thủ tục hải quan và chứng từ xuất khẩu — bạn chỉ cần đóng gói hàng và cung cấp thông tin người nhận, phần còn lại đội ngũ Falco sẽ xử lý.",
  },
  {
    question: "Cước phí gửi hàng đi Châu Âu tính như thế nào?",
    answer:
      "Cước phí phụ thuộc vào cân nặng, kích thước và nước đến. Liên hệ hotline hoặc Zalo để được báo giá cụ thể và nhanh chóng cho lô hàng của bạn.",
  },
];

export default function FaqSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section className="section bg-mist">
      <div className="container-page">
        <Reveal>
          <span className="eyebrow">Câu hỏi thường gặp</span>
          <h2 className="mt-4 max-w-xl text-3xl font-extrabold leading-tight tracking-tight text-navy-900 sm:text-4xl">
            Giải đáp thắc mắc khi gửi hàng sang Châu Âu
          </h2>
        </Reveal>

        <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_1fr] lg:gap-12">
          <div className="space-y-3">
            {FAQS.map((faq, i) => {
              const isOpen = openIndex === i;
              return (
                <Reveal key={faq.question} delay={i * 0.05}>
                  <div className="card overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setOpenIndex(isOpen ? null : i)}
                      className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
                      aria-expanded={isOpen}
                    >
                      <span className="text-sm font-semibold text-navy-900 sm:text-base">
                        {faq.question}
                      </span>
                      <span
                        className={`shrink-0 text-xl font-bold text-flame-500 transition-transform duration-200 ${
                          isOpen ? "rotate-45" : ""
                        }`}
                        aria-hidden
                      >
                        +
                      </span>
                    </button>
                    {isOpen && (
                      <p className="px-5 pb-5 text-sm leading-relaxed text-ink/60">
                        {faq.answer}
                      </p>
                    )}
                  </div>
                </Reveal>
              );
            })}
          </div>

          <Reveal delay={0.15}>
            <div className="card flex h-full flex-col justify-center bg-navy-gradient p-8 text-white sm:p-10">
              <p className="text-sm font-bold uppercase tracking-wider text-flame-400">
                Còn thắc mắc khác?
              </p>
              <p className="mt-3 text-xl font-extrabold leading-snug">
                Nhắn Zalo hoặc gọi hotline, Falco Express tư vấn miễn phí
              </p>
              <p className="mt-3 text-sm leading-relaxed text-white/70">
                Đội ngũ Falco sẵn sàng hỗ trợ bạn chọn dịch vụ, tính cước phí và
                hướng dẫn đóng gói phù hợp cho từng loại hàng gửi sang Châu Âu.
              </p>
              <a href={SITE.zaloHref} target="_blank" rel="noopener noreferrer" className="btn mt-6 w-fit bg-white text-navy-800 hover:brightness-95">
                Nhắn Zalo ngay
                <ArrowRightIcon className="h-4 w-4" />
              </a>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
