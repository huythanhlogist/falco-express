"use client";

import { useCallback, useEffect, useState } from "react";
import Modal from "@/components/ui/Modal";
import { useConfirm, useToast } from "@/components/ui/Toast";
import { OFFICE_RULES, OFFICE_SALES } from "@/lib/office-agents";
import {
  ASSIGNEE_LABEL,
  fmtTime,
  officeApi,
  phoneOf,
  safeHttpUrl,
  type LeadItem,
  type LeadsResponse,
  type NoteItem,
} from "@/lib/office-api";

type Filter = "giu_tay" | "cho_duyet" | "da_duyet" | "da_gui" | "loai";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "giu_tay", label: `Gửi tay (từ ${OFFICE_RULES.manualSendScore} điểm)` },
  { id: "cho_duyet", label: "Chờ duyệt" },
  { id: "da_duyet", label: "Đã duyệt" },
  { id: "da_gui", label: "Đã gửi" },
  { id: "loai", label: "Đã loại" },
];

const SALE_TABS = [
  { id: "all", name: "", label: "Tất cả" },
  ...OFFICE_SALES.map((s) => ({ id: s.id, name: s.name, label: s.shortLabel })),
];

const REJECT_REASONS = [
  "Công ty quá lớn, đã có đối tác logistics",
  "Là đối thủ vận chuyển, không phải khách",
  "Sai thị trường",
  "Không có nhu cầu gửi hàng đi nước ngoài",
  "Liên hệ không dùng được",
  "Không đúng chân dung khách của sale này",
];

function phoneToCopy(contact: string): string {
  const vn = phoneOf(contact);
  if (vn) return vn;
  const m = (contact || "").match(/(?:\+|00)\s*\d[\d\s.()\-]{8,16}\d/);
  return m ? m[0].replace(/[\s.()\-]/g, "") : (contact || "").trim();
}

function wordCount(s: string) {
  return s.trim().split(/\s+/).filter(Boolean).length;
}

/** Parse ô nhập tiền VND: chỉ chấp nhận chữ số và dấu phân cách . , khoảng trắng. */
function parseVndInput(raw: string): { valid: true; value: number } | { valid: false; message: string } {
  const trimmed = raw.trim();
  if (!trimmed) return { valid: true, value: 0 };
  if (/[^\d.,\s]/.test(trimmed)) {
    return {
      valid: false,
      message: "Vui lòng chỉ nhập số tiền bằng VND (ví dụ: 1500000), không gõ chữ như 'triệu' hay 'tr'.",
    };
  }
  const digits = trimmed.replace(/[.,\s]/g, "");
  if (!digits) return { valid: true, value: 0 };
  const num = Number(digits);
  if (!Number.isFinite(num) || num < 0 || num > 100_000_000_000) {
    return { valid: false, message: "Số tiền không hợp lệ." };
  }
  return { valid: true, value: Math.round(num) };
}

export default function OfficeLeadsPanel() {
  const toast = useToast();
  const confirm = useConfirm();
  const [filter, setFilter] = useState<Filter>("giu_tay");
  const [data, setData] = useState<LeadsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState<number | null>(null);
  const [noteFor, setNoteFor] = useState<number | null>(null);
  const [noteText, setNoteText] = useState("");
  const [noteAssignee, setNoteAssignee] = useState<NoteItem["assignee"]>("muse");
  const [noteBusy, setNoteBusy] = useState(false);
  const [sale, setSale] = useState("all");
  const [rejectFor, setRejectFor] = useState<number | null>(null);
  const [rejectText, setRejectText] = useState("");
  const [wonLead, setWonLead] = useState<LeadItem | null>(null);
  const [wonInput, setWonInput] = useState("");

  const copyText = useCallback(
    async (text: string, okMsg: string) => {
      try {
        await navigator.clipboard.writeText(text);
        toast(okMsg, "success");
      } catch {
        toast("Không copy được, hãy bôi đen và copy tay", "error");
      }
    },
    [toast],
  );

  const load = useCallback(
    async (signal?: AbortSignal) => {
      const r = await officeApi<LeadsResponse>(`leads?status=${filter}`, undefined, { signal });
      if (!r.ok) {
        if (!r.aborted) setError(r.error);
        return;
      }
      setError(null);
      setData(r.data);
    },
    [filter],
  );

  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;
    let currentCtrl: AbortController | null = null;

    const run = async () => {
      currentCtrl?.abort();
      const ctrl = new AbortController();
      currentCtrl = ctrl;
      await load(ctrl.signal);
    };

    const schedule = () => {
      timer = window.setTimeout(async () => {
        if (!document.hidden && !cancelled) await run();
        if (!cancelled) schedule();
      }, 15_000);
    };

    const onVisibility = () => {
      if (!document.hidden && !cancelled) void run();
    };

    void run().then(() => {
      if (!cancelled) schedule();
    });
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      currentCtrl?.abort();
      if (timer !== undefined) window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [load]);

  async function act(
    lead: LeadItem,
    action: "approve" | "reject" | "undo" | "edit" | "quote" | "won" | "dealreset",
    note?: string,
    value?: number,
  ): Promise<boolean> {
    if (action === "approve") {
      const phone = phoneOf(lead.contact);
      const ok = await confirm(
        phone
          ? `Duyệt "${lead.company}"? Tin nháp sẽ được gửi qua Zalo tới ${phone} khi đến lượt (nếu công tắc Gửi Zalo đang bật).`
          : `Duyệt "${lead.company}"? Ô liên hệ không có số di động Zalo hợp lệ nên tin sẽ KHÔNG tự gửi, bạn phải nhắn tay.`,
        { confirmLabel: "Duyệt", danger: false },
      );
      if (!ok) return false;
    }
    if (action === "dealreset") {
      const ok = await confirm(`Bỏ trạng thái báo giá/chốt đơn của "${lead.company}"?`, {
        confirmLabel: "Bỏ trạng thái",
        danger: true,
      });
      if (!ok) return false;
    }
    if (action === "undo") {
      const ok = await confirm(`Hoàn tác duyệt cho "${lead.company}" về lại danh sách chờ duyệt?`, {
        confirmLabel: "Hoàn tác",
        danger: false,
      });
      if (!ok) return false;
    }
    if (action === "edit") {
      const nextDraft = (drafts[lead.id] ?? lead.draft).trim();
      if (!nextDraft) {
        toast("Tin nháp không được để trống", "error");
        return false;
      }
      if (wordCount(nextDraft) > OFFICE_RULES.maxDraftWords) {
        toast(`Tin nháp vượt quá ${OFFICE_RULES.maxDraftWords} từ, vui lòng rút gọn trước khi lưu`, "error");
        return false;
      }
    }

    setBusy(lead.id);
    const r = await officeApi("lead-action", {
      id: lead.id,
      action,
      draft: action === "edit" ? (drafts[lead.id] ?? lead.draft).trim() : undefined,
      note: action === "reject" ? note : undefined,
      value: action === "won" ? value : undefined,
    });
    setBusy(null);
    if (!r.ok) {
      toast(r.error, "error");
      return false;
    }
    toast(
      action === "approve"
        ? "Đã duyệt"
        : action === "reject"
          ? note
            ? "Đã loại, sale sẽ học từ lý do này"
            : "Đã loại"
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
    if (action === "edit") {
      setDrafts((d) => {
        const n = { ...d };
        delete n[lead.id];
        return n;
      });
    }
    if (action === "reject") {
      setRejectFor(null);
      setRejectText("");
    }
    void load();
    return true;
  }

  async function confirmWon() {
    if (!wonLead) return;
    const parsed = parseVndInput(wonInput);
    if (!parsed.valid) {
      toast(parsed.message, "error");
      return;
    }
    const ok = await act(wonLead, "won", undefined, parsed.value);
    if (ok) {
      setWonLead(null);
      setWonInput("");
    }
  }

  async function sendNote(lead: LeadItem) {
    if (noteBusy) return;
    setNoteBusy(true);
    const r = await officeApi("note-action", {
      action: "add",
      kind: "loi",
      text: `Lead #${lead.id} ${lead.company}: ${noteText}`,
      assignee: noteAssignee,
      lead_id: lead.id,
    });
    setNoteBusy(false);
    if (!r.ok) toast(r.error, "error");
    else {
      toast("Đã ghi vào tab Ghi chú & lỗi", "success");
      setNoteFor(null);
      setNoteText("");
    }
  }

  const saleName = SALE_TABS.find((t) => t.id === sale)?.name;
  const shownLeads = (data?.leads ?? []).filter((l) => sale === "all" || l.saleAgent === saleName);
  const parsedWon = parseVndInput(wonInput);

  return (
    <div className="space-y-4">
      {data?.stale ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
          Đang hiển thị dữ liệu tạm từ lúc {fmtTime(data.staleSince) || "trước đó"} do n8n phản hồi chậm hoặc tạm gián đoạn.
        </p>
      ) : null}

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
          const words = wordCount(current);
          const overLimit = words > OFFICE_RULES.maxDraftWords;
          const changed = current !== l.draft;
          const editable = l.status === "cho_duyet";
          const safeUrl = safeHttpUrl(l.sourceUrl);
          return (
            <li key={l.id} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="font-bold text-navy-800">{l.company}</h3>
                  <p className="text-xs text-slate-500">
                    {l.saleAgent} · {l.product} · {l.markets} · {fmtTime(l.createdAt)}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-800">
                    {l.score} điểm
                  </span>
                  {l.sendNote ? (
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                        l.sendNote.includes("đã gửi")
                          ? "bg-sky-100 text-sky-800"
                          : l.sendNote.includes("lỗi")
                            ? "bg-red-100 text-red-700"
                            : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {l.sendNote.replace(" (ghi từ Sheet)", "")}
                    </span>
                  ) : null}
                </div>
              </div>

              <p className="text-xs text-slate-600">
                <span className="font-semibold">Liên hệ:</span> {l.contact}
                {safeUrl ? (
                  <>
                    {" · "}
                    <a href={safeUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-navy-800 underline">
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
                  Tin nháp (gửi qua Zalo hoặc WhatsApp)
                  <span className={overLimit ? "text-red-600" : "text-slate-400"}>
                    {words} từ (tối đa {OFFICE_RULES.maxDraftWords})
                  </span>
                </label>
                <textarea
                  value={current}
                  disabled={!editable}
                  onChange={(e) => setDrafts((d) => ({ ...d, [l.id]: e.target.value }))}
                  rows={3}
                  className="w-full rounded-lg border border-slate-300 p-2 text-sm text-slate-700 outline-none focus:border-navy-800 disabled:bg-slate-50"
                />
                {overLimit ? (
                  <p className="mt-1 text-[11px] font-medium text-red-600">
                    Tin nháp đang vượt quá {OFFICE_RULES.maxDraftWords} từ — cần rút gọn trước khi lưu.
                  </p>
                ) : null}
                {l.qaNote ? <p className="mt-1 text-[11px] text-slate-400">Kiểm tra: {l.qaNote}</p> : null}
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => copyText(phoneToCopy(l.contact), "Đã copy số: " + phoneToCopy(l.contact))}
                  className="rounded-lg border border-teal-700 px-3 py-1.5 text-xs font-semibold text-teal-800 hover:bg-teal-50"
                >
                  Copy số
                </button>
                <button
                  type="button"
                  onClick={() => copyText(current, "Đã copy tin nhắn")}
                  className="rounded-lg bg-teal-700 px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90"
                >
                  Copy tin nhắn
                </button>
                {l.status === "cho_duyet" ? (
                  <>
                    {filter !== "giu_tay" ? (
                      <button
                        type="button"
                        disabled={busy === l.id || changed}
                        title={changed ? "Lưu tin đã sửa trước khi duyệt" : undefined}
                        onClick={() => act(l, "approve")}
                        className="rounded-lg bg-navy-800 px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-40"
                      >
                        Duyệt
                      </button>
                    ) : null}
                    {changed ? (
                      <button
                        type="button"
                        disabled={busy === l.id || overLimit || !current.trim()}
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
                    {l.intent && l.intent !== "khac" ? (
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                          l.intent === "tu_choi" ? "bg-red-100 text-red-700" : "bg-sky-100 text-sky-800"
                        }`}
                      >
                        {l.intent === "xin_bang_gia" ? "Khách xin bảng giá" : l.intent === "hoi_gia" ? "Khách hỏi giá" : l.intent === "thu_tuc" ? "Khách hỏi thủ tục" : "Khách từ chối"}
                      </span>
                    ) : null}
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                        l.dealStage === "chot_don"
                          ? "bg-emerald-100 text-emerald-800"
                          : l.dealStage === "bao_gia"
                            ? "bg-amber-100 text-amber-800"
                            : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {l.dealStage === "chot_don" ? `Đã chốt đơn${l.dealValue ? " · " + l.dealValue.toLocaleString("vi-VN") + "đ" : ""}` : l.dealStage === "bao_gia" ? "Đã báo giá" : l.status === "da_phan_hoi" ? "Khách đã trả lời" : "Đã gửi tin"}
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
                        onClick={() => {
                          setWonLead(l);
                          setWonInput(l.dealValue ? String(l.dealValue) : "");
                        }}
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
                      disabled={noteBusy || noteText.trim().length < 3}
                      onClick={() => sendNote(l)}
                      className="rounded-lg bg-navy-800 px-3 py-1 font-semibold text-white disabled:opacity-40"
                    >
                      {noteBusy ? "Đang ghi..." : "Ghi lại"}
                    </button>
                  </div>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>

      <Modal
        open={!!wonLead}
        title="Xác nhận chốt đơn"
        subtitle={wonLead ? `${wonLead.company} · ${wonLead.saleAgent}` : undefined}
        busy={wonLead !== null && busy === wonLead.id}
        onClose={() => {
          setWonLead(null);
          setWonInput("");
        }}
        footer={
          <>
            <button
              type="button"
              disabled={wonLead !== null && busy === wonLead.id}
              onClick={() => {
                setWonLead(null);
                setWonInput("");
              }}
              className="btn-outline !px-4 !py-2 text-sm"
            >
              Huỷ
            </button>
            <button
              type="button"
              disabled={!parsedWon.valid || (wonLead !== null && busy === wonLead.id)}
              onClick={confirmWon}
              className="rounded-full bg-emerald-600 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 disabled:opacity-40"
            >
              {wonLead !== null && busy === wonLead.id ? "Đang lưu..." : "Xác nhận chốt đơn"}
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <label className="block text-xs font-semibold text-navy-800">
            Giá trị đơn hàng (VND — bỏ trống nếu chưa biết)
            <input
              type="text"
              inputMode="numeric"
              value={wonInput}
              onChange={(e) => setWonInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && parsedWon.valid) {
                  e.preventDefault();
                  void confirmWon();
                }
              }}
              placeholder="Ví dụ: 1500000"
              className="mt-1.5 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm font-normal text-navy-900 outline-none focus:border-navy-800"
            />
          </label>
          {parsedWon.valid ? (
            <p className="rounded-xl bg-emerald-50 px-3.5 py-2 text-xs font-semibold text-emerald-800">
              {parsedWon.value > 0
                ? `Số tiền sẽ ghi nhận: ${parsedWon.value.toLocaleString("vi-VN")}đ`
                : "Chưa nhập giá trị (sẽ ghi nhận 0đ)."}
            </p>
          ) : (
            <p className="rounded-xl bg-red-50 px-3.5 py-2 text-xs font-semibold text-red-700">
              {parsedWon.message}
            </p>
          )}
        </div>
      </Modal>
    </div>
  );
}
