// Scores the question classifier. Run: npx ts-node --transpile-only --project tools/ml/tsconfig.json tools/coach/eval.ts
// "tuning" questions were used while building the model; "final" questions were written first and scored once afterwards.
import { classify } from '../../src/coach/intents';
import { HELD_OUT, OFF_TOPIC } from '../../test-data/coach/heldOut';
import { FINAL_TEST, FINAL_OFF_TOPIC } from '../../test-data/coach/finalTest';

const merchants = ['Swiggy', 'Uber', 'Amazon', 'Starbucks'];
function score(name: string, set: [string, string][], off: string[]) {
  const wrong = set.filter(([w, q]) => { const i = classify(q, merchants).intent; return i !== w && i !== 'unknown'; });
  const unsure = set.filter(([w, q]) => classify(q, merchants).intent === 'unknown');
  const right = set.length - wrong.length - unsure.length;
  const leaked = off.filter(q => classify(q).intent !== 'unknown');
  console.log(`${name}: ${right}/${set.length} right (${(right / set.length * 100).toFixed(1)}%), ${wrong.length} confidently wrong, ${unsure.length} "not sure"; off-topic answered by mistake: ${leaked.length}/${off.length}`);
  wrong.forEach(([w, q]) => console.log(`   wrong: expected ${w} for "${q}"`));
}
score('tuning set', HELD_OUT as any, OFF_TOPIC);
score('final set ', FINAL_TEST as any, FINAL_OFF_TOPIC);
