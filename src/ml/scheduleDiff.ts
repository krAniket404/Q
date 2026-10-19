import { PlannedNotification } from './notificationPlanner';

/** Compares what is already scheduled with a fresh plan, so only real changes touch the alarm system. */
export function diffSchedule(previous: PlannedNotification[], next: PlannedNotification[]): { toCancel: string[]; toSchedule: PlannedNotification[] } {
  const prev = new Map(previous.map(p => [p.id, p]));
  const nxt = new Map(next.map(n => [n.id, n]));
  const toCancel = previous.filter(p => !nxt.has(p.id)).map(p => p.id);
  const toSchedule = next.filter(n => { const p = prev.get(n.id); return !p || p.title !== n.title || p.body !== n.body || p.fireAt !== n.fireAt; });
  return { toCancel, toSchedule };
}
