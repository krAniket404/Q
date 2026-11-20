import { findRanges, findHours } from './timeRange';
import { findAmount, findCategory } from './entities';
import { COMMON_MERCHANTS, TRAINING } from './trainingData';
import { Intent } from './types';

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const PERIOD_RE = /\b(?:so far )?this (?:week|month|year)\b|\b(?:last|previous|prior|past)\s+(?:\d+\s+)?(?:week|month|day|year)s?\b|\btoday\b|\btonight\b|\byesterday\b|\bmonth to date\b|\blately\b|\brecently\b|\ball[- ]time\b|\boverall\b|\b(?:in|during|for|of)\s+(?:january|february|march|april|may|june|july|august|september|october|november|december)\b|\b(?:january|february|march|april|june|july|august|september|october|november|december)\b/g;
const HOURS_RE = /\bafter\s+\d{1,2}\s*(?:a\.?m\.?|p\.?m\.?)?|\bbefore\s+\d{1,2}\s*(?:a\.?m\.?|p\.?m\.?)|\blate[- ]?night\b|\bat night\b|\bmidnight\b|\bweekends?\b|\bweekdays?\b|\bmornings?\b|\bafternoons?\b|\bevenings?\b/g;
const AMT_RE = /(?:₹|rs\.?\s?|rupees?\s?|inr\s?)\d[\d,]*(?:\.\d+)?\s?(?:k|lakhs?)?|\b\d[\d,]*(?:\.\d+)?\s?(?:k|lakhs?|rupees|rs)\b|\b\d{3,}\b/g;
const SYN: { [canonical: string]: string[] } = {
  spend: ['spent', 'spending', 'spends', 'damage', 'cost', 'costs', 'costing', 'burn', 'burned', 'burnt', 'blow', 'blew', 'waste', 'wasted', 'splurge', 'splurged', 'shell', 'shelled', 'fork', 'forked', 'paid', 'pay', 'put', 'expense', 'expenses', 'outflow', 'outgo', 'gone', 'went'],
  biggest: ['largest', 'highest', 'priciest', 'costliest', 'greatest', 'top', 'maximum', 'max'],
  most: ['mostly', 'mainly', 'majority'],
  category: ['categories', 'type', 'types', 'kind', 'bucket', 'buckets', 'area', 'areas', 'group', 'groups', 'sorted', 'rank'],
  merchant: ['merchants', 'shop', 'shops', 'store', 'stores', 'vendor', 'vendors', 'place', 'places'],
  save: ['saved', 'saving', 'savings', 'saves', 'keep', 'kept'],
  income: ['salary', 'earn', 'earned', 'earning', 'earnings', 'receive', 'received', 'credited', 'came', 'paycheck'],
  joke: ['jokes', 'funny', 'laugh', 'humor', 'humour', 'smile', 'amusing'],
  help: ['capable', 'abilities', 'features', 'ask', 'examples', 'work'],
  why: ['reason', 'cause', 'caused', 'causing', 'making', 'driving', 'behind', 'because'],
  overspend: ['overshoot', 'overspending', 'overspent', 'exceed', 'exceeded', 'cross', 'crossed', 'breach', 'break', 'broke'],
  versus: ['vs', 'against', 'compare', 'compared', 'comparison', 'next', 'than'],
  often: ['frequently', 'count', 'number', 'times'],
  impulse: ['impulsive', 'impulsively', 'compulsive', 'spontaneous', 'impulses'],
  recurring: ['repeat', 'repeating', 'repeats', 'automatically', 'autopay', 'monthly', 'subscription', 'subscriptions'],
  safe: ['ok', 'okay', 'fine', 'afford', 'allowance'],
  tip: ['tips', 'advice', 'hack', 'hacks', 'suggestion', 'suggest', 'ways'],
  forecast: ['predict', 'projected', 'projection', 'estimate', 'headed', 'land', 'finish'],
  average: ['avg', 'typical', 'usual', 'normal'],
  day: ['daily', 'days', 'weekday', 'weekdays'],
};
const FOLD: { [w: string]: string } = {};
Object.entries(SYN).forEach(([c, ws]) => ws.forEach(w => { FOLD[w] = c; }));
const fold = (w: string) => FOLD[w] || (w.length > 4 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w);
const STOP = new Set(['i', 'my', 'me', 'the', 'a', 'an', 'is', 'am', 'are', 'it', 'to', 'of', 'in', 'on', 'at', 'do', 'did', 'does', 'you', 'for', 'and', 'that', 'this', 'what', 'whats', 'with', 'so']);
const MASKS = new Set(['PERIOD', 'HOURS', 'AMT', 'MERCH', 'CAT']);

/** Lower-cases, masks slots (periods, hours, amounts, merchants, categories) and returns unigram + bigram tokens. */
export function tokens(text: string, merchants: string[] = []): string[] {
  let t = ' ' + text.toLowerCase().replace(/[’']/g, '') + ' ';
  t = t.replace(PERIOD_RE, ' PERIOD ').replace(HOURS_RE, ' HOURS ').replace(AMT_RE, ' AMT ');
  const ms = [...new Set([...COMMON_MERCHANTS, ...merchants.map(m => m.toLowerCase().trim())])].filter(m => m.length >= 3).sort((a, b) => b.length - a.length);
  ms.forEach(m => { t = t.replace(new RegExp(`\\b${esc(m)}\\b`, 'g'), ' MERCH '); });
  const cat = findCategory(t);
  if (cat) { t = t.replace(/\b(?:food delivery|dining|delivery|restaurants?|takeout|takeaway|eating out|eating|foods?|meals|eat|groceries|grocery|supermarket|vegetables|veggies|travel|cabs?|taxis?|commute|transport|fuel|petrol|trips?|rides?|online shopping|shopping|clothes|clothing|fashion|gadgets|entertainment|movies?|gaming|games|bills?|recharge|electricity|utilities|health|medicines?|medicine|pharmacy|doctor|medical|personal care|grooming|salon|skincare)\b/g, ' CAT '); }
  const words = t.replace(/[^a-zA-Z ]/g, ' ').split(/\s+/).filter(Boolean).map(w => (MASKS.has(w) ? w : fold(w.toLowerCase())));
  const uni = words.filter(w => !STOP.has(w));
  const bi = words.slice(1).map((w, i) => `${words[i]}_${w}`);
  return [...uni, ...bi];
}

class NaiveBayes {
  private counts = new Map<Intent, Map<string, number>>(); private totals = new Map<Intent, number>(); private docs = new Map<Intent, number>(); vocab = new Set<string>();
  train(examples: [Intent, string][]) {
    examples.forEach(([i, text]) => {
      const m = this.counts.get(i) || new Map<string, number>(); this.counts.set(i, m);
      this.docs.set(i, (this.docs.get(i) || 0) + 1);
      tokens(text).forEach(tk => { m.set(tk, (m.get(tk) || 0) + 1); this.totals.set(i, (this.totals.get(i) || 0) + 1); this.vocab.add(tk); });
    });
  }
  scores(tk: string[]): { intent: Intent; log: number }[] {
    const V = this.vocab.size, alpha = 0.4, N = [...this.docs.values()].reduce((a, b) => a + b, 0);
    return [...this.counts.keys()].map(intent => {
      const m = this.counts.get(intent)!, tot = this.totals.get(intent) || 0;
      let log = Math.log((this.docs.get(intent) || 1) / N);
      tk.forEach(w => { log += Math.log(((m.get(w) || 0) + alpha) / (tot + alpha * (V + 1))); });
      return { intent, log };
    });
  }
}
const model = new NaiveBayes();
model.train(TRAINING);

/** Strong, readable cues. They nudge the model; they do not replace it. */
const RULES: [Intent, RegExp, number][] = [
  ['safe_to_spend', /\b(afford|safe to spend|allowance|can i (buy|spend)|enough (budget|money) (for|to))\b/, 6],
  ['explain_change', /\bwhy\b.*\b(spen[dt]|spending|expens\w*|up|more|higher|increase\w*|so much|jump\w*|rise|less|lower|drop\w*)\b|\bwhat (changed|caused|made|is driving)\b/, 6],
  ['compare_periods', /\b(vs\.?|versus|compared? (to|with)|compare)\b|\b(more|less|higher|lower|worse|better) than (last|previous)\b/, 5],
  ['subscriptions', /\bsubscriptions?\b|\brecurring\b|\bautopay\b|\bevery month\b|\bmonthly (charges|payments)\b|\brepeating\b/, 6],
  ['roast', /\broast\b|\bbrutal\b|\bsavage\b|\bburn me\b|\bjudge my\b/, 6],
  ['joke', /\bjokes?\b|\bmake me laugh\b|\bfunny\b/, 6],
  ['persona', /\bpersona\b|\bpersonality\b|\b(kind|type) of spender\b|\bspending style\b/, 6],
  ['impulse', /\bimpuls\w*\b/, 5],
  ['score_explain', /\b(wellness|financial|discipline|volatility)\s+score\b|\bmy score\b|\bhow is my score\b/, 4],
  ['merchant_count', /\bhow (many|often|frequently)\b.*\b(times?|orders?|rides?|purchases?|transactions?|visits?|use|paid)\b/, 4],
  ['month_forecast', /\b(forecast|predict\w*|project\w*|end of (the )?month|month[- ]end|on track|finish the month|run out|at this pace|will i (spend|overspend|exceed|stay))\b/, 6],
  ['biggest_purchases', /\b(biggest|largest|highest|most expensive|costliest)\b.*\b(purchases?|transactions?|expenses?|payments?|spend|thing)\b/, 5],
  ['top_categories', /\bwhere (does|is|did) (all )?my money (go|going|went)\b|\bwhat do i spend (the )?most on\b|\bcategor(y|ies)\b.*\b(most|top|breakdown|wise)\b|\bbreak ?down\b/, 4],
  ['top_merchants', /\b(top|most (frequent|visited)) merchants?\b|\bwho (do i pay|gets)\b|\bwhich (shop|store|merchant|app|place)\b/, 5],
  ['when_spend', /\b(what time|when|which (day|hour|weekday|time)|busiest|peak|riskiest)\b.*\b(spen[dt]|spending|shop|order|overspend|expensive|buy)\b|\bnight spender\b/, 5],
  ['budget_status', /\bbudgets?\b|\b(over|exceed\w*|crossed) (my |the )?(limit|budget)\b|\blimits?\b/, 3],
  ['income_savings', /\b(saved|savings|income|salary|earn\w*|received|net savings)\b/, 3],
  ['saving_tip', /\b(tips?|advice|hack)\b|\bhow (can|do|to) i (save|cut|reduce)\b|\bhelp me save\b|\bcut back\b|\bways to spend less\b/, 5],
  ['daily_average', /\b(average|avg|typical)\b.*\b(day|daily)\b|\b(per|a|each) day\b|\bdaily (average|spend|cost)\b/, 3],
  ['month_forecast', /\bovershoot\w*\b|\bby the (end|\d+(st|nd|rd|th))\b|\bunder budget\b|\bblow my budget\b/, 5],
  ['help', /^\s*help\s*$|\bwhat can (you|i)\b|\bhow do you work\b|\bwhat (should|can) i ask\b|\bcapable of\b|\bhow does this work\b|\bhelp me use\b|\bwhat can i do here\b|\bexamples? of questions\b/, 6],
];

export interface Classification { intent: Intent; confidence: number; ranked: { intent: Intent; p: number }[]; }

export function classify(question: string, merchants: string[] = []): Classification {
  const q = question.toLowerCase();
  const tk = tokens(question, merchants);
  const content = tk.filter(t => !t.includes('_') && !MASKS.has(t));
  const seen = content.filter(t => model.vocab.has(t)).length;
  const boosts: { [i: string]: number } = {};
  RULES.forEach(([i, re, w]) => { if (re.test(q)) { boosts[i] = Math.max(boosts[i] || 0, w); } });
  const anyBoost = Object.keys(boosts).length > 0;
  const coverage = content.length ? seen / content.length : 0;
  if (!anyBoost && (content.length === 0 || coverage < 0.5)) { return { intent: 'unknown', confidence: 0, ranked: [] }; }
  const raw = model.scores(tk).map(s => ({ intent: s.intent, log: s.log + (boosts[s.intent] || 0) }));
  const max = Math.max(...raw.map(r => r.log));
  const exps = raw.map(r => ({ intent: r.intent, e: Math.exp((r.log - max) / Math.max(2, tk.length / 3)) }));
  const z = exps.reduce((s, r) => s + r.e, 0);
  const ranked = exps.map(r => ({ intent: r.intent, p: r.e / z })).sort((a, b) => b.p - a.p);
  const top = ranked[0];
  if (!anyBoost && top.p < 0.3) { return { intent: 'unknown', confidence: top.p, ranked }; }
  return { intent: top.intent, confidence: top.p, ranked };
}

/** Pulls every slot the question mentions. */
export function parseSlots(question: string, now: Date, merchants: string[], earliest?: Date) {
  const ranges = findRanges(question, now, earliest);
  return { ranges: ranges.map(r => r.range), ...findHours(question), category: findCategory(question), amount: findAmount(question) };
}
