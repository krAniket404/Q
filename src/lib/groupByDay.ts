export interface DaySection<T> { key: string; title: string; total: number; data: T[]; }

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const keyOf = (d: Date) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;

/** Groups transactions into days (newest first) with a "spent that day" total. */
export function groupByDay<T extends { date: Date | string | number; amount: number; type: string }>(items: T[], now: Date = new Date()): DaySection<T>[] {
  const today = keyOf(now);
  const y = new Date(now); y.setDate(y.getDate() - 1);
  const yesterday = keyOf(y);
  const sorted = [...items].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const out: DaySection<T>[] = [];
  const index = new Map<string, DaySection<T>>();
  sorted.forEach(t => {
    const d = new Date(t.date);
    const k = keyOf(d);
    let s = index.get(k);
    if (!s) {
      s = { key: k, title: k === today ? 'Today' : k === yesterday ? 'Yesterday' : `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`, total: 0, data: [] };
      index.set(k, s);
      out.push(s);
    }
    s.data.push(t);
    if (t.type === 'debit') { s.total += t.amount; }
  });
  out.forEach(s => { s.total = Math.round(s.total); });
  return out;
}
