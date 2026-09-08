"use client";

import Script from "next/script";
import { SITE } from "@/lib/constants";

/**
 * Widget chat chính thức của Zalo OA (không phải tự dựng) — script SDK của
 * Zalo tự tìm div.zalo-chat-widget và tự vẽ nút chat nổi ở góc phải dưới,
 * tự xử lý mở popup/deep-link sang app Zalo. Chỉ cần đúng data-oaid.
 */
export default function ZaloOAWidget() {
  return (
    <>
      <div
        className="zalo-chat-widget"
        data-oaid={SITE.zaloOAId}
        data-welcome-message="Chào bạn! Falco Express có thể hỗ trợ gì cho bạn?"
        data-autopopup="0"
        data-width=""
        data-height=""
      />
      <Script src="https://sp.zalo.me/plugins/sdk.js" strategy="lazyOnload" />
    </>
  );
}
