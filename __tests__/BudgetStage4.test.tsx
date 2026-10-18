import React from 'react';
import { NativeModules } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';

jest.setTimeout(30000);
jest.mock('react-native-vector-icons/MaterialCommunityIcons', () => 'Icon');

import PaceHero, { paceState } from '../src/components/budget/PaceHero';
import CategoryTowers, { compact } from '../src/components/budget/CategoryTowers';
import { THEMES } from '../src/theme/themes';

beforeAll(() => { jest.useFakeTimers(); });
afterAll(() => { jest.useRealTimers(); });

const allText = (r: ReactTestRenderer.ReactTestRenderer) =>
  r.root.findAll(() => true).flatMap(n => n.children.filter(c => typeof c === 'string') as string[]).join(' | ');

test('pace compares money used with month elapsed', () => {
  expect(paceState(1000, 1200, 0.5)).toBe('over');
  expect(paceState(1000, 700, 0.5)).toBe('ahead');
  expect(paceState(1000, 520, 0.5)).toBe('on');
  expect(paceState(1000, 200, 0.5)).toBe('under');
  expect(paceState(0, 0, 0.5)).toBe('on');
});

test('compact amounts', () => {
  expect(compact(950)).toBe('950');
  expect(compact(1200)).toBe('1.2k');
  expect(compact(2000)).toBe('2k');
  expect(compact(12400)).toBe('12k');
});

test('PaceHero shows the daily number, or how far over you are', async () => {
  let r: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(() => { r = ReactTestRenderer.create(<PaceHero totalBudget={9000} totalSpent={1800} daysLeft={24} daysInMonth={30} elapsed={0.2} monthName="October" theme={THEMES.q} />); });
  await ReactTestRenderer.act(() => { jest.advanceTimersByTime(1500); });
  const t = allText(r!);
  expect(t).toContain('You can spend');
  expect(t).toContain('300');           // (9000-1800)/24
  expect(t).toContain('On pace');
  await ReactTestRenderer.act(() => r!.unmount());
  await ReactTestRenderer.act(() => { r = ReactTestRenderer.create(<PaceHero totalBudget={1000} totalSpent={1250} daysLeft={5} daysInMonth={30} elapsed={0.8} monthName="October" theme={THEMES.q} />); });
  expect(allText(r!)).toContain('Over budget');
  await ReactTestRenderer.act(() => r!.unmount());
});

test('Towers show only categories with spending and report taps', async () => {
  const onSelect = jest.fn();
  let r: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(() => {
    r = ReactTestRenderer.create(
      <CategoryTowers categories={['Shopping', 'Bills', 'Health']} spent={{ Shopping: 1192, Bills: 0, Health: 300 }}
        budgets={{ Shopping: 2000, Bills: 2000, Health: 1000 }} colors={{}} icons={{}} theme={THEMES.q} onSelect={onSelect} />,
    );
  });
  await ReactTestRenderer.act(() => { jest.advanceTimersByTime(1500); });
  const t = allText(r!);
  expect(t).toContain('Shopping');
  expect(t).toContain('Health');
  expect(t).not.toContain('Bills');
  const btn = r!.root.findAll(n => n.props.accessibilityRole === 'button' && typeof n.props.onPress === 'function')[0];
  expect(btn.props.accessibilityLabel).toContain('limit ₹2000');
  await ReactTestRenderer.act(() => { btn.props.onPress(); });
  expect(onSelect).toHaveBeenCalledWith('Shopping');
  await ReactTestRenderer.act(() => r!.unmount());
});

test('Budget screen renders the new layout', async () => {
  NativeModules.SmsModule = { loadData: jest.fn().mockResolvedValue(null), saveData: jest.fn().mockResolvedValue(undefined) };
  const BudgetsScreen = require('../src/screens/BudgetsScreen').default;
  const now = new Date();
  const tx = [{ id: '1', type: 'debit', amount: 1192, date: now, category: 'Shopping', merchant: 'Amazon' }, { id: '2', type: 'debit', amount: 400, date: now, category: 'Bills', merchant: 'Jio' }];
  let r: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => { r = ReactTestRenderer.create(<BudgetsScreen transactions={tx} theme={THEMES.q} />); await Promise.resolve(); await Promise.resolve(); });
  await ReactTestRenderer.act(async () => { jest.advanceTimersByTime(2000); await Promise.resolve(); });
  const t = allText(r!);
  expect(t).toContain('Budgets');
  expect(t).toContain('You can spend');
  expect(t).toContain('Where it went');
  expect(t).toContain('Monthly limits');
  await ReactTestRenderer.act(() => r!.unmount());
});
