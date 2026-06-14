/**
 * Transactional email dispatch.
 *
 * In production wire this to Resend/SES/Postmark via `EMAIL_API_KEY`. Until a
 * provider is configured it logs the message (so verification/reset links are
 * visible in server logs during development) and never throws into the caller.
 */
export interface MailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export function appUrl(path = ''): string {
  const base = process.env.APP_URL ?? process.env.NEXTAUTH_URL ?? 'http://localhost:3000';
  return `${base.replace(/\/$/, '')}${path}`;
}

export async function sendMail(msg: MailMessage): Promise<void> {
  const apiKey = process.env.EMAIL_API_KEY;
  if (!apiKey) {
    console.info(`[mail:dev] → ${msg.to} :: ${msg.subject}\n${msg.text}`);
    return;
  }
  try {
    // Resend-compatible HTTP API.
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM ?? 'TradePilot AI <noreply@tradepilot.ai>',
        to: msg.to,
        subject: msg.subject,
        html: msg.html,
        text: msg.text,
      }),
    });
  } catch (err) {
    console.error('[mail] send failed', err);
  }
}

export function verificationEmail(to: string, link: string): MailMessage {
  return {
    to,
    subject: 'Verify your TradePilot AI email',
    text: `Welcome to TradePilot AI. Verify your email: ${link}`,
    html: `<h2>Welcome to TradePilot AI</h2><p>Confirm your email to activate alerts and signals.</p><p><a href="${link}">Verify my email</a></p><p>This link expires in 24 hours.</p>`,
  };
}

export function resetEmail(to: string, link: string): MailMessage {
  return {
    to,
    subject: 'Reset your TradePilot AI password',
    text: `Reset your password: ${link}`,
    html: `<h2>Password reset</h2><p>Click below to choose a new password.</p><p><a href="${link}">Reset password</a></p><p>This link expires in 1 hour. If you didn't request this, ignore this email.</p>`,
  };
}
