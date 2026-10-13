import React from 'react';
import ReactTestRenderer from 'react-test-renderer';

jest.setTimeout(30000);
jest.mock('react-native-vector-icons/MaterialCommunityIcons', () => 'Icon');

import RhythmDial from '../src/components/spend/RhythmDial';
import TransactionsScreen from '../src/screens/TransactionsScreen';
import { groupByDay } from '../src/lib/groupByDay';
import { busiestHour, formatHour, lastMonthDebits, windowStats } from '../src/lib/rhythm';
import { THEMES } from '../src/theme/themes';

beforeAll(() => { jest.useFakeTimers(); });
afterAll(() => { jest.useRealTimers(); });

const NOW = new Date();
const tx = (hour: number, amount: number, daysAgo = 2, type = 'debit', id = Math.random().toString()) => {
  const d = new Date(NOW); d.setDate(d.getDate() - daysAgo); d.setHours(hour, 0, 0, 0);
  return { id, type, amount, date: d, merchant: 'Shop', bank: 'HDFC', category: 'Food' } as any;
};
const data = [tx(23, 500, 1), tx(23, 600, 2), tx(22, 450, 3), tx(23, 700, 4), tx(13, 100, 1), tx(12, 90, 2), tx(11, 120, 3)];

test('formatHour', () => {
  expect(formatHour(0)).toBe('12:00 AM');
  expect(formatHour(21.5)).toBe('9:30 PM');
  expect(formatHour(12.25)).toBe('12:15 PM');
});

test('busiest hour and window stats come from the data', () => {
  const debits = lastMonthDebits(data);
  expect(debits.length).toBe(7);
  const h = busiestHour(debits);
  expect(h).toBeGreaterThanOrEqual(21.5);
  expect(h).toBeLessThanOrEqual(24);
  const avg = debits.reduce((s, t) => s + t.amount, 0) / debits.length;
  const late = windowStats(debits, 23, avg);
  expect(late.count).toBe(4);
  expect(late.total).toBe(2250);
  expect(late.level).toBe('HIGH');
  expect(windowStats(debits, 4, avg).count).toBe(0);
  expect(windowStats(debits, 4, avg).level).toBe('LOW');
});

test('groupByDay groups, labels and totals', () => {
  const t = [tx(10, 100, 0), tx(15, 50, 0), tx(12, 200, 1), tx(9, 1000, 0, 'credit'), tx(9, 70, 5)];
  const s = groupByDay(t, NOW);
  expect(s.map(x => x.title).slice(0, 2)).toEqual(['Today', 'Yesterday']);
  expect(s[0].data.length).toBe(3);
  expect(s[0].total).toBe(150);   // credits are not "spent"
  expect(s[2].title).toMatch(/^\w{3} \d{1,2} \w{3}$/);
});

test('dial stays hidden with too little data, shows readout with enough', async () => {
  let r: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(() => { r = ReactTestRenderer.create(<RhythmDial transactions={data.slice(0, 2)} theme={THEMES.q} />); });
  expect(r!.toJSON()).toBeNull();
  await ReactTestRenderer.act(() => { r = ReactTestRenderer.create(<RhythmDial transactions={data} theme={THEMES.q} />); });
  await ReactTestRenderer.act(() => { jest.advanceTimersByTime(800); });
  const json = JSON.stringify(r!.toJSON());
  expect(json).toContain('Your money has a rhythm.');
  expect(json).toContain('Impulse activity');
  expect(json).toContain('found a late-night pattern');
  await ReactTestRenderer.act(() => r!.unmount());
});

test('Earlier / Later buttons move the hour', async () => {
  let r: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(() => { r = ReactTestRenderer.create(<RhythmDial transactions={data} theme={THEMES.q} />); });
  const before = JSON.stringify(r!.toJSON());
  const later = r!.root.findAll(n => n.props.accessibilityRole === 'button' && typeof n.props.onPress === 'function')[1];
  await ReactTestRenderer.act(() => { later.props.onPress(); jest.advanceTimersByTime(800); });
  expect(JSON.stringify(r!.toJSON())).not.toEqual(before);
  await ReactTestRenderer.act(() => r!.unmount());
});

const allText = (r: ReactTestRenderer.ReactTestRenderer) =>
  r.root.findAll(() => true).flatMap(n => n.children.filter(c => typeof c === 'string') as string[]).join(' | ');

test('Spend screen renders grouped rows and the dial', async () => {
  let r: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(() => {
    r = ReactTestRenderer.create(
      <TransactionsScreen transactions={data} mode={null} userLabels={[]} labeledTxnIds={[]} worthItTxnIds={[]} emergencyTxnIds={[]}
        avgAmount={300} model={{} as any} theme={THEMES.q} handleLabelTransaction={() => {}} onSetCategory={() => {}} handleToggleEmergency={() => {}} />,
    );
  });
  const text = allText(r!);
  expect(text).toContain('Spend');
  expect(text).toContain('Your money has a rhythm.');
  expect(text).toContain('Yesterday');
  expect(text).toContain('Impulse activity');
  await ReactTestRenderer.act(() => r!.unmount());
});
