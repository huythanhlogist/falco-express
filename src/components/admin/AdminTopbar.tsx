"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AlertBell from "@/components/admin/AlertBell";

function getEmailInitials(email: string): string {
  const local = email.split("@")[0]?.trim() ?? "";
  if (!local) return "?";
  const parts = local.split(/[._\-\s]+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return local[0].toUpperCase();
}

function getDisplayName(email: string): string {
  const local = email.split("@")[0]?.trim() ?? "";
  return local || email;
}

export default function AdminTopbar({
  email,
  role,
  todayLabel,
}: {
  email: string;
  role: "owner" | "staff";
  todayLabel: string;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  function handleSearch(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const trimmed = query.trim();
    if (trimmed) {
      router.push(`/admin/orders?q=${encodeURIComponent(trimmed)}`);
    } else {
      router.push("/admin/orders");
    }
  }

  const initials = getEmailInitials(email);
  const displayName = getDisplayName(email);

  return (
    <header className="flex min-h-[44px] flex-wrap items-center justify-between gap-3">
      {/* Ô tìm kiếm đơn nhanh — Enter chuyển sang /admin/orders?q=... */}
      <form
        onSubmit={handleSearch}
        role="search"
        className="flex h-10 w-full flex-1 items-center gap-2.5 rounded-xl border border-[#e7e7e3] bg-white px-3.5 text-[13px] transition-colors focus-within:border-[#132440] sm:max-w-[360px]"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="shrink-0 text-[#9ca3af]"
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.3-4.3" />
        </svg>
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Tìm mã vận đơn, khách hàng, FWD"
          aria-label="Tìm kiếm đơn hàng"
          className="w-full min-w-0 bg-transparent text-[13px] text-[#14181f] placeholder:text-[#8b8d93] focus:outline-none"
        />
        <kbd className="hidden shrink-0 rounded-md border border-[#e6e6e2] bg-[#f5f5f3] px-1.5 py-0.5 font-sans text-[11px] font-medium text-[#71717a] sm:inline-flex">
          ⌘K
        </kbd>
      </form>

      {/* Cụm bên phải: ngày VN, nút Trợ lý AI, chuông cảnh báo, avatar */}
      <div className="flex items-center gap-2.5 sm:gap-3">
        <div
          className="hidden h-10 items-center gap-2 whitespace-nowrap rounded-xl border border-[#e7e7e3] bg-white px-3.5 text-[13px] font-medium text-[#27272a] lg:inline-flex"
          title="Ngày hiện tại theo giờ Việt Nam (UTC+7)"
        >
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-[#71717a]"
            aria-hidden="true"
          >
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          <span>Hôm nay · {todayLabel}</span>
        </div>

        <Link
          href="/admin/van-phong"
          className="bg-falco-gradient hidden h-10 items-center gap-1.5 whitespace-nowrap rounded-xl px-4 text-[13px] font-semibold text-white shadow-admin-ai transition-all hover:brightness-105 xl:inline-flex"
        >
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3L12 3Z" />
            <path d="M5 3v4" />
            <path d="M19 17v4" />
            <path d="M3 5h4" />
            <path d="M17 19h4" />
          </svg>
          <span>Hỏi Falco AI</span>
        </Link>

        <AlertBell />

        <div className="flex items-center gap-2.5 pl-0.5" title={email}>
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#132440] text-[12.5px] font-bold text-white">
            {initials}
          </div>
          <div className="hidden min-w-0 flex-col sm:flex">
            <span className="max-w-[140px] truncate text-[13px] font-semibold leading-tight text-[#14181f]">
              {displayName}
            </span>
            <span className="text-[11.5px] leading-tight text-[#8b8d93]">
              {role === "owner" ? "Chủ tài khoản" : "Nhân viên"}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}
