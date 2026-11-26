"use client";

import { useConfirm, useToast } from "@/components/ui/Toast";
import { parseKangoHawbsJson } from "@/lib/kango-bill-validate";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type SentInfo = {
  kango_bill_id: string | null;
  kango_hawbs_json: string | null;
  kango_redirect_url: string | null;
  sent_by: string | null;
  sent_at: string | null;
};

function formatSentAt(raw: string | null): string {
  if (!raw) return "";
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  return d.toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });
}

export default function KangoBillSendBar({
  billId,
  status,
  sent,
  sendError,
}: {
  billId: number;
  status: "draft" | "sending" | "sent";
  sent: SentInfo;
  sendError: string | null;
}) {
  const ask = useConfirm();
  const toast = useToast();
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState(sendError);

  function send() {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/admin/kango-bills/${billId}/send`, { method: "POST" });
        const json = await res.json().catch(() => null);
        if (!res.ok) {
          const msg = json?.error || `Gửi bill thất bại (HTTP ${res.status})`;
          setError(msg);
          toast(msg, "error");
          setConfirming(false);
          router.refresh();
          return;
        }
        setConfirming(false);
        toast(`Đã duyệt và gửi lên Kango (ID: ${json?.billId ?? ""})`);
        router.refresh();
      } catch {
        const msg = "Mất kết nối khi gửi lên Kango — vui lòng tải lại trang và kiểm tra Kango trước khi thử lại";
        setError(msg);
        toast(msg, "error");
        setConfirming(false);
      }
    });
  }

  async function removeBill() {
    if (!(await ask("Xoá bill này? Không thể hoàn tác."))) return;
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/admin/kango-bills/${billId}`, { method: "DELETE" });
        const json = await res.json().catch(() => null);
        if (!res.ok) {
          const msg = json?.error || `Xoá bill thất bại (HTTP ${res.status})`;
          setError(msg);
          toast(msg, "error");
          return;
        }
        toast("Đã xoá bill");
        router.push("/admin/kango-bills");
        router.refresh();
      } catch {
        const msg = "Xoá bill thất bại — kiểm tra lại kết nối mạng";
        setError(msg);
        toast(msg, "error");
      }
    });
  }

  const hawbs = parseKangoHawbsJson(sent.kango_hawbs_json);

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
              Gửi bởi {sent.sent_by} lúc {formatSentAt(sent.sent_at)}
            </div>
          </dl>
          <p className="mt-2 text-xs text-ink/45">
            Bill đã phát hành trên Kango không thể sửa/xoá tại đây — nếu cần điều chỉnh, vui lòng thao tác trực tiếp trên web Kango.
          </p>
        </div>
      ) : status === "sending" ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-semibold text-amber-800">
            Bill đang được gửi lên Kango… Vui lòng chờ giây lát rồi tải lại trang (không gửi lại để tránh tạo trùng vận đơn).
          </p>
          <button
            type="button"
            onClick={() => router.refresh()}
            className="btn-outline !px-3.5 !py-1.5 text-xs"
          >
            Tải lại trạng thái
          </button>
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
            <button type="button" onClick={() => setConfirming(false)} disabled={isPending} className="btn-outline !px-4 !py-2 text-sm disabled:opacity-50">
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
