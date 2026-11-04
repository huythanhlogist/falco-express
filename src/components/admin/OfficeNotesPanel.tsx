"use client";

import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/components/ui/Toast";
import {
  ASSIGNEE_LABEL,
  fmtTime,
  KIND_LABEL,
  NOTE_STATUS_LABEL,
  officeApi,
  type NoteItem,
  type NotesResponse,
} from "@/lib/office-api";

type Filter = "mo" | "dang_xu_ly" | "da_xong";

const KIND_STYLE: Record<NoteItem["kind"], string> = {
  loi: "bg-red-100 text-red-700",
  ghi_chu: "bg-slate-100 text-slate-700",
  yeu_cau: "bg-sky-100 text-sky-800",
};

const BOTS = [
  { id: "any", label: "Bot nào rảnh" },
  { id: "musehuythanh", label: "Muse Huy Thanh" },
  { id: "videomuse", label: "Muse Video" },
];

export default function OfficeNotesPanel() {
  const toast = useToast();
  const [data, setData] = useState<NotesResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("mo");
  const [kind, setKind] = useState<NoteItem["kind"]>("loi");
  const [text, setText] = useState("");
  const [assignee, setAssignee] = useState<NoteItem["assignee"]>("muse");
  const [taskCode, setTaskCode] = useState("");
  const [sendBot, setSendBot] = useState("any");
  const [resolution, setResolution] = useState<Record<number, string>>({});

  const load = useCallback(async () => {
    const r = await officeApi<NotesResponse>("notes");
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

  async function add(extra?: { text: string; task_code: string; assignee: NoteItem["assignee"] }) {
    const body = extra
      ? { action: "add", kind: "loi", text: extra.text, assignee: extra.assignee, task_code: extra.task_code }
      : { action: "add", kind, text, assignee, task_code: taskCode };
    const r = await officeApi("note-action", body);
    if (!r.ok) {
      toast(r.error, "error");
      return;
    }
    toast("Đã ghi", "success");
    if (!extra) {
      setText("");
      setTaskCode("");
    }
    void load();
  }

  async function noteAction(body: Record<string, unknown>, okText: string) {
    const r = await officeApi("note-action", body);
    if (!r.ok) toast(r.error, "error");
    else toast(okText, "success");
    void load();
  }

  async function retryTask(code: string) {
    const r = await officeApi("task-action", { action: "requeue", task_code: code });
    if (!r.ok) toast(r.error, "error");
    else toast("Đã giao lại cho Muse", "success");
    void load();
  }

  const shown = data?.notes.filter((n) => n.status === filter) ?? [];

  return (
    <div className="space-y-4">
      {error ? (
        <p className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">Không đọc được ghi chú: {error}</p>
      ) : null}

      <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
        <h2 className="font-bold text-navy-800">Ghi lỗi hoặc ghi chú mới</h2>
        <div className="grid gap-2 md:grid-cols-[140px_1fr_160px]">
          <select value={kind} onChange={(e) => setKind(e.target.value as NoteItem["kind"])} className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm">
            {(["loi", "ghi_chu", "yeu_cau"] as const).map((k) => (
              <option key={k} value={k}>{KIND_LABEL[k]}</option>
            ))}
          </select>
          <textarea
            value={text}
            rows={2}
            maxLength={2000}
            onChange={(e) => setText(e.target.value)}
            placeholder="Mô tả lỗi hoặc điều cần chỉnh. Càng cụ thể thì người sửa càng làm đúng."
            className="rounded-lg border border-slate-300 p-2 text-sm outline-none focus:border-navy-800"
          />
          <select value={assignee} onChange={(e) => setAssignee(e.target.value as NoteItem["assignee"])} className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm">
            {(["muse", "claude", "huy"] as const).map((a) => (
              <option key={a} value={a}>Ai xử lý: {ASSIGNEE_LABEL[a]}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={taskCode}
            onChange={(e) => setTaskCode(e.target.value)}
            placeholder="Mã việc liên quan (không bắt buộc)"
            className="w-64 rounded-lg border border-slate-300 px-2 py-1.5 text-xs outline-none focus:border-navy-800"
          />
          <button
            type="button"
            disabled={text.trim().length < 3}
            onClick={() => add()}
            className="rounded-lg bg-navy-800 px-4 py-1.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-40"
          >
            Ghi lại
          </button>
          <span className="text-xs text-slate-400">
            Muse: bấm &quot;Giao Muse sửa&quot; để Muse nhận như một việc. Claude: xử lý khi anh mở phiên Claude và nhờ xem ghi chú.
          </span>
        </div>
      </section>

      {data && data.autoErrors.length > 0 ? (
        <section className="rounded-2xl border border-red-200 bg-red-50 p-4">
          <h2 className="mb-2 font-bold text-red-800">Lỗi tự ghi nhận từ Muse ({data.autoErrors.length})</h2>
          <ul className="space-y-2">
            {data.autoErrors.map((e) => (
              <li key={e.taskCode} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white p-3 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-navy-800">
                    {e.taskCode} · {e.status === "blocked" ? "Bị chặn" : "Lỗi"} {e.bot ? `· ${e.bot}` : ""}
                  </p>
                  <p className="text-xs text-slate-600">{e.reason || e.objective}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => retryTask(e.taskCode)}
                    className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-navy-800 hover:bg-slate-50"
                  >
                    Giao Muse thử lại
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      add({
                        text: `Việc ${e.taskCode} ${e.status}: ${e.reason || e.objective}`,
                        task_code: e.taskCode,
                        assignee: "claude",
                      })
                    }
                    className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-navy-800 hover:bg-slate-50"
                  >
                    Nhờ Claude xem
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        {(["mo", "dang_xu_ly", "da_xong"] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
              filter === f ? "border-navy-800 bg-navy-800 text-white" : "border-slate-200 bg-white text-navy-800 hover:bg-slate-50"
            }`}
          >
            {NOTE_STATUS_LABEL[f]}
            {data ? ` (${data.counts[f]})` : ""}
          </button>
        ))}
        <select value={sendBot} onChange={(e) => setSendBot(e.target.value)} className="ml-auto rounded-lg border border-slate-300 px-2 py-1 text-xs">
          {BOTS.map((b) => (
            <option key={b.id} value={b.id}>Giao Muse: {b.label}</option>
          ))}
        </select>
      </div>

      {data && shown.length === 0 ? (
        <p className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-slate-500">Không có mục nào.</p>
      ) : null}

      <ul className="space-y-3">
        {shown.map((n) => (
          <li key={n.id} className="space-y-2 rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${KIND_STYLE[n.kind]}`}>{KIND_LABEL[n.kind]}</span>
              <span className="text-xs text-slate-400">#{n.id} · {fmtTime(n.createdAt)}</span>
              {n.taskCode ? <span className="text-xs text-slate-500">việc {n.taskCode}</span> : null}
              {n.leadId ? <span className="text-xs text-slate-500">lead #{n.leadId}</span> : null}
              {n.linkedTask ? <span className="text-xs font-semibold text-emerald-700">đã giao Muse: {n.linkedTask}</span> : null}
              <label className="ml-auto flex items-center gap-1 text-xs text-slate-500">
                Ai xử lý
                <select
                  value={n.assignee}
                  onChange={(e) => noteAction({ action: "assign", id: n.id, assignee: e.target.value }, "Đã đổi người xử lý")}
                  className="rounded-lg border border-slate-300 px-1.5 py-0.5"
                >
                  {(["muse", "claude", "huy"] as const).map((a) => (
                    <option key={a} value={a}>{ASSIGNEE_LABEL[a]}</option>
                  ))}
                </select>
              </label>
            </div>
            <p className="whitespace-pre-wrap text-sm text-slate-700">{n.text}</p>
            {n.resolution ? <p className="text-xs text-slate-500">Cách xử lý: {n.resolution}</p> : null}

            <div className="flex flex-wrap items-center gap-2">
              {n.status !== "da_xong" ? (
                <>
                  <button
                    type="button"
                    onClick={() => noteAction({ action: "send_to_muse", id: n.id, bot: sendBot }, "Đã giao Muse sửa")}
                    className="rounded-lg bg-navy-800 px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90"
                  >
                    Giao Muse sửa
                  </button>
                  {n.status === "dang_xu_ly" ? (
                    <button
                      type="button"
                      onClick={() => noteAction({ action: "set_status", id: n.id, status: "mo" }, "Đã mở lại, có thể giao lại")}
                      className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-navy-800 hover:bg-slate-50"
                    >
                      Hủy giao, mở lại
                    </button>
                  ) : null}
                  {n.status === "mo" ? (
                    <button
                      type="button"
                      onClick={() => noteAction({ action: "set_status", id: n.id, status: "dang_xu_ly" }, "Đã chuyển sang đang xử lý")}
                      className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-navy-800 hover:bg-slate-50"
                    >
                      Đang xử lý
                    </button>
                  ) : null}
                  <input
                    value={resolution[n.id] ?? ""}
                    onChange={(e) => setResolution((r) => ({ ...r, [n.id]: e.target.value }))}
                    placeholder="Đã xử lý thế nào (không bắt buộc)"
                    className="w-56 rounded-lg border border-slate-300 px-2 py-1.5 text-xs outline-none focus:border-navy-800"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      noteAction({ action: "set_status", id: n.id, status: "da_xong", resolution: resolution[n.id] ?? "" }, "Đã đóng")
                    }
                    className="rounded-lg border border-emerald-300 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-50"
                  >
                    Xong
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => noteAction({ action: "set_status", id: n.id, status: "mo" }, "Đã mở lại")}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-navy-800 hover:bg-slate-50"
                >
                  Mở lại
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
