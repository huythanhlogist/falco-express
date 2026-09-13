"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { UploadIcon } from "@/components/icons";

type LineResult = {
  awb: string;
  amount: number;
  note: string;
  matched: boolean;
  falcoCode?: string;
  orderId?: number;
  status?: "new" | "update" | "unchanged" | "needs_review";
  previousCost?: number | null;
  previousSourceInvoice?: string | null;
  reason?: string;
  applied?: boolean;
};

type FileResult = {
  fileName: string;
  ok: boolean;
  error?: string;
  invoiceNumber?: string;
  invoiceDate?: string | null;
  totalFromFile?: number | null;
  lines?: LineResult[];
};

type Stage = "idle" | "previewing" | "previewed" | "committing" | "committed" | "error";

function money(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return `${n.toLocaleString("vi-VN")}đ`;
}

const STATUS_LABEL: Record<NonNullable<LineResult["status"]>, string> = {
  new: "Mới",
  update: "Cập nhật",
  unchanged: "Không đổi",
  needs_review: "Cần xem lại",
};

const STATUS_CLASS: Record<NonNullable<LineResult["status"]>, string> = {
  new: "bg-emerald-50 text-emerald-700",
  update: "bg-navy-50 text-navy-700",
  unchanged: "bg-mist text-ink/60",
  needs_review: "bg-flame-50 text-flame-700",
};

export default function UploadDbnInvoice() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [stage, setStage] = useState<Stage>("idle");
  const [results, setResults] = useState<FileResult[]>([]);
  const [error, setError] = useState("");
  const [forced, setForced] = useState<Set<string>>(new Set());

  function toggleForce(awb: string) {
    setForced((prev) => {
      const next = new Set(prev);
      if (next.has(awb)) next.delete(awb);
      else next.add(awb);
      return next;
    });
  }

  async function runPreview(selected: File[]) {
    setFiles(selected);
    setError("");
    setForced(new Set());
    setStage("previewing");
    try {
      const body = new FormData();
      body.append("mode", "preview");
      selected.forEach((f) => body.append("files", f));
      const res = await fetch("/api/admin/dbn-invoice", { method: "POST", body });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Có lỗi xảy ra khi đọc file");
        setStage("error");
        return;
      }
      setResults(json.results as FileResult[]);
      setStage("previewed");
    } catch {
      setError("Không kết nối được tới máy chủ — thử lại sau");
      setStage("error");
    }
  }

  async function runCommit() {
    setStage("committing");
    try {
      const body = new FormData();
      body.append("mode", "commit");
      body.append("force", JSON.stringify(Array.from(forced)));
      files.forEach((f) => body.append("files", f));
      const res = await fetch("/api/admin/dbn-invoice", { method: "POST", body });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Có lỗi xảy ra khi ghi CHI");
        setStage("error");
        return;
      }
      setResults(json.results as FileResult[]);
      setStage("committed");
      router.refresh();
    } catch {
      setError("Không kết nối được tới máy chủ — thử lại sau");
      setStage("error");
    }
  }

  function reset() {
    setFiles([]);
    setResults([]);
    setError("");
    setForced(new Set());
    setStage("idle");
    if (inputRef.current) inputRef.current.value = "";
  }

  function onInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const list = Array.from(e.target.files ?? []);
    if (list.length > 0) runPreview(list);
  }

  function onDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    const list = Array.from(e.dataTransfer.files ?? []);
    if (list.length > 0) runPreview(list);
  }

  const busy = stage === "previewing" || stage === "committing";
  const totalNeedsReview = results.reduce(
    (sum, r) => sum + (r.lines?.filter((l) => l.status === "needs_review").length ?? 0),
    0
  );

  return (
    <div>
      {(stage === "idle" || stage === "error") && (
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={onDrop}
          onClick={() => !busy && inputRef.current?.click()}
          className={`flex flex-col items-center justify-center gap-2.5 rounded-xl border-2 border-dashed border-line bg-white px-6 py-10 text-center transition-colors ${
            busy ? "cursor-wait opacity-70" : "cursor-pointer hover:border-flame-400 hover:bg-flame-50/30"
          }`}
        >
          <UploadIcon className="h-8 w-8 text-ink/40" />
          <p className="font-display text-sm font-bold text-navy-900">
            Bấm để chọn file, hoặc kéo thả vào đây
          </p>
          <p className="text-xs text-ink/50">
            File Excel (.xlsx) DBN Kango xuất ra — chọn/kéo được nhiều file cùng lúc
          </p>
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls"
            multiple
            onChange={onInputChange}
            disabled={busy}
            className="hidden"
          />
        </div>
      )}

      {stage === "previewing" && (
        <p className="mt-3 text-sm font-medium text-ink/60">Đang đọc file và đối chiếu đơn hàng...</p>
      )}

      {error && (
        <p className="mt-3 rounded-lg bg-flame-50 px-3.5 py-2.5 text-sm font-medium text-flame-700">
          {error}
        </p>
      )}

      {(stage === "previewed" || stage === "committing" || stage === "committed") && (
        <div className="mt-3 space-y-4">
          {results.map((r, fi) => (
            <div key={fi} className="rounded-xl border border-line bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-display text-sm font-bold text-navy-900">{r.fileName}</p>
                  {r.ok && (
                    <p className="mt-0.5 text-xs text-ink/50">
                      Hoá đơn #{r.invoiceNumber}
                      {r.invoiceDate ? ` · ${new Date(r.invoiceDate).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}` : ""}
                      {r.totalFromFile != null ? ` · Tổng ${money(r.totalFromFile)}` : ""}
                    </p>
                  )}
                </div>
              </div>

              {!r.ok ? (
                <p className="mt-2 rounded-lg bg-flame-50 px-3 py-2 text-xs font-medium text-flame-700">
                  {r.error}
                </p>
              ) : (
                <div className="mt-3 overflow-x-auto rounded-lg border border-line">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-line bg-mist/60 text-left text-xs font-semibold uppercase tracking-wide text-ink/45">
                        <th className="px-3 py-2">AWB</th>
                        <th className="px-3 py-2">Mã Falco</th>
                        <th className="px-3 py-2">CHI cũ</th>
                        <th className="px-3 py-2">CHI mới</th>
                        <th className="px-3 py-2">Ghi chú</th>
                        <th className="px-3 py-2">Trạng thái</th>
                        {stage === "previewed" && <th className="px-3 py-2">Ghi đè</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {r.lines?.map((l, li) => (
                        <tr key={li} className="border-b border-line last:border-0">
                          <td className="px-3 py-2 text-ink/70">{l.awb}</td>
                          <td className="px-3 py-2 font-medium text-navy-900">
                            {l.matched ? l.falcoCode : "—"}
                          </td>
                          <td className="px-3 py-2 text-ink/60">
                            {l.matched ? money(l.previousCost) : "—"}
                          </td>
                          <td className="px-3 py-2 font-semibold text-navy-900">{money(l.amount)}</td>
                          <td className="px-3 py-2 text-ink/60">{l.note || "—"}</td>
                          <td className="px-3 py-2">
                            {!l.matched ? (
                              <span
                                className="inline-flex items-center rounded-full bg-flame-50 px-2.5 py-1 text-xs font-bold text-flame-700"
                                title={l.reason}
                              >
                                Không tìm thấy
                              </span>
                            ) : (
                              <span
                                className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold ${STATUS_CLASS[l.status!]}`}
                                title={l.reason}
                              >
                                {stage === "committed" && l.applied === false
                                  ? "Đã bỏ qua"
                                  : STATUS_LABEL[l.status!]}
                              </span>
                            )}
                          </td>
                          {stage === "previewed" && (
                            <td className="px-3 py-2">
                              {l.matched && l.status === "needs_review" && (
                                <label className="flex items-center gap-1.5 text-xs text-ink/70">
                                  <input
                                    type="checkbox"
                                    checked={forced.has(l.awb)}
                                    onChange={() => toggleForce(l.awb)}
                                  />
                                  Ghi đè
                                </label>
                              )}
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}

          {stage === "previewed" && (
            <div className="flex flex-wrap items-center gap-3">
              <button type="button" onClick={runCommit} className="btn-primary !px-4 !py-2 text-sm">
                Xác nhận ghi CHI
              </button>
              <button type="button" onClick={reset} className="btn-outline !px-3.5 !py-2 text-sm">
                Huỷ
              </button>
              {totalNeedsReview > 0 && (
                <p className="text-xs text-flame-700">
                  {totalNeedsReview} dòng cần xem lại — tick &quot;Ghi đè&quot; nếu chắc chắn muốn ghi, không tick sẽ bị bỏ qua.
                </p>
              )}
            </div>
          )}

          {stage === "committed" && (
            <div className="flex items-center gap-3">
              <p className="text-sm font-semibold text-emerald-700">Đã ghi CHI xong.</p>
              <button type="button" onClick={reset} className="btn-outline !px-3.5 !py-2 text-sm">
                Upload file khác
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
