import { google } from "googleapis";
import { Readable } from "node:stream";

const FOLDER_MIME = "application/vnd.google-apps.folder";
const PROCESSED_FOLDER_NAME = "Đã xử lý";

/**
 * Dùng CHUNG service account với src/lib/sheets.ts (đã có sẵn cho Google
 * Sheets) — chỉ khác scope. Thư mục gốc `GOOGLE_DRIVE_INTAKE_FOLDER_ID` nằm
 * trong Drive cá nhân của chủ dự án, được share Editor cho service account
 * này (service account không sở hữu thư mục), nên cần scope "drive" đầy đủ
 * thay vì "drive.file" — "drive.file" chỉ chắc chắn hoạt động với file do
 * chính app tạo/mở, không đảm bảo với thư mục được share vào sau.
 */
function getAuthClient() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const rawKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;

  if (!email || !rawKey) {
    throw new Error("Thiếu GOOGLE_SERVICE_ACCOUNT_EMAIL hoặc GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY");
  }

  return new google.auth.GoogleAuth({
    credentials: {
      client_email: email,
      private_key: rawKey.replace(/\\n/g, "\n"),
    },
    scopes: ["https://www.googleapis.com/auth/drive"],
  });
}

async function getDriveClient() {
  const auth = getAuthClient();
  const authClient = await auth.getClient();
  return google.drive({ version: "v3", auth: authClient as never });
}

function getRootFolderId(): string {
  const id = process.env.GOOGLE_DRIVE_INTAKE_FOLDER_ID;
  if (!id) throw new Error("Thiếu GOOGLE_DRIVE_INTAKE_FOLDER_ID");
  return id;
}

function slugifyForFolderName(text: string): string {
  const cleaned = text.trim().replace(/\s+/g, " ").slice(0, 40);
  return cleaned || "Đơn chưa có ghi chú";
}

function timestampLabel(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}_${pad(
    date.getHours()
  )}-${pad(date.getMinutes())}-${pad(date.getSeconds())}`;
}

async function findChildFolderByName(
  drive: Awaited<ReturnType<typeof getDriveClient>>,
  parentId: string,
  name: string
): Promise<string | null> {
  const res = await drive.files.list({
    q: `'${parentId}' in parents and name = '${name.replace(/'/g, "\\'")}' and mimeType = '${FOLDER_MIME}' and trashed = false`,
    fields: "files(id, name)",
    spaces: "drive",
  });
  return res.data.files?.[0]?.id ?? null;
}

async function ensureProcessedFolder(
  drive: Awaited<ReturnType<typeof getDriveClient>>,
  rootFolderId: string
): Promise<string> {
  const existing = await findChildFolderByName(drive, rootFolderId, PROCESSED_FOLDER_NAME);
  if (existing) return existing;

  const created = await drive.files.create({
    requestBody: {
      name: PROCESSED_FOLDER_NAME,
      mimeType: FOLDER_MIME,
      parents: [rootFolderId],
    },
    fields: "id",
  });
  if (!created.data.id) throw new Error("Không tạo được thư mục 'Đã xử lý'");
  return created.data.id;
}

export type UploadedIntakeImage = {
  filename: string;
  mimeType: string;
  buffer: Buffer;
};

export type CreatedIntakeOrder = {
  folderId: string;
  folderName: string;
  folderUrl: string;
};

/**
 * Tạo 1 thư mục con RIÊNG cho 1 đơn (note + ảnh của đơn đó, KHÔNG lẫn với
 * đơn khác) trong thư mục gốc — đúng yêu cầu "chia ra để không lẫn địa chỉ
 * này với kiện hàng kia" khi nhân viên tải lên nhiều đơn liên tiếp.
 */
export async function createIntakeOrder(
  note: string,
  images: UploadedIntakeImage[]
): Promise<CreatedIntakeOrder> {
  const rootFolderId = getRootFolderId();
  const drive = await getDriveClient();

  const now = new Date();
  const folderName = `${timestampLabel(now)} — ${slugifyForFolderName(note)}`;

  const folder = await drive.files.create({
    requestBody: {
      name: folderName,
      mimeType: FOLDER_MIME,
      parents: [rootFolderId],
    },
    fields: "id, webViewLink",
  });
  const folderId = folder.data.id;
  if (!folderId) throw new Error("Không tạo được thư mục cho đơn mới trên Drive");

  if (note.trim()) {
    await drive.files.create({
      requestBody: { name: "note.txt", parents: [folderId] },
      media: { mimeType: "text/plain", body: Readable.from([Buffer.from(note, "utf-8")]) },
      fields: "id",
    });
  }

  for (const image of images) {
    await drive.files.create({
      requestBody: { name: image.filename, parents: [folderId] },
      media: { mimeType: image.mimeType, body: Readable.from([image.buffer]) },
      fields: "id",
    });
  }

  return {
    folderId,
    folderName,
    folderUrl: `https://drive.google.com/drive/folders/${folderId}`,
  };
}

export type PendingIntakeOrder = {
  folderId: string;
  folderName: string;
  folderUrl: string;
  createdAt: string;
  fileCount: number;
};

/**
 * Liệt kê các đơn CHƯA xử lý — mọi thư mục con của thư mục gốc, trừ
 * "Đã xử lý" (đơn đã được đọc và tạo bill nháp sẽ bị chuyển vào đó, xem
 * `markIntakeOrderProcessed`, nên không còn xuất hiện lại ở đây).
 */
export async function listPendingIntakeOrders(): Promise<PendingIntakeOrder[]> {
  const rootFolderId = getRootFolderId();
  const drive = await getDriveClient();

  const res = await drive.files.list({
    q: `'${rootFolderId}' in parents and mimeType = '${FOLDER_MIME}' and trashed = false and name != '${PROCESSED_FOLDER_NAME}'`,
    fields: "files(id, name, createdTime)",
    orderBy: "createdTime desc",
    spaces: "drive",
    pageSize: 100,
  });

  const folders = res.data.files || [];
  const result: PendingIntakeOrder[] = [];
  for (const folder of folders) {
    if (!folder.id) continue;
    const children = await drive.files.list({
      q: `'${folder.id}' in parents and trashed = false`,
      fields: "files(id)",
      spaces: "drive",
      pageSize: 1000,
    });
    result.push({
      folderId: folder.id,
      folderName: folder.name || "(không tên)",
      folderUrl: `https://drive.google.com/drive/folders/${folder.id}`,
      createdAt: folder.createdTime || "",
      fileCount: children.data.files?.length ?? 0,
    });
  }
  return result;
}

/** Xoá hẳn 1 đơn nhân viên lỡ tải nhầm (chưa xử lý) trước khi mình đọc tới. */
export async function deleteIntakeOrder(folderId: string): Promise<void> {
  const drive = await getDriveClient();
  await drive.files.delete({ fileId: folderId });
}

/**
 * Chuyển 1 thư mục đơn đã đọc/tạo bill xong sang "Đã xử lý" — di chuyển vật
 * lý (đổi parent) thay vì chỉ ghi log riêng, để nhân viên tự nhìn thấy ngay
 * trong Drive đơn nào còn chờ mà không cần hỏi lại; cũng tránh log bị lệch
 * nếu ai đó lỡ tự xoá/di chuyển file thủ công.
 */
export async function markIntakeOrderProcessed(folderId: string): Promise<void> {
  const rootFolderId = getRootFolderId();
  const drive = await getDriveClient();
  const processedFolderId = await ensureProcessedFolder(drive, rootFolderId);

  const file = await drive.files.get({ fileId: folderId, fields: "parents" });
  const previousParents = (file.data.parents || []).join(",");

  await drive.files.update({
    fileId: folderId,
    addParents: processedFolderId,
    removeParents: previousParents,
    fields: "id, parents",
  });
}
