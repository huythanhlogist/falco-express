"use client";

import { useEffect, useRef, useState } from "react";
import { TrashIcon, UploadIcon, ClockIcon } from "@/components/icons";

type PendingOrder = {
  folderId: string;
  folderName: string;
  folderUrl: string;
  createdAt: string;
  fileCount: number;
};

function formatDate(iso: string): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });
}

export default function AiIntakeForm() {
  const [note, setNote] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [justUploaded, setJustUploaded] = useState("");
  const [pending, setPending] = useState<PendingOrder[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [listError, setListError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  function loadPending() {
    setListError("");
    fetch("/api/admin/ai-intake")
      .then((res) => res.json().then((json) => ({ ok: res.ok, json })))
      .then(({ ok, json }) => {
        if (!ok) {
          setListError(json.error || "Không tải được danh sách");
          return;
        }
        setPending(json.orders ?? []);
      })
      .catch(() => setListError("Không tải được danh sách"))
      .finally(() => setLoadingList(false));
  }

  useEffect(() => {
    loadPending();
  }, []);

  function resetForm() {
    setNote("");
    setFiles([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function submit() {
    setError("");
    setJustUploaded("");
    if (!note.trim() && files.length === 0) {
      setError("Cần ít nhất ghi chú hoặc 1 ảnh cho đơn này");
      return;
    }

    const formData = new FormData();
    formData.set("note", note);
    for (const file of files) formData.append("images", file);

    setSaving(true);
    try {
      const res = await fetch("/api/admin/ai-intake", { method: "POST", body: formData });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Tải lên thất bại");
        return;
      }
      setJustUploaded(json.folderName || "");
      resetForm();
      loadPending();
    } catch {
      setError("Tải lên thất bại — kiểm tra lại kết nối mạng");
    } finally {
      setSaving(false);
    }
  }

  async function removeOrder(folderId: string) {
    if (!confirm("Xoá đơn này khỏi Drive? Không hoàn tác được.")) return;
    const res = await fetch(`/api/admin/ai-intake/${folderId}`, { method: "DELETE" });
    if (res.ok) {
      setPending((prev) => prev.filter((o) => o.folderId !== folderId));
    } else {
      const json = await res.json().catch(() => null);
      alert(json?.error || "Xoá thất bại");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-xl border border-line bg-white p-4">
        <h2 className="text-sm font-semibold text-navy-900">Thêm 1 đơn mới</h2>
        <p className="mt-1 text-xs text-ink/55">
          Mỗi lần bấm &quot;Tải lên đơn này&quot; sẽ tạo 1 thư mục riêng trên Drive — ghi chú và ảnh của
          từng đơn không bị lẫn vào nhau. Tạo bao nhiêu đơn thì lặp lại bấy nhiêu lần.
        </p>

        <div className="mt-4">
          <label className="text-xs font-semibold text-ink/60">Ghi chú đơn hàng</label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={4}
            placeholder="Vd: Sương Sương, 0787331792, Warszawa Ba Lan, thực phẩm + quần áo, khách hẹn lấy thứ 6..."
            className="mt-1 w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink focus:border-flame-400 focus:outline-none focus:ring-2 focus:ring-flame-100"
          />
        </div>

        <div className="mt-4">
          <label className="text-xs font-semibold text-ink/60">Ảnh (kiện hàng, địa chỉ viết tay, CCCD...)</label>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
            className="mt-1 w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink file:mr-3 file:rounded-md file:border-0 file:bg-flame-50 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-flame-700"
          />
          {files.length > 0 && (
            <p className="mt-1.5 text-xs text-ink/55">
              Đã chọn {files.length} ảnh ({(files.reduce((s, f) => s + f.size, 0) / 1024 / 1024).toFixed(1)} MB)
            </p>
          )}
        </div>

        {error && <p className="mt-3 text-xs font-medium text-flame-700">{error}</p>}
        {justUploaded && (
          <p className="mt-3 text-xs font-medium text-green-700">
            Đã tải lên: &quot;{justUploaded}&quot; — có thể tạo tiếp đơn khác ngay.
          </p>
        )}

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={submit}
            disabled={saving}
            className="btn-primary !px-5 !py-2.5 text-sm disabled:opacity-50"
          >
            <UploadIcon className="mr-1.5 inline h-4 w-4" />
            {saving ? "Đang tải lên..." : "Tải lên đơn này"}
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-line bg-white p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-navy-900">Đơn chờ xử lý ({pending.length})</h2>
          <button type="button" onClick={loadPending} className="text-xs font-medium text-flame-700 hover:underline">
            Tải lại
          </button>
        </div>

        {loadingList && <p className="mt-3 text-xs text-ink/55">Đang tải...</p>}
        {listError && <p className="mt-3 text-xs font-medium text-flame-700">{listError}</p>}
        {!loadingList && !listError && pending.length === 0 && (
          <p className="mt-3 text-xs text-ink/55">Chưa có đơn nào — tạo đơn đầu tiên ở trên.</p>
        )}

        <ul className="mt-3 flex flex-col divide-y divide-line">
          {pending.map((order) => (
            <li key={order.folderId} className="flex items-center justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <a
                  href={order.folderUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="block truncate text-sm font-medium text-ink hover:text-flame-700"
                >
                  {order.folderName}
                </a>
                <p className="mt-0.5 flex items-center gap-1 text-xs text-ink/50">
                  <ClockIcon className="h-3 w-3" />
                  {formatDate(order.createdAt)} · {order.fileCount} file
                </p>
              </div>
              <button
                type="button"
                onClick={() => removeOrder(order.folderId)}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-ink/40 hover:bg-flame-50 hover:text-flame-700"
                title="Xoá đơn này"
              >
                <TrashIcon className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>

        {pending.length > 0 && (
          <p className="mt-4 rounded-lg bg-mist/50 p-3 text-xs text-ink/60">
            Khi đã tải đủ, nhắn trực tiếp cho Claude trong phiên chat: <b>&quot;xử lý lô đơn mới&quot;</b> — Claude
            sẽ đọc các đơn ở trên, tạo bill nháp trong{" "}
            <a href="/admin/kango-bills" className="font-medium text-flame-700 hover:underline">
              Tạo bill
            </a>{" "}
            và chuyển các đơn đã đọc sang thư mục &quot;Đã xử lý&quot; trên Drive.
          </p>
        )}
      </div>
    </div>
  );
}
