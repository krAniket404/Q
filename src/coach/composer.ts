import { EngineResult, Intent, Tone } from './types';

const hash = (s: string) => { let h = 0; for (let i = 0; i < s.length; i++) { h = (h * 31 + s.charCodeAt(i)) >>> 0; } return h; };
const QUIPS: { up: string[]; down: string[] } = {
  up: ['Bold strategy.', 'Your wallet noticed.', 'Future you is taking notes.', 'That escalated.'],
  down: ['Look at you, behaving.', 'Suspiciously responsible.', 'Keep that energy.', 'Growth, quietly.'],
};
const QUIP_INTENTS: Intent[] = ['total_spend', 'compare_periods', 'explain_change', 'month_forecast', 'income_savings'];

/** Turns an engine result into chat text. Numbers are never changed here; only wording and an optional one-line quip. */
export function compose(r: EngineResult, tone: Tone, seed: string): string {
  const body = r.intent === 'help' ? r.lines.join('\n') : r.lines.join(' ');
  let text = body ? `${r.headline}${r.intent === 'help' ? '\n' : '\n\n'}${body}` : r.headline;
  if (tone === 'sassy' && r.ok && r.mood && r.mood !== 'flat' && QUIP_INTENTS.includes(r.intent) && hash(seed) % 3 !== 0) {
    const set = QUIPS[r.mood];
    text += ` ${set[hash(seed + r.intent) % set.length]}`;
  }
  return text;
}
