"use client";

import { useRef, useState } from "react";
import { UploadIcon } from "@/components/icons";

type UploadState = "idle" | "uploading" | "done" | "error";

type UploadResult = { categories: number; lines: number; warnings: string[] };

export default function UploadPriceQuote() {
  const [state, setState] = useState<UploadState>("idle");
  const [fileName, setFileName] = useState("");
  const [result, setResult] = useState<UploadResult | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setFileName(file.name);
    setState("uploading");
    setResult(null);
    setErrors([]);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/admin/price-quote/upload", { method: "POST", body: formData });
      const json = await res.json();
      if (!res.ok) {
        setErrors(json.errors && json.errors.length > 0 ? json.errors : [json.error || "Có lỗi xảy ra"]);
        setState("error");
        return;
      }
      setResult(json as UploadResult);
      setState("done");
    } catch {
      setErrors(["Không kết nối được tới máy chủ"]);
      setState("error");
    } finally {
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="card p-5">
      <p className="font-display text-sm font-bold text-navy-900">Upload bảng giá Kango</p>
      <p className="mt-1 text-sm text-ink/55">
        Tải file Excel bảng giá gốc Kango — hệ thống tự cộng phụ phí Falco và cập nhật lại toàn bộ tab
        &quot;Báo giá&quot;. Upload lại là cách DUY NHẤT để đổi giá gốc.
      </p>

      <label className="mt-3 flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-line bg-mist/50 px-4 py-6 text-sm font-medium text-ink/60 hover:border-flame-300 hover:bg-flame-50/40">
        <UploadIcon className="h-4 w-4" />
        {state === "uploading" ? `Đang xử lý ${fileName}...` : "Chọn file Excel bảng giá"}
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls"
          className="hidden"
          disabled={state === "uploading"}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
        />
      </label>

      {state === "done" && result && (
        <div className="mt-3 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">
          Đã cập nhật {result.categories} nhóm giá / {result.lines} dòng giá từ file {fileName}.
          {result.warnings.length > 0 && (
            <ul className="mt-1.5 list-disc pl-4 text-xs text-emerald-700">
              {result.warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {state === "error" && errors.length > 0 && (
        <div className="mt-3 rounded-xl bg-flame-50 p-3 text-sm text-flame-800">
          <ul className="list-disc pl-4">
            {errors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
