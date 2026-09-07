"use client";

import { useRef, useState, useTransition } from "react";
import { EyeIcon } from "@/components/icons";

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
  const [staff, setStaff] = useState(initialStaff);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function createStaff(e: React.FormEvent<HTMLFormElement>) {
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
      setError("Vui lòng nhập email");
      return;
    }
    if (password.length < 8) {
      setError("Mật khẩu phải có ít nhất 8 ký tự");
      return;
    }

    startTransition(async () => {
      const res = await fetch("/api/admin/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Có lỗi xảy ra");
        return;
      }
      setStaff((prev) => [
        ...prev,
        { id: json.id, email: email.toLowerCase(), role: "staff", created_at: new Date().toISOString() },
      ]);
      form.reset();
      setSuccess(
        `Đã tạo tài khoản ${email} — hãy lưu lại mật khẩu vừa nhập để gửi cho nhân viên, mật khẩu sẽ không hiển thị lại được.`
      );
    });
  }

  function removeStaff(id: number) {
    if (!confirm("Xoá tài khoản này?")) return;
    startTransition(async () => {
      const res = await fetch(`/api/admin/staff/${id}`, { method: "DELETE" });
      if (res.ok) {
        setStaff((prev) => prev.filter((s) => s.id !== id));
      }
    });
  }

  return (
    <div className="flex flex-col gap-6 lg:flex-row">
      <div className="flex-1 overflow-x-auto rounded-xl border border-line bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line bg-mist/60 text-left text-xs font-semibold uppercase tracking-wide text-ink/45">
              <th className="px-4 py-2.5">Email</th>
              <th className="px-4 py-2.5">Vai trò</th>
              {canManage && <th className="px-4 py-2.5" />}
            </tr>
          </thead>
          <tbody>
            {staff.map((s) => (
              <tr key={s.id} className="border-b border-line last:border-0 hover:bg-mist/40">
                <td className="px-4 py-2.5 text-ink/80">
                  {s.email}
                  {s.email === currentEmail && (
                    <span className="ml-2 text-xs text-ink/40">(bạn)</span>
                  )}
                </td>
                <td className="px-4 py-2.5">
                  <span
                    className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold ${
                      s.role === "owner"
                        ? "bg-navy-50 text-navy-800"
                        : "bg-flame-50 text-flame-700"
                    }`}
                  >
                    {s.role === "owner" ? "Chủ tài khoản" : "Nhân viên"}
                  </span>
                </td>
                {canManage && (
                  <td className="px-4 py-2.5 text-right">
                    {s.role !== "owner" && s.email !== currentEmail && (
                      <button
                        type="button"
                        onClick={() => removeStaff(s.id)}
                        disabled={isPending}
                        className="text-xs font-semibold text-flame-700 hover:underline disabled:opacity-50"
                      >
                        Xoá
                      </button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {canManage && (
        <form
          ref={formRef}
          onSubmit={createStaff}
          className="w-full shrink-0 rounded-xl border border-line bg-white p-5 lg:w-80"
        >
          <p className="font-display text-sm font-bold text-navy-900">Tạo tài khoản nhân viên</p>
          <p className="mt-1 text-xs text-ink/50">
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
                className="mt-1 w-full rounded-lg border border-line bg-white px-3.5 py-2.5 text-sm text-ink focus:border-flame-400 focus:outline-none focus:ring-2 focus:ring-flame-100"
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
              <p className="mt-1 text-xs text-ink/40">
                Kiểm tra lại bằng nút hiện mật khẩu trước khi tạo — mật khẩu không thể xem lại sau khi tạo xong.
              </p>
            </div>
          </div>

          {error && <p className="mt-3 text-xs font-medium text-flame-700">{error}</p>}
          {success && <p className="mt-3 text-xs font-medium text-emerald-600">{success}</p>}

          <button
            type="submit"
            disabled={isPending}
            className="btn-primary mt-4 w-full justify-center disabled:opacity-50"
          >
            {isPending ? "Đang tạo..." : "Tạo tài khoản"}
          </button>
        </form>
      )}
    </div>
  );
}
