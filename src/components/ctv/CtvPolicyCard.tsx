"use client";

import { useRef, useState } from "react";
import { toPng } from "html-to-image";
import { ImageDownloadIcon } from "@/components/icons";
import { FALCO_LOGO_DATA_URI } from "@/lib/falco-logo-data-uri";
import { compositeFalcoLogo } from "@/lib/composite-logo";
import { saveOrDownloadImage } from "@/lib/download-image";

const CARD_WIDTH = 720;

type PolicyContact = {
  name: string;
  phone: string;
  zaloHref: string;
  website: string;
  websiteHref: string;
};

export default function CtvPolicyCard({
  items,
  contact,
}: {
  items: { id: number; content: string }[];
  contact: PolicyContact;
}) {
  const [downloading, setDownloading] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const logoRef = useRef<HTMLDivElement>(null);

  async function downloadImage() {
    if (!cardRef.current) return;
    setDownloading(true);
    try {
      let dataUrl = await toPng(cardRef.current, {
        width: CARD_WIDTH,
        pixelRatio: 2,
        backgroundColor: "#ffffff",
        skipFonts: true,
      });
      if (logoRef.current) {
        dataUrl = await compositeFalcoLogo(dataUrl, cardRef.current, logoRef.current);
      }
      await saveOrDownloadImage(dataUrl, "falco-chinh-sach-van-chuyen.png");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div>
      <div className="flex items-center gap-3">
        <button type="button" onClick={downloadImage} disabled={downloading} className="btn-primary !px-4 !py-2 text-sm disabled:opacity-50">
          <ImageDownloadIcon className="h-4 w-4" />
          {downloading ? "Đang tạo ảnh..." : "Tải ảnh chính sách"}
        </button>
      </div>

      <div className="mt-3 overflow-x-auto rounded-xl border border-line">
        <div ref={cardRef} style={{ width: CARD_WIDTH }} className="bg-white">
          <div className="relative bg-falco-gradient-diag px-6 pb-8 pt-5 text-white">
            <div className="absolute inset-x-0 bottom-0 h-5 rounded-t-3xl bg-white" />
            <div className="flex items-center gap-3">
              <div
                ref={logoRef}
                role="img"
                aria-label="Falco Express"
                className="h-8 w-8 shrink-0 rounded-full bg-white bg-center bg-no-repeat"
                style={{ backgroundImage: `url(${FALCO_LOGO_DATA_URI})`, backgroundSize: "88%" }}
              />
              <div>
                <p className="text-sm font-extrabold tracking-wide">FALCO EXPRESS</p>
                <p className="text-[10px] opacity-85">Chính sách vận chuyển</p>
              </div>
            </div>
          </div>
          <div className="px-6 pb-2 pt-4">
            <ol className="flex flex-col gap-2.5">
              {items.map((item, i) => (
                <li key={item.id} className="flex gap-2 text-[12px] leading-relaxed text-ink/80">
                  <span className="shrink-0 font-bold text-flame-600">{i + 1}.</span>
                  <span>{item.content}</span>
                </li>
              ))}
            </ol>
          </div>
          <div className="mt-4 bg-navy-900 px-6 py-3">
            <a href={contact.zaloHref} target="_blank" rel="noopener noreferrer" className="block text-[12px] font-bold text-white">
              Liên hệ Zalo / SĐT ({contact.name}): {contact.phone}
            </a>
            <a
              href={contact.websiteHref}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-block text-[10.5px] font-semibold text-navy-200"
            >
              Tra cứu vận đơn tại: {contact.website}
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
