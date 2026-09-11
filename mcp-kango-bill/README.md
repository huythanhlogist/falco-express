# MCP server: Falco Kango Bill

Cho phép 1 agent Claude (Claude Desktop, Claude Code, hoặc bất kỳ ứng dụng
nào nói được MCP) tạo **bill Kango ở trạng thái nháp** trực tiếp qua API
của web admin Falco — không cần mở trình duyệt, không cần tài khoản admin.
Agent **không** gửi được gì lên Kango thật — chỉ tạo nháp; nhân viên vẫn
phải tự vào `/admin/kango-bills` kiểm tra rồi bấm "Duyệt & Gửi Kango" (xem
mục "Tạo bill từ agent ngoài" trong `../README.md` để hiểu vì sao thiết kế
như vậy).

Cách hoạt động: server này là 1 tiến trình Node chạy trên máy bạn, nói
chuyện với Claude qua giao thức MCP (qua stdio — không mở cổng mạng nào cả).
Nó có đúng 1 "tool" tên `create_kango_bill`. Khi bạn chat với Claude và yêu
cầu tạo bill, Claude tự gọi tool này với đúng dữ liệu, tool gọi thẳng API
`POST /api/admin/kango-bills` của web Falco kèm header `x-agent-api-key`.

## 1. Cài đặt (làm 1 lần)

```bash
cd "mcp-kango-bill"
npm install
```

Lấy giá trị `AGENT_API_KEY` trong `.env.local` ở thư mục gốc dự án (hoặc
trong Environment variables trên Hostinger hPanel) — đây chính là
`FALCO_AGENT_API_KEY` cần dùng ở các bước dưới.

## 2. Nối vào Claude Desktop

Mở file cấu hình Claude Desktop:
- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`

Thêm (hoặc gộp vào) mục `mcpServers`:

```json
{
  "mcpServers": {
    "falco-kango-bill": {
      "command": "node",
      "args": ["/duong-dan-tuyet-doi/toi/mcp-kango-bill/server.js"],
      "env": {
        "FALCO_AGENT_API_KEY": "dan-gia-tri-AGENT_API_KEY-vao-day",
        "FALCO_ADMIN_BASE_URL": "https://falcoexpress.com"
      }
    }
  }
}
```

**Dùng đường dẫn tuyệt đối** cho `args` (vd
`/Users/huythaithanh/Claucode 1/mcp-kango-bill/server.js`). Khởi động lại
Claude Desktop — vào phần cắm (plug icon) trong khung chat để xác nhận
"falco-kango-bill" đã kết nối và tool `create_kango_bill` xuất hiện.

## 3. Nối vào Claude Code (dùng CLI)

```bash
claude mcp add falco-kango-bill \
  --env FALCO_AGENT_API_KEY=dan-gia-tri-AGENT_API_KEY-vao-day \
  --env FALCO_ADMIN_BASE_URL=https://falcoexpress.com \
  -- node "/duong-dan-tuyet-doi/toi/mcp-kango-bill/server.js"
```

Chạy `claude mcp list` để xác nhận đã thêm. Mở 1 session Claude Code mới,
tool sẽ có sẵn (gõ `/mcp` để xem danh sách server đã nối trong phiên).

## 4. Test thủ công (không cần Claude)

```bash
FALCO_AGENT_API_KEY=<dán key> node --env-file=.env server.js
```

(cần tạo `.env` từ `.env.example` trước). Đây chỉ khởi động server chờ kết
nối MCP qua stdio — để test thật sự có gọi được tool không, cách dễ nhất là
hỏi thẳng Claude Desktop/Code sau khi đã nối ở bước 2/3, vd:

> "Tạo giúp tôi 1 bill Kango nháp gửi cho Nguyễn Văn A, SĐT 0912345678,
> Australia, bang Queensland, thành phố Brisbane, mã bưu chính 4000, địa
> chỉ 12 Test Street, dịch vụ AIR-AU, chi nhánh HCM, hàng hoá Sample, giá
> trị 50, 1 kiện 20x15x10cm nặng 1.2kg."

Claude sẽ tự trích xuất đúng các trường và gọi tool — kiểm tra lại bill vừa
tạo ở `/admin/kango-bills` trên web.

## Ghi chú bảo mật

- `FALCO_AGENT_API_KEY` **khác hẳn** mật khẩu admin của bạn — không đưa
  mật khẩu admin thật cho agent trong bất kỳ trường hợp nào.
- Đổi key này bất cứ lúc nào (sửa `AGENT_API_KEY` trong `.env.local` +
  Hostinger + file cấu hình MCP ở trên) nếu nghi ngờ bị lộ — route tạo bill
  sẽ chặn ngay các request dùng key cũ.
- Không đưa file `claude_desktop_config.json` hay lệnh `claude mcp add` đã
  điền sẵn key thật cho người khác/đăng công khai.
