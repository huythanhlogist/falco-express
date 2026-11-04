"use client";

import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/components/ui/Toast";
import {
  KNOWLEDGE_KIND_LABEL,
  officeApi,
  type KnowledgeItem,
  type KnowledgeResponse,
} from "@/lib/office-api";

type Filter = KnowledgeItem["status"];

const FILTER_LABEL: Record<Filter, string> = {
  de_xuat: "Chờ duyệt",
  da_duyet: "Đã duyệt",
  loai: "Đã loại",
};

const KINDS = Object.keys(KNOWLEDGE_KIND_LABEL);

export default function OfficeKnowledgePanel() {
  const toast = useToast();
  const [data, setData] = useState<KnowledgeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("de_xuat");
  const [area, setArea] = useState("");
  const [editing, setEditing] = useState<number | null>(null);
  const [draft, setDraft] = useState({ area: "", kind: "faq", title: "", content: "" });
  const [adding, setAdding] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);

  const load = useCallback(async () => {
    const r = await officeApi<KnowledgeResponse>("knowledge");
    if (!r.ok) {
      setError(r.error);
      return;
    }
    setError(null);
    setData(r.data);
  }, []);

  useEffect(() => {
    void load();
    const id = window.setInterval(load, 20000);
    return () => window.clearInterval(id);
  }, [load]);

  const nameOf = (code: string) => {
    if (code === "ALL") return "Dùng chung";
    const a = data?.agents.find((x) => x.code === code);
    return a ? `${a.name} (${code})` : code;
  };

  async function act(body: Record<string, unknown>, okText: string) {
    const r = await officeApi("knowledge-action", body);
    if (!r.ok) {
      toast(r.error, "error");
      return false;
    }
    toast(okText, "success");
    void load();
    return true;
  }

  function startEdit(i: KnowledgeItem) {
    setEditing(i.id);
    setDraft({ area: i.area, kind: i.kind, title: i.title, content: i.content });
  }

  async function saveEdit(id: number) {
    if (await act({ action: "edit", id, ...draft }, "Đã lưu")) setEditing(null);
  }

  async function addNew() {
    if (await act({ action: "add", ...draft }, "Đã thêm và duyệt")) {
      setAdding(false);
      setDraft({ area: "", kind: "faq", title: "", content: "" });
    }
  }

  const shown = (data?.items ?? []).filter((i) => i.status === filter && (!area || i.area === area));
  const selectedShown = shown.filter((i) => selected.has(i.id));
  const allShownSelected = shown.length > 0 && selectedShown.length === shown.length;

  function toggleOne(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected(allShownSelected ? new Set() : new Set(shown.map((i) => i.id)));
  }

  async function bulk(status: Filter, okText: string) {
    const ids = selectedShown.map((i) => i.id);
    if (ids.length === 0) return;
    setBulkBusy(true);
    let fail = 0;
    for (let n = 0; n < ids.length; n += 4) {
      const results = await Promise.all(
        ids.slice(n, n + 4).map((id) => officeApi("knowledge-action", { action: "set_status", id, status })),
      );
      fail += results.filter((r) => !r.ok).length;
    }
    setBulkBusy(false);
    setSelected(new Set());
    if (fail > 0) toast(`${okText}: ${ids.length - fail} mục, lỗi ${fail} mục`, "error");
    else toast(`${okText}: ${ids.length} mục`, "success");
    void load();
  }
  const areaOptions = data
    ? [{ code: "ALL", name: "Dùng chung" }, ...data.agents.map((a) => ({ code: a.code, name: a.name }))]
    : [];

  const form = (onSave: () => void, onCancel: () => void, saveLabel: string) => (
    <div className="space-y-2">
      <div className="grid gap-2 sm:grid-cols-2">
        <select value={draft.area} onChange={(e) => setDraft({ ...draft, area: e.target.value })} className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm">
          <option value="">Chọn agent</option>
          {areaOptions.map((a) => (
            <option key={a.code} value={a.code}>{a.name} ({a.code})</option>
          ))}
        </select>
        <select value={draft.kind} onChange={(e) => setDraft({ ...draft, kind: e.target.value })} className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm">
          {KINDS.map((k) => (
            <option key={k} value={k}>{KNOWLEDGE_KIND_LABEL[k]}</option>
          ))}
        </select>
      </div>
      <input value={draft.title} maxLength={120} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="Tiêu đề" className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-navy-800" />
      <textarea value={draft.content} rows={4} maxLength={1500} onChange={(e) => setDraft({ ...draft, content: e.target.value })} placeholder="Nội dung" className="w-full rounded-lg border border-slate-300 p-2 text-sm outline-none focus:border-navy-800" />
      <div className="flex gap-2">
        <button type="button" onClick={onSave} className="rounded-lg bg-navy-800 px-4 py-1.5 text-sm font-semibold text-white hover:opacity-90">{saveLabel}</button>
        <button type="button" onClick={onCancel} className="rounded-lg border border-slate-200 px-4 py-1.5 text-sm font-semibold text-navy-800 hover:bg-slate-50">Hủy</button>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      {error ? (
        <p className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">Không đọc được kho kiến thức: {error}</p>
      ) : null}

      <p className="text-xs text-slate-500">
        Muse đề xuất, anh duyệt. Chỉ mục đã duyệt mới được agent dùng. Mỗi mục gắn với mã agent nên đổi tên nhân viên không mất dữ liệu.
      </p>

      <div className="flex flex-wrap items-center gap-2">
        {(["de_xuat", "da_duyet", "loai"] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
              filter === f ? "border-navy-800 bg-navy-800 text-white" : "border-slate-200 bg-white text-navy-800 hover:bg-slate-50"
            }`}
          >
            {FILTER_LABEL[f]}
            {data ? ` (${data.counts[f]})` : ""}
          </button>
        ))}
        <select value={area} onChange={(e) => setArea(e.target.value)} className="rounded-lg border border-slate-300 px-2 py-1 text-xs">
          <option value="">Mọi agent</option>
          {areaOptions.map((a) => (
            <option key={a.code} value={a.code}>{a.name} ({a.code})</option>
          ))}
        </select>
        <button type="button" onClick={() => setAdding((v) => !v)} className="ml-auto rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-navy-800 hover:bg-slate-50">
          + Tự thêm mục
        </button>
      </div>

      {shown.length > 0 ? (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm">
          <label className="flex cursor-pointer items-center gap-2 font-semibold text-navy-800">
            <input type="checkbox" checked={allShownSelected} onChange={toggleAll} className="h-4 w-4" />
            Chọn tất cả ({shown.length})
          </label>
          {selectedShown.length > 0 ? (
            <>
              <span className="text-xs text-slate-500">Đã chọn {selectedShown.length}</span>
              {filter !== "da_duyet" ? (
                <button type="button" disabled={bulkBusy} onClick={() => bulk("da_duyet", "Đã duyệt")} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-40">
                  {bulkBusy ? "Đang xử lý..." : "Duyệt các mục đã chọn"}
                </button>
              ) : null}
              {filter !== "loai" ? (
                <button type="button" disabled={bulkBusy} onClick={() => bulk("loai", "Đã loại")} className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-40">
                  Loại các mục đã chọn
                </button>
              ) : null}
              {filter !== "de_xuat" ? (
                <button type="button" disabled={bulkBusy} onClick={() => bulk("de_xuat", "Đã đưa về chờ duyệt")} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-navy-800 hover:bg-slate-50 disabled:opacity-40">
                  Về chờ duyệt
                </button>
              ) : null}
            </>
          ) : null}
        </div>
      ) : null}

      {adding ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <h2 className="mb-2 font-bold text-navy-800">Thêm mục (tự động ở trạng thái đã duyệt)</h2>
          {form(addNew, () => setAdding(false), "Thêm")}
        </section>
      ) : null}

      {data && shown.length === 0 ? (
        <p className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-slate-500">Không có mục nào.</p>
      ) : null}

      <ul className="space-y-3">
        {shown.map((i) => (
          <li key={i.id} className="space-y-2 rounded-2xl border border-slate-200 bg-white p-4">
            {editing === i.id ? (
              form(() => saveEdit(i.id), () => setEditing(null), "Lưu")
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <input type="checkbox" checked={selected.has(i.id)} onChange={() => toggleOne(i.id)} aria-label={`Chọn mục ${i.id}`} className="h-4 w-4" />
                  <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-semibold text-sky-800">{nameOf(i.area)}</span>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                    {KNOWLEDGE_KIND_LABEL[i.kind] ?? i.kind}
                  </span>
                  <span className="text-xs text-slate-400">#{i.id} · {i.addedBy || "?"}</span>
                </div>
                <p className="font-semibold text-navy-800">{i.title}</p>
                <p className="whitespace-pre-wrap text-sm text-slate-700">{i.content}</p>
                {i.sourceUrl ? (
                  <a href={i.sourceUrl} target="_blank" rel="noopener noreferrer" className="block truncate text-xs text-sky-700 underline">
                    {i.sourceUrl}
                  </a>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  {i.status !== "da_duyet" ? (
                    <button type="button" onClick={() => act({ action: "set_status", id: i.id, status: "da_duyet" }, "Đã duyệt")} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700">
                      Duyệt
                    </button>
                  ) : null}
                  {i.status !== "loai" ? (
                    <button type="button" onClick={() => act({ action: "set_status", id: i.id, status: "loai" }, "Đã loại")} className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50">
                      Loại
                    </button>
                  ) : null}
                  {i.status !== "de_xuat" ? (
                    <button type="button" onClick={() => act({ action: "set_status", id: i.id, status: "de_xuat" }, "Đã đưa về chờ duyệt")} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-navy-800 hover:bg-slate-50">
                      Về chờ duyệt
                    </button>
                  ) : null}
                  <button type="button" onClick={() => startEdit(i)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-navy-800 hover:bg-slate-50">
                    Sửa
                  </button>
                </div>
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
