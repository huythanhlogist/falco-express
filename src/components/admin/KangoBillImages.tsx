"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { TrashIcon, UploadIcon } from "@/components/icons";
import { useConfirm, useToast } from "@/components/ui/Toast";
import {
  ALLOWED_KANGO_IMAGE_TYPES,
  MAX_KANGO_BILL_IMAGES,
  MAX_KANGO_IMAGE_BYTES,
} from "@/lib/kango-bill-validate";

export type KangoBillImageItem = {
  id: number;
  filename: string;
  mime_type: string;
  url: string;
};

export default function KangoBillImages({
  billId,
  initialImages,
  initialWarning,
}: {
  billId: number;
  initialImages: KangoBillImageItem[];
  initialWarning?: string;
}) {
  const ask = useConfirm();
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [images, setImages] = useState<KangoBillImageItem[]>(initialImages);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [error, setError] = useState("");

  const busy = uploading || deletingId !== null;

  async function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    setError("");
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;

    if (images.length + files.length > MAX_KANGO_BILL_IMAGES) {
      const msg = `Tối đa ${MAX_KANGO_BILL_IMAGES} ảnh mỗi bill (hiện đã có ${images.length} ảnh)`;
      setError(msg);
      toast(msg, "error");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    for (const file of files) {
      if (!ALLOWED_KANGO_IMAGE_TYPES.has(file.type)) {
        const msg = `"${file.name}" không đúng định dạng (chỉ nhận JPEG, PNG, WebP)`;
        setError(msg);
        toast(msg, "error");
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }
      if (file.size === 0) {
        const msg = `Ảnh "${file.name}" không có dữ liệu`;
        setError(msg);
        toast(msg, "error");
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }
      if (file.size > MAX_KANGO_IMAGE_BYTES) {
        const msg = `Ảnh "${file.name}" vượt quá 5 MB`;
        setError(msg);
        toast(msg, "error");
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }
    }

    const formData = new FormData();
    for (const file of files) formData.append("images", file);

    setUploading(true);
    try {
      const res = await fetch(`/api/admin/kango-bills/${billId}/images`, {
        method: "POST",
        body: formData,
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        const msg = json?.error || `Tải ảnh thất bại (HTTP ${res.status})`;
        setError(msg);
        toast(msg, "error");
        return;
      }
      setImages(Array.isArray(json?.images) ? json.images : images);
      toast(`Đã tải lên ${files.length} ảnh kiện hàng`, "success");
    } catch {
      const msg = "Tải ảnh thất bại — kiểm tra lại kết nối mạng";
      setError(msg);
      toast(msg, "error");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function removeImage(imageId: number) {
    const ok = await ask("Xoá ảnh kiện hàng này?\nThao tác này không thể hoàn tác.", {
      confirmLabel: "Xoá ảnh",
      danger: true,
    });
    if (!ok) return;

    setError("");
    setDeletingId(imageId);
    try {
      const res = await fetch(`/api/admin/kango-bills/images/${imageId}`, { method: "DELETE" });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        const msg = json?.error || `Xoá ảnh thất bại (HTTP ${res.status})`;
        setError(msg);
        toast(msg, "error");
        return;
      }
      setImages((prev) => prev.filter((img) => img.id !== imageId));
      toast("Đã xoá ảnh kiện hàng", "success");
    } catch {
      const msg = "Xoá ảnh thất bại — kiểm tra lại kết nối mạng";
      setError(msg);
      toast(msg, "error");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <section className="rounded-[20px] border border-[#ecece8] bg-white p-4 shadow-[0_1px_2px_rgba(19,36,64,0.03),0_6px_20px_rgba(19,36,64,0.028)] sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-display text-sm font-bold text-[#132440]">
            Ảnh kiện hàng (đã đóng) ({images.length}/{MAX_KANGO_BILL_IMAGES})
          </p>
          <p className="mt-0.5 text-xs text-[#8b8d93]">
            Định dạng JPEG, PNG, WebP · Tối đa 5 MB/ảnh · Tối đa {MAX_KANGO_BILL_IMAGES} ảnh/bill
          </p>
        </div>

        {images.length < MAX_KANGO_BILL_IMAGES && (
          <label
            aria-disabled={busy}
            className={`btn-outline inline-flex items-center gap-1.5 !px-3.5 !py-1.5 text-xs ${
              busy ? "pointer-events-none opacity-50" : "cursor-pointer"
            }`}
          >
            <UploadIcon className="h-3.5 w-3.5" />
            <span>{uploading ? "Đang tải lên…" : "Tải thêm ảnh"}</span>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              disabled={busy}
              onChange={handleFileChange}
              className="hidden"
            />
          </label>
        )}
      </div>

      {initialWarning && (
        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
          Bill đã được tạo thành công nhưng tải ảnh ban đầu bị lỗi: {initialWarning}. Bạn có thể tải lại ảnh ở đây.
        </div>
      )}

      {error && (
        <p
          role="alert"
          className="mt-3 rounded-xl border border-flame-200 bg-flame-50 px-3 py-2 text-xs font-medium text-flame-800"
        >
          {error}
        </p>
      )}

      {images.length === 0 ? (
        <div className="mt-3 rounded-xl border border-dashed border-[#e5e5e0] bg-[#fafaf8] px-4 py-6 text-center text-xs text-[#8b8d93]">
          Chưa có ảnh kiện hàng nào được gắn với bill này.
        </div>
      ) : (
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-6">
          {images.map((img) => {
            const isDeleting = deletingId === img.id;
            return (
              <div key={img.id} className="group overflow-hidden rounded-xl border border-[#ecece8] bg-[#fafaf8]">
                <a
                  href={img.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={`Mở ảnh ${img.filename}`}
                  className="block overflow-hidden"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={img.url}
                    alt={img.filename}
                    className={`aspect-square w-full object-cover transition-transform group-hover:scale-105 ${
                      isDeleting ? "opacity-50" : ""
                    }`}
                  />
                </a>
                <div className="flex items-center justify-between gap-1.5 border-t border-[#ecece8] bg-white px-2 py-1.5">
                  <p className="min-w-0 truncate text-[11px] text-[#52525b]" title={img.filename}>
                    {img.filename}
                  </p>
                  <button
                    type="button"
                    onClick={() => removeImage(img.id)}
                    disabled={busy}
                    title="Xoá ảnh này"
                    aria-label={`Xoá ảnh ${img.filename}`}
                    className="inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold text-flame-700 hover:bg-flame-50 disabled:opacity-50"
                  >
                    {!isDeleting && <TrashIcon className="h-3 w-3" />}
                    <span>{isDeleting ? "Đang xoá…" : "Xoá"}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
