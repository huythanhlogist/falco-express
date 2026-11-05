"use client";

import { useCallback, useEffect, useState } from "react";
import { useConfirm, useToast } from "@/components/ui/Toast";
import { fmtTime, officeApi, TASK_STATUS_LABEL } from "@/lib/office-api";
import type { OfficeLive } from "@/lib/office-agents";

const BOT_OPTIONS = [
  { id: "any", label: "Bot nào rảnh trước" },
  { id: "musehuythanh", label: "Muse Huy Thanh" },
  { id: "videomuse", label: "Muse Video" },
];

const STATUS_STYLE: Record<string, string> = {
  cho_giao: "bg-slate-100 text-slate-700",
  dang_lam: "bg-emerald-100 text-emerald-800",
  cho_nap: "bg-amber-100 text-amber-800",
  done: "bg-sky-100 text-sky-800",
  blocked: "bg-red-100 text-red-700",
  failed: "bg-red-100 text-red-700",
  huy: "bg-slate-200 text-slate-500",
};

const SALES = [
  { id: "linh", label: "Linh: đặc sản châu Âu" },
  { id: "nam", label: "Nam: shop bán Việt kiều (Âu, Úc)" },
  { id: "vy", label: "Vy: đại lý & CTV" },
  { id: "mai", label: "Mai: khách lẻ ở châu Âu" },
  { id: "khoa", label: "Khoa: linh kiện đi Mỹ" },
];

export default function OfficeQueuePanel() {
  const toast = useToast();
  const confirm = useConfirm();
  const [live, setLive] = useState<OfficeLive | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [bot, setBot] = useState("any");
  const [objective, setObjective] = useState("");
  const [instructions, setInstructions] = useState("");
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    const r = await officeApi<OfficeLive>("status");
    if (!r.ok) {
      setError(r.error);
      return;
    }
    setError(null);
    setLive(r.data);
  }, []);

  useEffect(() => {
    void load();
    const id = window.setInterval(load, 10000);
    return () => window.clearInterval(id);
  }, [load]);

  async function createTask() {
    setSending(true);
    const r = await officeApi("task-action", { action: "create", bot, objective, instructions });
    setSending(false);
    if (!r.ok) {
      toast(r.error, "error");
      return;
    }
    toast("Đã giao việc, Muse sẽ nhận trong vòng 1 phút", "success");
    setObjective("");
    setInstructions("");
    void load();
  }

  async function runSales(agents: string[]) {
    const ok = await confirm(
      agents.length === 4
        ? "Giao cả 4 việc tìm lead (Linh, Nam, Vy, Mai) cho Muse ngay bây giờ?"
        : `Giao việc tìm lead cho ${agents[0]} ngay bây giờ?`,
      { confirmLabel: "Giao việc" },
    );
    if (!ok) return;
    const r = await officeApi("run-sales", { agents });
    if (!r.ok) toast(r.error, "error");
    else toast("Đã tạo việc tìm lead, chờ vài giây rồi làm mới", "success");
    window.setTimeout(load, 3000);
  }

  async function ping(botId: string) {
    const r = await officeApi("task-action", { action: "ping", bot: botId });
    if (!r.ok) toast(r.error, "error");
    else toast("Đã gửi ping", "success");
    window.setTimeout(load, 2000);
  }

  async function taskAction(action: "cancel" | "requeue", taskCode: string) {
    if (action === "cancel") {
      const ok = await confirm(`Hủy việc ${taskCode}?`, { confirmLabel: "Hủy việc", danger: true });
      if (!ok) return;
    }
    const r = await officeApi("task-action", { action, task_code: taskCode });
    if (!r.ok) toast(r.error, "error");
    else toast(action === "cancel" ? "Đã hủy việc" : "Đã giao lại việc", "success");
    void load();
  }

  return (
    <div className="space-y-4">
      {error ? (
        <p className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">Không đọc được n8n: {error}</p>
      ) : null}

      <div className="grid gap-3 md:grid-cols-2">
        {(live?.muse ?? []).map((m) => (
          <div key={m.bot} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4">
            <div>
              <p className="font-bold text-navy-800">{m.bot === "musehuythanh" ? "Muse Huy Thanh" : "Muse Video"}</p>
              <p className="text-xs text-slate-500">
                {m.online ? "Online" : "Mất kết nối"}
                {m.lastSeen ? ` · nhịp sống ${fmtTime(m.lastSeen)}` : " · chưa từng báo"}
                {m.taskCode ? ` · đang làm ${m.taskCode}` : ""}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className={`h-2.5 w-2.5 rounded-full ${m.online ? "bg-emerald-500" : "bg-red-500"}`} />
              <button
                type="button"
                onClick={() => ping(m.bot)}
                className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-semibold text-navy-800 hover:bg-slate-50"
              >
                Ping
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
          <h2 className="font-bold text-navy-800">Giao việc cho Muse</h2>
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-navy-800">
              Giao cho
              <select
                value={bot}
                onChange={(e) => setBot(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
              >
                {BOT_OPTIONS.map((b) => (
                  <option key={b.id} value={b.id}>{b.label}</option>
                ))}
              </select>
            </label>
            <label className="block text-xs font-semibold text-navy-800">
              Mục tiêu (ngắn gọn, 5 đến 300 ký tự)
              <input
                value={objective}
                maxLength={300}
                onChange={(e) => setObjective(e.target.value)}
                placeholder="Ví dụ: Tìm 5 shop bán gia vị cho người Việt ở Đức"
                className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm font-normal outline-none focus:border-navy-800"
              />
            </label>
            <label className="block text-xs font-semibold text-navy-800">
              Chi tiết (không bắt buộc)
              <textarea
                value={instructions}
                maxLength={4000}
                rows={5}
                onChange={(e) => setInstructions(e.target.value)}
                placeholder="Yêu cầu cụ thể, nguồn nên xem, định dạng kết quả mong muốn..."
                className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-sm font-normal outline-none focus:border-navy-800"
              />
            </label>
            <p className="text-[11px] text-slate-400">
              Muse chỉ nghiên cứu và báo kết quả, không tự đăng bài hay gửi tin cho ai.
            </p>
            <button
              type="button"
              disabled={sending || objective.trim().length < 5}
              onClick={createTask}
              className="rounded-lg bg-navy-800 px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-40"
            >
              {sending ? "Đang giao..." : "Giao việc"}
            </button>
          </div>
        </section>

        <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
          <h2 className="font-bold text-navy-800">Tìm lead ngay</h2>
          <p className="text-xs text-slate-500">
            Lịch tự động chạy 20:30 mỗi tối. Bấm đây để chạy thêm bất cứ lúc nào, mỗi lần tối đa 5 lead mỗi người.
          </p>
          <div className="flex flex-wrap gap-2">
            {SALES.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => runSales([s.id])}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-navy-800 hover:bg-slate-50"
              >
                {s.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => runSales(["linh", "nam", "vy", "mai", "khoa"])}
              className="rounded-lg bg-navy-800 px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90"
            >
              Cả 5 người
            </button>
          </div>
          {live ? (
            <p className="text-xs text-slate-600">
              Hàng đợi: chờ giao {live.queue.cho_giao} · đang làm {live.queue.dang_lam} · chờ nạp {live.queue.cho_nap} ·
              xong {live.queue.done} · bị chặn {live.queue.blocked} · lỗi {live.queue.failed}
            </p>
          ) : null}
        </section>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white">
        <h2 className="border-b border-slate-100 px-4 py-3 font-bold text-navy-800">Việc gần đây</h2>
        {live && live.recent.length === 0 ? (
          <p className="p-4 text-sm text-slate-500">Chưa có việc nào.</p>
        ) : null}
        <ul className="divide-y divide-slate-100">
          {live?.recent.map((t) => (
            <li key={t.taskCode} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm">
              <div className="min-w-0 flex-1">
                <p className="truncate">
                  <span className="font-semibold text-navy-800">{t.taskCode}</span>{" "}
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_STYLE[t.status] ?? "bg-slate-100 text-slate-600"}`}>
                    {TASK_STATUS_LABEL[t.status] ?? t.status}
                  </span>
                  {t.bot ? <span className="text-xs text-slate-400"> · {t.bot}</span> : null}
                </p>
                <p className="truncate text-xs text-slate-500">
                  {t.found ? `${t.passed}/${t.found} lead đạt · ` : ""}
                  {t.summary}
                  {t.updatedAt ? ` · ${fmtTime(t.updatedAt)}` : ""}
                </p>
              </div>
              <div className="flex gap-2">
                {t.status === "cho_giao" || t.status === "dang_lam" ? (
                  <button
                    type="button"
                    onClick={() => taskAction("cancel", t.taskCode)}
                    className="rounded-lg border border-red-200 px-2.5 py-1 text-xs font-semibold text-red-700 hover:bg-red-50"
                  >
                    Hủy
                  </button>
                ) : null}
                {["dang_lam", "blocked", "failed", "huy"].includes(t.status) ? (
                  <button
                    type="button"
                    onClick={() => taskAction("requeue", t.taskCode)}
                    className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-navy-800 hover:bg-slate-50"
                  >
                    Giao lại
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
