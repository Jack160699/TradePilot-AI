import { z } from 'zod';

export const SignalProposalSchema = z.object({
  direction: z.enum(['LONG', 'SHORT']),
  entryPrice: z.number().positive(),
  stopLoss: z.number().positive(),
  takeProfit: z.number().positive(),
  confidence: z.number().min(0).max(1),
  riskReward: z.number().positive(),
  rationale: z.string().min(10),
});
export type SignalProposal = z.infer<typeof SignalProposalSchema>;

export interface MarketContext {
  symbol: string;
  timeframe: string;
  lastPrice: number;
  indicators: Record<string, number>;
  recentCandles: Array<{ t: number; o: number; h: number; l: number; c: number; v: number }>;
}
