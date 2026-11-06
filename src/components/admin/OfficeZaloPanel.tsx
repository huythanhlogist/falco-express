"use client";

import { useCallback, useEffect, useState } from "react";
import { useConfirm, useToast } from "@/components/ui/Toast";
import { fmtTime, officeApi, type ZaloResponse } from "@/lib/office-api";

const STATUS_STYLE: Record<string, string> = {
  da_gui: "bg-sky-100 text-sky-800",
  da_phan_hoi: "bg-emerald-100 text-emerald-800",
  gui_loi: "bg-red-100 text-red-700",
};
const STATUS_LABEL: Record<string, string> = {
  da_gui: "Đã gửi",
  da_phan_hoi: "Đã phản hồi",
  gui_loi: "Lỗi gửi",
};

export default function OfficeZaloPanel() {
  const toast = useToast();
  const confirm = useConfirm();
  const [data, setData] = useState<ZaloResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sendingId, setSendingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    const r = await officeApi<ZaloResponse>("zalo");
    if (!r.ok) {
      setError(r.error);
      return;
    }
    setError(null);
    setData(r.data);
  }, []);

  useEffect(() => {
    void load();
    const id = window.setInterval(load, 15000);
    return () => window.clearInterval(id);
  }, [load]);

  async function toggle() {
    if (!data) return;
    const next = !data.enabled;
    if (next) {
      const ok = await confirm(
        "Bật gửi Zalo tự động? Các lead đã duyệt sẽ được gửi từng tin một (tối đa theo hạn mức mỗi ngày, T2 đến T7, 8h đến 19h).",
        { confirmLabel: "Bật gửi" },
      );
      if (!ok) return;
    }
    setBusy(true);
    const r = await officeApi("zalo-action", { action: "set_enabled", enabled: next });
    setBusy(false);
    if (!r.ok) toast(r.error, "error");
    else toast(next ? "Đã bật gửi Zalo tự động" : "Đã tắt gửi Zalo tự động", "success");
    void load();
  }

  async function sendNow(a: ZaloResponse["approved"][number]) {
    const ok = await confirm(
      `Gửi ngay tới ${a.phone} (${a.company})?\n\n"${a.draft}"\n\nTin vẫn phải qua hạn mức của Zalo (cách nhau tối thiểu 3 phút, 15 tin mỗi ngày, 8h đến 20h).`,
      { confirmLabel: "Gửi ngay" },
    );
    if (!ok) return;
    setSendingId(a.id);
    const r = await officeApi("zalo-send-now", { id: a.id });
    setSendingId(null);
    if (!r.ok) toast(r.error, "error");
    else toast("Đã gửi tin qua Zalo", "success");
    void load();
  }

  async function retry(id: number) {
    const r = await officeApi("zalo-action", { action: "retry", id });
    if (!r.ok) toast(r.error, "error");
    else toast("Đã đưa lại hàng chờ gửi", "success");
    void load();
  }

  const b = data?.bridge ?? null;

  return (
    <div className="space-y-4">
      {error ? (
        <p className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">Không đọc được trạng thái Zalo: {error}</p>
      ) : null}

      <div className="grid gap-3 lg:grid-cols-2">
        <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-bold text-navy-800">Gửi Zalo tự động</h2>
              <p className="text-xs text-slate-500">
                Lead đạt kiểm tra (điểm từ 70, có SĐT Zalo) được duyệt tự động, lead khác chờ bạn duyệt. Mỗi lượt 1 tin, cách nhau ngẫu nhiên, T2 đến T7, 8h đến 19h, tối đa khoảng 30 tin mỗi ngày.
              </p>
            </div>
            <button
              type="button"
              disabled={!data || busy}
              onClick={toggle}
              className={`rounded-full px-4 py-2 text-sm font-bold text-white disabled:opacity-40 ${
                data?.enabled ? "bg-emerald-600 hover:bg-emerald-700" : "bg-slate-400 hover:bg-slate-500"
              }`}
            >
              {data?.enabled ? "Đang bật" : "Đang tắt"}
            </button>
          </div>
          <p className="rounded-lg bg-amber-50 p-2 text-xs text-amber-800">
            Zalo có thể khóa tài khoản nếu gửi chào hàng hàng loạt. Nên dùng số Zalo phụ và theo dõi tab Thống kê gửi tin. Gặp lỗi lạ thì tắt công tắc này ngay.
          </p>
        </section>

        <section className="space-y-2 rounded-2xl border border-slate-200 bg-white p-4">
          <h2 className="font-bold text-navy-800">Tài khoản Zalo (bridge)</h2>
          {b ? (
            <>
              <p className="text-sm">
                <span className={`mr-2 inline-block h-2.5 w-2.5 rounded-full ${b.loggedIn ? "bg-emerald-500" : "bg-red-500"}`} />
                {b.loggedIn ? `Đã đăng nhập: ${b.account}` : "Chưa đăng nhập Zalo (cần quét QR lại trong n8n)"}
              </p>
              <p className="text-sm text-slate-600">
                Hôm nay đã gửi <b>{b.sentToday}</b>/{b.dailyLimit} tin
                {b.canSendNow ? " · sẵn sàng gửi" : b.reason ? ` · ${b.reason}` : ""}
              </p>
            </>
          ) : (
            <p className="text-sm text-red-700">Không hỏi được bridge Zalo trên VPS.</p>
          )}
          {data ? (
            <p className="text-xs text-slate-500">
              Chờ gửi {data.counts.ready} · thiếu SĐT {data.counts.noPhone} · trùng số đã gửi {data.counts.duplicate} · đã gửi{" "}
              {data.counts.sent} · đã phản hồi {data.counts.replied} · lỗi {data.counts.failed}
            </p>
          ) : null}
        </section>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white">
        <h2 className="border-b border-slate-100 px-4 py-3 font-bold text-navy-800">
          Hàng chờ gửi ({data?.approved.length ?? 0})
        </h2>
        {data && data.approved.length === 0 ? (
          <p className="p-4 text-sm text-slate-500">Chưa có lead nào được duyệt. Duyệt lead ở tab &quot;Lead chờ duyệt&quot;.</p>
        ) : null}
        <ul className="divide-y divide-slate-100">
          {data?.approved.map((a) => (
            <li key={a.id} className="space-y-1 px-4 py-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold text-navy-800">
                  {a.company} <span className="text-xs font-normal text-slate-400">· {a.score} điểm · {a.saleAgent}</span>
                </p>
                {!a.hasPhone ? (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                    Thiếu SĐT Zalo, gửi tay
                  </span>
                ) : a.duplicate ? (
                  <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                    Số này đã được gửi
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
                      Chờ lượt gửi · {a.phone}
                    </span>
                    <button
                      type="button"
                      disabled={sendingId === a.id}
                      onClick={() => sendNow(a)}
                      className="rounded-lg bg-navy-800 px-3 py-1 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-40"
                    >
                      {sendingId === a.id ? "Đang gửi..." : "Gửi ngay"}
                    </button>
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-600">{a.draft}</p>
              {!a.hasPhone ? <p className="text-[11px] text-slate-400">Liên hệ: {a.contact}</p> : null}
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white">
        <h2 className="border-b border-slate-100 px-4 py-3 font-bold text-navy-800">Đã gửi và phản hồi</h2>
        {data && data.sent.length === 0 ? <p className="p-4 text-sm text-slate-500">Chưa gửi tin nào.</p> : null}
        <ul className="divide-y divide-slate-100">
          {data?.sent.map((s) => (
            <li key={s.id} className="space-y-1 px-4 py-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold text-navy-800">
                  {s.company} <span className="text-xs font-normal text-slate-400">· {s.phone} · {fmtTime(s.sentAt)}</span>
                </p>
                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_STYLE[s.status] ?? ""}`}>
                    {STATUS_LABEL[s.status] ?? s.status}
                  </span>
                  {s.status === "gui_loi" ? (
                    <button
                      type="button"
                      onClick={() => retry(s.id)}
                      className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-navy-800 hover:bg-slate-50"
                    >
                      Thử gửi lại
                    </button>
                  ) : null}
                </div>
              </div>
              <p className="text-xs text-slate-500">Tin đã gửi: {s.draft}</p>
              {s.status === "gui_loi" ? <p className="text-xs text-red-700">{s.note}</p> : null}
              {s.replyText ? (
                <p className="rounded-lg bg-emerald-50 p-2 text-xs text-emerald-900">
                  <b>Khách trả lời{s.repliedAt ? ` (${fmtTime(s.repliedAt)})` : ""}:</b> {s.replyText}
                  <span className="block text-[11px] text-emerald-700">Bot AI tự trả lời tiếp. Khi bot không trả lời được (chốt đơn, khiếu nại, hỏi hợp tác, bảo dừng...) sẽ có ghi chú &quot;cần anh Huy&quot; ở tab Ghi chú &amp; lỗi.</span>
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
