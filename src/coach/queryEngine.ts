import { ParsedTransaction } from '../lib/smsParser';
import { buildRiskProfile } from '../ml/riskProfile';
import { categoryMatches } from './entities';
import { hourInWindow, namedRange } from './timeRange';
import { CoachData, EngineResult, Intent, Slots, TimeRange } from './types';

type Txn = ParsedTransaction & { date: Date };
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DOW = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;
const sum = (t: Txn[]) => t.reduce((s, x) => s + x.amount, 0);
const day = (d: Date) => `${d.getDate()} ${MON[d.getMonth()]}`;
const pctChange = (a: number, b: number) => (b > 0 ? Math.round(((a - b) / b) * 100) : null);
const sod = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
export const displayCategory = (c?: string) => (!c || c === 'Food' ? (c === 'Food' ? 'Dining & Delivery' : 'Other') : c);

export function prep(transactions: ParsedTransaction[]): Txn[] {
  return (Array.isArray(transactions) ? transactions : []).map(t => ({ ...t, date: new Date(t.date as any) })).filter(t => !isNaN(t.date.getTime()) && isFinite(t.amount));
}
const inRange = (t: Txn, r: TimeRange) => t.date.getTime() >= r.from.getTime() && t.date.getTime() < r.to.getTime();

/** Applies the question's filters: period, category, merchant, hours, weekend. */
function filt(txns: Txn[], s: Slots, range?: TimeRange): Txn[] {
  return txns.filter(t => {
    if (range && !inRange(t, range)) { return false; }
    if (s.category && !categoryMatches(t.category, s.category)) { return false; }
    if (s.merchant && (t.merchant || '').toLowerCase() !== s.merchant.toLowerCase()) { return false; }
    if (s.hourFrom !== undefined && s.hourTo !== undefined && !hourInWindow(t.date.getHours(), s.hourFrom, s.hourTo)) { return false; }
    const dow = t.date.getDay();
    if (s.weekend && dow !== 0 && dow !== 6) { return false; }
    if (s.weekdays && (dow === 0 || dow === 6)) { return false; }
    return true;
  });
}

/** The period just before, matched in length (this month so far is compared with the same days of last month). */
export function previousPeriod(r: TimeRange): TimeRange {
  if (r.key === 'this_month') {
    const from = new Date(r.from.getFullYear(), r.from.getMonth() - 1, 1);
    const elapsed = Math.round((r.to.getTime() - r.from.getTime()) / 86400000);
    const monthEnd = new Date(r.from.getFullYear(), r.from.getMonth(), 1);
    const to = new Date(Math.min(addDays(from, elapsed).getTime(), monthEnd.getTime()));
    return { from, to, label: 'the same days last month', key: 'prev_' + r.key };
  }
  if (r.key === 'last_month') {
    return { from: new Date(r.from.getFullYear(), r.from.getMonth() - 1, 1), to: r.from, label: 'the month before', key: 'prev_' + r.key };
  }
  const len = r.to.getTime() - r.from.getTime();
  return { from: new Date(r.from.getTime() - len), to: r.from, label: r.key === 'this_week' ? 'the same days last week' : 'the period before', key: 'prev_' + r.key };
}
const daysIn = (r: TimeRange) => Math.max(1, Math.round((r.to.getTime() - r.from.getTime()) / 86400000));
const what = (s: Slots) => `${s.category ? ' on ' + s.category : s.merchant ? ' on ' + s.merchant : ''}${s.hoursLabel ? ' ' + s.hoursLabel : ''}${s.weekend ? ' on weekends' : s.weekdays ? ' on weekdays' : ''}`;
const result = (intent: Intent, headline: string, lines: string[] = [], numbers: number[] = [], followUps: string[] = [], mood?: 'up' | 'down' | 'flat'): EngineResult =>
  ({ intent, ok: true, headline, lines, facts: [], numbers, followUps, mood });
const needs = (intent: Intent, why: string): EngineResult => ({ intent, ok: false, headline: why, lines: [], facts: [], numbers: [], followUps: [] });

type Handler = (d: { all: Txn[]; debits: Txn[]; credits: Txn[]; data: CoachData; s: Slots; now: Date }) => EngineResult;

const total_spend: Handler = ({ debits, s, now }) => {
  const range = s.range ?? namedRange('this_month', now);
  const tx = filt(debits, s, range), total = sum(tx);
  if (tx.length === 0) { return result('total_spend', `Nothing${what(s)} ${range.label}. Zero. A clean slate.`, [], [0], ['What did I spend last month?']); }
  const prev = previousPeriod(range), pt = sum(filt(debits, s, prev)), p = pctChange(total, pt);
  const lines = [`${plural(tx.length, 'purchase')}, averaging ${inr(total / tx.length)}.`];
  const nums = [Math.round(total), tx.length, Math.round(total / tx.length)];
  if (p !== null && Math.abs(p) >= 1) { lines.push(`That is ${Math.abs(p)}% ${p > 0 ? 'more' : 'less'} than ${prev.label} (${inr(pt)}).`); nums.push(Math.abs(p), Math.round(pt)); }
  return result('total_spend', `You spent ${inr(total)}${what(s)} ${range.label}.`, lines, nums, ['Why did my spending change?', 'Which purchase was the biggest?'], p === null ? 'flat' : p > 0 ? 'up' : 'down');
};

function groupBy(tx: Txn[], key: (t: Txn) => string) {
  const m: { [k: string]: { total: number; n: number } } = {};
  tx.forEach(t => { const k = key(t); (m[k] = m[k] || { total: 0, n: 0 }); m[k].total += t.amount; m[k].n++; });
  return Object.entries(m).map(([name, v]) => ({ name, ...v })).sort((a, b) => b.total - a.total);
}

const top_categories: Handler = ({ debits, s, now }) => {
  const range = s.range ?? namedRange('this_month', now);
  const tx = filt(debits, { ...s, category: undefined }, range), total = sum(tx);
  if (!tx.length) { return result('top_categories', `No spending recorded ${range.label}.`, [], [0]); }
  const g = groupBy(tx, t => displayCategory(t.category)), top = g.slice(0, 3);
  const share = (x: number) => Math.round((x / total) * 100);
  return result('top_categories', `${top[0].name} leads ${range.label}: ${inr(top[0].total)}, ${share(top[0].total)}% of your spending.`,
    top.slice(1).map(c => `${c.name}: ${inr(c.total)} (${share(c.total)}%).`), top.flatMap(c => [Math.round(c.total), share(c.total)]), [`How much did I spend on ${top[0].name}?`]);
};

const top_merchants: Handler = ({ debits, s, now }) => {
  const range = s.range ?? namedRange('this_month', now);
  const tx = filt(debits, { ...s, merchant: undefined }, range);
  if (!tx.length) { return result('top_merchants', `No spending recorded ${range.label}.`, [], [0]); }
  const top = groupBy(tx, t => t.merchant || 'Unknown').slice(0, 3);
  return result('top_merchants', `${top[0].name} gets the most from you ${range.label}: ${inr(top[0].total)} across ${plural(top[0].n, 'purchase')}.`,
    top.slice(1).map(m => `${m.name}: ${inr(m.total)} (${plural(m.n, 'purchase')}).`), top.flatMap(m => [Math.round(m.total), m.n]), [`How many times did I order from ${top[0].name}?`]);
};

const biggest_purchases: Handler = ({ debits, s, now }) => {
  const range = s.range ?? namedRange('this_month', now);
  const tx = filt(debits, s, range).sort((a, b) => b.amount - a.amount).slice(0, 3);
  if (!tx.length) { return result('biggest_purchases', `No purchases${what(s)} ${range.label}.`, [], [0]); }
  const fmt = (t: Txn) => `${inr(t.amount)} at ${t.merchant || 'Unknown'} on ${day(t.date)}`;
  return result('biggest_purchases', `Your biggest purchase${what(s)} ${range.label} was ${fmt(tx[0])}.`, tx.slice(1).map(t => `Then ${fmt(t)}.`), tx.map(t => Math.round(t.amount)));
};

const compare_periods: Handler = ({ debits, s, now }) => {
  const a = s.range ?? namedRange('this_month', now);
  const b = s.compareTo ?? (a.key === 'this_month' ? namedRange('last_month', now) : previousPeriod(a));
  const aligned = a.key === 'this_month' && b.key === 'last_month' ? previousPeriod(a) : b;
  const ta = sum(filt(debits, s, a)), tb = sum(filt(debits, s, aligned)), p = pctChange(ta, tb);
  if (tb === 0 && ta === 0) { return result('compare_periods', `No spending${what(s)} in either period.`, [], [0]); }
  if (p === null) { return result('compare_periods', `You spent ${inr(ta)}${what(s)} ${a.label}, and nothing in ${b.label}.`, [], [Math.round(ta)]); }
  const lines = aligned !== b ? [`Over all of last month you spent ${inr(sum(filt(debits, s, b)))}.`] : [];
  return result('compare_periods', `${a.label[0].toUpperCase() + a.label.slice(1)}: ${inr(ta)}${what(s)}, versus ${inr(tb)} for ${aligned.label}. That is ${Math.abs(p)}% ${p >= 0 ? 'higher' : 'lower'}.`, lines, [Math.round(ta), Math.round(tb), Math.abs(p)], ['Why did it change?'], p > 0 ? 'up' : p < 0 ? 'down' : 'flat');
};

const month_forecast: Handler = ({ debits, data, now }) => {
  const r = namedRange('this_month', now), spent = sum(filt(debits, {}, r)), elapsed = daysIn(r);
  const dim = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate(), left = dim - now.getDate();
  if (elapsed < 3 || spent === 0) { return needs('month_forecast', "It's too early in the month for a sensible forecast. Ask me again in a few days."); }
  const mtd = spent / elapsed;
  const recentTx = debits.filter(t => t.date.getTime() >= addDays(sod(now), -13).getTime());
  const recent = recentTx.length ? sum(recentTx) / Math.min(14, Math.max(elapsed, 14)) : mtd;
  const low = spent + Math.min(mtd, recent) * left, high = spent + Math.max(mtd, recent) * left, mid = (low + high) / 2;
  const lines = [`You've spent ${inr(spent)} in ${plural(elapsed, 'day')}, about ${inr(mtd)} a day, with ${plural(left, 'day')} to go.`];
  const nums = [Math.round(mid), Math.round(low), Math.round(high), Math.round(spent), Math.round(mtd), left];
  const budget = data.budgets ? Object.values(data.budgets).reduce((s, v) => s + (v || 0), 0) : 0;
  if (budget > 0) { lines.push(mid > budget ? `Your budgets add up to ${inr(budget)}, so you're heading for roughly ${inr(mid - budget)} over.` : `Your budgets add up to ${inr(budget)}, so you're on track.`); nums.push(Math.round(budget), Math.round(Math.abs(mid - budget))); }
  return result('month_forecast', `At this pace you'll finish the month around ${inr(mid)} (somewhere between ${inr(low)} and ${inr(high)}).`, lines, nums, ['Can I afford ₹2,000 this week?'], budget > 0 && mid > budget ? 'up' : 'flat');
};

const daily_average: Handler = ({ debits, s, now }) => {
  const range = s.range ?? namedRange('this_month', now), tx = filt(debits, s, range), days = Math.min(daysIn(range), Math.max(1, Math.round((now.getTime() - range.from.getTime()) / 86400000) + 1));
  if (!tx.length) { return result('daily_average', `No spending${what(s)} ${range.label}.`, [], [0]); }
  return result('daily_average', `You spend about ${inr(sum(tx) / days)} a day${what(s)} ${range.label}.`, [`${inr(sum(tx))} over ${plural(days, 'day')}.`], [Math.round(sum(tx) / days), Math.round(sum(tx)), days]);
};

const merchant_count: Handler = ({ debits, s, now }) => {
  const range = s.range ?? namedRange('this_month', now);
  if (!s.merchant) { return needs('merchant_count', 'Tell me which merchant, for example "How many times did I order from Swiggy?"'); }
  const tx = filt(debits, s, range);
  if (!tx.length) { return result('merchant_count', `You haven't paid ${s.merchant} ${range.label}.`, [], [0]); }
  return result('merchant_count', `${s.merchant}: ${plural(tx.length, 'time')} ${range.label}, ${inr(sum(tx))} in total.`, [`About ${inr(sum(tx) / tx.length)} each time.`], [tx.length, Math.round(sum(tx)), Math.round(sum(tx) / tx.length)]);
};

/** Repeating monthly payments, found from the data when the app has not supplied its own list. */
export function detectSubscriptions(debits: Txn[]): { merchant: string; amount: number; count: number }[] {
  const by: { [m: string]: Txn[] } = {};
  debits.forEach(t => { (by[t.merchant || ''] = by[t.merchant || ''] || []).push(t); });
  const out: { merchant: string; amount: number; count: number }[] = [];
  Object.entries(by).forEach(([m, tx]) => {
    if (!m || tx.length < 3) { return; }
    const sorted = [...tx].sort((a, b) => a.date.getTime() - b.date.getTime());
    const gaps = sorted.slice(1).map((t, i) => (t.date.getTime() - sorted[i].date.getTime()) / 86400000).sort((a, b) => a - b);
    const med = gaps[Math.floor(gaps.length / 2)];
    const amts = sorted.map(t => t.amount), mean = amts.reduce((a, b) => a + b, 0) / amts.length;
    const cv = Math.sqrt(amts.reduce((s, a) => s + (a - mean) ** 2, 0) / amts.length) / mean;
    if (med >= 25 && med <= 35 && cv < 0.15) { out.push({ merchant: m, amount: Math.round(mean), count: tx.length }); }
  });
  return out.sort((a, b) => b.amount - a.amount);
}
const subscriptions: Handler = ({ debits, data }) => {
  const list = data.recurring && data.recurring.length ? data.recurring.filter(r => r.billingCycle === 'monthly' || !r.billingCycle || r.billingCycle === 'unknown').map(r => ({ merchant: r.merchant, amount: Math.round(r.amount), count: r.count })) : detectSubscriptions(debits);
  if (!list.length) { return result('subscriptions', "I can't see any repeating charges yet. I need to spot the same payment about three months running.", [], [0]); }
  const monthly = list.reduce((s, x) => s + x.amount, 0);
  return result('subscriptions', `You have ${plural(list.length, 'subscription')} costing ${inr(monthly)} a month, which is ${inr(monthly * 12)} a year.`,
    list.slice(0, 4).map(x => `${x.merchant}: ${inr(x.amount)} a month.`), [list.length, monthly, monthly * 12, ...list.slice(0, 4).map(x => x.amount)], ['Which subscriptions could I cancel?']);
};

const income_savings: Handler = ({ all, credits, debits, s, now }) => {
  const range = s.range ?? namedRange('this_month', now);
  const inc = sum(filt(credits, {}, range)), out = sum(filt(debits, {}, range));
  if (inc === 0) { return result('income_savings', `I don't see any money coming in ${range.label}. You've spent ${inr(out)}.`, [], [Math.round(out)]); }
  const kept = inc - out, rate = Math.round((kept / inc) * 100);
  return result('income_savings', kept >= 0 ? `${range.label[0].toUpperCase() + range.label.slice(1)} you received ${inr(inc)} and kept ${inr(kept)}: a ${rate}% savings rate.` : `${range.label[0].toUpperCase() + range.label.slice(1)} you received ${inr(inc)} but spent ${inr(out)}, which is ${inr(-kept)} more than came in.`,
    [`Spent ${inr(out)} in total.`], [Math.round(inc), Math.round(Math.abs(kept)), Math.abs(rate), Math.round(out)], ['Where does my money go?'], kept >= 0 ? 'down' : 'up');
};

const when_spend: Handler = ({ debits, now }) => {
  const recent = debits.filter(t => t.date.getTime() >= addDays(sod(now), -90).getTime());
  if (recent.length < 10) { return needs('when_spend', "I need a couple of weeks of spending before I can tell when you spend the most."); }
  const profile = buildRiskProfile(recent, { now });
  const total = sum(recent), late = sum(recent.filter(t => t.date.getHours() >= 21 || t.date.getHours() < 5));
  const lateShare = Math.round((late / total) * 100);
  const byDow = DOW.map((d, i) => ({ d, total: sum(recent.filter(t => t.date.getDay() === i)) })).sort((a, b) => b.total - a.total);
  const lines = [`${DOW.includes(byDow[0].d) ? byDow[0].d + 's carry' : ''} the most money overall (${inr(byDow[0].total)} over the last 90 days).`, `${lateShare}% of your spending happens after 9 PM.`];
  const nums = [Math.round(byDow[0].total), lateShare];
  if (profile.windows.length) {
    const w = profile.windows[0];
    return result('when_spend', `${w.label} is your busiest slot: about ${inr(w.expected)} on a typical ${DOW[w.weekday]}.`, lines, [Math.round(w.expected), ...nums], ['Why did my spending change?']);
  }
  const hours = Array.from({ length: 12 }, (_, b) => ({ b, total: sum(recent.filter(t => Math.floor(t.date.getHours() / 2) === b)) })).sort((a, b) => b.total - a.total)[0];
  return result('when_spend', `You spend the most between ${(hours.b * 2) % 12 || 12}${hours.b * 2 < 12 ? ' AM' : ' PM'} and ${((hours.b * 2 + 2) % 12) || 12}${hours.b * 2 + 2 < 12 || hours.b * 2 + 2 === 24 ? ' AM' : ' PM'}.`, lines, [...nums, Math.round(hours.total)]);
};

const explain_change: Handler = ({ debits, s, now }) => {
  const cur = s.range ?? namedRange('this_month', now), prev = previousPeriod(cur);
  const a = filt(debits, s, cur), b = filt(debits, s, prev), ta = sum(a), tb = sum(b);
  if (a.length === 0) { return result('explain_change', `There's no spending${what(s)} ${cur.label} to explain.`, [], [0]); }
  if (tb === 0) { return needs('explain_change', `I have nothing from ${prev.label} to compare with, so I can't say what changed yet.`); }
  const p = pctChange(ta, tb) as number, delta = ta - tb;
  if (Math.abs(p) < 5) { return result('explain_change', `Not much changed: ${inr(ta)} ${cur.label} against ${inr(tb)} for ${prev.label}, within ${Math.abs(p)}%.`, [], [Math.round(ta), Math.round(tb), Math.abs(p)], undefined, 'flat'); }
  const up = delta > 0;
  const lines: string[] = [], nums = [Math.round(ta), Math.round(tb), Math.abs(p)];
  const ca = groupBy(a, t => displayCategory(t.category)), cb = groupBy(b, t => displayCategory(t.category));
  const names = new Set([...ca.map(x => x.name), ...cb.map(x => x.name)]);
  const moves = [...names].map(n => ({ n, d: (ca.find(x => x.name === n)?.total || 0) - (cb.find(x => x.name === n)?.total || 0) })).filter(x => up ? x.d > 0 : x.d < 0).sort((x, y) => Math.abs(y.d) - Math.abs(x.d)).slice(0, 2);
  if (moves.length) { lines.push(`Biggest ${up ? 'rise' : 'drop'}: ${moves.map(m => `${m.n} ${up ? '+' : '−'}${inr(Math.abs(m.d))}`).join(', ')}.`); nums.push(...moves.map(m => Math.round(Math.abs(m.d)))); }
  const na = a.length, nb = b.length, avga = ta / na, avgb = tb / nb;
  const cnt = pctChange(na, nb) as number, tick = pctChange(avga, avgb) as number;
  if (Math.abs(cnt) >= Math.abs(tick) && Math.abs(cnt) >= 10) { lines.push(`It's mostly how often: ${na} purchases against ${nb}.`); nums.push(na, nb); }
  else if (Math.abs(tick) >= 10) { lines.push(`It's mostly how much per purchase: ${inr(avga)} on average against ${inr(avgb)}.`); nums.push(Math.round(avga), Math.round(avgb)); }
  const lateShare = (x: Txn[], t: number) => (t > 0 ? Math.round((sum(x.filter(y => y.date.getHours() >= 21 || y.date.getHours() < 5)) / t) * 100) : 0);
  const sa = lateShare(a, ta), sb = lateShare(b, tb);
  if (Math.abs(sa - sb) >= 5) { lines.push(`After 9 PM went from ${sb}% to ${sa}% of your spending.`); nums.push(sa, sb); }
  const big = [...a].sort((x, y) => y.amount - x.amount)[0];
  if (up && big && big.amount >= 0.3 * delta && big.amount >= 2 * avgb) { lines.push(`One purchase did a lot of it: ${inr(big.amount)} at ${big.merchant || 'Unknown'} on ${day(big.date)}.`); nums.push(Math.round(big.amount)); }
  return result('explain_change', `${up ? 'Spending is up' : 'Spending is down'} ${Math.abs(p)}%${what(s)}: ${inr(ta)} ${cur.label} against ${inr(tb)} for ${prev.label}.`, lines, nums, ['What time do I spend the most?'], up ? 'up' : 'down');
};

const safe_to_spend: Handler = ({ debits, data, s, now }) => {
  const r = namedRange('this_month', now), spent = sum(filt(debits, {}, r));
  const dim = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate(), left = Math.max(dim - now.getDate() + 1, 1);
  const budget = data.budgets ? Object.values(data.budgets).reduce((x, v) => x + (v || 0), 0) : 0;
  const lines: string[] = [], nums: number[] = [];
  if (budget > 0) {
    const remaining = budget - spent, perDay = remaining / left;
    if (s.amount) {
      nums.push(Math.round(s.amount), Math.round(remaining), Math.round(Math.max(perDay, 0)));
      if (remaining <= 0) { return result('safe_to_spend', `Your budget for the month is already used up (${inr(spent)} of ${inr(budget)}), so ${inr(s.amount)} would be on top.`, [], [...nums, Math.round(spent), Math.round(budget)]); }
      const fits = s.amount <= remaining;
      return result('safe_to_spend', fits ? `Yes, you can afford ${inr(s.amount)}: you have ${inr(remaining)} left in your budget. It would use ${Math.round((s.amount / remaining) * 100)}% of it.` : `Not comfortably. ${inr(s.amount)} is more than the ${inr(remaining)} you have left in your budget.`, [`That is about ${(s.amount / Math.max(perDay, 1)).toFixed(1)} days of your daily allowance.`], [...nums, Math.round((s.amount / remaining) * 100)], undefined, fits ? 'flat' : 'up');
    }
    return result('safe_to_spend', remaining > 0 ? `You can spend about ${inr(perDay)} a day for the rest of the month.` : `You've used your whole budget for the month.`, [`${inr(Math.max(remaining, 0))} left of ${inr(budget)}, with ${plural(left, 'day')} to go.`], [Math.round(perDay), Math.round(Math.max(remaining, 0)), Math.round(budget), left]);
  }
  const recent = debits.filter(t => t.date.getTime() >= addDays(sod(now), -29).getTime());
  if (recent.length < 5) { return needs('safe_to_spend', 'Set a budget or give me a few weeks of spending and I can answer that properly.'); }
  const avgDay = sum(recent) / 30;
  if (s.amount) { lines.push(`That is ${(s.amount / avgDay).toFixed(1)} days of your usual spending (${inr(avgDay)} a day).`); nums.push(Math.round(avgDay)); return result('safe_to_spend', `I can't see a budget, so I can't say it's safe. ${inr(s.amount)} is roughly ${Math.round((s.amount / (avgDay * 30)) * 100)}% of a typical month for you.`, lines, [Math.round(s.amount), Math.round((s.amount / (avgDay * 30)) * 100), ...nums]); }
  return result('safe_to_spend', `You usually spend about ${inr(avgDay)} a day. Set a monthly budget and I'll tell you what is safe.`, [], [Math.round(avgDay)]);
};

const budget_status: Handler = ({ debits, data, now }) => {
  if (!data.budgets || !Object.keys(data.budgets).length) { return needs('budget_status', 'You have not set any budgets yet. Add some in the Budget tab and I will track them.'); }
  const r = namedRange('this_month', now);
  const rows = Object.entries(data.budgets).filter(([, l]) => l > 0).map(([c, l]) => { const sp = sum(filt(debits, { category: c }, r)); return { c, l, sp, used: sp / l }; }).sort((a, b) => b.used - a.used);
  const over = rows.filter(x => x.used >= 1), near = rows.filter(x => x.used >= 0.8 && x.used < 1);
  if (!over.length && !near.length) { return result('budget_status', 'All your budgets are in good shape this month.', rows.slice(0, 2).map(x => `${x.c}: ${Math.round(x.used * 100)}% used.`), rows.slice(0, 2).map(x => Math.round(x.used * 100))); }
  const lines = [...over.map(x => `${x.c} is over: ${inr(x.sp)} of ${inr(x.l)}.`), ...near.map(x => `${x.c} is at ${Math.round(x.used * 100)}%: ${inr(x.sp)} of ${inr(x.l)}.`)];
  return result('budget_status', over.length ? `${plural(over.length, 'budget')} already over this month.` : `${plural(near.length, 'budget')} close to the limit.`, lines, rows.flatMap(x => [Math.round(x.sp), Math.round(x.l), Math.round(x.used * 100)]), undefined, over.length ? 'up' : 'flat');
};

const impulse: Handler = ({ debits, data, now }) => {
  const recent = debits.filter(t => t.date.getTime() >= addDays(sod(now), -30).getTime());
  if (recent.length < 5) { return needs('impulse', 'I need a few more weeks of spending to say much about your impulse buying.'); }
  const total = sum(recent), med = [...recent].map(t => t.amount).sort((a, b) => a - b)[Math.floor(recent.length / 2)];
  const late = recent.filter(t => t.date.getHours() >= 21 || t.date.getHours() < 5), big = recent.filter(t => t.amount >= med * 2);
  const lateShare = Math.round((sum(late) / total) * 100), bigShare = Math.round((sum(big) / total) * 100);
  const lines = [`${lateShare}% of your spending in the last 30 days happened after 9 PM (${plural(late.length, 'purchase')}).`, `${plural(big.length, 'purchase')} were at least double your typical ${inr(med)}, adding up to ${bigShare}% of the total.`];
  const nums = [lateShare, late.length, big.length, Math.round(med), bigShare];
  const head = data.scores ? `Your impulse score is ${Math.round(data.scores.impulse)}/100. Here is what drives it.` : 'Here is what suggests impulse buying in your last 30 days.';
  if (data.scores) { nums.push(Math.round(data.scores.impulse), 100); }
  return result('impulse', head, lines, nums, ['What time do I spend the most?']);
};

const score_explain: Handler = ({ data }) => {
  const sc = data.scores;
  if (!sc) { return needs('score_explain', "I can't see your scores yet. Give me a little more data."); }
  const parts = [{ n: 'Discipline', v: sc.discipline, hi: true, m: 'how steady your spending is month to month' }, { n: 'Impulse', v: sc.impulse, hi: false, m: 'how often purchases look unplanned' }, { n: 'Volatility', v: sc.volatility, hi: false, m: 'how erratic your weeks are' }, { n: 'Savings rate', v: sc.savingsRate, hi: true, m: 'how much of what comes in stays' }];
  const worst = [...parts].sort((a, b) => (a.hi ? a.v : 100 - a.v) - (b.hi ? b.v : 100 - b.v))[0];
  return result('score_explain', `Your wellness score is ${Math.round(sc.wellness)}/100. The part pulling it down most is ${worst.n.toLowerCase()}, at ${Math.round(worst.v)}/100.`,
    [`${worst.n} measures ${worst.m}.`, ...parts.filter(p => p !== worst).map(p => `${p.n}: ${Math.round(p.v)}/100.`)], [Math.round(sc.wellness), Math.round(worst.v), ...parts.map(p => Math.round(p.v)), 100]);
};

const help: Handler = () => result('help', 'I can work out answers from your own spending. Try:', ['"How much did I spend on food last week?"', '"Why did my spending go up this month?"', '"Can I afford ₹2,500?"', '"What time do I spend the most?"', '"What am I paying for every month?"'], []);

const HANDLERS: { [k in Intent]?: Handler } = { total_spend, top_categories, top_merchants, biggest_purchases, compare_periods, month_forecast, daily_average, merchant_count, subscriptions, income_savings, when_spend, explain_change, safe_to_spend, budget_status, impulse, score_explain, help };
export const ENGINE_INTENTS = Object.keys(HANDLERS) as Intent[];

export function runIntent(intent: Intent, slots: Slots, data: CoachData): EngineResult | null {
  const h = HANDLERS[intent];
  if (!h) { return null; }
  const all = prep(data.transactions);
  return h({ all, debits: all.filter(t => t.type === 'debit'), credits: all.filter(t => t.type === 'credit'), data, s: slots, now: data.now });
}
