"use client";

import { useCallback, useEffect, useState } from "react";
import { useConfirm, useToast } from "@/components/ui/Toast";
import {
  ASSIGNEE_LABEL,
  fmtTime,
  officeApi,
  phoneOf,
  type LeadItem,
  type LeadsResponse,
  type NoteItem,
} from "@/lib/office-api";

type Filter = "cho_duyet" | "da_duyet" | "da_gui" | "loai";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "cho_duyet", label: "Chờ duyệt" },
  { id: "da_duyet", label: "Đã duyệt" },
  { id: "da_gui", label: "Đã gửi" },
  { id: "loai", label: "Đã loại" },
];

const SALE_TABS = [
  { id: "all", name: "", label: "Tất cả" },
  { id: "linh", name: "Linh", label: "Linh · đặc sản Âu" },
  { id: "nam", name: "Nam", label: "Nam · shop Việt kiều" },
  { id: "vy", name: "Vy", label: "Vy · đại lý, CTV" },
  { id: "mai", name: "Mai", label: "Mai · khách lẻ Âu" },
  { id: "khoa", name: "Khoa", label: "Khoa · linh kiện Mỹ" },
];

const REJECT_REASONS = [
  "Công ty quá lớn, đã có đối tác logistics",
  "Là đối thủ vận chuyển, không phải khách",
  "Sai thị trường",
  "Không có nhu cầu gửi hàng đi nước ngoài",
  "Liên hệ không dùng được",
  "Không đúng chân dung khách của sale này",
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
  const [sale, setSale] = useState("all");
  const [rejectFor, setRejectFor] = useState<number | null>(null);
  const [rejectText, setRejectText] = useState("");

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

  async function act(lead: LeadItem, action: "approve" | "reject" | "undo" | "edit" | "quote" | "won" | "dealreset", note?: string) {
    if (action === "approve") {
      const phone = phoneOf(lead.contact);
      const ok = await confirm(
        phone
          ? `Duyệt "${lead.company}"? Tin nháp sẽ được gửi qua Zalo tới ${phone} khi đến lượt (nếu công tắc Gửi Zalo đang bật).`
          : `Duyệt "${lead.company}"? Ô liên hệ không có số di động Zalo hợp lệ nên tin sẽ KHÔNG tự gửi, bạn phải nhắn tay.`,
        { confirmLabel: "Duyệt" },
      );
      if (!ok) return;
    }
    setBusy(lead.id);
    const r = await officeApi("lead-action", {
      id: lead.id,
      action,
      draft: action === "edit" ? drafts[lead.id] : undefined,
      note: action === "reject" ? note : undefined,
    });
    setBusy(null);
    if (!r.ok) {
      toast(r.error, "error");
    } else {
      toast(
        action === "approve"
          ? "Đã duyệt"
          : action === "reject"
            ? note ? "Đã loại, sale sẽ học từ lý do này" : "Đã loại"
            : action === "undo"
              ? "Đã hoàn tác"
              : action === "quote"
                ? "Đã ghi: đã báo giá"
                : action === "won"
                  ? "Đã ghi: chốt đơn"
                  : action === "dealreset"
                    ? "Đã bỏ trạng thái"
                    : "Đã lưu tin",
        "success",
      );
      if (action === "edit") setDrafts((d) => { const n = { ...d }; delete n[lead.id]; return n; });
      if (action === "reject") {
        setRejectFor(null);
        setRejectText("");
      }
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

  const saleName = SALE_TABS.find((t) => t.id === sale)?.name;
  const shownLeads = (data?.leads ?? []).filter((l) => sale === "all" || l.saleAgent === saleName);

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
        <span className="text-xs text-slate-400">Tự cập nhật mỗi 15 giây. Duyệt = đồng ý gửi tin này qua Zalo (xem tab Gửi Zalo).</span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {SALE_TABS.map((t) => {
          const n = t.id === "all" ? (data?.leads.length ?? 0) : (data?.leads.filter((l) => l.saleAgent === t.name).length ?? 0);
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setSale(t.id)}
              className={`rounded-lg border px-3 py-1.5 text-sm font-bold ${
                sale === t.id ? "border-teal-700 bg-teal-700 text-white" : "border-slate-200 bg-white text-teal-800 hover:bg-slate-50"
              }`}
            >
              {t.label} ({n})
            </button>
          );
        })}
      </div>

      {error ? (
        <p className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">Không đọc được lead: {error}</p>
      ) : null}

      {data && shownLeads.length === 0 && !error ? (
        <p className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-slate-500">
          Không có lead nào ở mục này.
        </p>
      ) : null}

      <ul className="grid gap-3 lg:grid-cols-2">
        {shownLeads.map((l) => {
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
                  <span className={wordCount(current) > 150 ? "text-red-600" : "text-slate-400"}>
                    {wordCount(current)} từ (tối đa 150)
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
                      onClick={() => setRejectFor(rejectFor === l.id ? null : l.id)}
                      className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-40"
                    >
                      Loại
                    </button>
                  </>
                ) : null}
                {l.status === "da_gui" || l.status === "da_phan_hoi" ? (
                  <>
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                        l.dealStage === "chot_don"
                          ? "bg-emerald-100 text-emerald-800"
                          : l.dealStage === "bao_gia"
                            ? "bg-amber-100 text-amber-800"
                            : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {l.dealStage === "chot_don" ? "Đã chốt đơn" : l.dealStage === "bao_gia" ? "Đã báo giá" : l.status === "da_phan_hoi" ? "Khách đã trả lời" : "Đã gửi tin"}
                    </span>
                    {l.dealStage !== "bao_gia" && l.dealStage !== "chot_don" ? (
                      <button
                        type="button"
                        disabled={busy === l.id}
                        onClick={() => act(l, "quote")}
                        className="rounded-lg border border-amber-300 px-3 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-50 disabled:opacity-40"
                      >
                        Đã báo giá
                      </button>
                    ) : null}
                    {l.dealStage !== "chot_don" ? (
                      <button
                        type="button"
                        disabled={busy === l.id}
                        onClick={() => act(l, "won")}
                        className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-40"
                      >
                        Chốt đơn
                      </button>
                    ) : null}
                    {l.dealStage ? (
                      <button
                        type="button"
                        disabled={busy === l.id}
                        onClick={() => act(l, "dealreset")}
                        className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                      >
                        Bỏ trạng thái
                      </button>
                    ) : null}
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

              {rejectFor === l.id ? (
                <div className="space-y-2 rounded-lg bg-red-50 p-3">
                  <p className="text-xs font-semibold text-red-800">
                    Vì sao lead này không đạt? Lý do sẽ được ghi thành bài học cho {l.saleAgent}, lần sau sale tránh lỗi này.
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {REJECT_REASONS.map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setRejectText(r)}
                        className="rounded-full border border-red-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-red-700 hover:bg-red-100"
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                  <textarea
                    value={rejectText}
                    onChange={(e) => setRejectText(e.target.value)}
                    rows={2}
                    maxLength={280}
                    placeholder="Chọn lý do có sẵn hoặc tự viết. Càng cụ thể, sale càng học đúng."
                    className="w-full rounded-lg border border-slate-300 p-2 text-sm outline-none focus:border-navy-800"
                  />
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={busy === l.id}
                      onClick={() => act(l, "reject", rejectText.trim())}
                      className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-40"
                    >
                      {rejectText.trim().length >= 3 ? "Loại và dạy sale" : "Loại (không ghi lý do)"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setRejectFor(null)}
                      className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                    >
                      Hủy
                    </button>
                  </div>
                </div>
              ) : null}

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
