"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { EyeIcon } from "@/components/icons";

export default function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [rateLimited, setRateLimited] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setRateLimited(false);

    // Đọc trực tiếp từ FormData (giá trị DOM thật tại thời điểm bấm nút)
    // thay vì chỉ tin vào state — tránh trường hợp app PWA vừa mở, người
    // dùng gõ ngay khi React chưa kịp gắn xong sự kiện (hydrate), khiến ô
    // nhìn có chữ nhưng state rỗng và request đăng nhập gửi đi trống.
    const form = e.currentTarget;
    const data = new FormData(form);
    const email = String(data.get("email") || "").trim();
    const password = String(data.get("password") || "");

    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        if (res.status === 429) {
          setRateLimited(true);
          throw new Error(
            json.error || "Bạn đã nhập sai quá nhiều lần. Vui lòng thử lại sau 15 phút."
          );
        }
        throw new Error(json.error || "Đăng nhập thất bại");
      }
      router.push("/admin/orders");
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
          <h1 className="mt-3 font-display text-lg font-bold text-navy-900">
            Đăng nhập quản trị
          </h1>
          <p className="mt-1 text-sm text-ink/55">FALCO EXPRESS Admin</p>
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
            <div className="relative mt-1">
              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                required
                autoComplete="current-password"
                className="w-full rounded-xl border border-line bg-white px-4 py-2.5 pr-10 text-sm text-ink focus:border-flame-400"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                title={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-ink/45 hover:text-ink/75"
              >
                {showPassword ? (
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M3 3l18 18" />
                    <path d="M10.58 10.58A2.75 2.75 0 0 0 13.42 13.42" />
                    <path d="M9.88 5.7A9.8 9.8 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a17.4 17.4 0 0 1-3.18 4.02" />
                    <path d="M6.61 6.61A17.6 17.6 0 0 0 2.5 12s3.5 6.5 9.5 6.5a9.9 9.9 0 0 0 4.39-1.02" />
                  </svg>
                ) : (
                  <EyeIcon className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          {error && (
            <p
              role="alert"
              className={
                rateLimited
                  ? "rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-sm font-medium text-amber-800"
                  : "text-sm font-medium text-red-600"
              }
            >
              {error}
            </p>
          )}

          <button type="submit" disabled={loading} className="btn-primary mt-1 justify-center">
            {loading ? "Đang đăng nhập..." : "Đăng nhập"}
          </button>
        </form>
      </div>
    </div>
  );
}
