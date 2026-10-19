# Q behaviour brain: what exists, what it can and cannot do

## Files
| File | Job |
|---|---|
| `src/ml/riskProfile.ts` | Learns, per user, how much money moves in each weekday x 2-hour slot. Sparse slots are pulled toward the user's own baseline. Produces "risk windows" and a backtest. |
| `src/ml/notificationPlanner.ts` | Turns the profile, bills, budgets, payday and streaks into a 7-day list of alerts, with caps, quiet hours and minimum gaps. Every alert carries a "why am I seeing this" line. |
| `src/ml/feedback.ts` | Learns from taps: ignore an alert 3 times and it backs off for 3 days (then 7, then 21). "Not helpful" silences it for 14 days. |
| `src/ml/notificationPrefs.ts` | The user's controls: on/off per type, quiet hours, max per day/week, minimum gap, lead time, sensitivity, snooze. |
| `src/ml/scheduleDiff.ts` | Compares a fresh plan with what is already scheduled so only real changes touch the alarm system. |
| `src/ml/synthetic.ts` | Generates users with known habits. Used for tests and for `data/synthetic/cohort_180d.csv`. |

## Honest limits
- The numbers in `tools/ml/backtest.ts` come from **synthetic** users whose habits are strong and clean. Real people are noisier, so real accuracy will be lower. Only real, consented data can tell us how much.
- Q predicts **when** money is likely to move, as probabilities. It does not predict the exact purchase.
- "Unplanned" is a guess (a purchase bigger than usual, or late at night) until the user labels purchases "worth it / impulse".
- A user with no time pattern gets few or no alerts. That is by design.

## Training data
1. **Per-user learning needs no population data.** Each phone learns from that user's own history.
2. **Population data only helps new users** (better starting guesses). Before using any real user's data for that:
   - get explicit, informed, opt-in consent for this specific purpose, with an easy way to withdraw (India's DPDP Act 2023 asks for this; have a lawyer review);
   - strip merchant names, round amounts and times, drop dates;
   - update the privacy policy and the website, because the app currently uploads transactions to Supabase and Firebase.
3. **Meanwhile**, `data/synthetic/` is for building and testing only.

## Commands
```
npx jest __tests__/MLBrain.test.ts
npx ts-node --transpile-only --project tools/ml/tsconfig.json tools/ml/backtest.ts
npx ts-node --transpile-only --project tools/ml/tsconfig.json tools/ml/export_synthetic.ts
```
