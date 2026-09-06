"use client";

import { motion, useInView, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

/**
 * Hiệu ứng hiện dần khi cuộn tới. Dùng `useInView` (dựa trên
 * IntersectionObserver) làm cách hiện chính, NHƯNG luôn có một mốc thời
 * gian dự phòng: nếu sau 1 giây trình duyệt vẫn chưa báo phần tử đang
 * hiển thị (từng gặp trên một số trình duyệt di động/app trong app khi
 * trang tải trong lúc chưa được coi là "đang hiển thị"), nội dung vẫn
 * được hiện ra — tránh bị kẹt ở trạng thái vô hình vĩnh viễn.
 */
export default function Reveal({
  children,
  delay = 0,
  y = 18,
  className,
}: {
  children: ReactNode;
  delay?: number;
  y?: number;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px 0px" });
  const [fallbackVisible, setFallbackVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setFallbackVisible(true), 1000);
    return () => clearTimeout(timer);
  }, []);

  const visible = inView || fallbackVisible;

  return (
    <motion.div
      ref={ref}
      className={className}
      initial={reduce ? undefined : { opacity: 0, y }}
      animate={reduce || visible ? { opacity: 1, y: 0 } : undefined}
      transition={{ duration: 0.55, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}
