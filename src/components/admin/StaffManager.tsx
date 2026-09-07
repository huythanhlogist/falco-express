"use client";

import { useState, useTransition } from "react";

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
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isPending, startTransition] = useTransition();

  function createStaff(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
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
        { id: json.id, email: email.trim().toLowerCase(), role: "staff", created_at: new Date().toISOString() },
      ]);
      setEmail("");
      setPassword("");
      setSuccess("Đã tạo tài khoản nhân viên");
      setTimeout(() => setSuccess(""), 3000);
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
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded-lg border border-line bg-white px-3.5 py-2.5 text-sm text-ink focus:border-flame-400 focus:outline-none focus:ring-2 focus:ring-flame-100"
                placeholder="nhanvien@falcoexpress.com"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-ink/60">Mật khẩu</label>
              <input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full rounded-lg border border-line bg-white px-3.5 py-2.5 text-sm text-ink focus:border-flame-400 focus:outline-none focus:ring-2 focus:ring-flame-100"
                placeholder="Tối thiểu 8 ký tự"
              />
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
