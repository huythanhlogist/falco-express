"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

export default function CtvLoginForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    // Đọc trực tiếp từ FormData tại thời điểm bấm nút — tránh trường hợp
    // React chưa kịp gắn xong sự kiện (hydrate) khiến state rỗng dù ô nhìn
    // có chữ, giống lỗi đã gặp ở form đăng nhập admin trên app PWA.
    const form = e.currentTarget;
    const data = new FormData(form);
    const email = String(data.get("email") || "").trim();
    const password = String(data.get("password") || "");

    try {
      const res = await fetch("/api/ctv/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Đăng nhập thất bại");
      router.push("/ctv/tai-khoan");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Có lỗi xảy ra");
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-2xl border border-line bg-white p-8 shadow-sm">
        <div className="flex flex-col items-center text-center">
          <Image
            src="/falco-logo.png"
            alt="Falco Express logo"
            width={48}
            height={48}
            className="h-12 w-12 rounded-full object-cover ring-1 ring-line"
          />
          <h1 className="mt-3 font-display text-lg font-bold text-navy-900">Đăng nhập CTV</h1>
          <p className="mt-1 text-sm text-ink/55">FALCO EXPRESS — Cộng tác viên</p>
        </div>

        <form onSubmit={handleSubmit} className="mt-7 flex flex-col gap-4">
          <div>
            <label htmlFor="email" className="text-xs font-semibold text-ink/60">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="username"
              className="mt-1 w-full rounded-xl border border-line bg-white px-4 py-2.5 text-sm text-ink focus:border-flame-400"
            />
          </div>
          <div>
            <label htmlFor="password" className="text-xs font-semibold text-ink/60">
              Mật khẩu
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className="mt-1 w-full rounded-xl border border-line bg-white px-4 py-2.5 text-sm text-ink focus:border-flame-400"
            />
          </div>

          {error && <p className="text-sm font-medium text-red-600">{error}</p>}

          <button type="submit" disabled={loading} className="btn-primary mt-1 justify-center">
            {loading ? "Đang đăng nhập..." : "Đăng nhập"}
          </button>
        </form>
      </div>
    </div>
  );
}
