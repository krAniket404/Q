import { Intent } from '../../../src/coach/types';
// A second set, written BEFORE tuning the classifier and scored only once afterwards.
export const FINAL_TEST: [Intent, string][] = [
  ['total_spend', 'how much have I put into cabs'], ['total_spend', 'my spending on delivery in august?'], ['total_spend', 'what did I shell out on shopping this month'], ['total_spend', 'show total expenses for last 14 days'], ['total_spend', 'amount spent at starbucks'], ['total_spend', 'how much do I spend at weekends'], ["total_spend", "what's my total this week"], ['total_spend', 'money gone on health last month'],
  ['top_categories', 'which expense category is biggest'], ['top_categories', "where's most of my money going"], ['top_categories', 'rank my spending categories'], ['top_categories', "what's my number one spending area"],
  ['top_merchants', 'who am I paying the most'], ['top_merchants', 'which store do I give the most money to'], ['top_merchants', 'my highest paid merchants'],
  ['biggest_purchases', 'largest payment I made this month'], ['biggest_purchases', "what's my most expensive purchase ever"], ['biggest_purchases', 'top five biggest transactions'],
  ['compare_periods', 'is this week more expensive than last week'], ['compare_periods', 'how did october compare to september'], ['compare_periods', 'spending now versus last month'], ['compare_periods', 'have I spent less than last month on food'],
  ['month_forecast', 'what will my month end spend be'], ['month_forecast', 'am I going to blow my budget this month'], ['month_forecast', "predict how much I'll have spent by the 30th"], ['month_forecast', 'will I finish the month under budget'],
  ['daily_average', 'what do I spend on average per day'], ['daily_average', 'how much per day on food'], ['daily_average', 'my daily average outflow'],
  ['merchant_count', 'how many uber rides this month'], ['merchant_count', 'number of times I ordered from swiggy'], ['merchant_count', 'how often do I buy from amazon'],
  ['subscriptions', 'what do I pay for each month automatically'], ['subscriptions', 'show me my subscription costs'], ['subscriptions', 'total of my recurring payments'],
  ['income_savings', 'how much am I saving'], ['income_savings', 'how much did I earn this month'], ['income_savings', 'what portion of my salary is saved'],
  ['when_spend', 'what time of the day do I spend most'], ['when_spend', 'which day of the week is my biggest spending day'], ['when_spend', 'am I spending more late at night'],
  ['explain_change', 'why is my spending up compared to last month'], ['explain_change', "what's the reason I spent so much"], ['explain_change', 'why did my expenses go up this week'],
  ['safe_to_spend', 'can I afford a 2000 rupee dinner'], ['safe_to_spend', 'how much can I spend each day without going over'], ['safe_to_spend', 'is it ok to buy shoes for 3500'],
  ['budget_status', 'how are my budget limits looking'], ['budget_status', 'which budgets am I about to break'], ['budget_status', 'am I over my food budget'],
  ['impulse', 'why is my impulse index high'], ['impulse', 'am I a compulsive buyer'], ['impulse', 'how many impulse purchases do I make'],
  ['persona', "what's my financial personality"], ['persona', 'tell me my persona'], ['persona', 'what spender type am I'],
  ['score_explain', 'why is my wellness score what it is'], ['score_explain', 'how can I improve my financial score'], ['score_explain', 'what is my volatility score'],
  ['roast', 'roast me about money'], ['roast', 'tear my spending apart'], ['roast', 'be mean about my spending'],
  ['saving_tip', 'any tips for saving money'], ['saving_tip', 'how can I cut my spending'], ['saving_tip', 'give me a money saving tip'],
  ['joke', 'got a joke for me'], ['joke', 'tell me a funny finance joke'], ['joke', 'make me smile'],
  ['help', 'what can you help me with'], ['help', 'what can I ask'], ['help', 'how does this work'],
];
export const FINAL_OFF_TOPIC = ['what is the speed of light', 'who is the best footballer', 'give me a recipe for pasta', 'how do airplanes fly', 'tell me a bedtime story', "what's in the news today", 'how do I learn python', 'which phone is best to buy'];
