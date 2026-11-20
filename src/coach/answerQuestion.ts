import { classify, parseSlots } from './intents';
import { compose } from './composer';
import { nextContext, resolveFollowUp } from './context';
import { findMerchant } from './entities';
import { ModelCall, askModel } from './llm';
import { prep, runIntent, ENGINE_INTENTS } from './queryEngine';
import { namedRange } from './timeRange';
import { CoachContext, CoachData, Intent, Slots, Tone } from './types';

export interface CoachAnswer { text: string; source: 'engine' | 'legacy' | 'llm' | 'fallback'; intent: Intent; confidence: number; followUps: string[]; ctx: CoachContext; }
export interface AnswerInput {
  question: string; data: CoachData; ctx?: CoachContext; tone?: Tone;
  legacy?: (question: string) => string | null;          // the app's built-in roast / tip / joke / persona lines
  llm?: ModelCall;                                       // only used for questions the engine cannot answer
}
const LEGACY: Intent[] = ['roast', 'saving_tip', 'joke', 'persona'];
/** The app's existing lines are looked up by a fixed phrase for the intent, not by whatever words the user typed. */
const LEGACY_PHRASE: { [k: string]: string } = { roast: 'roast', saving_tip: 'harsh saving tip', joke: 'joke', persona: 'persona' };

export function suggestions(data: CoachData): string[] {
  const tx = prep(data.transactions).filter(t => t.type === 'debit');
  const cats: { [c: string]: number } = {};
  tx.forEach(t => { const c = t.category || 'Other'; cats[c] = (cats[c] || 0) + t.amount; });
  const top = Object.entries(cats).sort((a, b) => b[1] - a[1])[0]?.[0];
  return [top ? `How much did I spend on ${top === 'Food' ? 'food' : top} this month?` : 'How much did I spend this month?', 'Why did my spending change?', 'What time do I spend the most?'];
}

export async function answerQuestion(input: AnswerInput): Promise<CoachAnswer> {
  const { question, data } = input;
  const ctx: CoachContext = input.ctx ?? { turns: 0 };
  const tone = input.tone ?? 'sassy';
  const all = prep(data.transactions);
  const merchants = [...new Set(all.map(t => t.merchant).filter(Boolean))].slice(0, 400);
  const earliest = all.length ? new Date(Math.min(...all.map(t => t.date.getTime()))) : undefined;

  const cls = classify(question, merchants);
  const p = parseSlots(question, data.now, merchants, earliest);
  const found: Slots = { category: p.category, merchant: findMerchant(question, merchants), amount: p.amount, hourFrom: p.hourFrom, hourTo: p.hourTo, hoursLabel: p.hoursLabel, weekend: p.weekend, weekdays: p.weekdays };
  if (p.ranges.length >= 2) { found.range = p.ranges[0]; found.compareTo = p.ranges[1]; }
  else if (p.ranges.length === 1) { found.range = p.ranges[0]; }
  Object.keys(found).forEach(k => { if ((found as any)[k] === undefined) { delete (found as any)[k]; } });

  const r = resolveFollowUp(question, cls.intent, cls.confidence, found, ctx);
  let { intent, slots } = r;
  // "than last month" with one period named: compare this period against it.
  if (intent === 'compare_periods' && slots.range && !slots.compareTo && /\b(than|vs\.?|versus|compared? (to|with))\b/i.test(question)) {
    const named = slots.range;
    slots = { ...slots, range: undefined, compareTo: named };
    if (named.key === 'last_week') { slots.range = namedRange('this_week', data.now); }
    else if (named.key === 'last_month') { slots.range = namedRange('this_month', data.now); }
    else { delete slots.compareTo; slots.range = named; }
  }
  const done = (text: string, source: CoachAnswer['source'], followUps: string[] = []): CoachAnswer => ({ text, source, intent, confidence: cls.confidence, followUps, ctx: nextContext(intent, slots, ctx) });

  if (LEGACY.includes(intent) && input.legacy) {
    const t = input.legacy(LEGACY_PHRASE[intent]);
    if (t) { return done(t, 'legacy'); }
  }
  if (ENGINE_INTENTS.includes(intent)) {
    const res = runIntent(intent, slots, data);
    if (res) { return done(compose(res, tone, question), 'engine', res.followUps); }
  }
  if (input.llm) {
    const t = await askModel(question, data, input.llm, tone);
    if (t) { return done(t, 'llm'); }
  }
  const s = suggestions(data);
  return done(`I can't work that one out from your spending. I'm best at questions about your own money, like:\n"${s[0]}"\n"${s[1]}"\n"${s[2]}"`, 'fallback', s);
}
