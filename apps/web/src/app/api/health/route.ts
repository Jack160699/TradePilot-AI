import { NextResponse } from 'next/server';
import { prisma } from '@tradepilot/db';
import { redis } from '@/lib/redis';

export async function GET() {
  const checks = { db: false, redis: false };
  try { await prisma.$queryRaw`SELECT 1`; checks.db = true; } catch {}
  try { await redis.ping(); checks.redis = true; } catch {}
  const healthy = checks.db && checks.redis;
  return NextResponse.json({ status: healthy ? 'ok' : 'degraded', checks }, { status: healthy ? 200 : 503 });
}
