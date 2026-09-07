"use client";

import { useEffect, useRef, useState } from "react";
import { UploadIcon } from "@/components/icons";

type UploadState = "idle" | "uploading" | "done" | "error";

type UploadResult = {
  totalBills: number;
  inserted: number;
  updated: number;
  unchanged: number;
  insertedCodes: string[];
  errors: string[];
};

type HistoryEntry = {
  id: number;
  file_name: string;
  uploaded_by: string;
  total_bills: number;
  inserted: number;
  updated: number;
  unchanged: number;
  errors: string | null;
  created_at: string;
};

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function UploadOrders() {
  const [state, setState] = useState<UploadState>("idle");
  const [fileName, setFileName] = useState("");
  const [result, setResult] = useState<UploadResult | null>(null);
  const [error, setError] = useState("");
  const [history, setHistory] = useState<HistoryEntry[] | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function loadHistory() {
    try {
      const res = await fetch("/api/admin/upload-history");
      if (!res.ok) return;
      const json = await res.json();
      setHistory(json.history as HistoryEntry[]);
    } catch {
      // Lỗi tải lịch sử không quan trọng bằng việc upload — bỏ qua âm thầm,
      // khu vực lịch sử chỉ đơn giản không hiện gì.
    }
  }

  useEffect(() => {
    loadHistory();
  }, []);

  async function handleFile(file: File) {
    setFileName(file.name);
    setResult(null);
    setError("");
    setState("uploading");

    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/admin/upload-orders", { method: "POST", body });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Có lỗi xảy ra khi tải file lên");
        setState("error");
        return;
      }
      setResult(json as UploadResult);
      setState("done");
      loadHistory();
    } catch {
      setError("Không kết nối được tới máy chủ — thử lại sau");
      setState("error");
    } finally {
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function onInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }

  function onDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }

  const busy = state === "uploading";

  return (
    <div className="max-w-3xl">
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
          {busy ? "Đang tải lên và xử lý..." : "Bấm để chọn file, hoặc kéo thả file vào đây"}
        </p>
        <p className="text-xs text-ink/50">File Excel (.xlsx) Kango xuất ra — đúng cấu trúc cột cố định mỗi lần gửi</p>
        {fileName && <p className="mt-1 text-xs font-medium text-ink/70">{fileName}</p>}
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls"
          onChange={onInputChange}
          disabled={busy}
          className="hidden"
        />
      </div>

      {state === "uploading" && (
        <p className="mt-3 text-sm font-medium text-ink/60">
          Đang đọc file và cập nhật dữ liệu, vui lòng đợi...
        </p>
      )}

      {state === "error" && (
        <p className="mt-3 rounded-lg bg-flame-50 px-3.5 py-2.5 text-sm font-medium text-flame-700">
          {error}
        </p>
      )}

      {state === "done" && result && (
        <div className="mt-3 rounded-xl border border-line bg-white p-4">
          <p className="font-display text-sm font-bold text-emerald-700">Tải lên thành công</p>
          <div className="mt-3 grid grid-cols-3 gap-2.5">
            <div className="rounded-lg bg-emerald-50 px-3 py-2.5">
              <p className="text-xs text-emerald-700">Bill mới</p>
              <p className="mt-1 font-display text-lg font-bold text-emerald-800">{result.inserted}</p>
            </div>
            <div className="rounded-lg bg-navy-50 px-3 py-2.5">
              <p className="text-xs text-navy-700">Đã cập nhật</p>
              <p className="mt-1 font-display text-lg font-bold text-navy-900">{result.updated}</p>
            </div>
            <div className="rounded-lg bg-mist px-3 py-2.5">
              <p className="text-xs text-ink/60">Không đổi</p>
              <p className="mt-1 font-display text-lg font-bold text-ink/80">{result.unchanged}</p>
            </div>
          </div>
          <p className="mt-3 text-xs text-ink/50">
            Đọc được {result.totalBills} bill trong file. Bill mới đã được ghi vào hệ thống và mirror sang
            Google Sheet; bill đã có được cập nhật thông tin/mã tracking thay đổi hoặc còn thiếu.
          </p>
          {result.insertedCodes.length > 0 && (
            <p className="mt-2 text-xs text-ink/60">
              Mã Falco mới: {result.insertedCodes.join(", ")}
            </p>
          )}
          {result.errors.length > 0 && (
            <div className="mt-3 rounded-lg bg-flame-50 px-3.5 py-2.5">
              <p className="text-xs font-semibold text-flame-700">Cảnh báo:</p>
              <ul className="mt-1 list-disc pl-4 text-xs text-flame-700">
                {result.errors.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            </div>
          )}
          <button
            type="button"
            onClick={() => {
              setState("idle");
              setResult(null);
              setFileName("");
            }}
            className="btn-outline mt-4 !px-3.5 !py-2 text-sm"
          >
            Tải file khác
          </button>
        </div>
      )}

      <div className="mt-8">
        <h2 className="font-display text-base font-bold text-navy-900">Lịch sử upload</h2>
        <p className="mt-0.5 text-xs text-ink/50">
          Chỉ lưu lại kết quả xử lý (không lưu file gốc) — 20 lần gần nhất.
        </p>
        <div className="mt-3 overflow-x-auto rounded-xl border border-line bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line bg-mist/60 text-left text-xs font-semibold uppercase tracking-wide text-ink/45">
                <th className="px-3 py-2">Thời gian</th>
                <th className="px-3 py-2">File</th>
                <th className="px-3 py-2">Người upload</th>
                <th className="px-3 py-2">Tổng bill</th>
                <th className="px-3 py-2">Mới</th>
                <th className="px-3 py-2">Cập nhật</th>
                <th className="px-3 py-2">Không đổi</th>
                <th className="px-3 py-2">Lỗi</th>
              </tr>
            </thead>
            <tbody>
              {(history ?? []).map((h) => {
                const errs: string[] = h.errors ? JSON.parse(h.errors) : [];
                return (
                  <tr key={h.id} className="border-b border-line last:border-0 hover:bg-mist/40">
                    <td className="px-3 py-2 text-ink/70">{formatDateTime(h.created_at)}</td>
                    <td className="px-3 py-2 text-ink/70">{h.file_name}</td>
                    <td className="px-3 py-2 text-ink/70">{h.uploaded_by}</td>
                    <td className="px-3 py-2 text-ink/70">{h.total_bills}</td>
                    <td className="px-3 py-2 font-medium text-emerald-700">{h.inserted}</td>
                    <td className="px-3 py-2 font-medium text-navy-800">{h.updated}</td>
                    <td className="px-3 py-2 text-ink/50">{h.unchanged}</td>
                    <td className="px-3 py-2">
                      {errs.length > 0 ? (
                        <span
                          title={errs.join("\n")}
                          className="inline-flex items-center rounded-full bg-flame-50 px-2.5 py-1 text-xs font-bold text-flame-700"
                        >
                          {errs.length} lỗi
                        </span>
                      ) : (
                        <span className="text-ink/30">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {history !== null && history.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-5 py-8 text-center text-ink/45">
                    Chưa có lần upload nào.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
