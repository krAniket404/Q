import { ParsedTransaction } from '../lib/smsParser';
import { RecurringCharge } from '../lib/behavioralEngine';

export type Intent =
  | 'total_spend' | 'top_categories' | 'top_merchants' | 'biggest_purchases' | 'compare_periods' | 'month_forecast'
  | 'daily_average' | 'merchant_count' | 'subscriptions' | 'income_savings' | 'when_spend' | 'explain_change'
  | 'safe_to_spend' | 'budget_status' | 'impulse' | 'persona' | 'score_explain' | 'roast' | 'saving_tip' | 'joke' | 'help'
  | 'unknown';

/** [from, to): `to` is exclusive. */
export interface TimeRange { from: Date; to: Date; label: string; key: string; }

export interface Slots {
  range?: TimeRange;
  compareTo?: TimeRange;
  category?: string;         // canonical category, e.g. 'Dining & Delivery'
  merchant?: string;         // as it appears in the user's data
  amount?: number;
  hourFrom?: number;         // wraps past midnight when hourFrom > hourTo
  hourTo?: number;
  hoursLabel?: string;
  weekend?: boolean;
  weekdays?: boolean;
}

export interface Scores { discipline: number; impulse: number; volatility: number; wellness: number; savingsRate: number; }
export interface CoachData {
  transactions: ParsedTransaction[];
  now: Date;
  scores?: Scores;
  budgets?: { [category: string]: number };
  recurring?: RecurringCharge[];
}

export interface Fact { label: string; value: string; }
export interface EngineResult {
  intent: Intent; ok: boolean; headline: string; lines: string[]; facts: Fact[];
  numbers: number[];           // every number the answer may quote (used to check AI-written text)
  followUps: string[]; mood?: 'up' | 'down' | 'flat';
}
export interface CoachContext { intent?: Intent; slots?: Slots; turns: number; }
export type Tone = 'sassy' | 'plain';
