#!/usr/bin/env node
// MCP server exposing tools that let a Claude agent draft Kango shipment
// bills for Falco Express directly via the API, no browser needed. Talks
// to POST /api/admin/kango-bills using a FALCO_AGENT_API_KEY (never the
// human admin's password). This tool can only create DRAFTS — the real,
// irreversible "send to Kango" step still requires a human to log into
// /admin/kango-bills and press "Duyệt & Gửi Kango" by hand. See
// ../README.md ("Tạo bill từ agent ngoài").
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const BASE_URL = process.env.FALCO_ADMIN_BASE_URL || "https://falcoexpress.com";
const AGENT_API_KEY = process.env.FALCO_AGENT_API_KEY;

if (!AGENT_API_KEY) {
  console.error(
    "Thiếu biến môi trường FALCO_AGENT_API_KEY — lấy giá trị AGENT_API_KEY từ .env.local của dự án web."
  );
  process.exit(1);
}

const server = new McpServer({ name: "falco-kango-bill", version: "1.0.0" });

const packageSchema = z.object({
  packageQuantity: z.number().int().min(1).describe("Số kiện hàng"),
  packageType: z.number().int().min(0).max(2).describe("0 = Carton, 1 = Pallet, 2 = Túi (Phong bì)"),
  packageLength: z.number().positive().describe("Chiều dài (cm)"),
  packageWidth: z.number().positive().describe("Chiều rộng (cm)"),
  packageHeight: z.number().positive().describe("Chiều cao (cm)"),
  packageWeight: z.number().positive().describe("Cân nặng (kg)"),
});

const invoiceSchema = z.object({
  invoiceGoodsDetails: z.string().min(1).describe("Tên sản phẩm"),
  invoiceQuantity: z.number().int().min(1).describe("Số lượng"),
  invoiceUnit: z.number().int().min(0).max(3).describe("0 = Pcs, 1 = Bag, 2 = Box, 3 = Jar"),
  invoicePrice: z.number().min(0).describe("Đơn giá"),
  invoiceTotalPrice: z.number().min(0).describe("Tổng tiền"),
});

server.registerTool(
  "create_kango_bill",
  {
    title: "Tạo bill Kango (nháp)",
    description:
      "Tạo 1 bill Kango (khởi tạo shipment) ở trạng thái NHÁP trong web admin Falco Express. " +
      "KHÔNG gửi gì lên Kango thật — nhân viên Falco vẫn phải tự vào /admin/kango-bills, " +
      "kiểm tra lại rồi bấm 'Duyệt & Gửi Kango' mới tạo vận đơn thật. Dùng tool này khi có đủ " +
      "thông tin người nhận + kiện hàng từ khách (vd trích xuất từ tin nhắn/đơn hàng).",
    inputSchema: {
      receiverCompanyName: z.string().min(1).describe("Tên công ty người nhận"),
      receiverContactName: z.string().min(1).describe("Tên người nhận"),
      receiverTelephone: z.string().min(1).describe("SĐT người nhận"),
      receiverCountry: z.string().min(1).describe("Quốc gia (vd: AUSTRALIA)"),
      receiverStateName: z.string().min(1).describe("Bang/khu vực"),
      receiverCity: z.string().min(1).describe("Thành phố"),
      receiverPostalCode: z.string().min(1).describe("Mã bưu chính"),
      receiverAddress1: z.string().min(1).describe("Địa chỉ dòng 1"),
      receiverAddress2: z.string().optional().describe("Địa chỉ dòng 2 (tuỳ chọn)"),
      receiverAddress3: z.string().optional().describe("Địa chỉ dòng 3 (tuỳ chọn)"),
      shipmentService: z.string().min(1).describe("Mã dịch vụ Kango, vd: AIR-AU"),
      shipmentSignatureFlg: z.boolean().optional().describe("Yêu cầu chữ ký người nhận (mặc định true)"),
      shipmentBranch: z
        .enum(["HCM", "HN", "DN", "NGHE-AN", "DQH - HCM", "QUẢNG TRỊ"])
        .describe("Chi nhánh tạo đơn — phải khớp đúng 1 trong các chi nhánh có thật trong tài khoản Kango"),
      shipmentReferenceCode: z.string().optional().describe("Mã theo dõi nội bộ (tuỳ chọn)"),
      shipmentGoodsName: z.string().min(1).describe("Tên hàng hoá"),
      shipmentValue: z.number().min(0).describe("Giá trị kiện hàng (USD)"),
      shipmentExportAs: z.number().int().min(0).max(1).optional().describe("0 = Gift, 1 = Sample (mặc định 0)"),
      packages: z.array(packageSchema).min(1).describe("Danh sách kiện hàng, ít nhất 1 kiện"),
      invoices: z.array(invoiceSchema).optional().describe("Danh sách invoice chi tiết (tuỳ chọn)"),
    },
  },
  async (input) => {
    const res = await fetch(`${BASE_URL}/api/admin/kango-bills`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-agent-api-key": AGENT_API_KEY,
      },
      body: JSON.stringify(input),
    });
    const json = await res.json().catch(() => null);

    if (!res.ok) {
      return {
        isError: true,
        content: [{ type: "text", text: `Tạo bill thất bại (HTTP ${res.status}): ${json?.error || "lỗi không rõ"}` }],
      };
    }

    return {
      content: [
        {
          type: "text",
          text: `Đã tạo bill NHÁP #${json.id} thành công. Bill này CHƯA gửi lên Kango — vào ${BASE_URL}/admin/kango-bills/${json.id} để kiểm tra lại rồi bấm "Duyệt & Gửi Kango".`,
        },
      ],
    };
  }
);

// ===== "AI nhập đơn" — hàng chờ đơn hàng nhân viên upload (note + ảnh) tại
// /admin/ai-nhap-don, lưu trong MySQL (ai_intake_orders/ai_intake_images).
// 3 tool dưới đây cho agent: (1) liệt kê đơn đang chờ, (2) lấy ảnh của 1 đơn
// để agent tự đọc/trích xuất, (3) đánh dấu đã xử lý sau khi tạo bill xong.
// Agent KHÔNG có quyền xoá đơn (route DELETE vẫn chỉ session admin gọi được).

server.registerTool(
  "list_pending_ai_intake_orders",
  {
    title: "Liệt kê đơn AI nhập đơn đang chờ xử lý",
    description:
      "Lấy danh sách các đơn hàng nhân viên đã upload qua trang /admin/ai-nhap-don " +
      "nhưng CHƯA được agent xử lý (status = pending). Mỗi đơn gồm ghi chú (note) " +
      "nhân viên gõ và số lượng ảnh kèm theo. Gọi tool này đầu tiên khi founder " +
      "nói 'xử lý lô đơn mới', rồi dùng get_ai_intake_order_images để xem ảnh " +
      "từng đơn trước khi tạo bill.",
    inputSchema: {},
  },
  async () => {
    const res = await fetch(`${BASE_URL}/api/admin/ai-intake`, {
      headers: { "x-agent-api-key": AGENT_API_KEY },
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      return {
        isError: true,
        content: [{ type: "text", text: `Lấy danh sách đơn chờ thất bại (HTTP ${res.status}): ${json?.error || "lỗi không rõ"}` }],
      };
    }
    const orders = json.orders || [];
    if (orders.length === 0) {
      return { content: [{ type: "text", text: "Không có đơn nào đang chờ xử lý." }] };
    }
    const lines = orders.map(
      (o) =>
        `#${o.id} — ${o.imageCount} ảnh — tạo lúc ${o.created_at} bởi ${o.created_by}\nGhi chú: ${o.note || "(không có ghi chú text)"}`
    );
    return {
      content: [
        {
          type: "text",
          text: `Có ${orders.length} đơn đang chờ xử lý:\n\n${lines.join("\n\n")}`,
        },
      ],
    };
  }
);

server.registerTool(
  "get_ai_intake_order_images",
  {
    title: "Lấy ảnh của 1 đơn AI nhập đơn",
    description:
      "Tải toàn bộ ảnh (dạng ảnh thật, xem được trực tiếp) của 1 đơn trong hàng chờ " +
      "AI nhập đơn, theo orderId lấy từ list_pending_ai_intake_orders. Dùng để đọc " +
      "thông tin khách hàng/kiện hàng từ ảnh trước khi map vào create_kango_bill.",
    inputSchema: {
      orderId: z.number().int().min(1).describe("ID đơn trong hàng chờ (lấy từ list_pending_ai_intake_orders)"),
    },
  },
  async ({ orderId }) => {
    const listRes = await fetch(`${BASE_URL}/api/admin/ai-intake/${orderId}/images`, {
      headers: { "x-agent-api-key": AGENT_API_KEY },
    });
    const listJson = await listRes.json().catch(() => null);
    if (!listRes.ok) {
      return {
        isError: true,
        content: [{ type: "text", text: `Lấy danh sách ảnh thất bại (HTTP ${listRes.status}): ${listJson?.error || "lỗi không rõ"}` }],
      };
    }
    const images = listJson.images || [];
    if (images.length === 0) {
      return { content: [{ type: "text", text: `Đơn #${orderId} không có ảnh nào.` }] };
    }

    const content = [{ type: "text", text: `Đơn #${orderId} có ${images.length} ảnh:` }];
    for (const img of images) {
      const imgRes = await fetch(`${BASE_URL}/api/admin/ai-intake/image/${img.id}`, {
        headers: { "x-agent-api-key": AGENT_API_KEY },
      });
      if (!imgRes.ok) {
        content.push({ type: "text", text: `(Không tải được ảnh ${img.filename}, HTTP ${imgRes.status})` });
        continue;
      }
      const buf = Buffer.from(await imgRes.arrayBuffer());
      content.push({
        type: "image",
        data: buf.toString("base64"),
        mimeType: img.mime_type || "image/jpeg",
      });
    }
    return { content };
  }
);

server.registerTool(
  "mark_ai_intake_order_processed",
  {
    title: "Đánh dấu 1 đơn AI nhập đơn đã xử lý",
    description:
      "Đánh dấu 1 đơn trong hàng chờ AI nhập đơn là ĐÃ XỬ LÝ (status = processed), " +
      "sau khi agent đã tạo xong bill Kango nháp tương ứng bằng create_kango_bill. " +
      "KHÔNG xoá dữ liệu — chỉ đổi trạng thái để lần 'xử lý lô đơn mới' sau không " +
      "đọc lại đơn này nữa. Chỉ gọi SAU KHI create_kango_bill đã thành công.",
    inputSchema: {
      orderId: z.number().int().min(1).describe("ID đơn cần đánh dấu đã xử lý"),
    },
  },
  async ({ orderId }) => {
    const res = await fetch(`${BASE_URL}/api/admin/ai-intake/${orderId}`, {
      method: "PATCH",
      headers: { "x-agent-api-key": AGENT_API_KEY },
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      return {
        isError: true,
        content: [{ type: "text", text: `Đánh dấu đã xử lý thất bại (HTTP ${res.status}): ${json?.error || "lỗi không rõ"}` }],
      };
    }
    return { content: [{ type: "text", text: `Đã đánh dấu đơn #${orderId} là đã xử lý.` }] };
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("falco-kango-bill MCP server đang chạy (stdio).");
