/**
 * Lưu 1 ảnh (data URL) xuống máy nhân viên. Trên di động (đặc biệt Safari
 * iOS), thẻ <a download> với data URL thường KHÔNG lưu được thẳng vào Thư
 * viện ảnh — chỉ mở ảnh hoặc tải vào Files. Ưu tiên Web Share API
 * (navigator.share với file) khi trình duyệt hỗ trợ, vì bảng chia sẻ gốc
 * của hệ điều hành có sẵn nút "Lưu vào ảnh"/"Save Image". Chỉ rơi về tải
 * file thông thường khi trình duyệt không hỗ trợ share file (chủ yếu là
 * desktop) — nếu nhân viên tự bấm Huỷ ở bảng chia sẻ thì dừng lại luôn,
 * không tự động tải thêm 1 lần nữa gây rối.
 */
export async function saveOrDownloadImage(dataUrl: string, filename: string): Promise<void> {
  let file: File | null = null;
  try {
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    file = new File([blob], filename, { type: blob.type || "image/png" });
  } catch {
    file = null;
  }

  if (file && typeof navigator !== "undefined" && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return;
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      // Lỗi khác (hiếm) — rơi về cách tải thông thường bên dưới.
    }
  }

  const link = document.createElement("a");
  link.download = filename;
  link.href = dataUrl;
  link.click();
}
