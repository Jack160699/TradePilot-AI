import type { MarketContext } from './types';

export const SYSTEM_PROMPT = `You are TradePilot's quantitative signal engine.
Analyze the provided market context and indicators and produce a single,
risk-managed trade proposal. Be conservative: only propose trades with a
clear edge. Always respect a minimum risk/reward of 1.5. Respond ONLY with
the JSON matching the requested schema.`;

export function buildUserPrompt(ctx: MarketContext): string {
  return [
    `Symbol: ${ctx.symbol}`,
    `Timeframe: ${ctx.timeframe}`,
    `Last price: ${ctx.lastPrice}`,
    `Indicators: ${JSON.stringify(ctx.indicators)}`,
    `Recent candles (oldest→newest): ${JSON.stringify(ctx.recentCandles.slice(-30))}`,
    '',
    'Return JSON: { direction, entryPrice, stopLoss, takeProfit, confidence, riskReward, rationale }',
  ].join('\n');
}
