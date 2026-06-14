import type { AlertMessage } from './types';
import { TelegramProvider } from './telegram';
import { WhatsAppProvider } from './whatsapp';

export interface DispatchTarget {
  telegramChatId?: string;
  whatsappNumber?: string;
}

/** Fan-out an alert across all configured channels for a user. */
export class NotificationDispatcher {
  private telegram = new TelegramProvider();
  private whatsapp = new WhatsAppProvider();

  async dispatch(target: DispatchTarget, msg: AlertMessage) {
    const results: Array<{ channel: string; ok: boolean; error?: string }> = [];
    if (target.telegramChatId) {
      const r = await this.telegram.send(target.telegramChatId, msg);
      results.push({ channel: 'TELEGRAM', ok: r.ok, error: r.error });
    }
    if (target.whatsappNumber) {
      const r = await this.whatsapp.send(target.whatsappNumber, msg);
      results.push({ channel: 'WHATSAPP', ok: r.ok, error: r.error });
    }
    return results;
  }
}
