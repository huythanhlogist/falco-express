"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { TrashIcon, UploadIcon } from "@/components/icons";
import { useConfirm, useToast } from "@/components/ui/Toast";

export type KangoBillImageItem = {
  id: number;
  filename: string;
  mime_type: string;
  url: string;
};

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_BYTES = 5 * 1024 * 1024;
const MAX_IMAGES = 6;

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

  async function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    setError("");
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;

    if (images.length + files.length > MAX_IMAGES) {
      setError(`Tối đa ${MAX_IMAGES} ảnh mỗi bill (hiện đã có ${images.length} ảnh)`);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    for (const file of files) {
      if (!ALLOWED_TYPES.has(file.type)) {
        setError(`"${file.name}" không đúng định dạng (chỉ nhận JPEG, PNG, WebP)`);
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }
      if (file.size > MAX_BYTES) {
        setError(`Ảnh "${file.name}" vượt quá 5 MB`);
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
        setError(json?.error || "Tải ảnh thất bại");
        return;
      }
      setImages(Array.isArray(json?.images) ? json.images : images);
      toast(`Đã tải lên ${files.length} ảnh kiện hàng`);
    } catch {
      setError("Tải ảnh thất bại — kiểm tra lại kết nối mạng");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function removeImage(imageId: number) {
    if (!(await ask("Xoá ảnh kiện hàng này? Không thể hoàn tác."))) return;
    setError("");
    setDeletingId(imageId);
    try {
      const res = await fetch(`/api/admin/kango-bills/images/${imageId}`, { method: "DELETE" });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        toast(json?.error || "Xoá ảnh thất bại", "error");
        return;
      }
      setImages((prev) => prev.filter((img) => img.id !== imageId));
      toast("Đã xoá ảnh kiện hàng");
    } catch {
      toast("Xoá ảnh thất bại — kiểm tra lại kết nối mạng", "error");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <section className="rounded-xl border border-line bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-display text-sm font-bold text-navy-900">
            Ảnh kiện hàng (đã đóng) ({images.length}/{MAX_IMAGES})
          </p>
          <p className="mt-0.5 text-xs text-ink/50">
            Định dạng JPEG, PNG, WebP · Tối đa 5 MB/ảnh · Tối đa {MAX_IMAGES} ảnh/bill
          </p>
        </div>

        {images.length < MAX_IMAGES && (
          <label className="btn-outline inline-flex cursor-pointer items-center gap-1.5 !px-3.5 !py-1.5 text-xs">
            <UploadIcon className="h-3.5 w-3.5" />
            <span>{uploading ? "Đang tải..." : "Tải thêm ảnh"}</span>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              disabled={uploading}
              onChange={handleFileChange}
              className="hidden"
            />
          </label>
        )}
      </div>

      {initialWarning && (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
          Bill đã được tạo thành công nhưng tải ảnh ban đầu bị lỗi: {initialWarning}. Bạn có thể tải lại ảnh ở đây.
        </div>
      )}

      {error && <p className="mt-3 text-xs font-medium text-flame-700">{error}</p>}

      {images.length === 0 ? (
        <p className="mt-3 text-xs text-ink/45">Chưa có ảnh kiện hàng nào được gắn với bill này.</p>
      ) : (
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-6">
          {images.map((img) => (
            <div key={img.id} className="group relative overflow-hidden rounded-lg border border-line bg-mist/30">
              <a href={img.url} target="_blank" rel="noopener noreferrer" title={`Mở ảnh ${img.filename}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img.url}
                  alt={img.filename}
                  className="aspect-square w-full object-cover transition-transform group-hover:scale-105"
                />
              </a>
              <button
                type="button"
                onClick={() => removeImage(img.id)}
                disabled={deletingId === img.id}
                title="Xoá ảnh này"
                className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-ink/60 shadow-sm hover:bg-flame-600 hover:text-white disabled:opacity-50"
              >
                <TrashIcon className="h-3.5 w-3.5" />
              </button>
              <p className="truncate px-2 py-1 text-[11px] text-ink/60" title={img.filename}>
                {img.filename}
              </p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
