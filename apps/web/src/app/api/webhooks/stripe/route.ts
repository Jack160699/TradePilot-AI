import { NextResponse } from 'next/server';
import { getStripe } from '@/lib/stripe';
import { prisma } from '@tradepilot/db';
import { recordAudit } from '@/lib/audit';

export async function POST(req: Request) {
  const body = await req.text();
  const sig = req.headers.get('stripe-signature') ?? '';
  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 503 });
  }
  let event;
  try {
    event = getStripe().webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  switch (event.type) {
    case 'checkout.session.completed':
    case 'customer.subscription.updated': {
      const sub = event.data.object as { customer: string; status: string; current_period_end: number };
      await prisma.subscription.updateMany({
        where: { providerCustomerId: sub.customer },
        data: {
          status: sub.status === 'active' ? 'ACTIVE' : 'PAST_DUE',
          currentPeriodEnd: new Date(sub.current_period_end * 1000),
        },
      });
      break;
    }
    case 'customer.subscription.deleted': {
      const sub = event.data.object as { customer: string };
      await prisma.subscription.updateMany({
        where: { providerCustomerId: sub.customer },
        data: { status: 'CANCELED', plan: 'FREE' },
      });
      break;
    }
  }
  await recordAudit({ action: 'BILLING_EVENT', resource: 'stripe', metadata: { type: event.type } });
  return NextResponse.json({ received: true });
}
