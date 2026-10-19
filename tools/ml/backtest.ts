// Honest model report. Run: npx ts-node --transpile-only tools/ml/backtest.ts
// Real accuracy needs real (consented) data: replace generateCohort with rows loaded from an anonymised export.
import { ARCHETYPES, generateCohort } from '../../src/ml/synthetic';
import { riskCaptureBacktest } from '../../src/ml/riskProfile';

const cohort = generateCohort(12, 180, 7);
const end = new Date(2026, 9, 1);
const byUser: { [u: string]: typeof cohort } = {};
cohort.forEach(t => { (byUser[t.userId] = byUser[t.userId] || []).push(t); });
const mean = (a: number[]) => a.reduce((s, v) => s + v, 0) / (a.length || 1);

console.log('Share of FUTURE spending that lands inside the 14 predicted weekly slots (of 84). Chance = 17%.\n');
console.log('archetype            model   hour-only   lift');
ARCHETYPES.forEach(a => {
  const rs = Object.entries(byUser).filter(([, tx]) => tx[0].archetype === a)
    .map(([, tx]) => riskCaptureBacktest(tx, { cutoff: new Date(end.getTime() - 56 * 86400000), trainDays: 90, testDays: 28, topCells: 14 })).filter(Boolean) as any[];
  console.log(`${a.padEnd(20)} ${(mean(rs.map(r => r.capture)) * 100).toFixed(0).padStart(3)}%    ${(mean(rs.map(r => r.hourOnlyCapture)) * 100).toFixed(0).padStart(3)}%       ${mean(rs.map(r => r.lift)).toFixed(1)}x`);
});
