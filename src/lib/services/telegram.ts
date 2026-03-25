const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? "";
const CHAT_ID = process.env.TELEGRAM_CHAT_ID ?? "";

interface TelegramResponse {
  ok: boolean;
  description?: string;
}

export async function sendTelegramNotification(
  text: string
): Promise<{ sent: boolean; error?: string }> {
  if (!BOT_TOKEN || !CHAT_ID) {
    console.warn("[telegram] BOT_TOKEN or CHAT_ID not configured — skipping");
    return { sent: false, error: "Telegram not configured" };
  }

  try {
    const res = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: CHAT_ID,
          text,
          parse_mode: "HTML",
          disable_web_page_preview: true,
        }),
      }
    );

    const data: TelegramResponse = await res.json();

    if (!data.ok) {
      console.error("[telegram] API error:", data.description);
      return { sent: false, error: data.description };
    }

    return { sent: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[telegram] Network error:", message);
    return { sent: false, error: message };
  }
}
