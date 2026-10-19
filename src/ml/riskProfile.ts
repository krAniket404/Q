import { ParsedTransaction } from '../lib/smsParser';

/**
 * Spending-risk profile: for every weekday and 2-hour block, how much money usually moves,
 * how often a purchase happens, and how often it is unplanned.
 * Sparse cells are pulled toward the user's own baseline (empirical Bayes), so one odd Tuesday doesn't create a "window".
 */
export const BLOCKS = 12;
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const dayName = (w: number) => DAYS[w];

export interface RiskCell { weekday: number; block: number; expected: number; p: number; impulseP: number; n: number; confidence: number; score: number; }
export interface RiskWindow { key: string; weekday: number; startHour: number; endHour: number; expected: number; share: number; p: number; impulseP: number; score: number; confidence: number; n: number; label: string; }
export interface RiskProfile { cells: RiskCell[]; windows: RiskWindow[]; historyDays: number; debitCount: number; weeklySpend: number; }
export interface RiskOptions { now?: Date; lookbackDays?: number; k?: number; maxWindows?: number; labels?: { [id: string]: 'impulse' | 'worth_it' }; }

const hr12 = (h: number) => (h % 12) || 12;
const ampm = (h: number) => (h % 24 < 12 ? 'AM' : 'PM');
export function fmtRange(s: number, e: number): string {
  const a = ampm(s), b = ampm(e % 24);
  return a === b ? `${hr12(s)}–${hr12(e % 24)} ${a}` : `${hr12(s)} ${a}–${hr12(e % 24)} ${b}`;
}
const median = (a: number[]) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : 0; };
const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

export function buildRiskProfile(transactions: ParsedTransaction[], opts: RiskOptions = {}): RiskProfile {
  const now = opts.now ?? new Date();
  const lookback = opts.lookbackDays ?? 90;
  const k = opts.k ?? 2;
  const since = now.getTime() - lookback * 86400000;
  const debits = (Array.isArray(transactions) ? transactions : [])
    .map(t => ({ ...t, date: new Date(t.date as any) }))
    .filter(t => t.type === 'debit' && !isNaN(t.date.getTime()) && t.date.getTime() >= since && t.date.getTime() <= now.getTime());
  const empty: RiskProfile = { cells: [], windows: [], historyDays: 0, debitCount: debits.length, weeklySpend: 0 };
  if (debits.length < 15) { return empty; }
  const first = Math.min(...debits.map(t => t.date.getTime()));
  const historyDays = Math.max(1, Math.min(lookback, Math.ceil((now.getTime() - first) / 86400000)));
  if (historyDays < 14) { return { ...empty, historyDays }; }

  const occ = new Array(7).fill(0);
  for (let i = 0; i < historyDays; i++) { occ[new Date(now.getTime() - i * 86400000).getDay()]++; }
  const med = median(debits.map(t => t.amount));
  const isImpulse = (t: ParsedTransaction & { date: Date }) => {
    const l = t.id && opts.labels ? opts.labels[t.id] : undefined;
    if (l) { return l === 'impulse'; }
    const h = t.date.getHours();
    return t.amount >= med * 1.5 || ((h >= 21 || h < 5) && t.amount >= med);
  };

  const S = Array.from({ length: 7 }, () => new Array(BLOCKS).fill(0));
  const C = Array.from({ length: 7 }, () => new Array(BLOCKS).fill(0));
  const I = Array.from({ length: 7 }, () => new Array(BLOCKS).fill(0));
  const D = Array.from({ length: 7 }, () => Array.from({ length: BLOCKS }, () => new Set<string>()));
  let impulses = 0;
  debits.forEach(t => {
    const w = t.date.getDay(), b = Math.floor(t.date.getHours() / 2);
    S[w][b] += t.amount; C[w][b]++; D[w][b].add(dayKey(t.date));
    if (isImpulse(t)) { I[w][b]++; impulses++; }
  });
  const g = impulses / debits.length;
  const totOcc = occ.reduce((a, b) => a + b, 0);
  const priorExp = Array.from({ length: BLOCKS }, (_, b) => S.reduce((s, row) => s + row[b], 0) / totOcc);
  const priorP = Array.from({ length: BLOCKS }, (_, b) => D.reduce((s, row) => s + row[b].size, 0) / totOcc);

  const cells: RiskCell[] = [];
  for (let w = 0; w < 7; w++) {
    for (let b = 0; b < BLOCKS; b++) {
      const expected = (S[w][b] + k * priorExp[b]) / (occ[w] + k);
      const p = (D[w][b].size + k * priorP[b]) / (occ[w] + k);
      const impulseP = (I[w][b] + 3 * g) / (C[w][b] + 3);
      const confidence = (1 - Math.exp(-C[w][b] / 6)) * Math.min(historyDays / 60, 1);
      cells.push({ weekday: w, block: b, expected, p, impulseP, n: C[w][b], confidence, score: 0 });
    }
  }
  const maxExp = Math.max(...cells.map(c => c.expected), 1e-9);
  cells.forEach(c => { c.score = (c.expected / maxExp) * (0.5 + 0.5 * c.impulseP); });
  const weeklySpend = cells.reduce((s, c) => s + c.expected, 0);

  const windows: RiskWindow[] = [];
  for (let w = 0; w < 7; w++) {
    const row = cells.filter(c => c.weekday === w);
    let b = 0;
    while (b < BLOCKS) {
      if (row[b].expected >= 0.5 * maxExp) {
        let e = b;
        while (e + 1 < BLOCKS && row[e + 1].expected >= 0.5 * maxExp) { e++; }
        const part = row.slice(b, e + 1);
        const n = part.reduce((s, c) => s + c.n, 0);
        const expected = part.reduce((s, c) => s + c.expected, 0);
        windows.push({
          key: `${w}-${b * 2}`, weekday: w, startHour: b * 2, endHour: (e + 1) * 2, expected, share: expected / weeklySpend,
          p: Math.max(...part.map(c => c.p)), impulseP: part.reduce((s, c) => s + c.impulseP * Math.max(c.n, 1), 0) / part.reduce((s, c) => s + Math.max(c.n, 1), 0),
          score: Math.max(...part.map(c => c.score)), confidence: part.reduce((s, c) => s + c.confidence, 0) / part.length, n,
          label: `${DAYS[w]} ${fmtRange(b * 2, (e + 1) * 2)}`,
        });
        b = e + 1;
      } else { b++; }
    }
  }
  windows.sort((a, c) => c.expected - a.expected);
  return { cells, windows: windows.slice(0, opts.maxWindows ?? 6), historyDays, debitCount: debits.length, weeklySpend };
}

export interface BacktestResult { capture: number; baseline: number; lift: number; hourOnlyCapture: number; testSpend: number; impulseCapture: number | null; }
/** Train on everything before the cut-off, then ask: how much of the NEXT days' spending fell inside the top cells we picked? */
export function riskCaptureBacktest(transactions: (ParsedTransaction & { isImpulse?: boolean })[], opts: { cutoff: Date; trainDays?: number; testDays?: number; topCells?: number }): BacktestResult | null {
  const topCells = opts.topCells ?? 14;
  const profile = buildRiskProfile(transactions, { now: opts.cutoff, lookbackDays: opts.trainDays ?? 90 });
  if (profile.cells.length === 0) { return null; }
  const top = new Set([...profile.cells].sort((a, b) => b.expected - a.expected).slice(0, topCells).map(c => `${c.weekday}-${c.block}`));
  const end = opts.cutoff.getTime() + (opts.testDays ?? 28) * 86400000;
  const test = transactions.map(t => ({ ...t, date: new Date(t.date as any) })).filter(t => t.type === 'debit' && t.date.getTime() > opts.cutoff.getTime() && t.date.getTime() <= end);
  const total = test.reduce((s, t) => s + t.amount, 0);
  if (total === 0) { return null; }
  const inTop = (t: { date: Date }) => top.has(`${t.date.getDay()}-${Math.floor(t.date.getHours() / 2)}`);
  const capture = test.filter(inTop).reduce((s, t) => s + t.amount, 0) / total;
  const imp = test.filter(t => t.isImpulse);
  const impTotal = imp.reduce((s, t) => s + t.amount, 0);
  const baseline = topCells / (7 * BLOCKS);
  // Tougher baseline: knows which hours are busy, but ignores the weekday.
  const trainStart = opts.cutoff.getTime() - (opts.trainDays ?? 90) * 86400000;
  const perBlock = new Array(BLOCKS).fill(0);
  transactions.map(t => ({ ...t, date: new Date(t.date as any) })).filter(t => t.type === 'debit' && t.date.getTime() >= trainStart && t.date.getTime() <= opts.cutoff.getTime())
    .forEach(t => { perBlock[Math.floor(t.date.getHours() / 2)] += t.amount; });
  const hours = new Set(perBlock.map((v, b) => [v, b]).sort((a, b) => b[0] - a[0]).slice(0, Math.ceil(topCells / 7)).map(x => x[1]));
  const hourOnlyCapture = test.filter(t => hours.has(Math.floor(t.date.getHours() / 2))).reduce((s, t) => s + t.amount, 0) / total;
  return { capture, baseline, lift: capture / baseline, hourOnlyCapture, testSpend: Math.round(total), impulseCapture: imp.length ? imp.filter(inTop).reduce((s, t) => s + t.amount, 0) / impTotal : null };
}
