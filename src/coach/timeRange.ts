import { Slots, TimeRange } from './types';

const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const sod = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const monday = (d: Date) => addDays(sod(d), -((d.getDay() + 6) % 7));
const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
const mk = (from: Date, to: Date, label: string, key: string): TimeRange => ({ from, to, label, key });

export function namedRange(kind: string, now: Date, earliest?: Date): TimeRange {
  const today = sod(now), tomorrow = addDays(today, 1);
  switch (kind) {
    case 'today': return mk(today, tomorrow, 'today', 'today');
    case 'yesterday': return mk(addDays(today, -1), today, 'yesterday', 'yesterday');
    case 'this_week': return mk(monday(now), tomorrow, 'this week', 'this_week');
    case 'last_week': { const m = monday(now); return mk(addDays(m, -7), m, 'last week', 'last_week'); }
    case 'this_month': return mk(new Date(now.getFullYear(), now.getMonth(), 1), tomorrow, 'this month', 'this_month');
    case 'last_month': return mk(new Date(now.getFullYear(), now.getMonth() - 1, 1), new Date(now.getFullYear(), now.getMonth(), 1), 'last month', 'last_month');
    case 'this_year': return mk(new Date(now.getFullYear(), 0, 1), tomorrow, 'this year', 'this_year');
    case 'recent': return mk(addDays(today, -13), tomorrow, 'the last 2 weeks', 'recent');
    case 'all_time': return mk(earliest ? sod(earliest) : new Date(2000, 0, 1), tomorrow, 'overall', 'all_time');
    default: throw new Error('unknown range ' + kind);
  }
}
export const rolling = (n: number, unit: string, now: Date): TimeRange => {
  const today = sod(now), days = unit.startsWith('week') ? n * 7 : unit.startsWith('month') ? n * 30 : n;
  return mk(addDays(today, -(days - 1)), addDays(today, 1), `the last ${n} ${n === 1 ? unit.replace(/s$/, '') : unit.replace(/s?$/, 's')}`, `last_${n}_${unit}`);
};
export const monthRange = (m: number, now: Date): TimeRange => {
  const y = m > now.getMonth() ? now.getFullYear() - 1 : now.getFullYear();
  return mk(new Date(y, m, 1), new Date(y, m + 1, 1), `in ${MONTHS[m][0].toUpperCase() + MONTHS[m].slice(1)}`, `month_${y}_${m}`);
};

type Hit = { index: number; end: number; range: TimeRange };
/** Time expressions in the order they appear in the question. */
export function findRanges(text: string, now: Date, earliest?: Date): Hit[] {
  const t = text.toLowerCase();
  const hits: Hit[] = [];
  const add = (re: RegExp, build: (m: RegExpExecArray) => TimeRange) => {
    const g = new RegExp(re.source, 'g'); let m: RegExpExecArray | null;
    while ((m = g.exec(t))) { if (!hits.some(h => m!.index < h.end && m!.index + m![0].length > h.index)) { hits.push({ index: m.index, end: m.index + m[0].length, range: build(m) }); } }
  };
  add(/\b(?:last|past|previous)\s+(\d+)\s+(days?|weeks?|months?)\b/, m => rolling(+m[1], m[2], now));
  add(/\b(?:the\s+)?(?:past|last)\s+(week)\b(?!\s*end)/, m => (m[0].includes('past') ? rolling(7, 'days', now) : namedRange('last_week', now)));
  add(/\b(?:so far )?this month\b|\bmonth to date\b|\bmtd\b/, () => namedRange('this_month', now));
  add(/\b(?:last|previous)\s+month\b/, () => namedRange('last_month', now));
  add(/\bthis week\b/, () => namedRange('this_week', now));
  add(/\b(?:previous|prior)\s+week\b/, () => namedRange('last_week', now));
  add(/\byesterday\b/, () => namedRange('yesterday', now));
  add(/\btoday\b|\btonight\b/, () => namedRange('today', now));
  add(/\bthis year\b/, () => namedRange('this_year', now));
  add(/\blately\b|\brecently\b/, () => namedRange('recent', now));
  add(/\ball[- ]time\b|\bso far\b|\bever\b|\boverall\b|\bin total\b/, () => namedRange('all_time', now, earliest));
  MONTHS.forEach((name, mi) => {
    // "may" is also a verb, so it only counts as a month after a preposition.
    const bare = name === 'may' ? '' : `|\\b${name}\\b`;
    add(new RegExp(`\\b(?:in|during|for|of)\\s+(?:${name}|${name.slice(0, 3)}\\.?)\\b${bare}`), () => monthRange(mi, now));
  });
  return hits.sort((a, b) => a.index - b.index);
}

const h24 = (h: number, ap?: string) => { const a = (ap || '').replace(/\./g, ''); return a === 'pm' ? (h % 12) + 12 : a === 'am' ? h % 12 : h; };

/** Hour-of-day and weekday cues ("after 9 pm", "late night", "weekends"). */
export function findHours(text: string): Pick<Slots, 'hourFrom' | 'hourTo' | 'hoursLabel' | 'weekend' | 'weekdays'> {
  const t = text.toLowerCase();
  const out: Pick<Slots, 'hourFrom' | 'hourTo' | 'hoursLabel' | 'weekend' | 'weekdays'> = {};
  let m = /\bafter\s+(\d{1,2})(?::\d{2})?\s*(a\.?m\.?|p\.?m\.?)?/.exec(t);
  if (m && (m[2] || +m[1] >= 12)) { const h = h24(+m[1], m[2]); out.hourFrom = h; out.hourTo = 5; out.hoursLabel = `after ${(h % 12) || 12} ${h < 12 ? 'AM' : 'PM'}`; }
  else if ((m = /\bbefore\s+(\d{1,2})(?::\d{2})?\s*(a\.?m\.?|p\.?m\.?)/.exec(t))) { const h = h24(+m[1], m[2]); out.hourFrom = 5; out.hourTo = h; out.hoursLabel = `before ${(h % 12) || 12} ${h < 12 ? 'AM' : 'PM'}`; }
  else if (/\blate[- ]?night\b|\bmidnight\b|\bat night\b|\bnight\b|\blate at night\b/.test(t)) { out.hourFrom = 21; out.hourTo = 5; out.hoursLabel = 'late at night (9 PM to 5 AM)'; }
  else if (/\bmornings?\b/.test(t)) { out.hourFrom = 5; out.hourTo = 12; out.hoursLabel = 'in the morning'; }
  else if (/\bafternoons?\b/.test(t)) { out.hourFrom = 12; out.hourTo = 17; out.hoursLabel = 'in the afternoon'; }
  else if (/\bevenings?\b/.test(t)) { out.hourFrom = 17; out.hourTo = 21; out.hoursLabel = 'in the evening'; }
  if (/\bweekends?\b/.test(t)) { out.weekend = true; }
  else if (/\bweekdays?\b/.test(t)) { out.weekdays = true; }
  return out;
}
export const hourInWindow = (h: number, from: number, to: number) => (from <= to ? h >= from && h < to : h >= from || h < to);
