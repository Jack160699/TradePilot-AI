import twilio from 'twilio';
import { getEnv } from '@tradepilot/config';
import type { AlertMessage, NotificationProvider } from './types';

export class WhatsAppProvider implements NotificationProvider {
  readonly channel = 'WHATSAPP' as const;
  private client: ReturnType<typeof twilio> | null = null;
  private from: string;
  constructor() {
    const env = getEnv();
    this.from = process.env.TWILIO_WHATSAPP_FROM ?? 'whatsapp:+14155238886';
    if (env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN) {
      this.client = twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN);
    }
  }
  async send(to: string, msg: AlertMessage) {
    if (!this.client) return { ok: false, error: 'Twilio credentials missing' };
    const message = await this.client.messages.create({
      from: this.from,
      to: `whatsapp:${to}`,
      body: `${msg.title}\n${msg.body}${msg.url ? `\n${msg.url}` : ''}`,
    });
    return { ok: true, id: message.sid };
  }
}
