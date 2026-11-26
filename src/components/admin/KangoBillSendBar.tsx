"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckIcon, CopyIcon, RefreshIcon } from "@/components/icons";
import { useConfirm, useToast } from "@/components/ui/Toast";
import { parseKangoHawbsJson } from "@/lib/kango-bill-validate";

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

async function copyText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const el = document.createElement("textarea");
    el.value = text;
    el.style.position = "fixed";
    el.style.opacity = "0";
    document.body.appendChild(el);
    el.select();
    document.execCommand("copy");
    document.body.removeChild(el);
  }
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
  const [sending, setSending] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [refreshing, startRefresh] = useTransition();
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(sendError);

  useEffect(() => {
    setError(sendError);
  }, [sendError]);

  const busy = sending || deleting;

  async function send() {
    const ok = await ask(
      "Xác nhận duyệt và gửi bill này lên Kango?\nThao tác này sẽ tạo vận đơn thật trên Kango và không thể hoàn tác.",
      { confirmLabel: "Duyệt & Gửi Kango", danger: true }
    );
    if (!ok) return;

    setError(null);
    setSending(true);
    try {
      const res = await fetch(`/api/admin/kango-bills/${billId}/send`, { method: "POST" });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        const msg = json?.error || `Gửi bill thất bại (HTTP ${res.status})`;
        setError(msg);
        toast(msg, "error");
        router.refresh();
        return;
      }
      toast(
        json?.billId
          ? `Đã duyệt và gửi lên Kango (ID: ${json.billId})`
          : "Đã duyệt và gửi lên Kango",
        "success"
      );
      router.refresh();
    } catch {
      const msg = "Mất kết nối khi gửi lên Kango — vui lòng tải lại trang và kiểm tra Kango trước khi thử lại";
      setError(msg);
      toast(msg, "error");
    } finally {
      setSending(false);
    }
  }

  async function removeBill() {
    const ok = await ask(`Xoá bill #${billId}?\nThao tác này không thể hoàn tác.`, {
      confirmLabel: "Xoá bill",
      danger: true,
    });
    if (!ok) return;

    setError(null);
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/kango-bills/${billId}`, { method: "DELETE" });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        const msg = json?.error || `Xoá bill thất bại (HTTP ${res.status})`;
        setError(msg);
        toast(msg, "error");
        return;
      }
      toast(`Đã xoá bill #${billId}`, "success");
      router.push("/admin/kango-bills");
      router.refresh();
    } catch {
      const msg = "Xoá bill thất bại — kiểm tra lại kết nối mạng";
      setError(msg);
      toast(msg, "error");
    } finally {
      setDeleting(false);
    }
  }

  async function handleCopyBillId(code: string) {
    await copyText(code);
    setCopied(true);
    toast(`Đã sao chép mã ${code}`, "info");
    setTimeout(() => setCopied(false), 1500);
  }

  const hawbs = parseKangoHawbsJson(sent.kango_hawbs_json);

  return (
    <div className="rounded-[20px] border border-[#ecece8] bg-white p-4 shadow-[0_1px_2px_rgba(19,36,64,0.03),0_6px_20px_rgba(19,36,64,0.028)] sm:p-5">
      {status === "sent" ? (
        <div>
          <p className="text-sm font-bold text-[#16a34a]">Đã gửi lên Kango</p>
          <dl className="mt-2 flex flex-col gap-1 text-sm text-[#4b5563]">
            <div className="flex flex-wrap items-center gap-1.5">
              <dt className="font-semibold text-[#8b8d93]">ID bill Kango:</dt>
              <dd className="font-semibold text-[#132440]">{sent.kango_bill_id || "—"}</dd>
              {sent.kango_bill_id && (
                <button
                  type="button"
                  onClick={() => handleCopyBillId(sent.kango_bill_id!)}
                  title="Sao chép ID bill Kango"
                  aria-label="Sao chép ID bill Kango"
                  className="inline-flex h-6 w-6 items-center justify-center rounded-md text-[#8b8d93] hover:bg-[#f5f5f3] hover:text-[#132440]"
                >
                  {copied ? <CheckIcon className="h-3.5 w-3.5 text-[#16a34a]" /> : <CopyIcon className="h-3.5 w-3.5" />}
                </button>
              )}
            </div>
            {hawbs.length > 0 && (
              <div>
                <dt className="inline font-semibold text-[#8b8d93]">HAWB: </dt>
                <dd className="inline text-[#14181f]">{hawbs.join(", ")}</dd>
              </div>
            )}
            {sent.kango_redirect_url && (
              <div>
                <a
                  href={sent.kango_redirect_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-[#132440] hover:text-[#f7941d] hover:underline"
                >
                  Xem trên Kango →
                </a>
              </div>
            )}
            <div className="text-xs text-[#8b8d93]">
              Gửi bởi {sent.sent_by} lúc {formatSentAt(sent.sent_at)}
            </div>
          </dl>
          <p className="mt-2 text-xs text-[#8b8d93]">
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
            disabled={refreshing}
            onClick={() => startRefresh(() => router.refresh())}
            className="btn-outline inline-flex items-center gap-1.5 !px-3.5 !py-1.5 text-xs disabled:opacity-50"
          >
            <RefreshIcon className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
            <span>{refreshing ? "Đang tải…" : "Tải lại trạng thái"}</span>
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={send}
            disabled={busy}
            className="btn-primary !px-4 !py-2 text-sm disabled:opacity-50"
          >
            {sending ? "Đang gửi…" : "Duyệt & Gửi Kango"}
          </button>
          <button
            type="button"
            onClick={removeBill}
            disabled={busy}
            className="text-xs font-semibold text-flame-700 hover:underline disabled:opacity-50"
          >
            {deleting ? "Đang xoá…" : "Xoá bill"}
          </button>
        </div>
      )}
      {error && (
        <p
          role="alert"
          className="mt-3 rounded-xl border border-flame-200 bg-flame-50 px-3 py-2 text-xs font-medium text-flame-800"
        >
          {error}
        </p>
      )}
    </div>
  );
}
