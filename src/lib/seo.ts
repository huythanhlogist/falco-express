import { getSeoSetting } from "@/lib/db";

export type MetaOverride = { title: string; description: string };

/**
 * Đọc override title/description từ bảng seo_settings (đặt trong trang
 * admin). Nếu DB lỗi hoặc chưa có override, trả về nội dung mặc định của
 * trang — không bao giờ làm sập trang công khai vì lỗi kết nối MySQL.
 */
export async function resolveMetadataOverride(
  pagePath: string,
  fallback: MetaOverride
): Promise<MetaOverride> {
  try {
    const setting = await getSeoSetting(pagePath);
    return {
      title: setting?.meta_title?.trim() || fallback.title,
      description: setting?.meta_description?.trim() || fallback.description,
    };
  } catch {
    return fallback;
  }
}
