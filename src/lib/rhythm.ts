import { ParsedTransaction } from './smsParser';

export const isLateNight = (hour: number) => hour >= 21 || hour < 5;
export const hourOf = (d: Date) => d.getHours() + d.getMinutes() / 60;

/** Debits from the last 30 days: the data the dial draws. */
export function lastMonthDebits(transactions: ParsedTransaction[], now: Date = new Date()): ParsedTransaction[] {
  if (!Array.isArray(transactions)) { return []; }
  const since = now.getTime() - 30 * 24 * 3600 * 1000;
  return transactions
    .map(t => ({ ...t, date: new Date(t.date as any) }))
    .filter(t => t.type === 'debit' && !isNaN(t.date.getTime()) && t.date.getTime() >= since);
}

const circ = (a: number, b: number) => { const d = Math.abs(a - b) % 24; return Math.min(d, 24 - d); };

export interface WindowStats { count: number; total: number; impulse: number; level: 'HIGH' | 'MEDIUM' | 'LOW'; }

/** What happened within `half` hours of `hour`. "Impulse" = purchases above your own average amount. */
export function windowStats(debits: ParsedTransaction[], hour: number, avg: number, half = 1.5): WindowStats {
  const inWin = debits.filter(t => circ(hourOf(t.date), hour) <= half);
  const impulse = inWin.filter(t => t.amount >= avg && avg > 0).length;
  return {
    count: inWin.length,
    total: Math.round(inWin.reduce((s, t) => s + t.amount, 0)),
    impulse,
    level: impulse >= 3 ? 'HIGH' : impulse >= 1 ? 'MEDIUM' : 'LOW',
  };
}

/** The hour with the most money moving through it: where the dial starts. */
export function busiestHour(debits: ParsedTransaction[]): number {
  if (debits.length === 0) { return 21.5; }
  let best = 21.5, bestSum = -1;
  for (let h = 0; h < 24; h += 0.5) {
    const sum = debits.filter(t => circ(hourOf(t.date), h) <= 1.5).reduce((s, t) => s + t.amount, 0);
    if (sum > bestSum) { bestSum = sum; best = h; }
  }
  return best;
}

export function formatHour(hour: number): string {
  const h = Math.floor(hour) % 24;
  const m = Math.floor((hour % 1) * 60);
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}
