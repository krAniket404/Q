import { ParsedTransaction } from '../lib/smsParser';

/**
 * Synthetic users with KNOWN habits. Real accuracy can only be measured on real data,
 * but this lets us check that the models learn a pattern that is definitely there.
 */
export type Archetype = 'midnight_impulser' | 'weekend_warrior' | 'stealth_saver' | 'strategic_spender' | 'balanced';
export const ARCHETYPES: Archetype[] = ['midnight_impulser', 'weekend_warrior', 'stealth_saver', 'strategic_spender', 'balanced'];

export interface SyntheticTxn extends ParsedTransaction { id: string; userId: string; archetype: Archetype; isImpulse: boolean; }

export function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const poisson = (r: () => number, lambda: number) => { const L = Math.exp(-lambda); let k = 0, p = 1; do { k++; p *= r(); } while (p > L && k < 30); return k - 1; };
const logNormal = (r: () => number, median: number, sigma: number) => median * Math.exp(sigma * Math.sqrt(-2 * Math.log(r() || 1e-9)) * Math.cos(2 * Math.PI * r()));
const pick = <T,>(r: () => number, items: [T, number][]) => { const tot = items.reduce((s, i) => s + i[1], 0); let x = r() * tot; for (const [v, w] of items) { x -= w; if (x <= 0) { return v; } } return items[items.length - 1][0]; };

interface Proc { days: number[]; from: number; to: number; rate: number; median: number; cats: [string, number][]; impulse: number; }
const ALL = [0, 1, 2, 3, 4, 5, 6];
const PROFILES: Record<Archetype, Proc[]> = {
  midnight_impulser: [
    { days: ALL, from: 9, to: 19, rate: 1.2, median: 150, cats: [['Food', 3], ['Groceries', 2], ['Travel', 2]], impulse: 0.05 },
    { days: [5, 6, 0], from: 21, to: 24, rate: 1.6, median: 650, cats: [['Dining & Delivery', 4], ['Shopping', 3], ['Entertainment', 1]], impulse: 0.6 },
    { days: [1, 2, 3, 4], from: 22, to: 24, rate: 0.5, median: 420, cats: [['Dining & Delivery', 3], ['Shopping', 2]], impulse: 0.45 },
  ],
  weekend_warrior: [
    { days: [1, 2, 3, 4, 5], from: 9, to: 19, rate: 0.8, median: 130, cats: [['Food', 3], ['Travel', 2], ['Groceries', 1]], impulse: 0.05 },
    { days: [6, 0], from: 12, to: 22, rate: 3.0, median: 520, cats: [['Dining & Delivery', 3], ['Shopping', 3], ['Entertainment', 2]], impulse: 0.35 },
  ],
  stealth_saver: [
    { days: ALL, from: 9, to: 19, rate: 0.7, median: 110, cats: [['Groceries', 3], ['Food', 2], ['Bills', 1]], impulse: 0.03 },
    { days: ALL, from: 21, to: 24, rate: 0.08, median: 300, cats: [['Dining & Delivery', 1]], impulse: 0.2 },
  ],
  strategic_spender: [
    { days: [6], from: 9, to: 12, rate: 1, median: 1400, cats: [['Groceries', 1]], impulse: 0.02 },
    { days: [1, 2, 3, 4, 5], from: 9, to: 19, rate: 0.6, median: 120, cats: [['Food', 2], ['Travel', 2]], impulse: 0.04 },
    { days: ALL, from: 18, to: 21, rate: 0.2, median: 250, cats: [['Dining & Delivery', 1], ['Health', 1]], impulse: 0.08 },
  ],
  balanced: [
    { days: ALL, from: 9, to: 21, rate: 1.2, median: 200, cats: [['Food', 3], ['Groceries', 2], ['Travel', 2], ['Shopping', 1]], impulse: 0.15 },
    { days: [5], from: 19, to: 23, rate: 0.6, median: 450, cats: [['Dining & Delivery', 3], ['Entertainment', 2]], impulse: 0.3 },
  ],
};
const MERCHANTS: Record<string, string[]> = {
  Food: ['Local Cafe', 'Chai Point', 'Subway'], 'Dining & Delivery': ['Swiggy', 'Zomato', 'Dominos'],
  Groceries: ['DMart', 'BigBasket', 'Zepto', 'Blinkit'], Travel: ['Uber', 'Ola', 'Rapido'],
  Shopping: ['Amazon', 'Flipkart', 'Myntra'], Entertainment: ['BookMyShow', 'Steam', 'PVR'],
  Bills: ['Airtel', 'Jio', 'BESCOM'], Health: ['Apollo Pharmacy', 'PharmEasy'],
};
const SUBS: [string, number, number][] = [['Netflix', 649, 5], ['Spotify', 119, 12], ['YouTube Premium', 189, 20]];

export function generateUser(seed: number, archetype: Archetype, days = 180, end: Date = new Date(2026, 9, 1), userId = `${archetype}-${seed}`): SyntheticTxn[] {
  const r = makeRng(seed);
  const out: SyntheticTxn[] = [];
  const subs = SUBS.filter(() => r() < 0.8);
  const salary = Math.round((25000 + r() * 35000) / 100) * 100;
  let n = 0;
  const add = (date: Date, type: 'debit' | 'credit', amount: number, merchant: string, category: string, isImpulse: boolean) =>
    out.push({ id: `${userId}-${n++}`, userId, archetype, isImpulse, date, type, amount: Math.max(10, Math.round(amount)), merchant, category, bank: 'SYN', raw: '' });
  for (let d = days - 1; d >= 0; d--) {
    const day = new Date(end.getFullYear(), end.getMonth(), end.getDate() - d);
    const w = day.getDay(), dom = day.getDate();
    if (dom === 1) { add(new Date(day.getFullYear(), day.getMonth(), dom, 9, 0), 'credit', salary, 'Salary', 'Income', false); }
    subs.forEach(([m, amt, sd]) => { if (dom === sd) { add(new Date(day.getFullYear(), day.getMonth(), dom, 6, 0), 'debit', amt, m, 'Subscriptions', false); } });
    PROFILES[archetype].forEach(p => {
      if (!p.days.includes(w)) { return; }
      const boost = dom <= 5 ? (archetype === 'stealth_saver' ? 1.1 : 1.4) : 1;
      const count = poisson(r, p.rate * boost);
      for (let i = 0; i < count; i++) {
        const t = p.from + r() * (p.to - p.from);
        const isImpulse = r() < p.impulse;
        const cat = pick(r, p.cats);
        const when = new Date(day.getFullYear(), day.getMonth(), dom, Math.floor(t), Math.floor((t % 1) * 60));
        add(when, 'debit', logNormal(r, p.median, 0.6) * (isImpulse ? 1.3 : 1), MERCHANTS[cat][Math.floor(r() * MERCHANTS[cat].length)], cat, isImpulse);
      }
    });
  }
  return out.sort((a, b) => a.date.getTime() - b.date.getTime());
}

export function generateCohort(perArchetype = 12, days = 180, seed = 7): SyntheticTxn[] {
  const all: SyntheticTxn[] = [];
  ARCHETYPES.forEach((a, ai) => { for (let i = 0; i < perArchetype; i++) { all.push(...generateUser(seed + ai * 1000 + i, a, days, undefined, `${a}-${i + 1}`)); } });
  return all;
}

export function toCsv(rows: SyntheticTxn[]): string {
  const head = 'user_id,archetype,id,timestamp,type,amount,merchant,category,hour,weekday,is_impulse';
  return [head, ...rows.map(t => [t.userId, t.archetype, t.id, t.date.toISOString(), t.type, t.amount, t.merchant, JSON.stringify(t.category), t.date.getHours(), t.date.getDay(), t.isImpulse ? 1 : 0].join(','))].join('\n');
}
