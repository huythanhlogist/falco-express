import { GET as officeGet } from "@/app/api/admin/office/[...path]/route";

export const dynamic = "force-dynamic";

// Gộp logic đọc trạng thái về handler dùng chung ở /api/admin/office/[...path].
export async function GET(request: Request) {
  return officeGet(request, { params: Promise.resolve({ path: ["status"] }) });
}
