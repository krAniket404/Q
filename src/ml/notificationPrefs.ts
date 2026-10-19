export type NotificationKind = 'risk_window' | 'bill_due' | 'budget_pace' | 'payday' | 'streak_guard' | 'weekly_summary';
export type Sensitivity = 'low' | 'normal' | 'high';

export interface NotificationPrefs {
  enabled: boolean;
  kinds: Record<NotificationKind, boolean>;
  quiet: { startHour: number; endHour: number };   // no alerts while the hour is in [start, end); wraps past midnight if start > end
  maxPerDay: number;
  maxPerWeek: number;
  minGapMinutes: number;
  leadMinutes: number;                              // how long before a risk window the heads-up arrives
  sensitivity: Sensitivity;                         // how sure Q must be before it speaks up
  snoozeUntil: number | null;
}

export const KIND_LABELS: Record<NotificationKind, string> = {
  risk_window: 'Heads-up before my biggest spending hours',
  bill_due: 'Bills and subscriptions renewing',
  budget_pace: 'A category is close to its limit',
  payday: 'Payday spending reminder',
  streak_guard: 'Mention my streak in heads-ups',
  weekly_summary: 'Sunday weekly summary',
};

export const SENSITIVITY: Record<Sensitivity, { minConfidence: number; minShare: number }> = {
  low: { minConfidence: 0.6, minShare: 0.15 },
  normal: { minConfidence: 0.4, minShare: 0.1 },
  high: { minConfidence: 0.25, minShare: 0.06 },
};

export const defaultPrefs = (): NotificationPrefs => ({
  enabled: true,
  kinds: { risk_window: true, bill_due: true, budget_pace: true, payday: true, streak_guard: true, weekly_summary: true },
  quiet: { startHour: 0, endHour: 7 },
  maxPerDay: 3,
  maxPerWeek: 14,
  minGapMinutes: 180,
  leadMinutes: 30,
  sensitivity: 'normal',
  snoozeUntil: null,
});

const clamp = (n: any, lo: number, hi: number, d: number) => (typeof n === 'number' && isFinite(n) ? Math.min(hi, Math.max(lo, Math.round(n))) : d);

/** Safe to call on anything read from storage: unknown or broken values fall back to defaults. */
export function sanitizePrefs(raw: any): NotificationPrefs {
  const d = defaultPrefs();
  if (!raw || typeof raw !== 'object') { return d; }
  const kinds = { ...d.kinds };
  (Object.keys(kinds) as NotificationKind[]).forEach(k => { if (typeof raw.kinds?.[k] === 'boolean') { kinds[k] = raw.kinds[k]; } });
  return {
    enabled: typeof raw.enabled === 'boolean' ? raw.enabled : d.enabled,
    kinds,
    quiet: { startHour: clamp(raw.quiet?.startHour, 0, 23, d.quiet.startHour), endHour: clamp(raw.quiet?.endHour, 0, 23, d.quiet.endHour) },
    maxPerDay: clamp(raw.maxPerDay, 0, 10, d.maxPerDay),
    maxPerWeek: clamp(raw.maxPerWeek, 0, 40, d.maxPerWeek),
    minGapMinutes: clamp(raw.minGapMinutes, 15, 720, d.minGapMinutes),
    leadMinutes: clamp(raw.leadMinutes, 5, 120, d.leadMinutes),
    sensitivity: raw.sensitivity === 'low' || raw.sensitivity === 'high' ? raw.sensitivity : 'normal',
    snoozeUntil: typeof raw.snoozeUntil === 'number' && raw.snoozeUntil > 0 ? raw.snoozeUntil : null,
  };
}

export const inQuietHours = (hour: number, q: { startHour: number; endHour: number }) =>
  q.startHour === q.endHour ? false : q.startHour < q.endHour ? hour >= q.startHour && hour < q.endHour : hour >= q.startHour || hour < q.endHour;
