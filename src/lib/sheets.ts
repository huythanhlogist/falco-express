import { google } from "googleapis";

const SHEET_RANGE = process.env.GOOGLE_SHEET_RANGE || "Orders!A2:K1000";

export type OrderRow = {
  falcoCode: string;
  billNumber: string;
  recipientName: string;
  recipientPhone: string;
  service: string;
  destination: string;
  lastMileCodes: string;
  receivedDate: string;
  warehouseDate: string;
  handoverDate: string;
  deliveredDate: string;
};

export type TrackingStep = {
  title: string;
  date: string;
  done: boolean;
};

export type LastMileLink = {
  code: string;
  carrier: string;
  url: string;
};

export type PublicOrder = {
  falcoCode: string;
  billNumber: string;
  service: string;
  destination: string;
  lastMile: LastMileLink[];
  currentStatus: string;
  steps: TrackingStep[];
  ksnPostUrl: string;
};

/**
 * Mapping hãng last-mile theo đúng SERVICE thật của Falco (file Kango
 * không có cột ghi tên hãng, nhưng mỗi mã SERVICE luôn cố định một hãng).
 * Xác nhận trực tiếp từ người vận hành — không suy đoán từ định dạng mã.
 */
const SERVICE_CARRIER: Record<
  string,
  { carrier: string; buildUrl: (code: string) => string }
> = {
  "AIR-UK-PRIORITY": {
    carrier: "DPD UK",
    buildUrl: (c) => `https://www.dpd.co.uk/apps/tracking/?parcel=${encodeURIComponent(c)}`,
  },
  "AIR-EU-DHL-PRIORITY": {
    carrier: "DHL",
    buildUrl: (c) =>
      `https://www.dhl.com/vn-vi/home/tracking/tracking-express.html?submit=1&tracking-id=${encodeURIComponent(c)}`,
  },
  "AIR-EU-DL-BH": {
    carrier: "DPD EU",
    buildUrl: (c) => `https://tracking.dpd.de/status/en_US/parcel/${encodeURIComponent(c)}`,
  },
  "AIR-CAD": {
    carrier: "USPS",
    buildUrl: (c) => `https://tools.usps.com/go/TrackConfirmAction?tLabels=${encodeURIComponent(c)}`,
  },
};

/**
 * Với dịch vụ chưa có trong bảng trên (tuyến mới), suy luận tạm theo từ khoá
 * trong tên dịch vụ (vd "AIR-EU-UPS-PRIORITY" → UPS). Nếu không nhận diện
 * được, KHÔNG đoán bừa hãng cụ thể — trả về mã theo dõi kèm link tra cứu đa
 * hãng (17TRACK) để tránh gắn nhầm thương hiệu như đã từng xảy ra.
 */
function resolveCarrier(service: string): {
  carrier: string;
  buildUrl: (code: string) => string;
} {
  const exact = SERVICE_CARRIER[service.trim().toUpperCase()];
  if (exact) return exact;

  const s = service.toUpperCase();
  if (s.includes("UPS")) {
    return {
      carrier: "UPS",
      buildUrl: (c) => `https://www.ups.com/track?tracknum=${encodeURIComponent(c)}`,
    };
  }
  if (s.includes("DHL")) {
    return {
      carrier: "DHL",
      buildUrl: (c) =>
        `https://www.dhl.com/vn-vi/home/tracking/tracking-express.html?submit=1&tracking-id=${encodeURIComponent(c)}`,
    };
  }

  return {
    carrier: "Đối tác vận chuyển",
    buildUrl: (c) => `https://t.17track.net/en#nums=${encodeURIComponent(c)}`,
  };
}

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
    recipientName: (row[2] || "").trim(),
    recipientPhone: (row[3] || "").trim(),
    service: (row[4] || "").trim(),
    destination: (row[5] || "").trim(),
    lastMileCodes: (row[6] || "").trim(),
    receivedDate: (row[7] || "").trim(),
    warehouseDate: (row[8] || "").trim(),
    handoverDate: (row[9] || "").trim(),
    deliveredDate: (row[10] || "").trim(),
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

  const { carrier, buildUrl } = resolveCarrier(order.service);
  const lastMile: LastMileLink[] = lastMileCodes.map((code) => ({
    code,
    carrier,
    url: buildUrl(code),
  }));

  return {
    falcoCode: order.falcoCode,
    billNumber: order.billNumber,
    service: order.service,
    destination: order.destination,
    lastMile,
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
    r.recipientName,
    r.recipientPhone,
    r.service,
    r.destination,
    r.lastMileCodes,
    r.receivedDate,
    r.warehouseDate,
    r.handoverDate,
    r.deliveredDate,
  ]);

  await sheets.spreadsheets.values.append({
    spreadsheetId: sheetId,
    range: SHEET_RANGE,
    valueInputOption: "USER_ENTERED",
    requestBody: { values },
  });
}
