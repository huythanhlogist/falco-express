"use client";

import { useState, useTransition } from "react";

type Profile = {
  ctv_code: string;
  full_name: string;
  phone: string;
  cccd_number: string;
  contact_name: string | null;
  contact_phone: string | null;
  contact_zalo_href: string | null;
};

export default function CtvProfileForm({ profile }: { profile: Profile }) {
  const [contactName, setContactName] = useState(profile.contact_name ?? "");
  const [contactPhone, setContactPhone] = useState(profile.contact_phone ?? "");
  const [contactZaloHref, setContactZaloHref] = useState(profile.contact_zalo_href ?? "");
  const [success, setSuccess] = useState("");
  const [isPending, startTransition] = useTransition();

  function save(e: React.FormEvent) {
    e.preventDefault();
    setSuccess("");
    startTransition(async () => {
      const res = await fetch("/api/ctv/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactName, contactPhone, contactZaloHref }),
      });
      if (res.ok) setSuccess("Đã lưu.");
    });
  }

  return (
    <div className="flex flex-col gap-6 lg:flex-row">
      <div className="w-full shrink-0 rounded-xl border border-line bg-white p-5 lg:w-80">
        <p className="font-display text-sm font-bold text-navy-900">Hồ sơ</p>
        <p className="mt-1 text-xs text-ink/50">Do Falco quản lý, liên hệ admin nếu cần đổi.</p>
        <dl className="mt-4 flex flex-col gap-3 text-sm">
          <div>
            <dt className="text-xs font-semibold text-ink/50">Mã CTV</dt>
            <dd className="mt-0.5 font-bold text-navy-800">{profile.ctv_code}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold text-ink/50">Họ tên</dt>
            <dd className="mt-0.5 text-ink/80">{profile.full_name}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold text-ink/50">Số điện thoại</dt>
            <dd className="mt-0.5 text-ink/80">{profile.phone}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold text-ink/50">Số CCCD</dt>
            <dd className="mt-0.5 text-ink/80">{profile.cccd_number}</dd>
          </div>
        </dl>
      </div>

      <form onSubmit={save} className="flex-1 rounded-xl border border-line bg-white p-5">
        <p className="font-display text-sm font-bold text-navy-900">Liên hệ hiển thị trên bảng giá</p>
        <p className="mt-1 text-xs text-ink/50">
          Mặc định dùng tên/SĐT hồ sơ ở trên — chỉnh ở đây nếu bạn muốn khách liên hệ bằng thông tin khác.
        </p>

        <div className="mt-4 flex flex-col gap-3">
          <div>
            <label className="text-xs font-semibold text-ink/60">Tên hiển thị</label>
            <input
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              placeholder={profile.full_name}
              className="mt-1 w-full rounded-lg border border-line bg-white px-3.5 py-2.5 text-sm text-ink focus:border-flame-400 focus:outline-none focus:ring-2 focus:ring-flame-100"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-ink/60">SĐT hiển thị</label>
            <input
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
              placeholder={profile.phone}
              className="mt-1 w-full rounded-lg border border-line bg-white px-3.5 py-2.5 text-sm text-ink focus:border-flame-400 focus:outline-none focus:ring-2 focus:ring-flame-100"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-ink/60">Link Zalo</label>
            <input
              value={contactZaloHref}
              onChange={(e) => setContactZaloHref(e.target.value)}
              placeholder="https://zalo.me/84..."
              className="mt-1 w-full rounded-lg border border-line bg-white px-3.5 py-2.5 text-sm text-ink focus:border-flame-400 focus:outline-none focus:ring-2 focus:ring-flame-100"
            />
          </div>
        </div>

        {success && <p className="mt-3 text-xs font-medium text-emerald-600">{success}</p>}

        <button type="submit" disabled={isPending} className="btn-primary mt-4 disabled:opacity-50">
          {isPending ? "Đang lưu..." : "Lưu"}
        </button>
      </form>
    </div>
  );
}
