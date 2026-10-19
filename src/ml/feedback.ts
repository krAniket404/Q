/**
 * What the user does with a notification teaches Q when to stay quiet.
 * Ignore three of the same alert in a row and it backs off for days; "not helpful" silences it for two weeks.
 */
export type Outcome = 'opened' | 'acted' | 'dismissed' | 'snoozed' | 'not_helpful';
export interface FeedbackEntry { shown: number; opened: number; acted: number; dismissStreak: number; mutedUntil: number; }
export type FeedbackState = { [key: string]: FeedbackEntry };

const DAY = 86400000;
const blank = (): FeedbackEntry => ({ shown: 0, opened: 0, acted: 0, dismissStreak: 0, mutedUntil: 0 });

export function recordShown(state: FeedbackState, key: string): FeedbackState {
  const e = state[key] ?? blank();
  return { ...state, [key]: { ...e, shown: e.shown + 1 } };
}

export function recordOutcome(state: FeedbackState, key: string, outcome: Outcome, now: number): FeedbackState {
  const e = { ...(state[key] ?? blank()) };
  switch (outcome) {
    case 'opened': e.opened++; e.dismissStreak = 0; break;
    case 'acted': e.acted++; e.opened++; e.dismissStreak = 0; e.mutedUntil = 0; break;
    case 'snoozed': e.mutedUntil = Math.max(e.mutedUntil, now + DAY); break;
    case 'not_helpful': e.mutedUntil = now + 14 * DAY; e.dismissStreak = 0; break;
    case 'dismissed':
      e.dismissStreak++;
      if (e.dismissStreak >= 9) { e.mutedUntil = now + 21 * DAY; }
      else if (e.dismissStreak >= 6) { e.mutedUntil = now + 7 * DAY; }
      else if (e.dismissStreak >= 3) { e.mutedUntil = now + 3 * DAY; }
      break;
  }
  return { ...state, [key]: e };
}

export const isMuted = (state: FeedbackState | undefined, key: string, at: number) => !!state && (state[key]?.mutedUntil ?? 0) > at;
export const engagementRate = (e?: FeedbackEntry) => (!e || e.shown === 0 ? null : e.opened / e.shown);
