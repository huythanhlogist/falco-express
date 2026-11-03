"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

/**
 * Cửa sổ dùng chung cho admin/FWD: vẽ ra ngoài cùng của trang (không bị lệch bởi khung cha), khoá cuộn nền,
 * Esc để đóng, tự đưa con trỏ vào ô đầu tiên, phần đầu/cuối cố định còn nội dung cuộn riêng.
 */
export default function Modal({
  open,
  title,
  subtitle,
  onClose,
  children,
  footer,
  size = "md",
  busy = false,
}: {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: "md" | "lg" | "xl";
  busy?: boolean;
}) {
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    document.addEventListener("keydown", onKey);
    const t = setTimeout(() => panel.current?.querySelector<HTMLElement>("input, textarea, select")?.focus(), 60);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", onKey);
      clearTimeout(t);
    };
  }, [open, busy, onClose]);

  if (!open) return null;
  const width = size === "xl" ? "max-w-3xl" : size === "lg" ? "max-w-2xl" : "max-w-lg";
  return createPortal(
    <div
      className="fixed inset-0 z-[90] flex items-end justify-center bg-navy-950/45 p-0 backdrop-blur-[1px] sm:items-center sm:p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`flex max-h-[92vh] w-full ${width} flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl`}
      >
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div className="min-w-0">
            <h2 className="truncate font-display text-base font-bold text-navy-900">{title}</h2>
            {subtitle && <p className="mt-0.5 truncate text-xs text-ink/55">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="Đóng"
            className="-mr-1 flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-ink/50 transition-colors hover:bg-mist hover:text-navy-900 focus-visible:outline-2 focus-visible:outline-flame-500"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex items-center justify-end gap-2 border-t border-line bg-mist/50 px-5 py-3">{footer}</div>}
      </div>
    </div>,
    document.body
  );
}
