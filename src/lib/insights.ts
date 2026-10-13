import { ParsedTransaction } from './smsParser';

export interface LateNightInsight { count: number; lateAvg: number; dayAvg: number; pct: number; }

/**
 * "Q noticed": does spending change after 9 PM? Uses the last 30 days of debits.
 * Returns null unless there is a real, explainable pattern (3+ late purchases that average more than daytime ones).
 */
export function noticeLateNight(transactions: ParsedTransaction[], now: Date = new Date()): LateNightInsight | null {
  if (!Array.isArray(transactions)) { return null; }
  const since = now.getTime() - 30 * 24 * 3600 * 1000;
  const debits = transactions.filter(t => t.type === 'debit' && t.date && t.date.getTime() >= since);
  const late = debits.filter(t => t.date.getHours() >= 21 || t.date.getHours() <= 4);
  const day = debits.filter(t => t.date.getHours() > 4 && t.date.getHours() < 21);
  if (late.length < 3 || day.length === 0) { return null; }
  const avg = (a: ParsedTransaction[]) => a.reduce((s, t) => s + t.amount, 0) / a.length;
  const lateAvg = avg(late);
  const dayAvg = avg(day);
  if (!(dayAvg > 0) || lateAvg <= dayAvg) { return null; }
  return { count: late.length, lateAvg: Math.round(lateAvg), dayAvg: Math.round(dayAvg), pct: Math.round(((lateAvg - dayAvg) / dayAvg) * 100) };
}
