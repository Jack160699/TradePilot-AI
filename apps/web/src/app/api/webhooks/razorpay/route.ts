import { NextResponse } from 'next/server';
import { verifyRazorpaySignature } from '@/lib/razorpay';
import { prisma } from '@tradepilot/db';
import { recordAudit } from '@/lib/audit';

export async function POST(req: Request) {
  const body = await req.text();
  const sig = req.headers.get('x-razorpay-signature') ?? '';
  if (!verifyRazorpaySignature(body, sig)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }
  const event = JSON.parse(body) as { event: string; payload: { subscription?: { entity: { customer_id: string; status: string } } } };

  if (event.event === 'subscription.charged' || event.event === 'subscription.activated') {
    const entity = event.payload.subscription?.entity;
    if (entity) {
      await prisma.subscription.updateMany({
        where: { providerCustomerId: entity.customer_id },
        data: { status: 'ACTIVE' },
      });
    }
  }
  await recordAudit({ action: 'BILLING_EVENT', resource: 'razorpay', metadata: { type: event.event } });
  return NextResponse.json({ received: true });
}
