import Razorpay from 'razorpay';
import { createHmac, timingSafeEqual } from 'node:crypto';

// The Razorpay SDK throws at construction if key_id is empty, which would crash
// the webhook route module at import time when keys aren't configured. Build the
// client lazily so the module loads (and signature verification works) regardless.
let _razorpay: Razorpay | null = null;
export function getRazorpay(): Razorpay {
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    throw new Error('Razorpay is not configured (RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET missing)');
  }
  if (!_razorpay) {
    _razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });
  }
  return _razorpay;
}

/** Verify Razorpay webhook signature (HMAC-SHA256) using a constant-time
 *  comparison to avoid leaking the digest via timing side-channels. */
export function verifyRazorpaySignature(body: string, signature: string): boolean {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET ?? '';
  if (!secret || !signature) return false;
  const expected = createHmac('sha256', secret).update(body).digest('hex');
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(signature, 'utf8');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
