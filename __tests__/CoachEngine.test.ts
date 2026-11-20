import { generateUser } from '../src/ml/synthetic';
import { answerQuestion } from '../src/coach/answerQuestion';
import { classify } from '../src/coach/intents';
import { detectSubscriptions, inr, prep } from '../src/coach/queryEngine';
import { buildPrompt, extractNumbers, snapshot, validateAnswer } from '../src/coach/llm';
import { findRanges } from '../src/coach/timeRange';
import { CoachContext, CoachData } from '../src/coach/types';
import { HELD_OUT, OFF_TOPIC } from '../test-data/coach/heldOut';
import { FINAL_TEST, FINAL_OFF_TOPIC } from '../test-data/coach/finalTest';

jest.setTimeout(60000);
const NOW = new Date(2026, 9, 21, 15, 0);                    // Wed 21 Oct 2026
const tx = generateUser(3, 'midnight_impulser', 180, new Date(2026, 9, 21), 'u');
const data: CoachData = { transactions: tx, now: NOW, scores: { discipline: 40, impulse: 72, volatility: 30, wellness: 55, savingsRate: 10 } };
const ask = (q: string, extra: Partial<CoachData> = {}, ctx?: CoachContext) => answerQuestion({ question: q, data: { ...data, ...extra }, ctx, tone: 'plain' });

// independent brute force
const D = (y: number, m: number, d: number) => new Date(y, m, d);
const debits = prep(tx).filter(t => t.type === 'debit');
const total = (f: (t: any) => boolean) => debits.filter(f).reduce((s, t) => s + t.amount, 0);
const between = (a: Date, b: Date) => (t: any) => t.date >= a && t.date < b;
const THIS_M = between(D(2026, 9, 1), D(2026, 9, 22)), LAST_M = between(D(2026, 8, 1), D(2026, 9, 1));
const FOOD = (t: any) => t.category === 'Food' || t.category === 'Dining & Delivery';

describe('question understanding', () => {
  test('time expressions', () => {
    const r = (q: string) => findRanges(q, NOW).map(h => h.range.label);
    expect(r('how much did I spend last week')).toEqual(['last week']);
    expect(r('this month vs last month')).toEqual(['this month', 'last month']);
    expect(r('what about september')).toEqual(['in September']);
    expect(r('I may spend more')).toEqual([]);               // "may" the verb is not May
    expect(r('past 10 days')).toEqual(['the last 10 days']);
  });
  const acc = (set: [string, string][]) => set.filter(([want, q]) => classify(q, ['Swiggy', 'Uber', 'Amazon', 'Starbucks']).intent === want).length / set.length;
  test('classifier accuracy on questions it was tuned on', () => { expect(acc(HELD_OUT as any)).toBeGreaterThanOrEqual(0.9); });
  test('classifier accuracy on a separate set scored once after tuning', () => {
    const a = acc(FINAL_TEST as any);
    const wrong = FINAL_TEST.filter(([w, q]) => { const i = classify(q, ['Swiggy', 'Uber', 'Amazon', 'Starbucks']).intent; return i !== w && i !== 'unknown'; });
    console.log(`separate test: ${(a * 100).toFixed(1)}% correct, ${wrong.length} confidently wrong`);
    expect(a).toBeGreaterThanOrEqual(0.9);
    expect(wrong.length).toBeLessThanOrEqual(1);
  });
  test('it does not answer off-topic questions as if they were about money', () => {
    expect([...OFF_TOPIC, ...FINAL_OFF_TOPIC].filter(q => classify(q).intent !== 'unknown')).toEqual([]);
  });
});

describe('answers match an independent calculation', () => {
  test('total spend last month', async () => { expect((await ask('How much did I spend last month?')).text).toContain(inr(total(LAST_M))); });
  test('category + period', async () => { expect((await ask('How much did I spend on food this month?')).text).toContain(inr(total(t => THIS_M(t) && FOOD(t)))); });
  test('merchant count', async () => {
    const n = debits.filter(t => THIS_M(t) && t.merchant === 'Swiggy').length;
    const a = await ask('how many times did I order from swiggy this month?');
    expect(a.intent).toBe('merchant_count');
    expect(a.text).toContain(n === 1 ? '1 time' : `${n} times`);
    expect(a.text).toContain(inr(total(t => THIS_M(t) && t.merchant === 'Swiggy')));
  });
  test('hours filter', async () => { expect((await ask('how much did I spend after 9 pm this month')).text).toContain(inr(total(t => THIS_M(t) && (t.date.getHours() >= 21 || t.date.getHours() < 5)))); });
  test('weekends', async () => { expect((await ask('how much did I spend on weekends last month')).text).toContain(inr(total(t => LAST_M(t) && (t.date.getDay() === 0 || t.date.getDay() === 6)))); });
  test('biggest purchase', async () => {
    const big = [...debits.filter(THIS_M)].sort((a, b) => b.amount - a.amount)[0];
    const a = await ask("what was my biggest purchase this month");
    expect(a.intent).toBe('biggest_purchases'); expect(a.text).toContain(inr(big.amount)); expect(a.text).toContain(big.merchant);
  });
  test('comparison uses the same days of last month', async () => {
    const a = await ask('this month vs last month');
    expect(a.intent).toBe('compare_periods');
    expect(a.text).toContain(inr(total(THIS_M)));
    expect(a.text).toContain(inr(total(between(D(2026, 8, 1), D(2026, 8, 22)))));
  });
  test('explaining a change finds the true biggest driver', async () => {
    const cur = new Map<string, number>(), prev = new Map<string, number>();
    debits.forEach(t => { const c = t.category === 'Food' ? 'Dining & Delivery' : t.category || 'Other'; if (THIS_M(t)) cur.set(c, (cur.get(c) || 0) + t.amount); if (between(D(2026, 8, 1), D(2026, 8, 22))(t)) prev.set(c, (prev.get(c) || 0) + t.amount); });
    const cats = [...new Set([...cur.keys(), ...prev.keys()])].map(c => ({ c, d: (cur.get(c) || 0) - (prev.get(c) || 0) }));
    const up = total(THIS_M) > total(between(D(2026, 8, 1), D(2026, 8, 22)));
    const lead = cats.sort((a, b) => (up ? b.d - a.d : a.d - b.d))[0];
    const a = await ask('why did I spend so much this month');
    expect(a.intent).toBe('explain_change');
    expect(a.text).toContain(lead.c); expect(a.text).toContain(inr(Math.abs(lead.d)));
  });
  test('daily average', async () => { expect((await ask('what is my average spend per day this month')).text).toContain(inr(total(THIS_M) / 21)); });
  test('subscriptions are found and totalled', async () => {
    const subs = detectSubscriptions(debits);
    expect(subs.length).toBeGreaterThan(0);
    const monthly = subs.reduce((s, x) => s + x.amount, 0);
    const a = await ask('what subscriptions do I have');
    expect(a.intent).toBe('subscriptions'); expect(a.text).toContain(inr(monthly)); expect(a.text).toContain(inr(monthly * 12));
  });
  test('income and savings', async () => {
    const inc = prep(tx).filter(t => t.type === 'credit' && THIS_M(t)).reduce((s, t) => s + t.amount, 0), out = total(THIS_M);
    const a = await ask('how much did I save this month');
    expect(a.text).toContain(inr(inc));
    expect(a.text).toContain(out < inc ? `${Math.round(((inc - out) / inc) * 100)}%` : inr(out - inc));
  });
  test('month forecast brackets a sensible figure', async () => {
    const a = await ask('how much will I spend this month');
    const nums = a.text.match(/₹[\d,]+/g)!.map(s => +s.replace(/[₹,]/g, ''));
    expect(a.intent).toBe('month_forecast');
    expect(nums[0]).toBeGreaterThanOrEqual(total(THIS_M));
    expect(nums[1]).toBeLessThanOrEqual(nums[0]); expect(nums[0]).toBeLessThanOrEqual(nums[2]);
  });
  test('affordability uses the remaining budget', async () => {
    const spent = total(THIS_M);
    const a = await ask('can I afford 2500', { budgets: { Shopping: spent + 20000 } });
    expect(a.intent).toBe('safe_to_spend'); expect(a.text).toContain('Yes'); expect(a.text).toContain(inr(20000));
    const b = await ask('can I afford 25000', { budgets: { Shopping: spent + 4000 } });
    expect(b.text).toMatch(/Not comfortably/); expect(b.text).toContain(inr(4000));
  });
  test('busiest slot', async () => { const a = await ask('what time do I spend the most'); expect(a.intent).toBe('when_spend'); expect(a.text).toMatch(/PM|AM/); });
  test('score explanation names the weakest part', async () => { expect((await ask('why is my score low')).text).toMatch(/savings rate|discipline/i); });
});

describe('conversation', () => {
  test('follow-ups reuse the previous question', async () => {
    const first = await ask('how much did I spend on food this month?');
    const second = await ask('and last month?', {}, first.ctx);
    expect(second.intent).toBe('total_spend');
    expect(second.text).toContain(inr(total(t => LAST_M(t) && FOOD(t))));
    const third = await ask('what about shopping?', {}, second.ctx);
    expect(third.text).toContain(inr(total(t => LAST_M(t) && t.category === 'Shopping')));
    const why = await ask('why?', {}, third.ctx);
    expect(why.intent).toBe('explain_change');
  });
  test('built-in roast / joke lines still work', async () => {
    const a = await answerQuestion({ question: 'roast me', data, legacy: () => 'LEGACY ROAST' });
    expect(a.source).toBe('legacy'); expect(a.text).toBe('LEGACY ROAST');
  });
});

describe('outside AI model: used last, and never trusted blindly', () => {
  test('extracts and validates numbers', () => {
    expect(extractNumbers('You spent ₹2,500 (31%) and ₹1.5k, about 12 times')).toEqual([2500, 31, 1500]);
    expect(validateAnswer('You spent ₹2,500, up 31%.', [2500, 31])).toBe(true);
    expect(validateAnswer('You spent ₹9,999.', [2500])).toBe(false);
    expect(validateAnswer('See https://x.com for ₹2,500', [2500])).toBe(false);
  });
  test('the prompt carries totals only: no merchants, no transaction dates', () => {
    const snap = snapshot(data); const prompt = buildPrompt('tell me something', snap, 'plain');
    ['Swiggy', 'Zomato', 'Amazon', 'Uber', 'Netflix'].forEach(m => expect(prompt).not.toContain(m));
    expect(prompt).not.toMatch(/\d{4}-\d{2}-\d{2}/);
    expect(snap.facts.length).toBeGreaterThan(2);
  });
  test('accepts a reply made only of known figures; rejects an invented one', async () => {
    const snap = snapshot(data); const known = snap.numbers.find(n => n > 1000)!;
    const good = await answerQuestion({ question: 'is my money doing okay overall', data, llm: async () => `Your month looks fine so far, you've spent ${inr(known)}.` });
    expect(good.source).toBe('llm');
    const bad = await answerQuestion({ question: 'is my money doing okay overall', data, llm: async () => 'You spent ₹77,777 which is 91% too much.' });
    expect(bad.source).toBe('fallback');
  });
  test('engine answers never call the model', async () => {
    const llm = jest.fn(async () => 'x');
    const a = await answerQuestion({ question: 'how much did I spend last month', data, llm });
    expect(a.source).toBe('engine'); expect(llm).not.toHaveBeenCalled();
  });
  test('model errors fall back gracefully', async () => {
    const a = await answerQuestion({ question: 'what is the weather', data, llm: async () => { throw new Error('offline'); } });
    expect(a.source).toBe('fallback'); expect(a.text).toMatch(/How much did I spend/);
  });
});

describe('never breaks on thin or empty data', () => {
  const qs = ['how much did I spend', 'top categories', 'top merchants', 'biggest purchase', 'compare this month with last month', 'how much will I spend this month', 'daily average', 'how many times did I order from swiggy', 'what subscriptions do I have', 'how much did I save', 'what time do I spend the most', 'why did I spend so much', 'can I afford 500', 'am I over budget', 'why is my impulse score high', 'why is my score low', 'help'];
  test.each([[[]], [tx.slice(0, 4)]])('%#', async t => {
    for (const q of qs) {
      const a = await answerQuestion({ question: q, data: { transactions: t as any, now: NOW }, tone: 'sassy' });
      expect(typeof a.text).toBe('string'); expect(a.text.length).toBeGreaterThan(5);
      expect(a.text).not.toMatch(/NaN|undefined|Infinity/);
    }
  });
});
