# Falco Express Logistics — Website

Website chính thức của **Falco Express Logistics**, xây dựng bằng Next.js 16
(App Router, TypeScript, Tailwind CSS).

## Yêu cầu hệ thống

- Node.js 18.18+ (khuyến nghị 20 LTS trở lên)
- npm 10+

## Chạy dự án ở local

```bash
npm install
npm run dev
```

Mở http://localhost:3000

## Cấu trúc thư mục

```
src/
  app/                 Các trang (App Router): /, /gioi-thieu, /dich-vu,
                       /tra-cuu-van-don, /lien-he, /api/contact
                       /admin/*             Trang quản trị (đăng nhập bắt buộc)
                       /api/admin/*         API cho trang quản trị
  components/          Header, Footer, Hero, các section UI dùng chung
    admin/             UI riêng cho trang quản trị (nav, bảng đơn, sửa SEO)
  lib/
    constants.ts       Thông tin công ty, chi nhánh, dịch vụ (chỉnh nội dung ở đây)
    db.ts              Kết nối MySQL — nguồn dữ liệu chính cho đơn hàng + admin
    kango.ts           Gọi API tracking chính thức của Kango
    sheets.ts          Ghi mirror sang Google Sheet (chỉ để tải Excel, không đọc lại)
    auth.ts            Đăng nhập admin: hash mật khẩu, ký/xác thực session
    seo.ts             Đọc override title/description từ bảng seo_settings
  proxy.ts             Middleware: chặn /admin/* và /api/admin/* khi chưa đăng nhập
public/
  falco-logo.png       Logo chính thức
scripts/
  import-kango-orders.ts   Nhập đơn hàng mới từ file Excel Kango vào MySQL (+ mirror Sheet)
```

### Chỉnh nội dung nhanh

- Thông tin liên hệ, hotline, chi nhánh, danh sách dịch vụ: sửa trong
  [`src/lib/constants.ts`](src/lib/constants.ts).
- Dữ liệu tra cứu vận đơn: mã Falco + AWB lấy từ **MySQL**, trạng thái/hành
  trình thật lấy **trực tiếp từ API Kango** mỗi lần khách tra cứu — xem mục
  "Tra cứu vận đơn: MySQL + API Kango" bên dưới.
- Quản lý đơn hàng, trạng thái thanh toán, SEO từng trang: đăng nhập
  `/admin` — xem mục "Trang quản trị (admin)" bên dưới.

## Form liên hệ (gửi email)

API `/api/contact` dùng `nodemailer` để gửi email khi có khách điền form.
Nếu chưa cấu hình biến môi trường SMTP, hệ thống vẫn nhận request thành công
nhưng chỉ ghi log ra console (không gửi được email) — xem
[`.env.example`](.env.example).

Copy `.env.example` thành `.env.local` và điền thông tin SMTP thật:

```bash
cp .env.example .env.local
```

```
SMTP_HOST=smtp.hostinger.com
SMTP_PORT=465
SMTP_USER=info@falcoexpress.com
SMTP_PASS=mat-khau-email
CONTACT_TO_EMAIL=info@falcoexpress.com
```

> Hostinger cung cấp SMTP cho email theo tên miền trong hPanel → Email
> Accounts. Dùng đúng host/port của Hostinger cho tên miền của bạn.

## Tra cứu vận đơn: MySQL + API Kango

Kiến trúc hiện tại:

1. **MySQL** (`orders`, `order_parcels`) lưu **Mã Falco ↔ AWB** — nguồn
   dữ liệu chính, web đọc trực tiếp từ đây.
2. Khi khách tra cứu, `/api/tracking` lấy AWB từ MySQL rồi gọi **thẳng API
   tracking chính thức của Kango** (`src/lib/kango.ts`) để lấy hành trình,
   trạng thái và link tra cứu hãng last-mile **thật 100%** — không còn
   suy đoán hãng vận chuyển như trước.
3. **Google Sheet chỉ còn là bản mirror**: script nhập liệu vẫn ghi thêm
   vào Sheet sau khi ghi MySQL, để bạn tải file Excel tổng hợp khi cần —
   **web không đọc lại Sheet nữa**.

### 1. Lấy API key Kango

Đăng nhập kango-post.com → phần thông tin tài khoản → copy API key.

### 2. Tạo MySQL trên Hostinger

hPanel → Website → Cơ sở dữ liệu → tạo 1 database + user mới (khuyến nghị
tạo user riêng cho web, không dùng chung với user khác). Sau đó chạy 1 lần
để tạo bảng:

```bash
npx tsx -e "
import { config } from 'dotenv'; config({ path: '.env.local' });
import mysql from 'mysql2/promise';
const conn = await mysql.createConnection({
  host: process.env.DB_HOST, port: Number(process.env.DB_PORT),
  user: process.env.DB_USER, password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});
await conn.query(\`CREATE TABLE IF NOT EXISTS orders (
  id INT AUTO_INCREMENT PRIMARY KEY, falco_code VARCHAR(20) UNIQUE NOT NULL,
  awb VARCHAR(20) NOT NULL, recipient_name VARCHAR(255), recipient_phone VARCHAR(50),
  service VARCHAR(100), destination VARCHAR(255), received_date DATE,
  payment_status ENUM('unpaid','paid') NOT NULL DEFAULT 'unpaid',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP)\`);
await conn.query(\`CREATE TABLE IF NOT EXISTS order_parcels (
  id INT AUTO_INCREMENT PRIMARY KEY, order_id INT NOT NULL, hawb VARCHAR(20),
  tracking_code VARCHAR(50) NOT NULL,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE)\`);
console.log('done'); await conn.end();
"
```

### 3. Cấu hình biến môi trường

```
KANGO_API_KEY=<api key từ kango-post.com>
KANGO_API_URL=https://kango-post.com/api/get-tracking

DB_HOST=localhost   # dùng "localhost" khi app chạy trên cùng server Hostinger với MySQL
DB_PORT=3306
DB_USER=<user MySQL>
DB_PASSWORD=<mật khẩu MySQL>
DB_NAME=<tên database>
```

> Nếu kết nối MySQL từ máy ngoài Hostinger (vd để chạy `npm run import:kango`
> từ máy cá nhân), cần dùng hostname/IP ở hPanel → Cơ sở dữ liệu → MySQL từ
> xa và thêm IP máy đó vào danh sách cho phép — xem `DB_HOST` tương ứng.

### 4. Nhập đơn hàng mới từ file Excel Kango ("ListShipment") xuất định kỳ

Mỗi khi có file mới từ Kango, chạy:

```bash
npm run import:kango -- /duong/dan/ListShipment.xlsx
```

Script tự động: đọc file theo đúng cấu trúc cột thật của Kango (AWB,
TRACKING NUMBER, SERVICE, DATE, CONTACT, CITY, COUNTRY, TELEPHONE — xem vị
trí cột trong `COL` ở đầu file
[`scripts/import-kango-orders.ts`](scripts/import-kango-orders.ts)), gộp
các dòng kiện cùng một bill (dòng kiện sau để trống ô AWB), bỏ qua AWB đã
có sẵn trong MySQL (khử trùng lặp do file Kango xuất theo tháng), sinh Mã
Falco mới cho bill chưa có, ghi vào **MySQL** rồi mirror sang **Google
Sheet**. Nếu Kango đổi cấu trúc cột, chỉ cần sửa lại các số trong object
`COL`.

## Trang quản trị (admin)

Truy cập `https://falcoexpress.com/admin` (chuyển hướng tới `/admin/login`
nếu chưa đăng nhập). Gồm:

- **Đơn hàng** (`/admin/orders`): danh sách toàn bộ đơn từ MySQL (sắp xếp
  theo ngày nhận, mới nhất trước), lọc theo tháng và theo **trạng thái thu
  tiền** (`unpaid` Chưa thu / `collected_by_staff` Thu hộ / `paid` Đã thu —
  chỉ đánh dấu thủ công, không có cổng thanh toán), tìm theo mã Falco/AWB/
  tên/SĐT. Mỗi đơn có thể **sửa** (mọi trường + danh sách mã tracking) hoặc
  **xoá** trực tiếp trên trang.
- **Kế toán** (`/admin/ke-toan`): tổng kết Thu/Chi/Lãi-lỗ theo tuần hiện tại
  và theo tháng (có bộ lọc tháng) — Thu gộp cả "Đã thu" và "Thu hộ", Chi gồm
  cột `cost` của từng đơn cộng bảng chi phí phát sinh chung. Danh sách đơn
  cho nhập tay **Thu** (`orders.amount`) và **Chi** (`orders.cost`) từng đơn,
  tự tính Lãi/lỗ mỗi dòng, lọc theo trạng thái thu. Bảng **Chi phí phát
  sinh** (bảng `expenses`) nhập tay chi phí chung, sửa/xoá được từng dòng.
  Mỗi lần sửa Thu/Chi/trạng thái thu, admin **ghi ngay** (đồng bộ, trong
  cùng request PATCH — không phải job nền) sang tab **"Kế toán"** trong
  CÙNG file Google Sheet đang dùng cho tab "Orders" (`src/lib/sheets.ts` →
  `upsertAccountingRow`, tự tạo tab + tiêu đề nếu chưa có). Ghi theo kiểu
  **upsert theo mã Falco** (tìm đúng dòng để cập nhật, không append trùng)
  vì Thu/Chi có thể sửa nhiều lần — khác `appendOrders` chỉ ghi 1 lần lúc
  nhập đơn mới.
- **Upload tài liệu** (`/admin/upload`): nhân viên tự upload file Excel
  "ListShipment" Kango xuất ra ngay trên web (không cần chạy CLI nữa). Bill
  mới được thêm vào (khử trùng theo AWB); bill AWB đã có sẵn được **cập nhật
  khi file mới có giá trị khác** — vừa điền vào chỗ đang trống (vd mã
  tracking chưa có ở lần trước), vừa cập nhật khi thông tin thực sự thay đổi
  (vd đổi tên/SĐT) — ô nào file mới để trống thì giữ nguyên dữ liệu cũ, không
  xoá mất. Logic đọc/gộp/merge dùng chung với `scripts/import-kango-orders.ts`
  qua `src/lib/kango-import.ts`. Có bảng **lịch sử upload** (bảng
  `upload_history`) hiện 20 lần gần nhất — chỉ lưu kết quả xử lý (ai upload,
  file gì, số bill mới/cập nhật/không đổi, lỗi), KHÔNG lưu nội dung file gốc
  để tránh phình dung lượng DB.
- **SEO** (`/admin/seo`): sửa tiêu đề (title) và mô tả (description) cho
  từng trang công khai. Để trống ô nào thì trang đó dùng nội dung mặc định
  có sẵn trong code. Lưu vào bảng `seo_settings`, các trang công khai đọc
  lại sau tối đa 5 phút (`revalidate = 300`).
- **Search Console** (`/admin/search-console`): khung hiển thị báo cáo —
  hiện là placeholder, sẽ có số liệu thật khi làm Giai đoạn 3 (kết nối
  Google Search Console).
- **Nhân viên** (`/admin/staff`): mỗi tài khoản có `role` là `owner` (chủ
  tài khoản) hoặc `staff` (nhân viên). Nhân viên có toàn quyền xem/sửa mọi
  mục trên — chỉ riêng việc **tạo hoặc xoá tài khoản khác** là giới hạn cho
  `owner` (cả UI lẫn API `/api/admin/staff` đều kiểm tra `role` từ JWT
  session, không chỉ ẩn nút trên giao diện).

### Thiết lập lần đầu

1. **Tạo bảng** (1 lần, chạy trên MySQL đã cấu hình ở `DB_*`):

   ```bash
   npx tsx -e "
   import { config } from 'dotenv'; config({ path: '.env.local' });
   import mysql from 'mysql2/promise';
   const conn = await mysql.createConnection({
     host: process.env.DB_HOST, port: Number(process.env.DB_PORT),
     user: process.env.DB_USER, password: process.env.DB_PASSWORD,
     database: process.env.DB_NAME,
   });
   await conn.query(\`CREATE TABLE IF NOT EXISTS admin_users (
     id INT AUTO_INCREMENT PRIMARY KEY, email VARCHAR(255) UNIQUE NOT NULL,
     password_hash VARCHAR(255) NOT NULL,
     role ENUM('owner','staff') NOT NULL DEFAULT 'staff',
     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)\`);
   await conn.query(\`CREATE TABLE IF NOT EXISTS seo_settings (
     page_path VARCHAR(255) PRIMARY KEY, meta_title VARCHAR(255),
     meta_description VARCHAR(500),
     updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP)\`);
   await conn.query(\`ALTER TABLE orders MODIFY COLUMN payment_status
     ENUM('unpaid','collected_by_staff','paid') NOT NULL DEFAULT 'unpaid'\`);
   await conn.query(\`ALTER TABLE orders ADD COLUMN IF NOT EXISTS amount DECIMAL(12,2) NULL\`);
   await conn.query(\`ALTER TABLE orders ADD COLUMN IF NOT EXISTS cost DECIMAL(12,2) NULL\`);
   await conn.query(\`CREATE TABLE IF NOT EXISTS expenses (
     id INT AUTO_INCREMENT PRIMARY KEY, description VARCHAR(500) NOT NULL,
     amount DECIMAL(12,2) NOT NULL, expense_date DATETIME NOT NULL,
     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
     updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP)\`);
   await conn.query(\`CREATE TABLE IF NOT EXISTS upload_history (
     id INT AUTO_INCREMENT PRIMARY KEY, file_name VARCHAR(255) NOT NULL,
     uploaded_by VARCHAR(255) NOT NULL, total_bills INT NOT NULL DEFAULT 0,
     inserted INT NOT NULL DEFAULT 0, updated INT NOT NULL DEFAULT 0,
     unchanged INT NOT NULL DEFAULT 0, errors TEXT NULL,
     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)\`);
   console.log('done'); await conn.end();
   "
   ```

   (Script này dùng cú pháp `-e` với top-level `await` — nếu gặp lỗi
   "Top-level await is currently not supported", lưu thành file `.ts` tạm
   trong thư mục dự án rồi chạy `npx tsx <file>.ts`, xem cách làm tương tự
   trong lịch sử phát triển dự án.)

2. **Đặt `ADMIN_SESSION_SECRET`** trong `.env.local` (và trong Environment
   variables trên hPanel) — chuỗi ngẫu nhiên dùng để ký cookie đăng nhập:

   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

3. **Tạo tài khoản admin đầu tiên** (đổi email/mật khẩu theo ý bạn):

   ```bash
   npx tsx -e "
   import { config } from 'dotenv'; config({ path: '.env.local' });
   import mysql from 'mysql2/promise';
   import bcrypt from 'bcryptjs';
   const conn = await mysql.createConnection({
     host: process.env.DB_HOST, port: Number(process.env.DB_PORT),
     user: process.env.DB_USER, password: process.env.DB_PASSWORD,
     database: process.env.DB_NAME,
   });
   const hash = await bcrypt.hash('MAT_KHAU_MOI', 12);
   await conn.query(
     \"INSERT INTO admin_users (email, password_hash, role) VALUES (?, ?, 'owner') ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash)\",
     ['ban@falcoexpress.com', hash]
   );
   console.log('done'); await conn.end();
   "
   ```

   Tài khoản đầu tiên nên là `owner` (như trên) — đây là tài khoản duy nhất
   có thể tạo/xoá các tài khoản nhân viên khác trong `/admin/staff` sau này.

Middleware xác thực nằm ở [`src/proxy.ts`](src/proxy.ts) (Next.js 16 đổi
tên quy ước từ `middleware.ts` sang `proxy.ts`), chặn toàn bộ `/admin/*` và
`/api/admin/*` trừ trang đăng nhập, dựa trên cookie session đã ký (JWT,
thư viện `jose`) — đổi `ADMIN_SESSION_SECRET` sẽ đăng xuất mọi phiên đang
mở.

## Build production

```bash
npm run build
npm run start
```

`next.config.js` đã bật `output: "standalone"` — khi build xong, Next.js tạo
sẵn một server Node.js gọn nhẹ trong `.next/standalone`, phù hợp để chạy trên
Hostinger mà không cần cài lại `node_modules` đầy đủ trên server.

## Hướng dẫn deploy lên Hostinger (Node.js hosting)

1. **Kiểm tra gói hosting**: cần gói Hostinger có hỗ trợ **Node.js**
   (Business/Premium hosting hoặc VPS). Vào **hPanel → Website → Advanced →
   Node.js** để tạo ứng dụng Node.js mới.
2. **Tạo Node.js App** trong hPanel:
   - Chọn phiên bản Node.js 20.x
   - Application root: thư mục chứa mã nguồn (ví dụ `falcoexpress.com`)
   - Application startup file: `server.js` (xem file mẫu bên dưới) hoặc
     `node_modules/.bin/next start` tuỳ giao diện Hostinger hỗ trợ
3. **Đưa code lên server**: qua Git (khuyến nghị) hoặc File Manager/FTP:
   - Kết nối repo GitHub trong hPanel (Git) rồi deploy, hoặc
   - `git clone` thủ công qua SSH nếu gói hỗ trợ SSH
4. **Cài dependencies & build** (qua terminal SSH của Hostinger):
   ```bash
   npm install
   npm run build
   ```
5. **Cấu hình biến môi trường** trong hPanel → Node.js → Environment
   variables: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`,
   `CONTACT_TO_EMAIL`, `GOOGLE_SERVICE_ACCOUNT_EMAIL`,
   `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`, `GOOGLE_SHEET_ID`,
   `GOOGLE_SHEET_RANGE`, `KANGO_API_KEY`, `KANGO_API_URL`, `DB_HOST`,
   `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` (xem mục "Tra cứu vận đơn:
   MySQL + API Kango"), `ADMIN_SESSION_SECRET` (xem mục "Trang quản trị
   (admin)").
6. **Khởi động ứng dụng**: dùng nút Restart trong hPanel Node.js, hoặc trỏ
   startup file tới `server.js` dưới đây nếu Hostinger yêu cầu một entry
   point cố định:

   ```js
   // server.js — dùng khi Hostinger yêu cầu một file khởi động cố định
   const { createServer } = require("http");
   const next = require("next");

   const app = next({ dev: false });
   const handle = app.getRequestHandler();
   const port = process.env.PORT || 3000;

   app.prepare().then(() => {
     createServer((req, res) => handle(req, res)).listen(port);
   });
   ```

7. **Gắn tên miền**: trỏ domain/subdomain trong hPanel tới ứng dụng Node.js
   vừa tạo, bật SSL miễn phí (Let's Encrypt) trong hPanel → SSL.

## Đưa code lên GitHub

```bash
git init
git add .
git commit -m "Initial commit: Falco Express website"
git branch -M main
git remote add origin <URL_REPO_GITHUB_CUA_BAN>
git push -u origin main
```

## SEO

- `src/app/sitemap.ts` và `src/app/robots.ts` tự sinh `/sitemap.xml` và
  `/robots.txt`. Cập nhật domain thật trong hai file này và trong
  `metadataBase` tại `src/app/layout.tsx` khi có tên miền chính thức.
