"use client";

import { useMemo, useRef, useState } from "react";
import { CloseIcon, EyeIcon, SearchIcon } from "@/components/icons";
import { useConfirm, useToast } from "@/components/ui/Toast";

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

type StatusFilter = "all" | "active" | "disabled";

function normalizeSearch(value: string): string {
  return value.trim().toLowerCase();
}

export default function CtvManager({ initialCtvs }: { initialCtvs: CtvItem[] }) {
  const ask = useConfirm();
  const toast = useToast();
  const [ctvs, setCtvs] = useState(initialCtvs);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const filteredCtvs = useMemo(() => {
    const q = normalizeSearch(query);
    const digitsOnly = q.replace(/\D/g, "");
    return ctvs.filter((c) => {
      if (statusFilter !== "all" && c.status !== statusFilter) return false;
      if (!q) return true;
      const haystack = `${c.ctv_code} ${c.full_name} ${c.phone} ${c.referred_by_name ?? ""}`.toLowerCase();
      if (haystack.includes(q)) return true;
      if (digitsOnly && c.phone.replace(/\D/g, "").includes(digitsOnly)) return true;
      return false;
    });
  }, [ctvs, query, statusFilter]);

  async function createCtv(e: React.FormEvent<HTMLFormElement>) {
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
      const msg = "Vui lòng nhập đủ tên, số điện thoại và số CCCD";
      setError(msg);
      toast(msg, "error");
      return;
    }
    if (!email) {
      const msg = "Vui lòng nhập email";
      setError(msg);
      toast(msg, "error");
      return;
    }
    if (password.length < 8) {
      const msg = "Mật khẩu phải có ít nhất 8 ký tự";
      setError(msg);
      toast(msg, "error");
      return;
    }

    setCreating(true);
    try {
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
      const json = (await res.json().catch(() => ({}))) as {
        id?: number;
        ctvCode?: string;
        error?: string;
      };
      if (!res.ok || typeof json.id !== "number" || !json.ctvCode) {
        const msg = json.error || "Không tạo được tài khoản FWD";
        setError(msg);
        toast(msg, "error");
        return;
      }
      setCtvs((prev) => [
        ...prev,
        {
          id: json.id!,
          ctv_code: json.ctvCode!,
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
        `Đã tạo tài khoản FWD ${json.ctvCode} (${fullName}) — hãy lưu lại mật khẩu vừa nhập để gửi cho FWD, mật khẩu sẽ không hiển thị lại được.`
      );
      toast(`Đã tạo tài khoản FWD ${json.ctvCode}`, "success");
    } catch {
      const msg = "Không kết nối được máy chủ";
      setError(msg);
      toast(msg, "error");
    } finally {
      setCreating(false);
    }
  }

  async function toggleStatus(ctv: CtvItem) {
    const nextStatus = ctv.status === "active" ? "disabled" : "active";
    const confirmed = await ask(
      nextStatus === "disabled"
        ? `Vô hiệu hoá tài khoản FWD ${ctv.ctv_code} (${ctv.full_name})?\nTài khoản sẽ không thể đăng nhập vào cổng /fwd.`
        : `Kích hoạt lại tài khoản FWD ${ctv.ctv_code} (${ctv.full_name})?`,
      {
        confirmLabel: nextStatus === "disabled" ? "Vô hiệu hoá" : "Kích hoạt lại",
        danger: nextStatus === "disabled",
      }
    );
    if (!confirmed) return;

    setBusyId(ctv.id);
    try {
      const res = await fetch(`/api/admin/ctv/${ctv.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        toast(json.error || "Không cập nhật được trạng thái FWD", "error");
        return;
      }
      setCtvs((prev) => prev.map((c) => (c.id === ctv.id ? { ...c, status: nextStatus } : c)));
      toast(
        nextStatus === "disabled"
          ? `Đã vô hiệu hoá FWD ${ctv.ctv_code}`
          : `Đã kích hoạt lại FWD ${ctv.ctv_code}`,
        "success"
      );
    } catch {
      toast("Không kết nối được máy chủ", "error");
    } finally {
      setBusyId(null);
    }
  }

  const hasFilter = Boolean(query.trim()) || statusFilter !== "all";

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
      <div className="flex-1 overflow-hidden rounded-[22px] border border-[#ecece8] bg-white shadow-[0_1px_2px_rgba(19,36,64,0.03),0_6px_20px_rgba(19,36,64,0.028)]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#ecece8] px-4 py-3.5 sm:px-5">
          <div className="relative min-w-[220px] flex-1">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8b8d93]" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Tìm theo tên, mã FWD, số điện thoại..."
              aria-label="Tìm kiếm FWD"
              className="w-full rounded-xl border border-[#e7e7e3] bg-[#fafaf8] py-2 pl-9 pr-8 text-sm text-[#14181f] placeholder:text-[#8b8d93] focus:border-[#132440] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#132440]/10"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Xoá từ khoá tìm kiếm"
                className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-[#8b8d93] hover:bg-[#ecece8] hover:text-[#14181f]"
              >
                <CloseIcon className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-0.5 rounded-xl bg-[#ebebea] p-[3px]">
              {(
                [
                  { value: "all", label: "Tất cả" },
                  { value: "active", label: "Hoạt động" },
                  { value: "disabled", label: "Vô hiệu hoá" },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => setStatusFilter(tab.value)}
                  className={`rounded-[9px] px-2.5 py-1 text-xs font-semibold transition-colors ${
                    statusFilter === tab.value
                      ? "bg-[#132440] text-white"
                      : "text-[#52525b] hover:text-[#14181f]"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <span className="text-xs font-medium text-[#8b8d93] tabular-nums">
              {filteredCtvs.length}/{ctvs.length} FWD
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#ecece8] bg-[#fafaf8] text-left text-xs font-semibold uppercase tracking-wide text-[#8b8d93]">
                <th className="px-4 py-3">Mã</th>
                <th className="px-4 py-3">Tên</th>
                <th className="px-4 py-3">SĐT</th>
                <th className="px-4 py-3">Người giới thiệu</th>
                <th className="px-4 py-3">Trạng thái</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {filteredCtvs.map((c) => {
                const isBusy = busyId === c.id;
                return (
                  <tr key={c.id} className="border-b border-[#ecece8] last:border-0 hover:bg-[#fafaf8]">
                    <td className="px-4 py-3 font-semibold text-[#132440]">{c.ctv_code}</td>
                    <td className="px-4 py-3 text-[#14181f]">{c.full_name}</td>
                    <td className="px-4 py-3 text-ink/70 tabular-nums">{c.phone}</td>
                    <td className="px-4 py-3 text-ink/60">{c.referred_by_name ?? "—"}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold ${
                          c.status === "active" ? "bg-emerald-50 text-emerald-700" : "bg-ink/5 text-ink/50"
                        }`}
                      >
                        {c.status === "active" ? "Hoạt động" : "Vô hiệu hoá"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => toggleStatus(c)}
                        disabled={isBusy}
                        className="whitespace-nowrap text-xs font-semibold text-flame-700 hover:underline disabled:opacity-50"
                      >
                        {isBusy ? "Đang lưu…" : c.status === "active" ? "Vô hiệu hoá" : "Kích hoạt lại"}
                      </button>
                    </td>
                  </tr>
                );
              })}
              {ctvs.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-[#8b8d93]">
                    Chưa có tài khoản FWD nào.
                  </td>
                </tr>
              )}
              {ctvs.length > 0 && filteredCtvs.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-[#8b8d93]">
                    <p>Không tìm thấy tài khoản FWD phù hợp.</p>
                    {hasFilter && (
                      <button
                        type="button"
                        onClick={() => {
                          setQuery("");
                          setStatusFilter("all");
                        }}
                        className="mt-2 text-xs font-semibold text-[#132440] hover:underline"
                      >
                        Xoá bộ lọc
                      </button>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <form
        ref={formRef}
        onSubmit={createCtv}
        className="w-full shrink-0 rounded-[22px] border border-[#ecece8] bg-white p-5 shadow-[0_1px_2px_rgba(19,36,64,0.03),0_6px_20px_rgba(19,36,64,0.028)] lg:w-96"
      >
        <p className="font-display text-sm font-bold text-[#132440]">Tạo tài khoản FWD</p>
        <p className="mt-1 text-xs text-[#8b8d93]">
          FWD chỉ truy cập được khu vực /fwd riêng — không thấy dữ liệu nội bộ khác của admin.
        </p>

        <div className="mt-4 flex flex-col gap-3">
          <div>
            <label className="text-xs font-semibold text-ink/60">Họ tên</label>
            <input
              name="fullName"
              required
              className="mt-1 w-full rounded-xl border border-[#e7e7e3] bg-white px-3.5 py-2.5 text-sm text-[#14181f] focus:border-[#f7941d] focus:outline-none focus:ring-2 focus:ring-[#f7941d]/20"
            />
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-xs font-semibold text-ink/60">Số điện thoại</label>
              <input
                name="phone"
                required
                className="mt-1 w-full rounded-xl border border-[#e7e7e3] bg-white px-3.5 py-2.5 text-sm text-[#14181f] focus:border-[#f7941d] focus:outline-none focus:ring-2 focus:ring-[#f7941d]/20"
              />
            </div>
            <div className="flex-1">
              <label className="text-xs font-semibold text-ink/60">Số CCCD</label>
              <input
                name="cccdNumber"
                required
                className="mt-1 w-full rounded-xl border border-[#e7e7e3] bg-white px-3.5 py-2.5 text-sm text-[#14181f] focus:border-[#f7941d] focus:outline-none focus:ring-2 focus:ring-[#f7941d]/20"
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
              className="mt-1 w-full rounded-xl border border-[#e7e7e3] bg-white px-3.5 py-2.5 text-sm text-[#14181f] focus:border-[#f7941d] focus:outline-none focus:ring-2 focus:ring-[#f7941d]/20"
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
                className="w-full rounded-xl border border-[#e7e7e3] bg-white px-3.5 py-2.5 pr-10 text-sm text-[#14181f] focus:border-[#f7941d] focus:outline-none focus:ring-2 focus:ring-[#f7941d]/20"
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
              className="mt-1 w-full rounded-xl border border-[#e7e7e3] bg-white px-3.5 py-2.5 text-sm text-[#14181f] focus:border-[#f7941d] focus:outline-none focus:ring-2 focus:ring-[#f7941d]/20"
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
                className="mt-1 w-full rounded-xl border border-[#e7e7e3] bg-white px-3.5 py-2.5 text-sm text-[#14181f] focus:border-[#f7941d] focus:outline-none focus:ring-2 focus:ring-[#f7941d]/20"
              />
            </div>
            <div className="flex-1">
              <label className="text-xs font-semibold text-ink/60">% Hoa hồng giới thiệu</label>
              <input
                name="referralOverridePct"
                type="number"
                step="0.1"
                defaultValue={5}
                className="mt-1 w-full rounded-xl border border-[#e7e7e3] bg-white px-3.5 py-2.5 text-sm text-[#14181f] focus:border-[#f7941d] focus:outline-none focus:ring-2 focus:ring-[#f7941d]/20"
              />
            </div>
          </div>
        </div>

        {error && <p className="mt-3 text-xs font-medium text-flame-700">{error}</p>}
        {success && <p className="mt-3 text-xs font-medium text-emerald-600">{success}</p>}

        <button
          type="submit"
          disabled={creating}
          className="btn-primary mt-4 w-full justify-center disabled:opacity-50"
        >
          {creating ? "Đang lưu…" : "Tạo tài khoản FWD"}
        </button>
      </form>
    </div>
  );
}
