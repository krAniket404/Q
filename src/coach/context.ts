import { CoachContext, Intent, Slots } from './types';

const FOLLOW = /^\s*(and|what about|how about|also|same (for|but)|now|then|what of|how's|how is|ok(ay)? (and|so))\b/i;

export interface Resolved { intent: Intent; slots: Slots; followUp: boolean; }

/** "And last month?" or "what about food?" only make sense with the previous question in mind. */
export function resolveFollowUp(question: string, intent: Intent, confidence: number, found: Slots, ctx: CoachContext): Resolved {
  const hasNew = !!(found.range || found.category || found.merchant || found.hourFrom !== undefined || found.weekend || found.weekdays);
  const words = question.trim().split(/\s+/).length;
  const bareWhy = /^\s*(why|how come|why is that|why so)\s*\??\s*$/i.test(question);
  const looksFollow = FOLLOW.test(question) || (words <= 6 && hasNew && (intent === 'unknown' || confidence < 0.45));
  if (ctx.intent && ctx.slots && (bareWhy || looksFollow)) {
    if (bareWhy) { return { intent: 'explain_change', slots: { ...ctx.slots }, followUp: true }; }
    const slots: Slots = { ...ctx.slots };
    (Object.keys(found) as (keyof Slots)[]).forEach(k => { if (found[k] !== undefined) { (slots as any)[k] = found[k]; } });
    if (found.range && !found.compareTo) { delete slots.compareTo; }
    const keepIntent = intent === 'unknown' || confidence < 0.45 ? ctx.intent : intent;
    return { intent: keepIntent, slots, followUp: true };
  }
  return { intent, slots: found, followUp: false };
}
export const nextContext = (intent: Intent, slots: Slots, ctx: CoachContext): CoachContext => ({ intent, slots, turns: ctx.turns + 1 });
