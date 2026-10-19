import { ARCHETYPES, generateCohort, generateUser, makeRng, toCsv } from '../src/ml/synthetic';
import { buildRiskProfile, fmtRange, riskCaptureBacktest } from '../src/ml/riskProfile';
import { defaultPrefs, inQuietHours, sanitizePrefs } from '../src/ml/notificationPrefs';
import { isMuted, recordOutcome, recordShown } from '../src/ml/feedback';
import { detectPayday, planNotifications } from '../src/ml/notificationPlanner';
import { diffSchedule } from '../src/ml/scheduleDiff';

jest.setTimeout(60000);
const END = new Date(2026, 9, 1);              // Thu 1 Oct 2026, 00:00
const user = (a: any, seed = 1) => generateUser(seed, a, 180, END);

describe('synthetic data', () => {
  test('is deterministic and shaped like real transactions', () => {
    const a = user('midnight_impulser'), b = user('midnight_impulser');
    expect(a.length).toBe(b.length);
    expect(a[10].amount).toBe(b[10].amount);
    expect(a.every(t => t.amount > 0 && t.date instanceof Date && (t.type === 'debit' || t.type === 'credit'))).toBe(true);
    expect(a.some(t => t.type === 'credit' && t.merchant === 'Salary')).toBe(true);
    expect(toCsv(a.slice(0, 3)).split('\n').length).toBe(4);
  });
  test('rng is repeatable', () => { const r1 = makeRng(5), r2 = makeRng(5); expect([r1(), r1()]).toEqual([r2(), r2()]); });
  test('archetypes really behave differently', () => {
    const lateShare = (a: any) => { const d = user(a).filter(t => t.type === 'debit'); return d.filter(t => t.date.getHours() >= 21).reduce((s, t) => s + t.amount, 0) / d.reduce((s, t) => s + t.amount, 0); };
    const m = lateShare('midnight_impulser'), s = lateShare('stealth_saver');
    expect(m).toBeGreaterThan(0.4);
    expect(s).toBeLessThan(m * 0.6);          // the saver clearly spends less of its money late at night
  });
});

describe('risk profile', () => {
  test('finds the Friday-night window for a midnight impulser', () => {
    const p = buildRiskProfile(user('midnight_impulser'), { now: END });
    expect(p.windows.length).toBeGreaterThan(0);
    const top = p.windows[0];
    expect([5, 6, 0]).toContain(top.weekday);                 // Fri / Sat / Sun
    expect(top.startHour).toBeGreaterThanOrEqual(20);
    expect(top.label).toMatch(/PM/);
    expect(top.impulseP).toBeGreaterThan(0.4);
  });
  test('finds the weekend afternoon for a weekend warrior', () => {
    const top = buildRiskProfile(user('weekend_warrior', 3), { now: END }).windows[0];
    expect([6, 0]).toContain(top.weekday);
    expect(top.startHour).toBeGreaterThanOrEqual(12);
    expect(top.startHour).toBeLessThan(22);
  });
  test('stays quiet without enough data', () => {
    expect(buildRiskProfile([], { now: END }).windows).toEqual([]);
    expect(buildRiskProfile(user('balanced').slice(0, 10), { now: END }).windows).toEqual([]);
    const recent = user('balanced').filter(t => t.date.getTime() > END.getTime() - 9 * 86400000);
    expect(buildRiskProfile(recent, { now: END }).windows).toEqual([]);   // under 14 days of history
  });
  test('user labels override the guess', () => {
    const tx = user('midnight_impulser');
    const labels: any = {}; tx.forEach(t => { labels[t.id!] = 'worth_it'; });
    const p = buildRiskProfile(tx, { now: END, labels });
    expect(p.windows[0].impulseP).toBeLessThan(0.2);
  });
  test('range formatting', () => {
    expect(fmtRange(21, 23)).toBe('9–11 PM');
    expect(fmtRange(22, 24)).toBe('10 PM–12 AM');
    expect(fmtRange(10, 12)).toBe('10–12 AM'.replace('12 AM', '12 PM').replace('10–', '10 AM–'));
  });
});

const g_ = (a: string) => { const rs = rowsFor(a); return rs.reduce((s, r) => s + r.lift, 0) / rs.length; };
let rowsFor: (a: string) => any[] = () => [];
describe('backtest on the synthetic cohort (train on the past, test on later weeks)', () => {
  const cohort = generateCohort(6, 180, 11);
  const byUser: { [u: string]: any[] } = {};
  cohort.forEach(t => { (byUser[t.userId] = byUser[t.userId] || []).push(t); });
  const rows = Object.entries(byUser).map(([u, tx]) => ({ u, a: tx[0].archetype, r: riskCaptureBacktest(tx, { cutoff: new Date(END.getTime() - 56 * 86400000), trainDays: 90, testDays: 28, topCells: 14 }) }));

  rowsFor = (a: string) => rows.filter(x => x.r && x.a === a).map(x => x.r!);
  test('the top 14 of 84 weekly time-slots capture far more than their fair share', () => {
    const ok = rows.filter(x => x.r);
    expect(ok.length).toBeGreaterThan(20);
    const mean = (xs: number[]) => xs.reduce((s, v) => s + v, 0) / xs.length;
    const lift = mean(ok.map(x => x.r!.lift));
    console.log('SYNTHETIC backtest (train on 90 days, test the next 28), share of later spending inside the 14 predicted slots:');
    ARCHETYPES.forEach(a => {
      const g = ok.filter(x => x.a === a).map(x => x.r!);
      console.log(`  ${a.padEnd(18)} model ${(mean(g.map(r => r.capture)) * 100).toFixed(0)}%  hour-only ${(mean(g.map(r => r.hourOnlyCapture)) * 100).toFixed(0)}%  chance ${(g[0].baseline * 100).toFixed(0)}%  lift ${mean(g.map(r => r.lift)).toFixed(1)}x`);
    });
    expect(lift).toBeGreaterThan(2);
  });
  test('knowing the weekday beats knowing only the hour', () => {
    const ok = rows.filter(x => x.r);
    const mean = (xs: number[]) => xs.reduce((s, v) => s + v, 0) / xs.length;
    expect(mean(ok.map(x => x.r!.capture))).toBeGreaterThan(mean(ok.map(x => x.r!.hourOnlyCapture)));
    const g = (a: string) => ok.filter(x => x.a === a).map(x => x.r!);
    // Where behaviour depends on the weekday, the weekday-aware model wins by a lot...
    expect(mean(g('weekend_warrior').map(r => r.capture))).toBeGreaterThan(mean(g('weekend_warrior').map(r => r.hourOnlyCapture)) + 0.3);
    // ...and where it does not (late nights every night), it must at least not lose.
    expect(mean(g('midnight_impulser').map(r => r.capture))).toBeGreaterThan(mean(g('midnight_impulser').map(r => r.hourOnlyCapture)) - 0.03);
  });
  test('a user with no time pattern is not treated as if they had one', () => {
    const saver = g_('stealth_saver');
    expect(saver).toBeLessThan(1.4);       // barely better than chance: Q should not claim a pattern here
  });
  test('and they capture the impulse spending even better than chance', () => {
    const imp = rows.filter(x => x.r && x.r.impulseCapture !== null && x.a === 'midnight_impulser').map(x => x.r!.impulseCapture!);
    expect(imp.reduce((s, v) => s + v, 0) / imp.length).toBeGreaterThan(0.5);
  });
});

describe('alerts follow the evidence', () => {
  const NOW = new Date(2026, 9, 5, 12, 0);
  const riskCount = (a: any, seed: number) => {
    const profile = buildRiskProfile(user(a, seed), { now: END });
    return planNotifications({ now: NOW, profile, prefs: defaultPrefs() }).filter(n => n.kind === 'risk_window').length;
  };
  test('strong, repeated patterns get heads-ups; a flat spender gets almost none', () => {
    const strong = [1, 2, 3].map(s => riskCount('midnight_impulser', s)).reduce((a, b) => a + b, 0) / 3;
    const warrior = [1, 2, 3].map(s => riskCount('weekend_warrior', s)).reduce((a, b) => a + b, 0) / 3;
    const flat = [1, 2, 3].map(s => riskCount('stealth_saver', s)).reduce((a, b) => a + b, 0) / 3;
    console.log(`risk heads-ups in the next 7 days: midnight_impulser ${strong.toFixed(1)}, weekend_warrior ${warrior.toFixed(1)}, stealth_saver ${flat.toFixed(1)}`);
    expect(strong).toBeGreaterThan(0);
    expect(warrior).toBeGreaterThan(0);
    expect(flat).toBeLessThan(strong);
  });
});

describe('notification planner', () => {
  const NOW = new Date(2026, 9, 5, 12, 0);       // Monday midday
  const profile = buildRiskProfile(user('midnight_impulser'), { now: END });
  const plan = (over: any = {}) => planNotifications({ now: NOW, profile, prefs: defaultPrefs(), ...over });

  test('warns shortly before the biggest spending hours', () => {
    const p = plan();
    const risk = p.filter(n => n.kind === 'risk_window');
    expect(risk.length).toBeGreaterThan(0);
    const n = risk[0];
    const w = profile.windows.find(w => `risk:${w.key}` === n.key)!;
    expect(new Date(n.fireAt).getDay()).toBe(w.weekday);
    expect(new Date(n.fireAt).getHours() * 60 + new Date(n.fireAt).getMinutes()).toBe(w.startHour * 60 - 30);
    expect(n.body).toMatch(/₹/);
    expect(n.actions).toContain('hold_24h');
    expect(n.reason).toMatch(/last \d+ days/);
  });
  test('never breaks the caps, the gap or quiet hours', () => {
    const prefs = { ...defaultPrefs(), maxPerDay: 1, maxPerWeek: 3, quiet: { startHour: 22, endHour: 7 } };
    const p = plan({ prefs });
    expect(p.length).toBeLessThanOrEqual(3);
    const perDay: any = {}; p.forEach(n => { const k = new Date(n.fireAt).toDateString(); perDay[k] = (perDay[k] || 0) + 1; expect(inQuietHours(new Date(n.fireAt).getHours(), prefs.quiet)).toBe(false); });
    Object.values(perDay).forEach((c: any) => expect(c).toBeLessThanOrEqual(1));
    const all = plan();
    for (let i = 1; i < all.length; i++) { expect(all[i].fireAt - all[i - 1].fireAt).toBeGreaterThanOrEqual(180 * 60000); }
  });
  test('ids are stable, so re-planning does not duplicate', () => {
    expect(plan().map(n => n.id)).toEqual(plan().map(n => n.id));
    expect(new Set(plan().map(n => n.id)).size).toBe(plan().length);
  });
  test('master switch, per-type switches and snooze are respected', () => {
    expect(plan({ prefs: { ...defaultPrefs(), enabled: false } })).toEqual([]);
    expect(plan({ prefs: { ...defaultPrefs(), kinds: { ...defaultPrefs().kinds, risk_window: false } } }).filter(n => n.kind === 'risk_window')).toEqual([]);
    const snoozed = plan({ prefs: { ...defaultPrefs(), snoozeUntil: NOW.getTime() + 3 * 86400000 } });
    snoozed.forEach(n => expect(n.fireAt).toBeGreaterThanOrEqual(NOW.getTime() + 3 * 86400000));
  });
  test('learns from being ignored', () => {
    const first = plan().find(n => n.kind === 'risk_window')!;
    let fb = {} as any;
    for (let i = 0; i < 3; i++) { fb = recordOutcome(recordShown(fb, first.key), first.key, 'dismissed', NOW.getTime()); }
    expect(isMuted(fb, first.key, NOW.getTime() + 86400000)).toBe(true);
    expect(isMuted(fb, first.key, NOW.getTime() + 4 * 86400000)).toBe(false);
    expect(plan({ feedback: fb }).some(n => n.key === first.key && n.fireAt < NOW.getTime() + 3 * 86400000)).toBe(false);
    const helpful = recordOutcome({}, first.key, 'not_helpful', NOW.getTime());
    expect(isMuted(helpful, first.key, NOW.getTime() + 13 * 86400000)).toBe(true);
    expect(isMuted(recordOutcome(fb, first.key, 'acted', NOW.getTime()), first.key, NOW.getTime() + 86400000)).toBe(false);
  });
  test('bills, budgets, payday and the weekly summary', () => {
    const p = plan({
      prefs: { ...defaultPrefs(), maxPerDay: 6, minGapMinutes: 15 },
      recurring: [{ merchant: 'Netflix', amount: 649, count: 5, transactions: [], confidence: 'high', billingCycle: 'monthly', nextExpectedDate: new Date(2026, 9, 7) }],
      budgets: [{ category: 'Shopping', limit: 2000, spent: 1700, daysLeft: 26 }],
      payday: { day: 8, effect: 1.6 }, week: { total: 4120, topWindow: 'Friday 9–11 PM' },
    });
    const bill = p.find(n => n.kind === 'bill_due')!;
    expect(bill.title).toMatch(/Netflix renews/);
    expect(bill.body).toContain('₹649');
    expect(p.find(n => n.kind === 'budget_pace')!.title).toMatch(/85%/);
    expect(p.find(n => n.kind === 'payday')!.body).toMatch(/60%/);
    expect(p.find(n => n.kind === 'weekly_summary')!.body).toContain('₹4,120');
    expect(plan({ payday: { day: 8, effect: 1.05 }, prefs: { ...defaultPrefs(), maxPerDay: 6, minGapMinutes: 15 } }).some(n => n.kind === 'payday')).toBe(false);
  });
  test('mentions an active streak in the heads-up', () => {
    const n = plan({ streaks: [{ name: 'No late-night orders', days: 12 }] }).find(n => n.kind === 'risk_window')!;
    expect(n.body).toContain('12 days');
  });
  test('detects payday from salary credits', () => {
    const pd = detectPayday(user('midnight_impulser'));
    expect(pd?.day).toBe(1);
    expect(detectPayday([])).toBeNull();
  });
});

describe('preferences and scheduling', () => {
  test('sanitizePrefs repairs anything broken', () => {
    expect(sanitizePrefs(null)).toEqual(defaultPrefs());
    const p = sanitizePrefs({ maxPerDay: 999, quiet: { startHour: -3, endHour: 'x' }, sensitivity: 'wild', kinds: { payday: false } });
    expect(p.maxPerDay).toBe(10); expect(p.quiet.startHour).toBe(0); expect(p.quiet.endHour).toBe(7);
    expect(p.sensitivity).toBe('normal'); expect(p.kinds.payday).toBe(false); expect(p.kinds.risk_window).toBe(true);
  });
  test('quiet hours wrap past midnight', () => {
    expect(inQuietHours(23, { startHour: 22, endHour: 7 })).toBe(true);
    expect(inQuietHours(3, { startHour: 22, endHour: 7 })).toBe(true);
    expect(inQuietHours(12, { startHour: 22, endHour: 7 })).toBe(false);
  });
  test('diffSchedule only touches what changed', () => {
    const mk = (id: string, t = 'a'): any => ({ id, title: t, body: 'b', fireAt: 1 });
    const d = diffSchedule([mk('1'), mk('2'), mk('3')], [mk('2'), mk('3', 'changed'), mk('4')]);
    expect(d.toCancel).toEqual(['1']);
    expect(d.toSchedule.map(n => n.id)).toEqual(['3', '4']);
  });
});
