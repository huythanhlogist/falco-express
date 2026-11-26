import { timingSafeEqual } from "node:crypto";
import type mysql from "mysql2/promise";
import {
  ensureKangoBillSchema,
  getPool,
  type KangoBillEditableFields,
  type KangoRecentReceiver,
  type NewKangoBillImage,
} from "./db";

export const AGENT_CREATED_BY = "agent (API key)";

export type KangoBillExtendedStatus = "draft" | "sending" | "sent";

/** So sánh AGENT_API_KEY an toàn bằng timingSafeEqual để tránh timing attack. */
export function isValidAgentKey(request: Request): boolean {
  const key = request.headers.get("x-agent-api-key");
  const expected = process.env.AGENT_API_KEY;
  if (!key || !expected) return false;
  const a = Buffer.from(key, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

// Tự bổ sung giá trị 'sending' vào cột ENUM status của bảng kango_bills (idempotent, 1 lần mỗi tiến trình)
// để hỗ trợ khoá nguyên tử khi "Duyệt & Gửi Kango" mà không cần chạy script tay trên Hostinger.
let sendingStatusReady: Promise<void> | null = null;
export function ensureKangoBillSendingStatus(): Promise<void> {
  if (!sendingStatusReady) {
    sendingStatusReady = (async () => {
      await ensureKangoBillSchema();
      const [cols] = await getPool().query<mysql.RowDataPacket[]>(
        "SHOW COLUMNS FROM kango_bills LIKE 'status'"
      );
      const colType = String(cols[0]?.Type ?? "");
      if (colType && !colType.includes("'sending'")) {
        await getPool().query(
          "ALTER TABLE kango_bills MODIFY COLUMN status ENUM('draft','sending','sent') NOT NULL DEFAULT 'draft'"
        );
      }
    })().catch((err) => {
      sendingStatusReady = null;
      throw err;
    });
  }
  return sendingStatusReady;
}

/**
 * Khoá nguyên tử trước khi gọi API tạo vận đơn thật trên Kango:
 * chỉ 1 request duy nhất chuyển được status từ 'draft' sang 'sending' (affectedRows === 1).
 */
export async function acquireKangoBillSendLock(id: number): Promise<boolean> {
  await ensureKangoBillSendingStatus();
  const [result] = await getPool().query<mysql.ResultSetHeader>(
    "UPDATE kango_bills SET status = 'sending', send_error = NULL WHERE id = ? AND status IN ('draft')",
    [id]
  );
  return result.affectedRows === 1;
}

/** Trả trạng thái bill về trạng thái trước ('draft') kèm lý do lỗi khi gửi Kango thất bại. */
export async function releaseKangoBillSendLock(
  id: number,
  previousStatus: "draft",
  error: string
): Promise<void> {
  await ensureKangoBillSendingStatus();
  await getPool().query(
    "UPDATE kango_bills SET status = ?, send_error = ? WHERE id = ? AND status = 'sending'",
    [previousStatus, error.slice(0, 2000), id]
  );
}

/**
 * Lưu kết quả gửi Kango thành công với timestamp chuẩn từ Node (tránh lệch ~7h do NOW() của MySQL Hostinger).
 */
export async function markKangoBillSentUtc(
  id: number,
  data: { sentBy: string; kangoBillId: string; hawbs: string[]; redirectUrl: string }
): Promise<void> {
  await ensureKangoBillSendingStatus();
  await getPool().query(
    `UPDATE kango_bills
     SET status = 'sent', sent_by = ?, sent_at = ?, kango_bill_id = ?, kango_hawbs_json = ?, kango_redirect_url = ?, send_error = NULL
     WHERE id = ?`,
    [data.sentBy, new Date(), data.kangoBillId, JSON.stringify(data.hawbs), data.redirectUrl, id]
  );
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Thử lưu kết quả Kango vào DB (có retry + fallback tối thiểu để luôn giữ được kango_bill_id).
 * Nếu vẫn lỗi sau mọi lần thử: ghi log chi tiết toàn bộ thông tin Kango trả về và trả `{ saved: false }`.
 */
export async function saveKangoBillSentWithRetry(
  id: number,
  data: { sentBy: string; kangoBillId: string; hawbs: string[]; redirectUrl: string }
): Promise<{ saved: true } | { saved: false; error: string }> {
  let lastErr: unknown = null;
  const delays = [0, 300, 800];

  for (let attempt = 0; attempt < delays.length; attempt++) {
    if (delays[attempt] > 0) await sleep(delays[attempt]);
    try {
      await markKangoBillSentUtc(id, data);
      return { saved: true };
    } catch (err) {
      lastErr = err;
      console.error(
        `[kango-bills/send] Lưu DB lần ${attempt + 1}/${delays.length} thất bại sau khi Kango đã tạo bill #${id} (kangoBillId=${data.kangoBillId}):`,
        err
      );
    }
  }

  // Fallback tối thiểu: ưu tiên lưu bằng được kango_bill_id và status='sent' để không mất dấu vận đơn thật.
  try {
    await getPool().query(
      "UPDATE kango_bills SET status = 'sent', kango_bill_id = ?, send_error = ? WHERE id = ?",
      [
        data.kangoBillId,
        `Đã tạo trên Kango (${data.kangoBillId}) nhưng lưu đầy đủ thông tin gặp lỗi`,
        id,
      ]
    );
    console.error(
      `[kango-bills/send] Fallback lưu tối thiểu thành công cho bill #${id}. Dữ liệu đầy đủ từ Kango:`,
      JSON.stringify(data)
    );
    return { saved: true };
  } catch (fallbackErr) {
    lastErr = fallbackErr;
    console.error(
      `[kango-bills/send] NGHIÊM TRỌNG: Kango đã tạo vận đơn thật nhưng lưu DB thất bại hoàn toàn cho bill #${id}. Dữ liệu Kango:`,
      JSON.stringify(data),
      "Lỗi:",
      fallbackErr
    );
    return {
      saved: false,
      error: lastErr instanceof Error ? lastErr.message : "Lỗi ghi cơ sở dữ liệu",
    };
  }
}

const KANGO_BILL_FIELD_COLUMNS: Record<keyof KangoBillEditableFields, string> = {
  receiverCompanyName: "receiver_company_name",
  receiverContactName: "receiver_contact_name",
  receiverTelephone: "receiver_telephone",
  receiverCountry: "receiver_country",
  receiverStateName: "receiver_state_name",
  receiverCity: "receiver_city",
  receiverPostalCode: "receiver_postal_code",
  receiverAddress1: "receiver_address_1",
  receiverAddress2: "receiver_address_2",
  receiverAddress3: "receiver_address_3",
  shipmentService: "shipment_service",
  shipmentSignatureFlg: "shipment_signature_flg",
  shipmentBranch: "shipment_branch",
  shipmentReferenceCode: "shipment_reference_code",
  shipmentGoodsName: "shipment_goods_name",
  shipmentValue: "shipment_value",
  shipmentExportAs: "shipment_export_as",
  packages: "packages_json",
  invoices: "invoices_json",
  customerNote: "customer_note",
};

/** Chỉ cho sửa khi bill còn ở trạng thái 'draft' (chặn sửa bill đã 'sent' hoặc đang 'sending'). */
export async function updateKangoBillIfEditable(
  id: number,
  fields: KangoBillEditableFields
): Promise<"updated" | "not_found" | "locked"> {
  await ensureKangoBillSchema();
  const entries = Object.entries(fields) as [keyof KangoBillEditableFields, unknown][];
  if (entries.length === 0) return "updated";

  const setClause = entries.map(([key]) => `${KANGO_BILL_FIELD_COLUMNS[key]} = ?`).join(", ");
  const values = entries.map(([key, value]) => {
    if (key === "shipmentSignatureFlg") return value ? 1 : 0;
    if (key === "packages" || key === "invoices") return JSON.stringify(value);
    return value;
  });

  const [result] = await getPool().query<mysql.ResultSetHeader>(
    `UPDATE kango_bills SET ${setClause} WHERE id = ? AND status = 'draft'`,
    [...values, id]
  );
  if (result.affectedRows > 0) return "updated";

  const [rows] = await getPool().query<mysql.RowDataPacket[]>(
    "SELECT status FROM kango_bills WHERE id = ? LIMIT 1",
    [id]
  );
  if (rows.length === 0) return "not_found";
  return "locked";
}

/** Chỉ cho xoá khi bill còn ở trạng thái 'draft' (chặn xoá bill đã 'sent' hoặc đang 'sending'). */
export async function deleteKangoBillIfDraft(
  id: number
): Promise<"deleted" | "not_found" | "locked"> {
  await ensureKangoBillSchema();
  const [result] = await getPool().query<mysql.ResultSetHeader>(
    "DELETE FROM kango_bills WHERE id = ? AND status = 'draft'",
    [id]
  );
  if (result.affectedRows > 0) return "deleted";

  const [rows] = await getPool().query<mysql.RowDataPacket[]>(
    "SELECT status FROM kango_bills WHERE id = ? LIMIT 1",
    [id]
  );
  if (rows.length === 0) return "not_found";
  return "locked";
}

/**
 * Danh sách 50 người nhận gần nhất (gộp theo SĐT) — đúng chuẩn MySQL 8 ONLY_FULL_GROUP_BY
 * và luôn trả địa chỉ của bill MỚI NHẤT cho mỗi SĐT.
 */
export async function listRecentKangoReceiversSafe(): Promise<KangoRecentReceiver[]> {
  await ensureKangoBillSchema();
  const [rows] = await getPool().query<mysql.RowDataPacket[]>(
    `SELECT
       receiver_company_name AS receiverCompanyName,
       receiver_contact_name AS receiverContactName,
       receiver_telephone AS receiverTelephone,
       receiver_country AS receiverCountry,
       receiver_state_name AS receiverStateName,
       receiver_city AS receiverCity,
       receiver_postal_code AS receiverPostalCode,
       receiver_address_1 AS receiverAddress1,
       receiver_address_2 AS receiverAddress2,
       receiver_address_3 AS receiverAddress3
     FROM kango_bills
     WHERE id IN (
       SELECT MAX(id)
       FROM kango_bills
       WHERE receiver_telephone IS NOT NULL AND receiver_telephone <> ''
       GROUP BY receiver_telephone
     )
     ORDER BY id DESC
     LIMIT 50`
  );
  return rows as unknown as KangoRecentReceiver[];
}

/**
 * Upload nhiều ảnh kiện hàng trong 1 transaction có khoá hàng bill:
 * đảm bảo không vượt quá giới hạn tối đa khi upload song song và không lưu dở dang nếu lỗi giữa chừng.
 */
export async function insertKangoBillImagesWithLimit(
  billId: number,
  files: NewKangoBillImage[],
  maxImages: number
): Promise<
  | { ok: true; ids: number[] }
  | { ok: false; reason: "not_found" | "locked" | "limit_exceeded"; existingCount?: number }
> {
  await ensureKangoBillSchema();
  const conn = await getPool().getConnection();
  try {
    await conn.beginTransaction();

    const [billRows] = await conn.query<mysql.RowDataPacket[]>(
      "SELECT id, status FROM kango_bills WHERE id = ? FOR UPDATE",
      [billId]
    );
    if (billRows.length === 0) {
      await conn.rollback();
      return { ok: false, reason: "not_found" };
    }
    if (String(billRows[0].status) !== "draft") {
      await conn.rollback();
      return { ok: false, reason: "locked" };
    }

    const [countRows] = await conn.query<mysql.RowDataPacket[]>(
      "SELECT COUNT(*) AS cnt FROM kango_bill_images WHERE bill_id = ?",
      [billId]
    );
    const existingCount = Number(countRows[0]?.cnt ?? 0);
    if (existingCount + files.length > maxImages) {
      await conn.rollback();
      return { ok: false, reason: "limit_exceeded", existingCount };
    }

    const ids: number[] = [];
    for (const file of files) {
      const [result] = await conn.query<mysql.ResultSetHeader>(
        `INSERT INTO kango_bill_images (bill_id, filename, mime_type, file_size, data)
         VALUES (?, ?, ?, ?, ?)`,
        [billId, file.filename, file.mimeType, file.buffer.length, file.buffer]
      );
      ids.push(result.insertId);
    }

    await conn.commit();
    return { ok: true, ids };
  } catch (err) {
    await conn.rollback().catch(() => undefined);
    throw err;
  } finally {
    conn.release();
  }
}

/** Xoá ảnh kiện hàng nhưng chặn nếu bill sở hữu ảnh đã 'sent' hoặc đang 'sending'. */
export async function deleteKangoBillImageIfDraft(
  imageId: number
): Promise<"deleted" | "not_found" | "locked"> {
  await ensureKangoBillSchema();
  const [rows] = await getPool().query<mysql.RowDataPacket[]>(
    `SELECT img.id, b.status
     FROM kango_bill_images img
     JOIN kango_bills b ON b.id = img.bill_id
     WHERE img.id = ?
     LIMIT 1`,
    [imageId]
  );
  if (rows.length === 0) return "not_found";
  if (String(rows[0].status) !== "draft") return "locked";

  const [result] = await getPool().query<mysql.ResultSetHeader>(
    `DELETE img FROM kango_bill_images img
     JOIN kango_bills b ON b.id = img.bill_id
     WHERE img.id = ? AND b.status = 'draft'`,
    [imageId]
  );
  return result.affectedRows > 0 ? "deleted" : "locked";
}
