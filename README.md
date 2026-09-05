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
    tracking-demo.ts   Dữ liệu demo cho trang tra cứu vận đơn
public/
  falco-logo.png       Logo chính thức
```

### Chỉnh nội dung nhanh

- Thông tin liên hệ, hotline, chi nhánh, danh sách dịch vụ: sửa trong
  [`src/lib/constants.ts`](src/lib/constants.ts).
- Trang tra cứu vận đơn hiện là **bản demo** với dữ liệu mẫu trong
  [`src/lib/tracking-demo.ts`](src/lib/tracking-demo.ts). Khi có hệ thống quản
  lý vận đơn thật, thay `TrackingLookup` component để gọi API thật thay vì
  tra cứu trong object tĩnh.

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
   `CONTACT_TO_EMAIL`.
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
