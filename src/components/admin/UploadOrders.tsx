"use client";

import { useRef, useState } from "react";
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

export default function UploadOrders() {
  const [state, setState] = useState<UploadState>("idle");
  const [fileName, setFileName] = useState("");
  const [result, setResult] = useState<UploadResult | null>(null);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

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
    <div className="max-w-2xl">
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
            Google Sheet; bill đã có được điền thêm thông tin/mã tracking còn thiếu.
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
    </div>
  );
}
