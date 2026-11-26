"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type AdminPageTab = {
  href: string;
  label: string;
};

/**
 * Thanh tab phân đoạn (segmented control) ở đầu các trang đã gộp nhóm —
 * kiểu dáng khớp cụm "30 ngày | Quý | Năm" trong mockup dashboard.
 */
export default function AdminPageTabs({
  tabs,
  className,
}: {
  tabs: AdminPageTab[];
  className?: string;
}) {
  const pathname = usePathname();

  return (
    <nav aria-label="Chuyển mục con" className={`mb-4 overflow-x-auto ${className ?? ""}`}>
      <div className="inline-flex items-center gap-0.5 rounded-xl bg-[#ebebea] p-[3px]">
        {tabs.map((tab) => {
          const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={`inline-flex h-8 shrink-0 items-center whitespace-nowrap rounded-[9px] px-3.5 text-[13px] transition-colors ${
                active
                  ? "bg-[#132440] font-semibold text-white"
                  : "font-medium text-[#52525b] hover:text-[#14181f]"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
