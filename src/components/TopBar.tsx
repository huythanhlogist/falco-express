import { SITE } from "@/lib/constants";

// Thanh trên cùng của header (chỉ hiện từ tablet trở lên, theo thiết kế mobile).
// Chưa có link Facebook thật trong cấu hình nên chưa hiện mục Facebook của thiết kế.
export default function TopBar() {
  return (
    <div className="hidden bg-falco-navy-dark text-[13px] text-[#c3cbda] md:block">
      <div className="lp-container flex flex-wrap items-center justify-between gap-x-6 gap-y-1 py-[9px]">
        <span>Hà Nội · Nghệ An · TP. Hồ Chí Minh — T2 – T7, 8:00 – 18:00</span>
        <div className="flex gap-5 font-semibold text-white">
          <a href={SITE.zaloHref} target="_blank" rel="noopener noreferrer" className="hover:opacity-80">
            Zalo
          </a>
          <a href={`mailto:${SITE.email}`} className="hover:opacity-80">
            {SITE.email}
          </a>
        </div>
      </div>
    </div>
  );
}
