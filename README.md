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
  components/          Header, Footer, Hero, các section UI dùng chung
  lib/
    constants.ts       Thông tin công ty, chi nhánh, dịch vụ (chỉnh nội dung ở đây)
    sheets.ts          Đọc/ghi Google Sheet cho tra cứu vận đơn thật
public/
  falco-logo.png       Logo chính thức
scripts/
  import-kango-orders.ts   Nhập đơn hàng mới từ file Excel Kango vào Google Sheet
```

### Chỉnh nội dung nhanh

- Thông tin liên hệ, hotline, chi nhánh, danh sách dịch vụ: sửa trong
  [`src/lib/constants.ts`](src/lib/constants.ts).
- Dữ liệu tra cứu vận đơn lấy trực tiếp từ Google Sheet — xem mục
  "Tra cứu vận đơn qua Google Sheet" bên dưới.

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

## Tra cứu vận đơn qua Google Sheet

Trang "Tra cứu vận đơn" đọc dữ liệu **trực tiếp từ 1 Google Sheet** mỗi khi
khách tra cứu — không cần deploy lại code khi có đơn hàng mới, chỉ cần cập
nhật Sheet.

### 1. Tạo Google Sheet

Tạo 1 sheet tên `Orders` với các cột theo đúng thứ tự (dòng 1 là tiêu đề,
dữ liệu bắt đầu từ dòng 2):

| Cột | Tên | Ví dụ |
|---|---|---|
| A | Mã Falco | `FL250906001` |
| B | Số bill | `2026800812` |
| C | Tên khách hàng | (nội bộ) |
| D | SĐT khách hàng | (nội bộ) |
| E | Dịch vụ | `Quốc tế` |
| F | Nước đến | `Hoa Kỳ` |
| G | Hãng last-mile | `DHL` |
| H | Mã tracking last-mile | `DHL123456, DHL123457` (nhiều mã cách nhau bởi dấu phẩy nếu bill có nhiều kiện) |
| I | Ngày tiếp nhận | `05/09/2026` |
| J | Ngày xử lý tại kho | |
| K | Ngày bàn giao đối tác vận chuyển | |
| L | Ngày giao thành công | |
| M | Ghi chú nội bộ | |

Cột C, D, M **không bao giờ** hiển thị công khai trên web — chỉ đọc nội bộ.
Trạng thái hiển thị cho khách được suy ra tự động từ cột I–L (mốc gần nhất
có ngày = trạng thái hiện tại), nên **không cần** một cột "trạng thái"
riêng.

### 2. Tạo Service Account (Google Cloud) — làm 1 lần

1. Vào [console.cloud.google.com](https://console.cloud.google.com), tạo
   project mới (hoặc dùng project có sẵn).
2. Vào **APIs & Services → Library**, bật **Google Sheets API**.
3. Vào **APIs & Services → Credentials → Create Credentials → Service
   Account**, đặt tên bất kỳ (vd `falco-tracking`).
4. Mở service account vừa tạo → tab **Keys → Add Key → Create new key →
   JSON**. Tải file JSON về — file này chứa `client_email` và
   `private_key`.
5. Mở Google Sheet đã tạo ở bước 1 → **Share** → dán đúng `client_email`
   trong file JSON vào, chọn quyền **Editor**.

### 3. Cấu hình biến môi trường

Từ file JSON tải ở bước trên, điền vào `.env.local`:

```
GOOGLE_SERVICE_ACCOUNT_EMAIL=<client_email trong file JSON>
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY="<private_key trong file JSON, giữ nguyên \n>"
GOOGLE_SHEET_ID=<lấy từ URL Sheet, đoạn giữa /d/ và /edit>
GOOGLE_SHEET_RANGE=Orders!A2:M1000
```

Khi deploy lên Hostinger, nhập 4 biến này vào **Environment variables**
của Node.js App, giống cách làm với `SMTP_*`.

### 4. Nhập đơn hàng mới từ file Excel Kango xuất định kỳ

Kango xuất được file Excel chứa mã AWB (dùng làm "Số bill"). Mỗi khi có
file mới, chạy:

```bash
npm run import:kango -- /duong/dan/file-kango.xlsx
```

Script tự động: đọc file, bỏ qua các AWB đã có sẵn trong Sheet (khử trùng
lặp do file Kango xuất theo tháng), sinh Mã Falco mới cho AWB chưa có, rồi
thêm dòng mới vào Google Sheet. Nếu tên cột trong file Excel thật khác với
danh sách trong `COLUMN_ALIASES` ở đầu file
[`scripts/import-kango-orders.ts`](scripts/import-kango-orders.ts), thêm
tên cột thật vào danh sách alias tương ứng.

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
   `GOOGLE_SHEET_RANGE` (xem mục "Tra cứu vận đơn qua Google Sheet").
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
