/** Position sizing & risk helpers. */
export function riskReward(entry: number, stop: number, target: number): number {
  const risk = Math.abs(entry - stop);
  const reward = Math.abs(target - entry);
  return risk === 0 ? 0 : reward / risk;
}

export function positionSize(
  accountEquity: number,
  riskPct: number,
  entry: number,
  stop: number,
): number {
  const riskAmount = accountEquity * (riskPct / 100);
  const perUnitRisk = Math.abs(entry - stop);
  return perUnitRisk === 0 ? 0 : riskAmount / perUnitRisk;
}
