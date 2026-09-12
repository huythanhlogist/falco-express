import { FALCO_LOGO_DATA_URI } from "./falco-logo-data-uri";

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Không tải được ảnh"));
    img.src = src;
  });
}

/**
 * html-to-image chụp cả khối DOM bằng cách dựng thành 1 SVG <foreignObject>
 * rồi vẽ SVG đó lên canvas. Đã thử 3 cách nhúng logo khác nhau (thẻ <img>
 * trỏ file, <img> base64, CSS background-image base64) — cả 3 đều bị
 * Safari/iOS bỏ qua không vẽ logo vào ảnh xuất ra dù logo vẫn hiện bình
 * thường trên màn hình (đã xác nhận lỗi xảy ra thật kể cả sau khi xoá sạch
 * cache Safari, không phải do xem bản cũ) — nên không còn tin cậy được
 * đường nào trong 3 đường trên nữa.
 *
 * Cách chắc chắn nhất: kệ cho html-to-image chụp thẻ (logo mất cũng
 * không sao), rồi TỰ vẽ đè logo lên ảnh PNG kết quả bằng Canvas 2D API —
 * `drawImage` thẳng lên canvas là thao tác nền tảng nhất của mọi trình
 * duyệt, không đi qua SVG/foreignObject nên không dính lỗi trên.
 *
 * Vị trí/kích thước logo được đo TRỰC TIẾP từ DOM thật (`getBoundingClientRect`)
 * tại thời điểm bấm tải, không hard-code toạ độ — để không bị lệch nếu sau
 * này chỉnh lại bố cục header của thẻ.
 */
export async function compositeFalcoLogo(
  baseDataUrl: string,
  cardEl: HTMLElement,
  logoEl: HTMLElement,
  // "circle" = khung tròn nền trắng đè lên nền màu (thẻ báo giá gradient).
  // "rect" = vẽ thẳng logo giữ nguyên tỉ lệ, không khung/không nền — dùng
  // cho DBN vì nền đã là trang giấy trắng, thêm vòng tròn trắng lại thành
  // 1 lớp viền thừa nhìn như lỗi (đã bị báo lại thật).
  shape: "circle" | "rect" = "circle"
): Promise<string> {
  const [baseImg, logoImg] = await Promise.all([
    loadImage(baseDataUrl),
    loadImage(FALCO_LOGO_DATA_URI),
  ]);

  const cardRect = cardEl.getBoundingClientRect();
  const logoRect = logoEl.getBoundingClientRect();
  if (cardRect.width === 0) return baseDataUrl;
  const scale = baseImg.width / cardRect.width;

  const x = (logoRect.left - cardRect.left) * scale;
  const y = (logoRect.top - cardRect.top) * scale;
  const size = logoRect.width * scale;

  const canvas = document.createElement("canvas");
  canvas.width = baseImg.width;
  canvas.height = baseImg.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return baseDataUrl;

  ctx.drawImage(baseImg, 0, 0);

  if (shape === "rect") {
    // Giữ đúng tỉ lệ ảnh gốc (không ép vuông làm méo logo), canh giữa
    // trong đúng khung đo được từ DOM.
    const logoAspect = logoImg.width / logoImg.height;
    const drawW = logoAspect >= 1 ? size : size * logoAspect;
    const drawH = logoAspect >= 1 ? size / logoAspect : size;
    ctx.drawImage(logoImg, x + (size - drawW) / 2, y + (size - drawH) / 2, drawW, drawH);
    return canvas.toDataURL("image/png");
  }

  // Vòng nền trắng tròn quanh logo + logo bo tròn đè lên, đúng phong cách cũ.
  ctx.save();
  ctx.beginPath();
  ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.clip();
  const inset = size * 0.06;
  ctx.drawImage(logoImg, x + inset, y + inset, size - inset * 2, size - inset * 2);
  ctx.restore();

  return canvas.toDataURL("image/png");
}
