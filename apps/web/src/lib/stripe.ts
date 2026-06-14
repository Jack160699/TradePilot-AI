import Stripe from 'stripe';

// The Stripe SDK throws at construction when the API key is empty, which would
// crash the webhook route module at import time if STRIPE_SECRET_KEY is unset.
// Build the client lazily so the module loads regardless of configuration.
// apiVersion is intentionally omitted so the SDK uses its own pinned default,
// avoiding a TS literal-type mismatch when the stripe package is upgraded.
let _stripe: Stripe | null = null;
export function getStripe(): Stripe {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('Stripe is not configured (STRIPE_SECRET_KEY missing)');
  }
  if (!_stripe) {
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { typescript: true });
  }
  return _stripe;
}

export const STRIPE_PRICES = {
  PRO: process.env.STRIPE_PRICE_PRO ?? '',
  ELITE: process.env.STRIPE_PRICE_ELITE ?? '',
} as const;
