const CATEGORY_WORDS: { [canonical: string]: string[] } = {
  'Dining & Delivery': ['food delivery', 'dining', 'delivery', 'restaurants', 'restaurant', 'takeout', 'takeaway', 'eating out', 'eating', 'food', 'foods', 'meals', 'eat'],
  Groceries: ['groceries', 'grocery', 'supermarket', 'vegetables', 'veggies'],
  Travel: ['travel', 'cabs', 'cab', 'taxi', 'taxis', 'commute', 'transport', 'fuel', 'petrol', 'trips', 'trip', 'rides', 'ride'],
  Shopping: ['online shopping', 'shopping', 'clothes', 'clothing', 'fashion', 'gadgets'],
  Entertainment: ['entertainment', 'movies', 'movie', 'gaming', 'games'],
  Bills: ['bills', 'bill', 'recharge', 'electricity', 'utilities'],
  Health: ['health', 'medicines', 'medicine', 'pharmacy', 'doctor', 'medical'],
  'Personal Care': ['personal care', 'grooming', 'salon', 'skincare'],
};
/** Some categories were stored under older names, so a question about one covers the other. */
export const CATEGORY_GROUPS: { [canonical: string]: string[] } = { 'Dining & Delivery': ['Dining & Delivery', 'Food'] };
export const categoryMatches = (txnCategory: string | undefined, canonical: string) =>
  (CATEGORY_GROUPS[canonical] || [canonical]).includes(txnCategory || 'Other');

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const ALL_WORDS: [string, string][] = Object.entries(CATEGORY_WORDS).flatMap(([c, ws]) => ws.map(w => [w, c] as [string, string])).sort((a, b) => b[0].length - a[0].length);

export function findCategory(text: string): string | undefined {
  const t = text.toLowerCase();
  for (const [w, c] of ALL_WORDS) { if (new RegExp(`\\b${esc(w)}\\b`).test(t)) { return c; } }
  return undefined;
}

export function findMerchant(text: string, merchants: string[]): string | undefined {
  const t = text.toLowerCase();
  let best: string | undefined;
  merchants.forEach(m => {
    const name = m.toLowerCase().trim();
    if (name.length >= 3 && new RegExp(`\\b${esc(name)}\\b`).test(t) && (!best || name.length > best.length)) { best = m; }
  });
  return best;
}

/** "₹500", "rs 1,200", "2k", "1.5 lakh". */
export function findAmount(text: string): number | undefined {
  const m = /(?:₹|rs\.?\s?|rupees?\s?|inr\s?)(\d[\d,]*(?:\.\d+)?)\s?(k|lakhs?|l)?\b|\b(\d[\d,]*(?:\.\d+)?)\s?(k|lakhs?)\b|\b(\d[\d,]{2,}(?:\.\d+)?)\s?(?:rupees|rs|inr)\b/i.exec(text)
    // a bare number such as "can I afford 2500" (but not a year, a count of days, or a percentage)
    || /\b(\d{3,}(?:,\d{3})*(?:\.\d+)?)\b(?!\s*(?:days?|weeks?|months?|years?|times|orders|%))/.exec(text.replace(/\b(19|20)\d{2}\b/g, ' '));
  if (!m) { return undefined; }
  const raw = (m[1] || m[3] || m[5] || '').replace(/,/g, '');
  const unit = (m[2] || m[4] || '').toLowerCase();
  const n = parseFloat(raw);
  return isNaN(n) ? undefined : unit === 'k' ? n * 1000 : unit.startsWith('l') ? n * 100000 : n;
}
