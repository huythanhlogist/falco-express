"use client";

import { useRef, useState, useTransition } from "react";
import { EyeIcon } from "@/components/icons";

type CtvItem = {
  id: number;
  ctv_code: string;
  full_name: string;
  phone: string;
  status: "active" | "disabled";
  referred_by_ctv_id: number | null;
  referred_by_name: string | null;
  created_at: string;
};

export default function CtvManager({ initialCtvs }: { initialCtvs: CtvItem[] }) {
  const [ctvs, setCtvs] = useState(initialCtvs);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function createCtv(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setSuccess("");

    // Đọc trực tiếp từ FormData tại thời điểm bấm nút — tránh trường hợp
    // React chưa kịp gắn xong sự kiện khiến state rỗng dù ô nhìn có chữ
    // (đã gặp lỗi tương tự với form đăng nhập trên app PWA điện thoại).
    const form = e.currentTarget;
    const data = new FormData(form);
    const email = String(data.get("email") || "").trim();
    const password = String(data.get("password") || "");
    const fullName = String(data.get("fullName") || "").trim();
    const phone = String(data.get("phone") || "").trim();
    const cccdNumber = String(data.get("cccdNumber") || "").trim();
    const referredByCtvId = String(data.get("referredByCtvId") || "");
    const commissionPct = Number(data.get("commissionPct") || 5);
    const referralOverridePct = Number(data.get("referralOverridePct") || 5);

    if (!fullName || !phone || !cccdNumber) {
      setError("Vui lòng nhập đủ tên, số điện thoại và số CCCD");
      return;
    }
    if (!email) {
      setError("Vui lòng nhập email");
      return;
    }
    if (password.length < 8) {
      setError("Mật khẩu phải có ít nhất 8 ký tự");
      return;
    }

    startTransition(async () => {
      const res = await fetch("/api/admin/ctv", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          fullName,
          phone,
          cccdNumber,
          referredByCtvId: referredByCtvId ? Number(referredByCtvId) : null,
          commissionPct,
          referralOverridePct,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Có lỗi xảy ra");
        return;
      }
      setCtvs((prev) => [
        ...prev,
        {
          id: json.id,
          ctv_code: json.ctvCode,
          full_name: fullName,
          phone,
          status: "active",
          referred_by_ctv_id: referredByCtvId ? Number(referredByCtvId) : null,
          referred_by_name: referredByCtvId
            ? prev.find((c) => c.id === Number(referredByCtvId))?.full_name ?? null
            : null,
          created_at: new Date().toISOString(),
        },
      ]);
      form.reset();
      setSuccess(
        `Đã tạo tài khoản CTV ${json.ctvCode} (${fullName}) — hãy lưu lại mật khẩu vừa nhập để gửi cho CTV, mật khẩu sẽ không hiển thị lại được.`
      );
    });
  }

  function toggleStatus(ctv: CtvItem) {
    const nextStatus = ctv.status === "active" ? "disabled" : "active";
    startTransition(async () => {
      const res = await fetch(`/api/admin/ctv/${ctv.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (res.ok) {
        setCtvs((prev) => prev.map((c) => (c.id === ctv.id ? { ...c, status: nextStatus } : c)));
      }
    });
  }

  return (
    <div className="flex flex-col gap-6 lg:flex-row">
      <div className="flex-1 overflow-x-auto rounded-xl border border-line bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line bg-mist/60 text-left text-xs font-semibold uppercase tracking-wide text-ink/45">
              <th className="px-4 py-2.5">Mã</th>
              <th className="px-4 py-2.5">Tên</th>
              <th className="px-4 py-2.5">SĐT</th>
              <th className="px-4 py-2.5">Người giới thiệu</th>
              <th className="px-4 py-2.5">Trạng thái</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {ctvs.map((c) => (
              <tr key={c.id} className="border-b border-line last:border-0 hover:bg-mist/40">
                <td className="px-4 py-2.5 font-semibold text-navy-800">{c.ctv_code}</td>
                <td className="px-4 py-2.5 text-ink/80">{c.full_name}</td>
                <td className="px-4 py-2.5 text-ink/70">{c.phone}</td>
                <td className="px-4 py-2.5 text-ink/60">{c.referred_by_name ?? "—"}</td>
                <td className="px-4 py-2.5">
                  <span
                    className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold ${
                      c.status === "active" ? "bg-emerald-50 text-emerald-700" : "bg-ink/5 text-ink/50"
                    }`}
                  >
                    {c.status === "active" ? "Hoạt động" : "Vô hiệu hoá"}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-right">
                  <button
                    type="button"
                    onClick={() => toggleStatus(c)}
                    disabled={isPending}
                    className="text-xs font-semibold text-flame-700 hover:underline disabled:opacity-50"
                  >
                    {c.status === "active" ? "Vô hiệu hoá" : "Kích hoạt lại"}
                  </button>
                </td>
              </tr>
            ))}
            {ctvs.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-ink/45">
                  Chưa có tài khoản CTV nào.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <form
        ref={formRef}
        onSubmit={createCtv}
        className="w-full shrink-0 rounded-xl border border-line bg-white p-5 lg:w-96"
      >
        <p className="font-display text-sm font-bold text-navy-900">Tạo tài khoản CTV</p>
        <p className="mt-1 text-xs text-ink/50">
          CTV chỉ truy cập được khu vực /ctv riêng — không thấy dữ liệu nội bộ khác của admin.
        </p>

        <div className="mt-4 flex flex-col gap-3">
          <div>
            <label className="text-xs font-semibold text-ink/60">Họ tên</label>
            <input
              name="fullName"
              required
              className="mt-1 w-full rounded-lg border border-line bg-white px-3.5 py-2.5 text-sm text-ink focus:border-flame-400 focus:outline-none focus:ring-2 focus:ring-flame-100"
            />
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-xs font-semibold text-ink/60">Số điện thoại</label>
              <input
                name="phone"
                required
                className="mt-1 w-full rounded-lg border border-line bg-white px-3.5 py-2.5 text-sm text-ink focus:border-flame-400 focus:outline-none focus:ring-2 focus:ring-flame-100"
              />
            </div>
            <div className="flex-1">
              <label className="text-xs font-semibold text-ink/60">Số CCCD</label>
              <input
                name="cccdNumber"
                required
                className="mt-1 w-full rounded-lg border border-line bg-white px-3.5 py-2.5 text-sm text-ink focus:border-flame-400 focus:outline-none focus:ring-2 focus:ring-flame-100"
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-ink/60">Email đăng nhập</label>
            <input
              name="email"
              type="email"
              required
              autoComplete="off"
              className="mt-1 w-full rounded-lg border border-line bg-white px-3.5 py-2.5 text-sm text-ink focus:border-flame-400 focus:outline-none focus:ring-2 focus:ring-flame-100"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-ink/60">Mật khẩu</label>
            <div className="relative mt-1">
              <input
                name="password"
                type={showPassword ? "text" : "password"}
                required
                minLength={8}
                autoComplete="new-password"
                className="w-full rounded-lg border border-line bg-white px-3.5 py-2.5 pr-10 text-sm text-ink focus:border-flame-400 focus:outline-none focus:ring-2 focus:ring-flame-100"
                placeholder="Tối thiểu 8 ký tự"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute inset-y-0 right-0 flex w-9 items-center justify-center text-ink/40 hover:text-ink/70"
                title={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
              >
                <EyeIcon className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-ink/60">Được giới thiệu bởi (không bắt buộc)</label>
            <select
              name="referredByCtvId"
              className="mt-1 w-full rounded-lg border border-line bg-white px-3.5 py-2.5 text-sm text-ink focus:border-flame-400 focus:outline-none focus:ring-2 focus:ring-flame-100"
            >
              <option value="">Không có</option>
              {ctvs.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.ctv_code} — {c.full_name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-xs font-semibold text-ink/60">% Hoa hồng gốc</label>
              <input
                name="commissionPct"
                type="number"
                step="0.1"
                defaultValue={5}
                className="mt-1 w-full rounded-lg border border-line bg-white px-3.5 py-2.5 text-sm text-ink focus:border-flame-400 focus:outline-none focus:ring-2 focus:ring-flame-100"
              />
            </div>
            <div className="flex-1">
              <label className="text-xs font-semibold text-ink/60">% Hoa hồng giới thiệu</label>
              <input
                name="referralOverridePct"
                type="number"
                step="0.1"
                defaultValue={5}
                className="mt-1 w-full rounded-lg border border-line bg-white px-3.5 py-2.5 text-sm text-ink focus:border-flame-400 focus:outline-none focus:ring-2 focus:ring-flame-100"
              />
            </div>
          </div>
        </div>

        {error && <p className="mt-3 text-xs font-medium text-flame-700">{error}</p>}
        {success && <p className="mt-3 text-xs font-medium text-emerald-600">{success}</p>}

        <button
          type="submit"
          disabled={isPending}
          className="btn-primary mt-4 w-full justify-center disabled:opacity-50"
        >
          {isPending ? "Đang tạo..." : "Tạo tài khoản CTV"}
        </button>
      </form>
    </div>
  );
}
