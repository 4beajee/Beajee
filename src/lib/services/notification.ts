import { Resend } from "resend";
import { prisma } from "@/lib/db";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const FROM = "Gennety <legal@gennety.com>";
const BASE_URL = process.env.NEXTAUTH_URL ?? "http://localhost:3000";

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/* ── Shared email layout ── */

function emailLayout(body: string, settingsUrl?: string): string {
  const manageUrl = settingsUrl ?? `${BASE_URL}/settings`;
  return `
    <div style="font-family: system-ui, -apple-system, sans-serif; max-width: 500px; margin: 0 auto; padding: 40px 20px;">
      ${body}
      <div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #eee;">
        <p style="font-size: 12px; color: #888; margin: 0;">
          Gennety — AI-powered professional networking
        </p>
        <p style="font-size: 11px; color: #aaa; margin: 4px 0 0 0;">
          <a href="${manageUrl}" style="color: #aaa; text-decoration: underline;">Manage email preferences</a>
        </p>
      </div>
    </div>
  `;
}

function ctaButton(text: string, url: string): string {
  return `<a href="${escapeHtml(url)}" style="display: inline-block; padding: 12px 24px; background: #111; color: #fff; text-decoration: none; border-radius: 8px; font-weight: 600;">${escapeHtml(text)}</a>`;
}

/* ── Preference check ── */

interface NotificationPrefs {
  notifyAllEmails: boolean;
  notifyMatchProposals: boolean;
  notifyNewMessages: boolean;
  notifyFreshness: boolean;
}

export function shouldSend(prefs: NotificationPrefs, type: "match" | "message" | "freshness"): boolean {
  if (!prefs.notifyAllEmails) return false;
  switch (type) {
    case "match": return prefs.notifyMatchProposals;
    case "message": return prefs.notifyNewMessages;
    case "freshness": return prefs.notifyFreshness;
  }
}

/* ── Audit log ── */

async function logEmailSent(ownerId: string, type: string, referenceId: string, resendId?: string) {
  try {
    await prisma.emailNotification.create({
      data: { ownerId, type, referenceId, resendId },
    });
  } catch (err) {
    console.error("[notification] Failed to log email:", err);
  }
}

/* ── Send helper ── */

type SendResult = { sent: boolean; reason?: string; emailId?: string };

async function sendEmail(
  to: string,
  subject: string,
  html: string,
  auditInfo?: { ownerId: string; type: string; referenceId: string }
): Promise<SendResult> {
  if (!resend) {
    console.log(`[notification] Resend not configured — skipping email to ${to}`);
    return { sent: false, reason: "RESEND_API_KEY not set" };
  }

  try {
    const { data, error } = await resend.emails.send({ from: FROM, to, subject, html });

    if (error) {
      console.error(`[notification] Failed to send to ${to}:`, error);
      return { sent: false, reason: error.message };
    }

    if (auditInfo) {
      logEmailSent(auditInfo.ownerId, auditInfo.type, auditInfo.referenceId, data?.id).catch(() => {});
    }

    return { sent: true, emailId: data?.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[notification] Error sending to ${to}:`, message);
    return { sent: false, reason: message };
  }
}

/* ── 1. Password reset ── */

export async function sendPasswordResetEmail(email: string, resetUrl: string) {
  return sendEmail(
    email,
    "Reset your password — Gennety",
    emailLayout(`
      <h2 style="font-size: 20px; color: #111; margin-bottom: 8px;">Password reset request</h2>
      <p style="color: #555; line-height: 1.6; margin-bottom: 24px;">
        We received a request to reset the password for your Gennety account.
        Click the button below to choose a new password.
      </p>
      ${ctaButton("Reset password", resetUrl)}
      <p style="margin-top: 24px; color: #555; line-height: 1.6;">
        This link expires in 1 hour. If you didn't request this, you can safely ignore this email.
      </p>
    `)
  );
}

/* ── 2. Password changed ── */

export async function sendPasswordChangedEmail(email: string) {
  return sendEmail(
    email,
    "Your password has been changed — Gennety",
    emailLayout(`
      <h2 style="font-size: 20px; color: #111; margin-bottom: 8px;">Password changed</h2>
      <p style="color: #555; line-height: 1.6;">
        Your Gennety account password was successfully changed.
        If you did not make this change, please reset your password immediately or contact support.
      </p>
    `)
  );
}

/* ── 3. Match proposal ── */

interface MatchNotification {
  ownerEmail: string;
  ownerName: string | null;
  otherPersonName: string | null;
  framing: string;
  matchId: string;
  ownerId: string;
}

export async function sendMatchProposalEmail(notification: MatchNotification) {
  const notifyUrl = `${BASE_URL}/notify?ownerId=${notification.ownerId}`;
  const otherName = escapeHtml(notification.otherPersonName ?? "a new connection");

  return sendEmail(
    notification.ownerEmail,
    `Your agent found someone: ${otherName}`,
    emailLayout(`
      <h2 style="font-size: 20px; color: #111; margin-bottom: 24px;">New introduction proposal</h2>
      <div style="background: #f7f7f7; border-left: 3px solid #111; padding: 16px; border-radius: 8px; margin-bottom: 24px;">
        <p style="margin: 0; color: #333; line-height: 1.6;">
          ${escapeHtml(notification.framing)}
        </p>
      </div>
      ${ctaButton("Review proposal", notifyUrl)}
      <p style="margin-top: 16px; font-size: 12px; color: #888;">
        Sent by your agent via Gennety
      </p>
    `),
    { ownerId: notification.ownerId, type: "MATCH_PROPOSAL", referenceId: notification.matchId }
  );
}

/* ── 4. Match confirmed — both owners said yes, chat is open ── */

interface MatchConfirmedNotification {
  ownerEmail: string;
  ownerName: string | null;
  otherPersonName: string | null;
  overlapSummary: string;
  matchId: string;
  ownerId: string;
}

export async function sendMatchConfirmedEmail(notification: MatchConfirmedNotification) {
  const chatUrl = `${BASE_URL}/chat/${notification.matchId}`;
  const otherName = escapeHtml(notification.otherPersonName ?? "your match");

  return sendEmail(
    notification.ownerEmail,
    `It's a match! Start chatting with ${otherName}`,
    emailLayout(`
      <h2 style="font-size: 20px; color: #111; margin-bottom: 8px;">You're connected!</h2>
      <p style="color: #555; line-height: 1.6; margin-bottom: 16px;">
        Both you and <strong>${otherName}</strong> confirmed the introduction. Your chat is now open.
      </p>
      <div style="background: #f7f7f7; border-left: 3px solid #10b981; padding: 16px; border-radius: 8px; margin-bottom: 24px;">
        <p style="margin: 0; color: #333; line-height: 1.6; font-size: 14px;">
          ${escapeHtml(notification.overlapSummary)}
        </p>
      </div>
      ${ctaButton("Open chat", chatUrl)}
    `),
    { ownerId: notification.ownerId, type: "MATCH_CONFIRMED", referenceId: notification.matchId }
  );
}

/* ── 5. New messages in chat (batched by cron) ── */

interface NewMessagesNotification {
  ownerEmail: string;
  ownerName: string | null;
  senderName: string | null;
  messageCount: number;
  lastMessagePreview: string;
  matchId: string;
  ownerId: string;
}

export async function sendNewMessagesEmail(notification: NewMessagesNotification) {
  const chatUrl = `${BASE_URL}/chat/${notification.matchId}`;
  const senderName = escapeHtml(notification.senderName ?? "Someone");
  const preview = escapeHtml(
    notification.lastMessagePreview.length > 200
      ? notification.lastMessagePreview.slice(0, 200) + "..."
      : notification.lastMessagePreview
  );

  const countText =
    notification.messageCount === 1
      ? "sent you a message"
      : `sent you ${notification.messageCount} messages`;

  return sendEmail(
    notification.ownerEmail,
    `${senderName} ${countText} on Gennety`,
    emailLayout(`
      <h2 style="font-size: 20px; color: #111; margin-bottom: 8px;">New message${notification.messageCount > 1 ? "s" : ""}</h2>
      <p style="color: #555; line-height: 1.6; margin-bottom: 16px;">
        <strong>${senderName}</strong> ${countText}:
      </p>
      <div style="background: #f7f7f7; padding: 16px; border-radius: 8px; margin-bottom: 24px;">
        <p style="margin: 0; color: #333; line-height: 1.6; font-size: 14px; font-style: italic;">
          "${preview}"
        </p>
      </div>
      ${ctaButton("Reply", chatUrl)}
    `),
    { ownerId: notification.ownerId, type: "NEW_MESSAGE", referenceId: notification.matchId }
  );
}

/* ── 6. Freshness warning — context getting stale ── */

interface FreshnessNotification {
  ownerEmail: string;
  ownerName: string | null;
  newState: "AGING" | "STALE";
  daysSinceUpdate: number;
  ownerId: string;
  agentId: string;
}

export async function sendFreshnessWarningEmail(notification: FreshnessNotification) {
  const settingsUrl = `${BASE_URL}/settings`;
  const greeting = notification.ownerName
    ? `Hi ${escapeHtml(notification.ownerName)},`
    : "Hi,";

  const stateText =
    notification.newState === "AGING"
      ? "Your context is getting outdated"
      : "Your context is stale — your agent has been removed from search";

  const actionText =
    notification.newState === "AGING"
      ? "Update your context to keep your agent active and finding relevant matches."
      : "Your agent can no longer find or be found by others. Update your context to reactivate it.";

  return sendEmail(
    notification.ownerEmail,
    notification.newState === "AGING"
      ? "Your Gennety profile needs a refresh"
      : "Your Gennety agent has been paused",
    emailLayout(`
      <h2 style="font-size: 20px; color: #111; margin-bottom: 8px;">${stateText}</h2>
      <p style="color: #555; line-height: 1.6; margin-bottom: 16px;">
        ${greeting} it's been ${notification.daysSinceUpdate} days since your last context update.
      </p>
      <p style="color: #555; line-height: 1.6; margin-bottom: 24px;">
        ${actionText}
      </p>
      ${ctaButton("Update context", settingsUrl)}
    `),
    { ownerId: notification.ownerId, type: "FRESHNESS_WARNING", referenceId: notification.agentId }
  );
}
