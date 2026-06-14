export const PLAN_LIMITS = {
  FREE: { signalsPerDay: 3, backtestsPerMonth: 5, portfolios: 1, alertChannels: ['IN_APP', 'EMAIL'] },
  PRO: { signalsPerDay: 50, backtestsPerMonth: 100, portfolios: 5, alertChannels: ['IN_APP', 'EMAIL', 'TELEGRAM'] },
  ELITE: { signalsPerDay: Infinity, backtestsPerMonth: 1000, portfolios: 25, alertChannels: ['IN_APP', 'EMAIL', 'TELEGRAM', 'WHATSAPP'] },
  ENTERPRISE: { signalsPerDay: Infinity, backtestsPerMonth: Infinity, portfolios: Infinity, alertChannels: ['IN_APP', 'EMAIL', 'TELEGRAM', 'WHATSAPP', 'WEBHOOK'] },
} as const;

export const PLAN_RANK = { FREE: 0, PRO: 1, ELITE: 2, ENTERPRISE: 3 } as const;
