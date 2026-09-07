"use client";

import { useState } from "react";
import { CopyIcon, CheckIcon } from "@/components/icons";

async function copyText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // Trình duyệt cũ / trang không chạy trên HTTPS-context: dùng cách copy
    // dự phòng qua textarea ẩn thay vì Clipboard API.
    const el = document.createElement("textarea");
    el.value = text;
    el.style.position = "fixed";
    el.style.opacity = "0";
    document.body.appendChild(el);
    el.select();
    document.execCommand("copy");
    document.body.removeChild(el);
  }
}

export default function CopyOrderInfoButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function handleClick() {
    await copyText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      title={text}
      className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors ${
        copied ? "bg-emerald-50 text-emerald-700" : "bg-mist text-ink/60 hover:bg-line"
      }`}
    >
      {copied ? (
        <>
          <CheckIcon className="h-3.5 w-3.5" /> Đã copy
        </>
      ) : (
        <>
          <CopyIcon className="h-3.5 w-3.5" /> Copy
        </>
      )}
    </button>
  );
}
