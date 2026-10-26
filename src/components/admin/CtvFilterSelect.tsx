"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";

// Bộ lọc "FWD cụ thể" ở tab Đơn hàng: Tất cả FWD, hoặc từng FWD dạng "FWD-0003 · Tên".
export default function CtvFilterSelect({ ctvs }: { ctvs: { id: number; ctv_code: string; full_name: string }[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const current = searchParams.get("ctv") ?? "";

  function change(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set("ctv", value);
    else params.delete("ctv");
    params.delete("page");
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <select
      value={current}
      onChange={(e) => change(e.target.value)}
      aria-label="Lọc theo FWD"
      className="rounded-lg border border-line bg-white px-3 py-1.5 text-sm font-semibold text-ink focus:border-flame-400 focus:outline-none focus:ring-2 focus:ring-flame-100"
    >
      <option value="">Tất cả FWD</option>
      {ctvs.map((c) => (
        <option key={c.id} value={c.id}>
          {c.ctv_code} · {c.full_name}
        </option>
      ))}
    </select>
  );
}
