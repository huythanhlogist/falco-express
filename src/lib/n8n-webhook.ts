export type KangoBillSentWebhookPayload = {
  event: "kango_bill_sent";
  billId: number;
  kangoBillId: string;
  hawbs: string[];
  receiverName: string;
  sentBy: string;
};

/**
 * Thông báo sang n8n ngay sau khi bill đã gửi Kango thành công.
 * Nếu chưa đặt N8N_BILL_SENT_WEBHOOK_URL thì bỏ qua.
 * Mọi lỗi mạng/timeout/HTTP chỉ ghi console.error — tuyệt đối không throw
 * để không làm ảnh hưởng phản hồi của API gửi bill.
 */
export async function notifyN8nKangoBillSent(
  data: Omit<KangoBillSentWebhookPayload, "event">
): Promise<void> {
  const webhookUrl = process.env.N8N_BILL_SENT_WEBHOOK_URL?.trim();
  if (!webhookUrl) return;

  const payload: KangoBillSentWebhookPayload = {
    event: "kango_bill_sent",
    billId: data.billId,
    kangoBillId: data.kangoBillId,
    hawbs: data.hawbs,
    receiverName: data.receiverName,
    sentBy: data.sentBy,
  };

  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // n8n kiểm tra bằng credential "Falco Agent Key" (header x-agent-api-key)
        "x-agent-api-key": process.env.AGENT_API_KEY ?? "",
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error(
        `[n8n-webhook] Gửi kango_bill_sent cho bill #${data.billId} nhận HTTP ${res.status}: ${text.slice(0, 300)}`
      );
    }
  } catch (err) {
    console.error(`[n8n-webhook] Lỗi khi gọi webhook cho bill #${data.billId}:`, err);
  }
}
