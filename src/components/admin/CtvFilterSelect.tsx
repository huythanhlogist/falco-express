"use client";

import { useTransition } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";

// Bộ lọc "FWD cụ thể" ở tab Đơn hàng: Tất cả FWD, hoặc từng FWD dạng "FWD-0003 · Tên".
export default function CtvFilterSelect({ ctvs }: { ctvs: { id: number; ctv_code: string; full_name: string }[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const current = searchParams.get("ctv") ?? "";

  function change(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set("ctv", value);
    else params.delete("ctv");
    params.delete("page");
    const qs = params.toString();
    startTransition(() => {
      router.push(qs ? `${pathname}?${qs}` : pathname);
    });
  }

  return (
    <select
      value={current}
      onChange={(e) => change(e.target.value)}
      disabled={isPending}
      aria-label="Lọc theo FWD"
      className="rounded-xl border border-[#e7e7e3] bg-white px-3 py-1.5 text-sm font-semibold text-[#14181f] focus:border-[#132440] focus:outline-none focus:ring-2 focus:ring-[#132440]/10 disabled:opacity-60"
    >
      <option value="">{isPending ? "Đang tải…" : "Tất cả FWD"}</option>
      {ctvs.length === 0 ? (
        <option value="" disabled>
          Chưa có FWD đang hoạt động
        </option>
      ) : (
        ctvs.map((c) => (
          <option key={c.id} value={c.id}>
            {c.ctv_code} · {c.full_name}
          </option>
        ))
      )}
    </select>
  );
}
