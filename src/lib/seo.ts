import { getSeoSetting } from "@/lib/db";

export type MetaOverride = {
  title: string;
  description: string;
  alternates: { canonical: string };
};

/**
 * Đọc override title/description từ bảng seo_settings (đặt trong trang
 * admin). Nếu DB lỗi hoặc chưa có override, trả về nội dung mặc định của
 * trang — không bao giờ làm sập trang công khai vì lỗi kết nối MySQL.
 *
 * Luôn kèm `alternates.canonical` trỏ về đúng URL tuyệt đối của trang
 * (dựa trên metadataBase đã khai ở layout.tsx). Thêm 2026-09-21 sau khi
 * Google Search Console báo 5 trang — bao gồm trang chủ, /lien-he,
 * /dich-vu, /gui-hang-di-sec, /gui-hang-di-ba-lan — ở trạng thái "Trang
 * trùng lặp, người dùng chưa chọn trang chính tắc" (không trang nào trong
 * code có canonical tag). Không có canonical rõ ràng khiến Google tự
 * suy đoán và có thể không lập chỉ mục trang dù nội dung hợp lệ.
 */
export async function resolveMetadataOverride(
  pagePath: string,
  fallback: Pick<MetaOverride, "title" | "description">
): Promise<MetaOverride> {
  const alternates = { canonical: pagePath };
  try {
    const setting = await getSeoSetting(pagePath);
    return {
      title: setting?.meta_title?.trim() || fallback.title,
      description: setting?.meta_description?.trim() || fallback.description,
      alternates,
    };
  } catch {
    return { ...fallback, alternates };
  }
}
