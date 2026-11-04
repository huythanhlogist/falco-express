"use client";

import { useCallback, useEffect, useState } from "react";
import { useConfirm, useToast } from "@/components/ui/Toast";
import {
  ASSIGNEE_LABEL,
  fmtTime,
  officeApi,
  type LeadItem,
  type LeadsResponse,
  type NoteItem,
} from "@/lib/office-api";

type Filter = "cho_duyet" | "da_duyet" | "loai";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "cho_duyet", label: "Chờ duyệt" },
  { id: "da_duyet", label: "Đã duyệt" },
  { id: "loai", label: "Đã loại" },
];

function wordCount(s: string) {
  return s.trim().split(/\s+/).filter(Boolean).length;
}

export default function OfficeLeadsPanel() {
  const toast = useToast();
  const confirm = useConfirm();
  const [filter, setFilter] = useState<Filter>("cho_duyet");
  const [data, setData] = useState<LeadsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState<number | null>(null);
  const [noteFor, setNoteFor] = useState<number | null>(null);
  const [noteText, setNoteText] = useState("");
  const [noteAssignee, setNoteAssignee] = useState<NoteItem["assignee"]>("muse");

  const load = useCallback(async () => {
    const r = await officeApi<LeadsResponse>(`leads?status=${filter}`);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    setError(null);
    setData(r.data);
  }, [filter]);

  useEffect(() => {
    void load();
    const id = window.setInterval(load, 15000);
    return () => window.clearInterval(id);
  }, [load]);

  async function act(lead: LeadItem, action: "approve" | "reject" | "undo" | "edit") {
    if (action === "reject") {
      const ok = await confirm(`Loại lead "${lead.company}"?`, { confirmLabel: "Loại", danger: true });
      if (!ok) return;
    }
    setBusy(lead.id);
    const r = await officeApi("lead-action", {
      id: lead.id,
      action,
      draft: action === "edit" ? drafts[lead.id] : undefined,
    });
    setBusy(null);
    if (!r.ok) {
      toast(r.error, "error");
    } else {
      toast(
        action === "approve" ? "Đã duyệt" : action === "reject" ? "Đã loại" : action === "undo" ? "Đã hoàn tác" : "Đã lưu tin",
        "success",
      );
      if (action === "edit") setDrafts((d) => { const n = { ...d }; delete n[lead.id]; return n; });
    }
    void load();
  }

  async function sendNote(lead: LeadItem) {
    const r = await officeApi("note-action", {
      action: "add",
      kind: "loi",
      text: `Lead #${lead.id} ${lead.company}: ${noteText}`,
      assignee: noteAssignee,
      lead_id: lead.id,
    });
    if (!r.ok) toast(r.error, "error");
    else {
      toast("Đã ghi vào tab Ghi chú & lỗi", "success");
      setNoteFor(null);
      setNoteText("");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
              filter === f.id
                ? "border-navy-800 bg-navy-800 text-white"
                : "border-slate-200 bg-white text-navy-800 hover:bg-slate-50"
            }`}
          >
            {f.label}
            {data ? ` (${data.counts[f.id]})` : ""}
          </button>
        ))}
        <span className="text-xs text-slate-400">Tự cập nhật mỗi 15 giây. Duyệt xong lead chờ bước gửi Zalo.</span>
      </div>

      {error ? (
        <p className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">Không đọc được lead: {error}</p>
      ) : null}

      {data && data.leads.length === 0 && !error ? (
        <p className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-slate-500">
          Không có lead nào ở mục này.
        </p>
      ) : null}

      <ul className="grid gap-3 lg:grid-cols-2">
        {data?.leads.map((l) => {
          const current = drafts[l.id] ?? l.draft;
          const changed = current !== l.draft;
          const editable = l.status === "cho_duyet";
          return (
            <li key={l.id} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="font-bold text-navy-800">{l.company}</h3>
                  <p className="text-xs text-slate-500">
                    {l.saleAgent} · {l.product} · {l.markets} · {fmtTime(l.createdAt)}
                  </p>
                </div>
                <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-800">
                  {l.score} điểm
                </span>
              </div>

              <p className="text-xs text-slate-600">
                <span className="font-semibold">Liên hệ:</span> {l.contact}
                {l.sourceUrl ? (
                  <>
                    {" · "}
                    <a href={l.sourceUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-navy-800 underline">
                      Xem nguồn
                    </a>
                  </>
                ) : null}
              </p>
              <p className="text-xs text-slate-600">
                <span className="font-semibold">Bằng chứng:</span> {l.reason}
              </p>

              <div>
                <label className="mb-1 flex items-center justify-between text-xs font-semibold text-navy-800">
                  Tin Zalo nháp
                  <span className={wordCount(current) > 40 ? "text-red-600" : "text-slate-400"}>
                    {wordCount(current)} từ (tối đa 40)
                  </span>
                </label>
                <textarea
                  value={current}
                  disabled={!editable}
                  onChange={(e) => setDrafts((d) => ({ ...d, [l.id]: e.target.value }))}
                  rows={3}
                  className="w-full rounded-lg border border-slate-300 p-2 text-sm text-slate-700 outline-none focus:border-navy-800 disabled:bg-slate-50"
                />
                {l.qaNote ? <p className="mt-1 text-[11px] text-slate-400">Kiểm tra: {l.qaNote}</p> : null}
              </div>

              <div className="flex flex-wrap gap-2">
                {l.status === "cho_duyet" ? (
                  <>
                    <button
                      type="button"
                      disabled={busy === l.id || changed}
                      title={changed ? "Lưu tin đã sửa trước khi duyệt" : undefined}
                      onClick={() => act(l, "approve")}
                      className="rounded-lg bg-navy-800 px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-40"
                    >
                      Duyệt
                    </button>
                    {changed ? (
                      <button
                        type="button"
                        disabled={busy === l.id}
                        onClick={() => act(l, "edit")}
                        className="rounded-lg border border-navy-800 px-3 py-1.5 text-xs font-semibold text-navy-800 hover:bg-slate-50 disabled:opacity-40"
                      >
                        Lưu tin đã sửa
                      </button>
                    ) : null}
                    <button
                      type="button"
                      disabled={busy === l.id}
                      onClick={() => act(l, "reject")}
                      className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-40"
                    >
                      Loại
                    </button>
                  </>
                ) : null}
                {l.status === "da_duyet" ? (
                  <button
                    type="button"
                    disabled={busy === l.id}
                    onClick={() => act(l, "undo")}
                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-navy-800 hover:bg-slate-50 disabled:opacity-40"
                  >
                    Hoàn tác duyệt
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => setNoteFor(noteFor === l.id ? null : l.id)}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Báo lỗi / ghi chú
                </button>
              </div>

              {noteFor === l.id ? (
                <div className="space-y-2 rounded-lg bg-slate-50 p-3">
                  <textarea
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    rows={2}
                    placeholder="Lead này sai chỗ nào? Ví dụ: là nhà xuất khẩu lớn, tin nhắn lủng củng..."
                    className="w-full rounded-lg border border-slate-300 p-2 text-sm outline-none focus:border-navy-800"
                  />
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-semibold text-navy-800">Ai xử lý:</span>
                    <select
                      value={noteAssignee}
                      onChange={(e) => setNoteAssignee(e.target.value as NoteItem["assignee"])}
                      className="rounded-lg border border-slate-300 px-2 py-1"
                    >
                      {(["muse", "claude", "huy"] as const).map((a) => (
                        <option key={a} value={a}>{ASSIGNEE_LABEL[a]}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      disabled={noteText.trim().length < 3}
                      onClick={() => sendNote(l)}
                      className="rounded-lg bg-navy-800 px-3 py-1 font-semibold text-white disabled:opacity-40"
                    >
                      Ghi lại
                    </button>
                  </div>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
