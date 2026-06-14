import { getEnv } from '@tradepilot/config';
import type { AlertMessage, NotificationProvider } from './types';

export class TelegramProvider implements NotificationProvider {
  readonly channel = 'TELEGRAM' as const;
  private token: string;
  constructor(token?: string) {
    this.token = token ?? getEnv().TELEGRAM_BOT_TOKEN ?? '';
  }
  async send(chatId: string, msg: AlertMessage) {
    if (!this.token) return { ok: false, error: 'TELEGRAM_BOT_TOKEN missing' };
    const text = `*${msg.title}*\n${msg.body}${msg.url ? `\n${msg.url}` : ''}`;
    const res = await fetch(`https://api.telegram.org/bot${this.token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' }),
    });
    const data = (await res.json()) as { ok: boolean; result?: { message_id: number } };
    return { ok: data.ok, id: data.result?.message_id?.toString() };
  }
}
