import { PrismaClient, SubscriptionPlan } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// ── RBAC catalog ───────────────────────────────────────────────────────────
const PERMISSIONS = [
  { key: 'signal:create', resource: 'signal', action: 'create' },
  { key: 'signal:read', resource: 'signal', action: 'read' },
  { key: 'signal:update', resource: 'signal', action: 'update' },
  { key: 'signal:delete', resource: 'signal', action: 'delete' },
  { key: 'user:read', resource: 'user', action: 'read' },
  { key: 'user:update', resource: 'user', action: 'update' },
  { key: 'user:delete', resource: 'user', action: 'delete' },
  { key: 'billing:manage', resource: 'billing', action: 'manage' },
  { key: 'audit:read', resource: 'audit', action: 'read' },
  { key: 'backtest:run', resource: 'backtest', action: 'create' },
  { key: 'portfolio:manage', resource: 'portfolio', action: 'manage' },
  { key: 'admin:access', resource: 'admin', action: 'manage' },
];

const ROLES: Record<string, string[]> = {
  ADMIN: PERMISSIONS.map((p) => p.key),
  ANALYST: ['signal:create', 'signal:read', 'signal:update', 'backtest:run', 'portfolio:manage'],
  USER: ['signal:read', 'backtest:run', 'portfolio:manage'],
};

async function main() {
  console.log('🌱 Seeding TradePilot AI...');

  // Permissions
  for (const p of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { key: p.key },
      update: {},
      create: p,
    });
  }

  // Roles + role-permission links
  for (const [name, keys] of Object.entries(ROLES)) {
    const role = await prisma.role.upsert({
      where: { name },
      update: {},
      create: { name, isSystem: true, description: `${name} system role` },
    });
    for (const key of keys) {
      const perm = await prisma.permission.findUnique({ where: { key } });
      if (perm) {
        await prisma.rolePermission.upsert({
          where: { roleId_permissionId: { roleId: role.id, permissionId: perm.id } },
          update: {},
          create: { roleId: role.id, permissionId: perm.id },
        });
      }
    }
  }

  // Admin user — passwordHash is a sha256 of "ChangeMe!123" placeholder; rotate in prod.
  const adminRole = await prisma.role.findUnique({ where: { name: 'ADMIN' } });
  const admin = await prisma.user.upsert({
    where: { email: 'admin@tradepilot.ai' },
    update: {},
    create: {
      email: 'admin@tradepilot.ai',
      name: 'Platform Admin',
      status: 'ACTIVE',
      emailVerified: new Date(),
      // bcrypt hash so the seeded admin can authenticate via Credentials.
      passwordHash: await bcrypt.hash(process.env.ADMIN_SEED_PASSWORD ?? 'ChangeMe!123', 12),
    },
  });
  if (adminRole) {
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: admin.id, roleId: adminRole.id } },
      update: {},
      create: { userId: admin.id, roleId: adminRole.id },
    });
  }
  await prisma.subscription.upsert({
    where: { userId: admin.id },
    update: {},
    create: { userId: admin.id, plan: SubscriptionPlan.ENTERPRISE, status: 'ACTIVE' },
  });

  // Instruments
  const instruments = [
    { symbol: 'BTCUSDT', name: 'Bitcoin', assetClass: 'CRYPTO' as const, exchange: 'BINANCE' },
    { symbol: 'ETHUSDT', name: 'Ethereum', assetClass: 'CRYPTO' as const, exchange: 'BINANCE' },
    { symbol: 'SOLUSDT', name: 'Solana', assetClass: 'CRYPTO' as const, exchange: 'BINANCE' },
    { symbol: 'BNBUSDT', name: 'BNB', assetClass: 'CRYPTO' as const, exchange: 'BINANCE' },
    { symbol: 'XRPUSDT', name: 'XRP', assetClass: 'CRYPTO' as const, exchange: 'BINANCE' },
    { symbol: 'AAPL', name: 'Apple Inc.', assetClass: 'EQUITY' as const, exchange: 'NASDAQ' },
    { symbol: 'MSFT', name: 'Microsoft Corp.', assetClass: 'EQUITY' as const, exchange: 'NASDAQ' },
    { symbol: 'TSLA', name: 'Tesla Inc.', assetClass: 'EQUITY' as const, exchange: 'NASDAQ' },
    { symbol: 'NVDA', name: 'NVIDIA Corp.', assetClass: 'EQUITY' as const, exchange: 'NASDAQ' },
    { symbol: 'AMZN', name: 'Amazon.com Inc.', assetClass: 'EQUITY' as const, exchange: 'NASDAQ' },
    { symbol: 'EURUSD', name: 'Euro / US Dollar', assetClass: 'FOREX' as const },
    { symbol: 'GBPUSD', name: 'Pound / US Dollar', assetClass: 'FOREX' as const },
    { symbol: 'XAUUSD', name: 'Gold / US Dollar', assetClass: 'COMMODITY' as const },
  ];
  for (const i of instruments) {
    await prisma.instrument.upsert({
      where: { symbol: i.symbol },
      update: {},
      create: i,
    });
  }

  // Feature flags
  for (const key of ['ai_signals', 'razorpay_checkout', 'whatsapp_alerts']) {
    await prisma.featureFlag.upsert({
      where: { key },
      update: {},
      create: { key, enabled: true, rollout: 100 },
    });
  }

  await seedDemoData();

  console.log('✅ Seed complete.');
}

// ── Demo data (Phase 7) ──────────────────────────────────────────────────────
// Deterministic, idempotent demo dataset: 1 demo user, 20 strategies,
// 5 portfolios with trades, 50 signals, and a handful of alerts.

const BASE_PRICE: Record<string, number> = {
  BTCUSDT: 64000, ETHUSDT: 3200, SOLUSDT: 150, BNBUSDT: 580, XRPUSDT: 0.52,
  AAPL: 195, MSFT: 420, TSLA: 250, NVDA: 120, AMZN: 185,
  EURUSD: 1.08, GBPUSD: 1.27, XAUUSD: 2350,
};
const SYMBOLS = Object.keys(BASE_PRICE);
const TIMEFRAMES = ['M15', 'M30', 'H1', 'H4', 'D1'] as const;

// Seeded PRNG so re-seeds produce the same dataset.
let seedState = 1337;
function rnd(): number {
  seedState = (seedState * 1664525 + 1013904223) % 4294967296;
  return seedState / 4294967296;
}
function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(rnd() * arr.length)]!;
}
function round(n: number, d = 6): number {
  const f = 10 ** d;
  return Math.round(n * f) / f;
}

type Cond = { left: object; op: string; right: object };
const ind = (indicator: string, period?: number) =>
  period ? { kind: 'indicator', indicator, period } : { kind: 'indicator', indicator };
const val = (value: number) => ({ kind: 'value', value });

/** Eight reusable rule templates spanning all six indicator families. */
function strategyTemplate(n: number): {
  name: string;
  direction: 'LONG' | 'SHORT';
  logic: 'AND' | 'OR';
  conditions: Cond[];
  sl: number;
  tp: number;
} {
  const templates = [
    { name: 'RSI Oversold Reversal', direction: 'LONG' as const, logic: 'AND' as const,
      conditions: [{ left: ind('RSI', 14), op: 'LT', right: val(30) }], sl: 0.02, tp: 0.04 },
    { name: 'RSI Overbought Fade', direction: 'SHORT' as const, logic: 'AND' as const,
      conditions: [{ left: ind('RSI', 14), op: 'GT', right: val(70) }], sl: 0.02, tp: 0.04 },
    { name: 'Trend Pullback', direction: 'LONG' as const, logic: 'AND' as const,
      conditions: [{ left: ind('PRICE'), op: 'GT', right: ind('EMA', 200) },
                   { left: ind('RSI', 14), op: 'LT', right: val(45) }], sl: 0.025, tp: 0.05 },
    { name: 'Golden Cross', direction: 'LONG' as const, logic: 'AND' as const,
      conditions: [{ left: ind('EMA', 50), op: 'CROSSES_ABOVE', right: ind('EMA', 200) }], sl: 0.03, tp: 0.09 },
    { name: 'Death Cross', direction: 'SHORT' as const, logic: 'AND' as const,
      conditions: [{ left: ind('EMA', 50), op: 'CROSSES_BELOW', right: ind('EMA', 200) }], sl: 0.03, tp: 0.09 },
    { name: 'MACD Momentum', direction: 'LONG' as const, logic: 'AND' as const,
      conditions: [{ left: ind('MACD'), op: 'CROSSES_ABOVE', right: ind('MACD_SIGNAL') }], sl: 0.02, tp: 0.05 },
    { name: 'Bollinger Mean Reversion', direction: 'LONG' as const, logic: 'AND' as const,
      conditions: [{ left: ind('PRICE'), op: 'LT', right: ind('BB_LOWER', 20) }], sl: 0.02, tp: 0.03 },
    { name: 'Volume Breakout', direction: 'LONG' as const, logic: 'AND' as const,
      conditions: [{ left: ind('VOLUME'), op: 'GT', right: ind('VOLUME_SMA', 20) },
                   { left: ind('PRICE'), op: 'GT', right: ind('SMA', 20) }], sl: 0.025, tp: 0.06 },
  ];
  const t = templates[n % templates.length]!;
  return { ...t, name: t.name };
}

async function seedDemoData() {
  const demo = await prisma.user.upsert({
    where: { email: 'demo@tradepilot.ai' },
    update: {},
    create: {
      email: 'demo@tradepilot.ai',
      name: 'Demo Trader',
      status: 'ACTIVE',
      emailVerified: new Date(),
      passwordHash: await bcrypt.hash(process.env.DEMO_SEED_PASSWORD ?? 'Demo!2345', 12),
    },
  });

  const userRole = await prisma.role.findUnique({ where: { name: 'USER' } });
  if (userRole) {
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: demo.id, roleId: userRole.id } },
      update: {},
      create: { userId: demo.id, roleId: userRole.id },
    });
  }
  await prisma.subscription.upsert({
    where: { userId: demo.id },
    update: {},
    create: { userId: demo.id, plan: SubscriptionPlan.PRO, status: 'ACTIVE' },
  });
  await prisma.notificationPreference.upsert({
    where: { userId: demo.id },
    update: {},
    create: { userId: demo.id },
  });

  // Idempotency: clear prior demo-owned rows before recreating.
  await prisma.signal.deleteMany({ where: { authorId: demo.id } });
  await prisma.trade.deleteMany({ where: { userId: demo.id } });
  await prisma.portfolio.deleteMany({ where: { userId: demo.id } });
  await prisma.strategy.deleteMany({ where: { userId: demo.id } });
  await prisma.alert.deleteMany({ where: { userId: demo.id } });

  const instrumentRows = await prisma.instrument.findMany({ where: { symbol: { in: SYMBOLS } } });
  const instrumentBySymbol = new Map(instrumentRows.map((i) => [i.symbol, i]));

  // 20 strategies
  seedState = 1337;
  for (let n = 0; n < 20; n++) {
    const t = strategyTemplate(n);
    const symbol = SYMBOLS[n % SYMBOLS.length]!;
    const timeframe = pick(TIMEFRAMES);
    await prisma.strategy.create({
      data: {
        userId: demo.id,
        name: `${t.name} #${n + 1}`,
        description: `${t.direction} ${symbol} on ${timeframe}`,
        symbol,
        timeframe,
        enabled: n % 4 !== 0, // ~75% enabled
        config: {
          logic: t.logic,
          direction: t.direction,
          conditions: t.conditions,
          stopLossPct: t.sl,
          takeProfitPct: t.tp,
        },
      },
    });
  }

  // 5 portfolios with trades
  const portfolioNames = ['Core', 'Swing', 'Crypto Alpha', 'Income', 'Experimental'];
  for (let p = 0; p < 5; p++) {
    const portfolio = await prisma.portfolio.create({
      data: {
        userId: demo.id,
        name: portfolioNames[p]!,
        baseCurrency: 'USD',
        isDefault: p === 0,
      },
    });
    const tradeCount = 4 + Math.floor(rnd() * 5);
    for (let k = 0; k < tradeCount; k++) {
      const symbol = pick(SYMBOLS);
      const instrument = instrumentBySymbol.get(symbol);
      if (!instrument) continue;
      const base = BASE_PRICE[symbol]!;
      const entry = round(base * (0.95 + rnd() * 0.1));
      const side = rnd() > 0.5 ? 'BUY' : 'SELL';
      const closed = rnd() > 0.35;
      const qty = round((1000 / base) * (0.5 + rnd()), 8);
      let exitPrice: number | null = null;
      let pnl: number | null = null;
      let pnlPct: number | null = null;
      if (closed) {
        const move = (rnd() - 0.45) * 0.12;
        exitPrice = round(entry * (1 + move));
        const dir = side === 'BUY' ? 1 : -1;
        pnlPct = round(dir * move * 100, 2);
        pnl = round(dir * (exitPrice - entry) * qty, 2);
      }
      await prisma.trade.create({
        data: {
          userId: demo.id,
          portfolioId: portfolio.id,
          instrumentId: instrument.id,
          side: side as 'BUY' | 'SELL',
          status: closed ? 'CLOSED' : 'OPEN',
          quantity: qty,
          entryPrice: entry,
          exitPrice: exitPrice ?? undefined,
          fees: round(entry * qty * 0.001, 2),
          pnl: pnl ?? undefined,
          pnlPct: pnlPct ?? undefined,
          openedAt: new Date(Date.now() - Math.floor(rnd() * 30) * 86400000),
          closedAt: closed ? new Date(Date.now() - Math.floor(rnd() * 10) * 86400000) : undefined,
        },
      });
    }
  }

  // 50 signals
  const statuses = ['ACTIVE', 'ACTIVE', 'ACTIVE', 'TRIGGERED', 'HIT_TARGET', 'HIT_STOPLOSS', 'EXPIRED'] as const;
  const models = ['RSI Oversold Reversal', 'Golden Cross', 'MACD Momentum', 'Bollinger Mean Reversion', 'Volume Breakout', 'GPT-4o Signal'];
  for (let s = 0; s < 50; s++) {
    const symbol = pick(SYMBOLS);
    const instrument = instrumentBySymbol.get(symbol);
    if (!instrument) continue;
    const base = BASE_PRICE[symbol]!;
    const entry = round(base * (0.97 + rnd() * 0.06));
    const direction = rnd() > 0.45 ? 'LONG' : 'SHORT';
    const slPct = 0.015 + rnd() * 0.02;
    const tpPct = slPct * (1.5 + rnd() * 1.5);
    const stopLoss = round(direction === 'LONG' ? entry * (1 - slPct) : entry * (1 + slPct));
    const takeProfit = round(direction === 'LONG' ? entry * (1 + tpPct) : entry * (1 - tpPct));
    const status = statuses[s % statuses.length]!;
    await prisma.signal.create({
      data: {
        instrumentId: instrument.id,
        authorId: demo.id,
        direction: direction as 'LONG' | 'SHORT',
        timeframe: pick(TIMEFRAMES),
        status,
        entryPrice: entry,
        stopLoss,
        takeProfit,
        confidence: round(0.55 + rnd() * 0.4, 2),
        riskReward: round(tpPct / slPct, 2),
        rationale: `${direction} ${symbol}: rule-based setup confirmed on the latest bar. Entry ${entry}, SL ${stopLoss}, TP ${takeProfit}.`,
        model: pick(models),
        indicators: { rsi: round(20 + rnd() * 60, 1), emaTrend: rnd() > 0.5 ? 'up' : 'down', source: 'seed' },
        publishedPlan: pick(['FREE', 'FREE', 'PRO', 'ELITE'] as const),
        createdAt: new Date(Date.now() - Math.floor(rnd() * 20) * 86400000),
        ...(status !== 'ACTIVE' ? { closedAt: new Date(), resultPct: round((rnd() - 0.4) * 8, 2) } : {}),
      },
    });
  }

  // Alerts
  const alertSpecs = [
    { type: 'PRICE' as const, symbol: 'BTCUSDT', condition: 'ABOVE' as const, threshold: 70000, channel: 'IN_APP' as const },
    { type: 'PRICE' as const, symbol: 'ETHUSDT', condition: 'BELOW' as const, threshold: 3000, channel: 'EMAIL' as const },
    { type: 'SIGNAL' as const, symbol: 'SOLUSDT', condition: 'ANY' as const, threshold: null, channel: 'TELEGRAM' as const },
    { type: 'PRICE' as const, symbol: 'NVDA', condition: 'CROSSES' as const, threshold: 130, channel: 'IN_APP' as const },
    { type: 'STRATEGY' as const, symbol: 'AAPL', condition: 'ANY' as const, threshold: null, channel: 'EMAIL' as const },
  ];
  for (const a of alertSpecs) {
    await prisma.alert.create({
      data: {
        userId: demo.id,
        type: a.type,
        symbol: a.symbol,
        condition: a.condition,
        threshold: a.threshold ?? undefined,
        channel: a.channel,
        status: 'ACTIVE',
      },
    });
  }

  console.log('   demo: 20 strategies, 5 portfolios, 50 signals, 5 alerts (demo@tradepilot.ai)');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
