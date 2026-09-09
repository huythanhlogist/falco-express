/**
 * Một số trình duyệt DESKTOP (vd Chrome/Edge trên Windows) cũng hỗ trợ
 * Web Share API với file — nếu dùng chung logic cho cả 2 thì trên laptop
 * bấm "Tải ảnh" có thể mở bảng chia sẻ hệ điều hành thay vì tải file bình
 * thường, khiến nhân viên tưởng nút không hoạt động (đã xảy ra thật). Vì
 * vậy CHỈ dùng Web Share trên điện thoại (di động) — desktop luôn tải file
 * qua thẻ <a download> như trước.
 */
function isMobileDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
}

/**
 * Lưu 1 ảnh (data URL) xuống máy nhân viên. Trên di động (đặc biệt Safari
 * iOS), thẻ <a download> với data URL thường KHÔNG lưu được thẳng vào Thư
 * viện ảnh — chỉ mở ảnh hoặc tải vào Files. Trên di động, ưu tiên Web Share
 * API (navigator.share với file) vì bảng chia sẻ gốc của hệ điều hành có
 * sẵn nút "Lưu vào ảnh"/"Save Image". Trên desktop luôn tải file bình
 * thường — nếu nhân viên tự bấm Huỷ ở bảng chia sẻ trên di động thì dừng
 * lại luôn, không tự động tải thêm 1 lần nữa gây rối.
 */
export async function saveOrDownloadImage(dataUrl: string, filename: string): Promise<void> {
  let file: File | null = null;
  if (isMobileDevice()) {
    try {
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      file = new File([blob], filename, { type: blob.type || "image/png" });
    } catch {
      file = null;
    }
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
