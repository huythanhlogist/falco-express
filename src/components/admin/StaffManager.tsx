"use client";

import { useMemo, useRef, useState } from "react";
import { CloseIcon, EyeIcon, SearchIcon } from "@/components/icons";
import { useConfirm, useToast } from "@/components/ui/Toast";
import { formatDateVN } from "@/lib/vn-date";

type StaffItem = { id: number; email: string; role: "owner" | "staff"; created_at: string };

export default function StaffManager({
  initialStaff,
  currentEmail,
  canManage,
}: {
  initialStaff: StaffItem[];
  currentEmail: string;
  canManage: boolean;
}) {
  const ask = useConfirm();
  const toast = useToast();
  const [staff, setStaff] = useState(initialStaff);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const filteredStaff = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return staff;
    return staff.filter((s) => {
      const roleLabel = s.role === "owner" ? "chủ tài khoản owner" : "nhân viên staff";
      const created = formatDateVN(s.created_at);
      return `${s.id} #${s.id} ${s.email} ${roleLabel} ${created}`.toLowerCase().includes(q);
    });
  }, [staff, query]);

  async function createStaff(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setSuccess("");

    // Đọc trực tiếp từ FormData (giá trị DOM thật tại thời điểm bấm nút) thay
    // vì chỉ tin vào state — tránh trường hợp form vừa hiện xong, người dùng
    // gõ ngay khi React chưa kịp gắn xong sự kiện (hydrate), khiến ô nhìn có
    // chữ nhưng state rỗng và tài khoản được tạo với email/mật khẩu trống.
    const form = e.currentTarget;
    const data = new FormData(form);
    const email = String(data.get("email") || "").trim();
    const password = String(data.get("password") || "");

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
      const res = await fetch("/api/admin/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const json = (await res.json().catch(() => ({}))) as { id?: number; error?: string };
      if (!res.ok || typeof json.id !== "number") {
        const msg = json.error || "Có lỗi xảy ra";
        setError(msg);
        toast(msg, "error");
        return;
      }
      setStaff((prev) => [
        ...prev,
        { id: json.id!, email: email.toLowerCase(), role: "staff", created_at: new Date().toISOString() },
      ]);
      form.reset();
      setSuccess(
        `Đã tạo tài khoản ${email} — hãy lưu lại mật khẩu vừa nhập để gửi cho nhân viên, mật khẩu sẽ không hiển thị lại được.`
      );
      toast("Đã tạo tài khoản nhân viên", "success");
    } catch {
      const msg = "Không kết nối được máy chủ";
      setError(msg);
      toast(msg, "error");
    } finally {
      setCreating(false);
    }
  }

  async function removeStaff(target: StaffItem) {
    if (
      !(await ask(
        `Xoá tài khoản ${target.email}? Phiên đăng nhập hiện tại của nhân viên sẽ mất hiệu lực ngay.`,
        { confirmLabel: "Xoá", danger: true }
      ))
    ) {
      return;
    }
    setDeletingId(target.id);
    try {
      const res = await fetch(`/api/admin/staff/${target.id}`, { method: "DELETE" });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        toast(json.error || "Không xoá được tài khoản", "error");
        return;
      }
      setStaff((prev) => prev.filter((s) => s.id !== target.id));
      toast("Đã xoá tài khoản nhân viên", "success");
    } catch {
      toast("Không kết nối được máy chủ", "error");
    } finally {
      setDeletingId(null);
    }
  }

  const colCount = canManage ? 4 : 3;

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
              placeholder="Tìm theo email, mã hoặc vai trò..."
              aria-label="Tìm kiếm nhân viên"
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
          <span className="text-xs font-medium text-[#8b8d93] tabular-nums">
            {filteredStaff.length}/{staff.length} tài khoản
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#ecece8] bg-[#fafaf8] text-left text-xs font-semibold uppercase tracking-wide text-[#8b8d93]">
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Vai trò</th>
                <th className="px-4 py-3">Ngày tạo</th>
                {canManage && <th className="px-4 py-3" />}
              </tr>
            </thead>
            <tbody>
              {filteredStaff.map((s) => {
                const isDeleting = deletingId === s.id;
                return (
                  <tr key={s.id} className="border-b border-[#ecece8] last:border-0 hover:bg-[#fafaf8]">
                    <td className="px-4 py-3 text-[#14181f]">
                      {s.email}
                      {s.email === currentEmail && (
                        <span className="ml-2 text-xs text-[#8b8d93]">(bạn)</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold ${
                          s.role === "owner"
                            ? "bg-navy-50 text-[#132440]"
                            : "bg-flame-50 text-flame-700"
                        }`}
                      >
                        {s.role === "owner" ? "Chủ tài khoản" : "Nhân viên"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-ink/60 tabular-nums">
                      {formatDateVN(s.created_at) || "—"}
                    </td>
                    {canManage && (
                      <td className="px-4 py-3 text-right">
                        {s.role !== "owner" && s.email !== currentEmail && (
                          <button
                            type="button"
                            onClick={() => removeStaff(s)}
                            disabled={isDeleting}
                            className="whitespace-nowrap text-xs font-semibold text-flame-700 hover:underline disabled:opacity-50"
                          >
                            {isDeleting ? "Đang xoá…" : "Xoá"}
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
              {staff.length === 0 && (
                <tr>
                  <td colSpan={colCount} className="px-4 py-8 text-center text-sm text-[#8b8d93]">
                    Chưa có tài khoản nhân viên nào.
                  </td>
                </tr>
              )}
              {staff.length > 0 && filteredStaff.length === 0 && (
                <tr>
                  <td colSpan={colCount} className="px-4 py-8 text-center text-sm text-[#8b8d93]">
                    <p>Không tìm thấy tài khoản nhân viên phù hợp.</p>
                    <button
                      type="button"
                      onClick={() => setQuery("")}
                      className="mt-2 text-xs font-semibold text-[#132440] hover:underline"
                    >
                      Xoá bộ lọc
                    </button>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {canManage && (
        <form
          ref={formRef}
          onSubmit={createStaff}
          className="w-full shrink-0 rounded-[22px] border border-[#ecece8] bg-white p-5 shadow-[0_1px_2px_rgba(19,36,64,0.03),0_6px_20px_rgba(19,36,64,0.028)] lg:w-80"
        >
          <p className="font-display text-sm font-bold text-[#132440]">Tạo tài khoản nhân viên</p>
          <p className="mt-1 text-xs text-[#8b8d93]">
            Nhân viên có toàn quyền truy cập và chỉnh sửa, trừ việc tạo thêm tài khoản.
          </p>

          <div className="mt-4 flex flex-col gap-3">
            <div>
              <label className="text-xs font-semibold text-ink/60">Email</label>
              <input
                name="email"
                type="email"
                required
                autoComplete="off"
                className="mt-1 w-full rounded-xl border border-[#e7e7e3] bg-white px-3.5 py-2.5 text-sm text-[#14181f] focus:border-[#f7941d] focus:outline-none focus:ring-2 focus:ring-[#f7941d]/20"
                placeholder="nhanvien@falcoexpress.com"
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
              <p className="mt-1 text-xs text-[#8b8d93]">
                Kiểm tra lại bằng nút hiện mật khẩu trước khi tạo — mật khẩu không thể xem lại sau khi tạo xong.
              </p>
            </div>
          </div>

          {error && <p className="mt-3 text-xs font-medium text-flame-700">{error}</p>}
          {success && <p className="mt-3 text-xs font-medium text-emerald-600">{success}</p>}

          <button
            type="submit"
            disabled={creating}
            className="btn-primary mt-4 w-full justify-center disabled:opacity-50"
          >
            {creating ? "Đang lưu…" : "Tạo tài khoản"}
          </button>
        </form>
      )}
    </div>
  );
}
