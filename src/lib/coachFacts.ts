import { ParsedTransaction } from './smsParser';
import { busiestHour, formatHour, isLateNight, lastMonthDebits } from './rhythm';

export interface Fact { label: string; detail: string; }

const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

/**
 * Real numbers from the user's own history, shown while the Coach answers.
 * These are what Q looked at; they are not the model's reasoning.
 */
export function buildFacts(transactions: ParsedTransaction[], now: Date = new Date()): Fact[] {
  const all = Array.isArray(transactions) ? transactions : [];
  const facts: Fact[] = [{ label: `${all.length.toLocaleString('en-IN')} transactions`, detail: 'in your history' }];
  const debits = lastMonthDebits(all, now);
  if (debits.length < 5) { return facts; }

  const total = debits.reduce((s, t) => s + t.amount, 0);
  const hour = busiestHour(debits);
  facts.push({ label: `Busiest around ${formatHour(hour)}`, detail: 'when most money moves' });

  const cats: { [k: string]: number } = {};
  debits.forEach(t => { const c = t.category || 'Other'; cats[c] = (cats[c] || 0) + t.amount; });
  const top = Object.entries(cats).sort((a, b) => b[1] - a[1])[0];
  if (top && total > 0) {
    facts.push({ label: `${top[0]} is ${Math.round((top[1] / total) * 100)}% of spend`, detail: `${inr(top[1])} of ${inr(total)} in 30 days` });
  }

  const weekAgo = now.getTime() - 7 * 24 * 3600 * 1000;
  const week = debits.filter(t => t.date.getTime() >= weekAgo).reduce((s, t) => s + t.amount, 0);
  const dailyAvg = total / 30;
  if (dailyAvg > 0) {
    const pct = Math.round(((week / 7 - dailyAvg) / dailyAvg) * 100);
    facts.push({ label: `Last 7 days: ${pct >= 0 ? '+' : '−'}${Math.abs(pct)}%`, detail: 'against your daily average' });
  }

  const late = debits.filter(t => isLateNight(t.date.getHours()));
  if (late.length > 0) {
    facts.push({ label: `${late.length} purchase${late.length === 1 ? '' : 's'} after 9 PM`, detail: `averaging ${inr(late.reduce((s, t) => s + t.amount, 0) / late.length)}` });
  }
  return facts;
}
