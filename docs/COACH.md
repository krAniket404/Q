# Q Coach: how questions get answered

```
question
  -> parse      time period, category, merchant, amount, hours   (src/coach/timeRange.ts, entities.ts)
  -> classify   what is being asked (21 intents)                 (src/coach/intents.ts + trainingData.ts)
  -> remember   "and last month?", "why?" reuse the last question (src/coach/context.ts)
  -> compute    exact answer from the user's transactions        (src/coach/queryEngine.ts)
  -> write      plain or sassy wording, numbers untouched        (src/coach/composer.ts)
  -> only if nothing above can answer: ask the AI model,
     show its reply only if every figure matches the data       (src/coach/llm.ts)
```

## What is computed, not guessed
Spend by period / category / merchant / hour / weekend, top categories and merchants, biggest purchases, period comparisons
(this month so far vs the same days last month), month-end forecast (as a range), daily average, merchant counts,
subscriptions, income and savings rate, busiest spending slot, "why did spending change" (category drivers, count vs size,
after-9-PM share, single large purchases), affordability against the remaining budget, budget status, impulse and score explanations.
The app's existing roast, saving-tip, joke and persona lines are still used for those intents.

## Privacy
Only questions the engine cannot answer reach the AI model, and then only totals, category shares and scores
(no merchant names, no dates, no transactions). Before this change the full list of top merchants was sent.
`src/coach/llm.ts -> snapshot()` is the single place that decides what leaves the phone.

## Measured quality (tools/coach/eval.ts, run it yourself)
- 94 "tuning" questions: 93.6% right, 0 off-topic questions answered by mistake.
- 71 "final" questions, written first and scored once after tuning: 95.8% right, 0 confidently wrong, 3 "not sure".
- Answers are checked against an independent calculation in __tests__/CoachEngine.test.ts.
Limits: the same person wrote the training and test questions. Real users will word things differently,
so expect lower accuracy until the model sees real questions. When it is unsure it says so instead of guessing.

## Improving it
Add example questions to `src/coach/trainingData.ts` (one list per intent), then run `tools/coach/eval.ts`.
Add new test questions to `test-data/coach/` and keep a set you never tune against.
The API key in AICoachScreen.tsx is still written in the app. Anything in the app can be extracted, so move it behind a small server before release.
