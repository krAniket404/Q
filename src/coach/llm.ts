import { CoachData, Tone } from './types';
import { inr, prep } from './queryEngine';
import { namedRange } from './timeRange';
import { categoryMatches } from './entities';

/** What an outside model is allowed to see: totals and shares, never merchants, dates or raw transactions. */
export interface Snapshot { facts: string[]; numbers: number[]; }

export function snapshot(data: CoachData): Snapshot {
  const all = prep(data.transactions).filter(t => t.type === 'debit');
  const facts: string[] = [], numbers: number[] = [];
  const push = (text: string, ...n: number[]) => { facts.push(text); numbers.push(...n.map(x => Math.round(x))); };
  const cur = namedRange('this_month', data.now), startPrev = new Date(data.now.getFullYear(), data.now.getMonth() - 1, 1);
  const inMonth = all.filter(t => t.date >= cur.from && t.date < cur.to);
  const elapsed = Math.max(1, Math.round((cur.to.getTime() - cur.from.getTime()) / 86400000));
  const prevSame = all.filter(t => t.date >= startPrev && t.date < new Date(startPrev.getTime() + elapsed * 86400000));
  const sum = (a: typeof all) => a.reduce((s, t) => s + t.amount, 0);
  if (inMonth.length) { push(`Spent this month so far: ${inr(sum(inMonth))} over ${elapsed} days across ${inMonth.length} purchases.`, sum(inMonth), elapsed, inMonth.length); }
  if (prevSame.length) { push(`Spent in the same days last month: ${inr(sum(prevSame))}.`, sum(prevSame)); }
  const by: { [c: string]: number } = {};
  inMonth.forEach(t => { const c = categoryMatches(t.category, 'Dining & Delivery') ? 'Dining & Delivery' : t.category || 'Other'; by[c] = (by[c] || 0) + t.amount; });
  Object.entries(by).sort((a, b) => b[1] - a[1]).slice(0, 3).forEach(([c, v]) => push(`Category ${c}: ${inr(v)} (${Math.round((v / sum(inMonth)) * 100)}% of this month).`, v, (v / sum(inMonth)) * 100));
  const late = inMonth.filter(t => t.date.getHours() >= 21 || t.date.getHours() < 5);
  if (inMonth.length && late.length) { push(`After 9 PM: ${Math.round((sum(late) / sum(inMonth)) * 100)}% of this month's spending.`, (sum(late) / sum(inMonth)) * 100); }
  if (data.scores) { push(`Scores out of 100: wellness ${Math.round(data.scores.wellness)}, discipline ${Math.round(data.scores.discipline)}, impulse ${Math.round(data.scores.impulse)}, volatility ${Math.round(data.scores.volatility)}, savings rate ${Math.round(data.scores.savingsRate)}.`, data.scores.wellness, data.scores.discipline, data.scores.impulse, data.scores.volatility, data.scores.savingsRate); }
  return { facts, numbers };
}

export function buildPrompt(question: string, snap: Snapshot, tone: Tone): string {
  return [
    `You are Q, a sharp money coach for a young Indian user.${tone === 'sassy' ? ' Be warm but a little sarcastic.' : ' Be calm and clear.'}`,
    'Answer in at most 3 short sentences, using ONLY the facts below. Never invent a number, date, merchant or fact that is not listed.',
    'If the facts do not answer the question, say so plainly in one sentence and suggest one thing the user can ask Q instead (for example about a category, a month, or a time of day).',
    `Facts:\n${snap.facts.length ? snap.facts.map(f => `- ${f}`).join('\n') : '- No spending data yet.'}`,
    `Question: ${question}`,
  ].join('\n\n');
}

/** Numbers that matter in a reply: rupee amounts, percentages and any figure of 3+ digits or with decimals. */
export function extractNumbers(text: string): number[] {
  const out: number[] = [];
  const re = /(?:₹|rs\.?\s?)\s?(\d[\d,]*(?:\.\d+)?)\s?(k|lakhs?)?|(\d+(?:\.\d+)?)\s?%|\b(\d[\d,]{2,}(?:\.\d+)?|\d+\.\d+)\b/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const raw = (m[1] || m[3] || m[4] || '').replace(/,/g, '');
    let n = parseFloat(raw);
    if (isNaN(n)) { continue; }
    const unit = (m[2] || '').toLowerCase();
    if (unit === 'k') { n *= 1000; } else if (unit.startsWith('lakh')) { n *= 100000; }
    out.push(n);
  }
  return out;
}
const close = (a: number, b: number) => Math.abs(a - b) <= Math.max(1, Math.abs(b) * 0.01);

/** An AI-written answer is only shown if every figure in it can be found in the facts it was given. */
export function validateAnswer(text: string, allowed: number[]): boolean {
  if (!text || text.length > 700 || /https?:\/\//i.test(text) || /as an ai|language model/i.test(text)) { return false; }
  return extractNumbers(text).every(n => allowed.some(a => close(n, a)));
}

export type ModelCall = (prompt: string) => Promise<string | null>;
export async function askModel(question: string, data: CoachData, call: ModelCall, tone: Tone): Promise<string | null> {
  const snap = snapshot(data);
  try {
    const reply = (await call(buildPrompt(question, snap, tone)))?.trim() ?? null;
    return reply && validateAnswer(reply, snap.numbers) ? reply : null;
  } catch { return null; }
}
