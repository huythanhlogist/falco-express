"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type SentInfo = { kango_bill_id: string | null; kango_hawbs_json: string | null; kango_redirect_url: string | null; sent_by: string | null; sent_at: string | null };

export default function KangoBillSendBar({
  billId,
  status,
  sent,
  sendError,
}: {
  billId: number;
  status: "draft" | "sent";
  sent: SentInfo;
  sendError: string | null;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState(sendError);

  function send() {
    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api/admin/kango-bills/${billId}/send`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Gửi thất bại");
        setConfirming(false);
        return;
      }
      setConfirming(false);
      router.refresh();
    });
  }

  function removeBill() {
    if (!confirm("Xoá bill này? Không thể hoàn tác.")) return;
    startTransition(async () => {
      const res = await fetch(`/api/admin/kango-bills/${billId}`, { method: "DELETE" });
      if (res.ok) router.push("/admin/kango-bills");
    });
  }

  const hawbs: string[] = sent.kango_hawbs_json ? JSON.parse(sent.kango_hawbs_json) : [];

  return (
    <div className="rounded-xl border border-line bg-white p-4">
      {status === "sent" ? (
        <div>
          <p className="text-sm font-bold text-emerald-700">Đã gửi lên Kango</p>
          <dl className="mt-2 flex flex-col gap-1 text-sm text-ink/70">
            <div>
              <dt className="inline font-semibold text-ink/50">ID bill Kango: </dt>
              <dd className="inline">{sent.kango_bill_id}</dd>
            </div>
            {hawbs.length > 0 && (
              <div>
                <dt className="inline font-semibold text-ink/50">Hawb: </dt>
                <dd className="inline">{hawbs.join(", ")}</dd>
              </div>
            )}
            {sent.kango_redirect_url && (
              <div>
                <a href={sent.kango_redirect_url} target="_blank" rel="noopener noreferrer" className="text-navy-700 hover:underline">
                  Xem trên Kango →
                </a>
              </div>
            )}
            <div className="text-xs text-ink/45">
              Gửi bởi {sent.sent_by} lúc {sent.sent_at ? new Date(sent.sent_at).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" }) : ""}
            </div>
          </dl>
          <p className="mt-2 text-xs text-ink/45">
            Vẫn sửa/xoá được ở đây — nếu cần đổi thông tin, sửa thẳng trên web Kango rồi cập nhật lại ở đây cho khớp.
          </p>
        </div>
      ) : confirming ? (
        <div>
          <p className="text-sm font-bold text-flame-700">
            Xác nhận gửi thật lên Kango? Hành động này sẽ tạo vận đơn thật, không hoàn tác được.
          </p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={send}
              disabled={isPending}
              className="btn-primary !px-4 !py-2 text-sm disabled:opacity-50"
            >
              {isPending ? "Đang gửi..." : "Xác nhận, Gửi Kango"}
            </button>
            <button type="button" onClick={() => setConfirming(false)} className="btn-outline !px-4 !py-2 text-sm">
              Huỷ
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={() => setConfirming(true)} className="btn-primary !px-4 !py-2 text-sm">
            Duyệt &amp; Gửi Kango
          </button>
          <button
            type="button"
            onClick={removeBill}
            disabled={isPending}
            className="text-xs font-semibold text-flame-700 hover:underline disabled:opacity-50"
          >
            Xoá bill
          </button>
        </div>
      )}
      {error && <p className="mt-3 text-xs font-medium text-flame-700">{error}</p>}
    </div>
  );
}
