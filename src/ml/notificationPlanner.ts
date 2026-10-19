import { ParsedTransaction } from '../lib/smsParser';
import { RecurringCharge } from '../lib/behavioralEngine';
import { RiskProfile, RiskWindow, dayName } from './riskProfile';
import { NotificationKind, NotificationPrefs, SENSITIVITY, inQuietHours } from './notificationPrefs';
import { FeedbackState, isMuted } from './feedback';

export type NotificationAction = 'hold_24h' | 'snooze' | 'not_helpful' | 'open';
export interface PlannedNotification {
  id: string; kind: NotificationKind; key: string; fireAt: number; title: string; body: string;
  reason: string;            // shown behind "Why am I seeing this?"
  confidence: number; priority: number; actions: NotificationAction[];
}
export interface BudgetStatus { category: string; limit: number; spent: number; daysLeft: number; }
export interface PlannerInput {
  now: Date; profile: RiskProfile; prefs: NotificationPrefs; feedback?: FeedbackState;
  recurring?: RecurringCharge[]; budgets?: BudgetStatus[];
  payday?: { day: number; effect: number | null } | null;
  streaks?: { name: string; days: number }[];
  week?: { total: number; topWindow?: string } | null;
  horizonDays?: number;
}

const PRIORITY: Record<NotificationKind, number> = { risk_window: 100, bill_due: 80, budget_pace: 70, streak_guard: 90, payday: 60, weekly_summary: 40 };
const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;
const at = (base: Date, dayOffset: number, hour: number, minute = 0) => new Date(base.getFullYear(), base.getMonth(), base.getDate() + dayOffset, hour, minute, 0, 0).getTime();
const pad = (n: number) => String(n).padStart(2, '0');
const stamp = (ms: number) => { const d = new Date(ms); return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}`; };
const when = (due: Date, now: Date) => {
  const diff = Math.round((new Date(due.getFullYear(), due.getMonth(), due.getDate()).getTime() - new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) / 86400000);
  return diff <= 0 ? 'today' : diff === 1 ? 'tomorrow' : `on ${dayName(due.getDay()).slice(0, 3)} ${due.getDate()}`;
};

/** Finds the usual salary day from monthly credits and whether spending jumps right after it. */
export function detectPayday(transactions: ParsedTransaction[]): { day: number; effect: number | null } | null {
  const credits = (transactions || []).map(t => ({ ...t, date: new Date(t.date as any) })).filter(t => t.type === 'credit' && t.amount >= 3000);
  if (credits.length < 2) { return null; }
  const max = Math.max(...credits.map(t => t.amount));
  const big = credits.filter(t => t.amount >= 0.6 * max);
  const months = new Set(big.map(t => `${t.date.getFullYear()}-${t.date.getMonth()}`));
  if (months.size < 2) { return null; }
  const counts: { [d: number]: number } = {};
  big.forEach(t => { counts[t.date.getDate()] = (counts[t.date.getDate()] || 0) + 1; });
  const day = Number(Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0]);
  const debits = (transactions || []).map(t => ({ ...t, date: new Date(t.date as any) })).filter(t => t.type === 'debit');
  const near: number[] = [], far: number[] = [];
  const perDay: { [k: string]: number } = {};
  debits.forEach(t => { const k = `${t.date.getFullYear()}-${t.date.getMonth()}-${t.date.getDate()}`; perDay[k] = (perDay[k] || 0) + t.amount; });
  Object.entries(perDay).forEach(([k, v]) => { const dom = Number(k.split('-')[2]); const since = (dom - day + 31) % 31; (since < 5 ? near : far).push(v); });
  const avg = (a: number[]) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);
  return { day, effect: avg(far) > 0 && near.length >= 5 ? avg(near) / avg(far) : null };
}

export function planNotifications(input: PlannerInput): PlannedNotification[] {
  const { now, profile, prefs, feedback } = input;
  if (!prefs.enabled || prefs.maxPerDay === 0 || prefs.maxPerWeek === 0) { return []; }
  const horizon = input.horizonDays ?? 7;
  const nowMs = now.getTime();
  const cand: PlannedNotification[] = [];
  const push = (n: Omit<PlannedNotification, 'id'>) => {
    if (n.fireAt <= nowMs + 60000) { return; }
    if (prefs.snoozeUntil && n.fireAt < prefs.snoozeUntil) { return; }
    if (inQuietHours(new Date(n.fireAt).getHours(), prefs.quiet)) { return; }
    if (isMuted(feedback, n.key, n.fireAt)) { return; }
    cand.push({ ...n, id: `${n.kind}:${n.key}:${stamp(n.fireAt)}` });
  };

  // 1. The signature alert: a heads-up shortly before the hours when this user spends the most.
  if (prefs.kinds.risk_window) {
    const th = SENSITIVITY[prefs.sensitivity];
    const streak = prefs.kinds.streak_guard ? (input.streaks || []).filter(s => s.days >= 3).sort((a, b) => b.days - a.days)[0] : undefined;
    profile.windows.filter((w: RiskWindow) => w.confidence >= th.minConfidence && w.share >= th.minShare).forEach(w => {
      for (let d = 0; d <= horizon; d++) {
        const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + d);
        if (day.getDay() !== w.weekday) { continue; }
        const fireAt = at(now, d, w.startHour, 0) - prefs.leadMinutes * 60000;
        const unplanned = w.impulseP >= 0.4 ? ' Purchases in these hours tend to be bigger than your usual.' : '';
        const streakLine = streak ? ` Your ${streak.name} streak is at ${streak.days} days.` : '';
        push({
          kind: 'risk_window', key: `risk:${w.key}`, fireAt,
          title: `${dayName(w.weekday)} ${w.label.split(' ').slice(1).join(' ')} is when you spend the most`,
          body: `About ${inr(w.expected)} usually goes out in these hours.${unplanned}${streakLine} Want to hold purchases for 24 hours tonight?`,
          reason: `Based on your last ${profile.historyDays} days: ${w.n} purchases fell in this window, about ${Math.round(w.share * 100)}% of your weekly spending.`,
          confidence: w.confidence, priority: PRIORITY.risk_window + (streak ? 0 : 0) + Math.round(w.score * 5),
          actions: ['hold_24h', 'snooze', 'not_helpful', 'open'],
        });
      }
    });
  }

  // 2. Bills and subscriptions: the day before, mid-morning.
  if (prefs.kinds.bill_due) {
    (input.recurring || []).forEach(r => {
      if (!r.nextExpectedDate) { return; }
      const due = new Date(r.nextExpectedDate);
      const daysAway = Math.round((new Date(due.getFullYear(), due.getMonth(), due.getDate()).getTime() - new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) / 86400000);
      if (daysAway < 0 || daysAway > horizon) { return; }
      let fireAt = at(now, daysAway - 1, 10);
      if (fireAt <= nowMs + 60000) { fireAt = at(now, daysAway, 9); }
      push({
        kind: 'bill_due', key: `bill:${r.merchant}`, fireAt,
        title: `${r.merchant} renews ${when(due, new Date(fireAt))}`, body: `${inr(r.amount)} is due. Still using it?`,
        reason: `${r.merchant} has charged you ${r.count} times${r.billingCycle && r.billingCycle !== 'unknown' ? ` on a ${r.billingCycle} cycle` : ''}.`,
        confidence: r.confidence === 'high' ? 0.9 : r.confidence === 'medium' ? 0.7 : 0.5, priority: PRIORITY.bill_due, actions: ['open', 'snooze', 'not_helpful'],
      });
    });
  }

  // 3. Budgets close to their limit: one midday note.
  if (prefs.kinds.budget_pace) {
    (input.budgets || []).forEach(b => {
      if (b.limit <= 0) { return; }
      const used = b.spent / b.limit;
      if (used < 0.8) { return; }
      let fireAt = at(now, 0, 12);
      if (fireAt <= nowMs + 60000) { fireAt = at(now, 1, 12); }
      const left = Math.max(b.limit - b.spent, 0);
      push({
        kind: 'budget_pace', key: `budget:${b.category}`, fireAt,
        title: used >= 1 ? `${b.category} is over its limit` : `${b.category} is at ${Math.round(used * 100)}% of its limit`,
        body: used >= 1 ? `You are ${inr(b.spent - b.limit)} over with ${b.daysLeft} days to go.` : `${inr(left)} left for ${b.daysLeft} days, about ${inr(left / Math.max(b.daysLeft, 1))} a day.`,
        reason: `You have spent ${inr(b.spent)} of your ${inr(b.limit)} ${b.category} limit.`,
        confidence: 0.9, priority: PRIORITY.budget_pace + (used >= 1 ? 5 : 0), actions: ['open', 'snooze', 'not_helpful'],
      });
    });
  }

  // 4. Payday: only if your own history shows spending really does jump afterwards.
  if (prefs.kinds.payday && input.payday && input.payday.effect && input.payday.effect >= 1.2) {
    for (let d = 0; d <= horizon; d++) {
      if (new Date(now.getFullYear(), now.getMonth(), now.getDate() + d).getDate() !== input.payday.day) { continue; }
      push({
        kind: 'payday', key: 'payday', fireAt: at(now, d, 9),
        title: 'Payday: pace the first week',
        body: `Your spending runs about ${Math.round((input.payday.effect - 1) * 100)}% higher in the 5 days after payday.`,
        reason: 'Compared with the rest of the month, using your own past paydays.', confidence: 0.7, priority: PRIORITY.payday, actions: ['open', 'snooze', 'not_helpful'],
      });
    }
  }

  // 5. Sunday evening summary.
  if (prefs.kinds.weekly_summary && input.week && input.week.total > 0) {
    for (let d = 0; d <= horizon; d++) {
      if (new Date(now.getFullYear(), now.getMonth(), now.getDate() + d).getDay() !== 0) { continue; }
      push({
        kind: 'weekly_summary', key: 'summary', fireAt: at(now, d, 18),
        title: 'Your week in one line', body: `${inr(input.week.total)} this week.${input.week.topWindow ? ` Busiest: ${input.week.topWindow}.` : ''}`,
        reason: 'A short Sunday check-in.', confidence: 0.8, priority: PRIORITY.weekly_summary, actions: ['open', 'not_helpful'],
      });
    }
  }

  // Choose: most important first, but never break the daily/weekly caps or the minimum gap.
  const accepted: PlannedNotification[] = [];
  const perDay: { [d: string]: number } = {};
  [...cand].sort((a, b) => b.priority - a.priority || a.fireAt - b.fireAt).forEach(n => {
    const dk = stamp(n.fireAt).slice(0, 8);
    if ((perDay[dk] || 0) >= prefs.maxPerDay || accepted.length >= prefs.maxPerWeek) { return; }
    if (accepted.some(a => Math.abs(a.fireAt - n.fireAt) < prefs.minGapMinutes * 60000)) { return; }
    perDay[dk] = (perDay[dk] || 0) + 1;
    accepted.push(n);
  });
  return accepted.sort((a, b) => a.fireAt - b.fireAt);
}
