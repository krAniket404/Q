import React from 'react';
import { NativeModules } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';

jest.setTimeout(30000);
jest.mock('react-native-vector-icons/MaterialCommunityIcons', () => 'Icon');

import DiagnosticSteps from '../src/components/coach/DiagnosticSteps';
import { buildFacts } from '../src/lib/coachFacts';
import { THEMES } from '../src/theme/themes';

beforeAll(() => { jest.useFakeTimers(); });
afterAll(() => { jest.useRealTimers(); });

const allText = (r: ReactTestRenderer.ReactTestRenderer) =>
  r.root.findAll(() => true).flatMap(n => n.children.filter(c => typeof c === 'string') as string[]).join(' | ');

const NOW = new Date();
const tx = (hour: number, amount: number, daysAgo: number, category = 'Food') => {
  const d = new Date(NOW); d.setDate(d.getDate() - daysAgo); d.setHours(hour, 0, 0, 0);
  return { id: `${hour}-${amount}-${daysAgo}`, type: 'debit', amount, date: d, category, merchant: 'Shop' } as any;
};
const data = [tx(23, 500, 1), tx(23, 600, 2), tx(22, 450, 3), tx(13, 100, 1), tx(12, 90, 9), tx(11, 120, 12, 'Shopping'), tx(10, 80, 20)];

test('facts are real numbers from the data', () => {
  const f = buildFacts(data, NOW);
  const text = f.map(x => `${x.label} ${x.detail}`).join(' | ');
  expect(f[0].label).toBe('7 transactions');
  expect(text).toContain('Busiest around');
  expect(text).toContain('Food is');
  expect(text).toContain('Last 7 days');
  expect(text).toContain('3 purchases after 9 PM');
});

test('facts stay minimal with too little data', () => {
  expect(buildFacts([], NOW)).toEqual([{ label: '0 transactions', detail: 'in your history' }]);
  expect(buildFacts(data.slice(0, 2), NOW).length).toBe(1);
});

test('DiagnosticSteps reveals lines one at a time', async () => {
  const facts = buildFacts(data, NOW);
  let r: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(() => { r = ReactTestRenderer.create(<DiagnosticSteps facts={facts} theme={THEMES.q} />); });
  expect(allText(r!)).toContain('7 transactions');
  expect(allText(r!)).not.toContain('Writing the answer');
  await ReactTestRenderer.act(() => { jest.advanceTimersByTime(480 * facts.length + 200); });
  expect(allText(r!)).toContain('Writing the answer');
  await ReactTestRenderer.act(() => r!.unmount());
});

test('Coach: empty state, asking a question, diagnosis, answer', async () => {
  NativeModules.SmsModule = { loadData: jest.fn().mockResolvedValue(null), saveData: jest.fn().mockResolvedValue(undefined) };
  const AICoachScreen = require('../src/screens/AICoachScreen').default;
  const scores = { discipline: 40, impulse: 72, volatility: 30, wellness: 60, savingsRate: 10 };
  let r: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => { r = ReactTestRenderer.create(<AICoachScreen transactions={data} scores={scores} theme={THEMES.q} />); await Promise.resolve(); await Promise.resolve(); });
  await ReactTestRenderer.act(async () => { jest.advanceTimersByTime(1500); await Promise.resolve(); });
  let t = allText(r!);
  expect(t).toContain('Ask Q why.');
  expect(t).toContain('Roast my spending habits');

  const roast = r!.root.findAll(n => n.props.accessibilityLabel === 'Roast my spending habits' && typeof n.props.onPress === 'function')[0];
  await ReactTestRenderer.act(async () => { roast.props.onPress(); await Promise.resolve(); });
  await ReactTestRenderer.act(async () => { jest.advanceTimersByTime(100); await Promise.resolve(); });
  t = allText(r!);
  expect(t).toContain('reading your data'.toUpperCase());      // diagnostic steps are visible while waiting
  expect(t).toContain('7 transactions');
  await ReactTestRenderer.act(async () => { jest.advanceTimersByTime(1500); await Promise.resolve(); await Promise.resolve(); });
  t = allText(r!);
  expect(t).toContain('DIAGNOSIS');                             // the answer arrives as a diagnosis block
  expect(t).not.toContain('Writing the answer');
  await ReactTestRenderer.act(() => r!.unmount());
});
