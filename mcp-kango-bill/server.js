#!/usr/bin/env node
// MCP server exposing ONE tool — "create_kango_bill" — that lets a Claude
// agent draft a Kango shipment bill for Falco Express directly via the API,
// no browser needed. Talks to POST /api/admin/kango-bills using a
// FALCO_AGENT_API_KEY (never the human admin's password). This tool can
// only create DRAFTS — the real, irreversible "send to Kango" step still
// requires a human to log into /admin/kango-bills and press
// "Duyệt & Gửi Kango" by hand. See ../README.md ("Tạo bill từ agent ngoài").
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

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("falco-kango-bill MCP server đang chạy (stdio).");
