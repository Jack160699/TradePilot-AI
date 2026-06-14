export interface AlertMessage {
  title: string;
  body: string;
  url?: string;
}
export interface NotificationProvider {
  readonly channel: 'EMAIL' | 'TELEGRAM' | 'WHATSAPP';
  send(to: string, msg: AlertMessage): Promise<{ ok: boolean; id?: string; error?: string }>;
}
