import { google } from "googleapis";

const SHEET_RANGE = process.env.GOOGLE_SHEET_RANGE || "Orders!A2:M1000";

export type OrderRow = {
  falcoCode: string;
  billNumber: string;
  customerName: string;
  customerPhone: string;
  service: string;
  destination: string;
  lastMileCarrier: string;
  lastMileCodes: string;
  receivedDate: string;
  warehouseDate: string;
  handoverDate: string;
  deliveredDate: string;
  note: string;
};

export type TrackingStep = {
  title: string;
  date: string;
  done: boolean;
};

export type PublicOrder = {
  falcoCode: string;
  billNumber: string;
  service: string;
  destination: string;
  lastMileCarrier: string;
  lastMileCodes: string[];
  currentStatus: string;
  steps: TrackingStep[];
  ksnPostUrl: string;
};

function getAuthClient() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const rawKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;

  if (!email || !rawKey) {
    throw new Error(
      "Thiếu GOOGLE_SERVICE_ACCOUNT_EMAIL hoặc GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY"
    );
  }

  return new google.auth.GoogleAuth({
    credentials: {
      client_email: email,
      private_key: rawKey.replace(/\\n/g, "\n"),
    },
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
}

async function getSheetsClient() {
  const auth = getAuthClient();
  const authClient = await auth.getClient();
  return google.sheets({ version: "v4", auth: authClient as never });
}

function rowToOrder(row: string[]): OrderRow {
  return {
    falcoCode: (row[0] || "").trim(),
    billNumber: (row[1] || "").trim(),
    customerName: (row[2] || "").trim(),
    customerPhone: (row[3] || "").trim(),
    service: (row[4] || "").trim(),
    destination: (row[5] || "").trim(),
    lastMileCarrier: (row[6] || "").trim(),
    lastMileCodes: (row[7] || "").trim(),
    receivedDate: (row[8] || "").trim(),
    warehouseDate: (row[9] || "").trim(),
    handoverDate: (row[10] || "").trim(),
    deliveredDate: (row[11] || "").trim(),
    note: (row[12] || "").trim(),
  };
}

export async function getAllOrders(): Promise<OrderRow[]> {
  const sheetId = process.env.GOOGLE_SHEET_ID;
  if (!sheetId) throw new Error("Thiếu GOOGLE_SHEET_ID");

  const sheets = await getSheetsClient();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: SHEET_RANGE,
  });

  const rows = res.data.values || [];
  return rows
    .filter((row) => (row[0] || "").trim() !== "")
    .map((row) => rowToOrder(row as string[]));
}

function toPublicOrder(order: OrderRow): PublicOrder {
  const milestones: { title: string; date: string }[] = [
    { title: "Đã tiếp nhận đơn hàng", date: order.receivedDate },
    { title: "Đang xử lý tại kho", date: order.warehouseDate },
    { title: "Đã bàn giao đối tác vận chuyển", date: order.handoverDate },
    { title: "Giao hàng thành công", date: order.deliveredDate },
  ];

  const steps: TrackingStep[] = milestones.map((m) => ({
    title: m.title,
    date: m.date,
    done: m.date !== "",
  }));

  const lastDone = [...steps].reverse().find((s) => s.done);
  const currentStatus = lastDone ? lastDone.title : "Chưa cập nhật";

  const lastMileCodes = order.lastMileCodes
    ? order.lastMileCodes.split(",").map((c) => c.trim()).filter(Boolean)
    : [];

  return {
    falcoCode: order.falcoCode,
    billNumber: order.billNumber,
    service: order.service,
    destination: order.destination,
    lastMileCarrier: order.lastMileCarrier,
    lastMileCodes,
    currentStatus,
    steps,
    ksnPostUrl: order.billNumber
      ? `https://www.ksnpost.com/?code=${encodeURIComponent(order.billNumber)}`
      : "",
  };
}

export async function findOrderByTrackingCode(
  code: string
): Promise<PublicOrder | null> {
  const normalized = code.trim().toUpperCase();
  if (!normalized) return null;

  const orders = await getAllOrders();
  const match = orders.find(
    (o) => o.falcoCode.toUpperCase() === normalized
  );

  return match ? toPublicOrder(match) : null;
}

export async function appendOrders(rows: OrderRow[]): Promise<void> {
  if (rows.length === 0) return;
  const sheetId = process.env.GOOGLE_SHEET_ID;
  if (!sheetId) throw new Error("Thiếu GOOGLE_SHEET_ID");

  const sheets = await getSheetsClient();
  const values = rows.map((r) => [
    r.falcoCode,
    r.billNumber,
    r.customerName,
    r.customerPhone,
    r.service,
    r.destination,
    r.lastMileCarrier,
    r.lastMileCodes,
    r.receivedDate,
    r.warehouseDate,
    r.handoverDate,
    r.deliveredDate,
    r.note,
  ]);

  await sheets.spreadsheets.values.append({
    spreadsheetId: sheetId,
    range: SHEET_RANGE,
    valueInputOption: "USER_ENTERED",
    requestBody: { values },
  });
}
