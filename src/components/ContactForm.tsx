"use client";

import { useState } from "react";
import { ArrowRightIcon, CheckCircleIcon } from "@/components/icons";

type Status = "idle" | "loading" | "success" | "error";

export default function ContactForm() {
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("loading");
    setErrorMsg("");

    const form = e.currentTarget;
    const data = {
      name: (form.elements.namedItem("name") as HTMLInputElement).value,
      phone: (form.elements.namedItem("phone") as HTMLInputElement).value,
      email: (form.elements.namedItem("email") as HTMLInputElement).value,
      message: (form.elements.namedItem("message") as HTMLTextAreaElement).value,
      // Trang khách đang đứng khi bấm gửi — dùng để biết trang/tuyến nào
      // thực sự ra khách (VD /gui-hang-di-duc), phục vụ đánh giá hiệu quả
      // từng trang SEO thay vì chỉ nhìn lượt truy cập.
      sourcePage: typeof window !== "undefined" ? window.location.pathname : "",
    };

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Có lỗi xảy ra");
      setStatus("success");
      form.reset();
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Có lỗi xảy ra");
    }
  }

  if (status === "success") {
    return (
      <div className="card flex h-full flex-col items-center justify-center p-10 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-flame-50 text-flame-600">
          <CheckCircleIcon className="h-7 w-7" />
        </span>
        <h3 className="mt-4 text-lg font-bold text-navy-900">Đã gửi thành công!</h3>
        <p className="mt-2 max-w-xs text-sm text-ink/60">
          Cảm ơn bạn đã liên hệ. Đội ngũ Falco Express sẽ phản hồi trong thời
          gian sớm nhất.
        </p>
        <button
          type="button"
          onClick={() => setStatus("idle")}
          className="btn-outline mt-6"
        >
          Gửi yêu cầu khác
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="card space-y-4 p-6 sm:p-8">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="name" className="mb-1.5 block text-sm font-semibold text-navy-900">
            Họ và tên
          </label>
          <input
            id="name"
            name="name"
            required
            placeholder="Nguyễn Văn A"
            className="w-full rounded-xl border border-line px-4 py-2.5 text-sm text-ink placeholder:text-ink/35 focus:border-flame-400"
          />
        </div>
        <div>
          <label htmlFor="phone" className="mb-1.5 block text-sm font-semibold text-navy-900">
            Số điện thoại
          </label>
          <input
            id="phone"
            name="phone"
            required
            type="tel"
            placeholder="09xx xxx xxx"
            className="w-full rounded-xl border border-line px-4 py-2.5 text-sm text-ink placeholder:text-ink/35 focus:border-flame-400"
          />
        </div>
      </div>

      <div>
        <label htmlFor="email" className="mb-1.5 block text-sm font-semibold text-navy-900">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          placeholder="ban@vidu.com"
          className="w-full rounded-xl border border-line px-4 py-2.5 text-sm text-ink placeholder:text-ink/35 focus:border-flame-400"
        />
      </div>

      <div>
        <label htmlFor="message" className="mb-1.5 block text-sm font-semibold text-navy-900">
          Nội dung
        </label>
        <textarea
          id="message"
          name="message"
          required
          rows={4}
          placeholder="Bạn cần hỗ trợ vận chuyển gì?"
          className="w-full resize-none rounded-xl border border-line px-4 py-2.5 text-sm text-ink placeholder:text-ink/35 focus:border-flame-400"
        />
      </div>

      {status === "error" && (
        <p className="text-sm font-medium text-flame-700">{errorMsg}</p>
      )}

      <button type="submit" disabled={status === "loading"} className="btn-primary w-full">
        {status === "loading" ? "Đang gửi..." : "Gửi yêu cầu"}
        {status !== "loading" && <ArrowRightIcon className="h-4 w-4" />}
      </button>
    </form>
  );
}
