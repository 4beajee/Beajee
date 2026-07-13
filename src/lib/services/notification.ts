import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const FROM = "Beajee <legal@beajee.com>";
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
          Beajee — AI-powered professional networking
        </p>
        <p style="font-size: 11px; color: #aaa; margin: 4px 0 0 0;">
          <a href="${manageUrl}" style="color: #aaa; text-decoration: underline;">Account settings</a>
        </p>
      </div>
    </div>
  `;
}

function ctaButton(text: string, url: string): string {
  return `<a href="${escapeHtml(url)}" style="display: inline-block; padding: 12px 24px; background: #111; color: #fff; text-decoration: none; border-radius: 8px; font-weight: 600;">${escapeHtml(text)}</a>`;
}

/* ── Send helper ── */

type SendResult = { sent: boolean; reason?: string; emailId?: string };

async function sendEmail(to: string, subject: string, html: string): Promise<SendResult> {
  if (!resend) {
    console.log("[notification] Resend not configured — skipping email delivery");
    return { sent: false, reason: "RESEND_API_KEY not set" };
  }

  try {
    const { data, error } = await resend.emails.send({ from: FROM, to, subject, html });

    if (error) {
      console.error("[notification] Email provider rejected delivery:", error);
      return { sent: false, reason: error.message };
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
    "Reset your password — Beajee",
    emailLayout(`
      <h2 style="font-size: 20px; color: #111; margin-bottom: 8px;">Password reset request</h2>
      <p style="color: #555; line-height: 1.6; margin-bottom: 24px;">
        We received a request to reset the password for your Beajee account.
        Click the button below to choose a new password.
      </p>
      ${ctaButton("Reset password", resetUrl)}
      <p style="margin-top: 24px; color: #555; line-height: 1.6;">
        This link expires in 1 hour. If you didn't request this, you can safely ignore this email.
      </p>
    `)
  );
}

export async function sendEmailVerificationEmail(email: string, verificationUrl: string) {
  return sendEmail(
    email,
    "Verify your email — Beajee",
    emailLayout(`
      <h2 style="font-size: 20px; color: #111; margin-bottom: 8px;">Verify your email</h2>
      <p style="color: #555; line-height: 1.6; margin-bottom: 24px;">
        Confirm this email address before using a password to sign in to Beajee.
      </p>
      ${ctaButton("Verify email", verificationUrl)}
      <p style="margin-top: 24px; color: #555; line-height: 1.6;">
        This link expires in 24 hours. If you did not create this account, ignore this email.
      </p>
    `)
  );
}

/* ── 2. Password changed ── */

export async function sendPasswordChangedEmail(email: string) {
  return sendEmail(
    email,
    "Your password has been changed — Beajee",
    emailLayout(`
      <h2 style="font-size: 20px; color: #111; margin-bottom: 8px;">Password changed</h2>
      <p style="color: #555; line-height: 1.6;">
        Your Beajee account password was successfully changed.
        If you did not make this change, please reset your password immediately or contact support.
      </p>
    `)
  );
}

/* ── 3. Operator reports ── */

export async function sendOperatorReportEmail(
  email: string,
  subject: string,
  reportText: string
) {
  return sendEmail(
    email,
    subject,
    emailLayout(`
      <h2 style="font-size: 20px; color: #111; margin-bottom: 8px;">OpenClaw operator report</h2>
      <pre style="white-space: pre-wrap; font-family: system-ui, -apple-system, sans-serif; color: #333; line-height: 1.55; background: #f7f7f7; border-radius: 8px; padding: 16px;">${escapeHtml(reportText)}</pre>
    `)
  );
}
