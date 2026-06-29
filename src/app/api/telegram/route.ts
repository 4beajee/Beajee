// Backward-compatible webhook alias. Production may still point Telegram at
// /api/telegram; keep it on the same personal-user behavior as /webhook.
export { POST } from "@/app/api/telegram/webhook/route";
