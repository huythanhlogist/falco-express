"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * Thanh tiến trình mỏng ở đầu trang: hiện NGAY khi bấm link/lọc/phân trang nội bộ (trước khi server trả
 * dữ liệu) và tắt khi đường dẫn hoặc bộ lọc đã đổi — để thao tác luôn có phản hồi tức thì thay vì "đứng hình".
 */
export default function NavProgress() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const [width, setWidth] = useState(0);
  const [visible, setVisible] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const stop = () => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
  };

  // Đã chuyển xong trang: chạy nốt 100% rồi ẩn.
  useEffect(() => {
    stop();
    setWidth(100);
    const t = setTimeout(() => {
      setVisible(false);
      setWidth(0);
    }, 220);
    return () => clearTimeout(t);
  }, [pathname, search]);

  useEffect(() => {
    const start = () => {
      stop();
      setVisible(true);
      setWidth(12);
      timer.current = setInterval(() => setWidth((w) => (w < 90 ? w + (90 - w) * 0.12 : w)), 200);
    };
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as HTMLElement | null)?.closest?.("a");
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin || url.pathname.startsWith("/api/")) return;
      if (url.pathname === location.pathname && url.search === location.search) return;
      start();
    };
    const onSubmit = (e: SubmitEvent) => {
      const f = e.target as HTMLFormElement | null;
      if (f && !f.getAttribute("action") && (f.method || "get").toLowerCase() === "get") start();
    };
    document.addEventListener("click", onClick);
    document.addEventListener("submit", onSubmit);
    return () => {
      document.removeEventListener("click", onClick);
      document.removeEventListener("submit", onSubmit);
      stop();
    };
  }, []);

  return (
    <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-0.5">
      <div
        className="h-full bg-flame-500 shadow-[0_0_8px_rgba(240,90,30,0.6)]"
        style={{ width: `${width}%`, opacity: visible ? 1 : 0, transition: "width 200ms ease-out, opacity 200ms ease-out" }}
      />
    </div>
  );
}
