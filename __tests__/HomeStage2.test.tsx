import React from 'react';
import { Text } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';

jest.setTimeout(30000);
jest.mock('react-native-vector-icons/MaterialCommunityIcons', () => 'Icon');

import Reveal from '../src/components/Reveal';
import HomeHeader from '../src/components/home/HomeHeader';
import SmartTrackingBanner from '../src/components/home/SmartTrackingBanner';
import QNoticed from '../src/components/home/QNoticed';
import PersonaCard from '../src/components/home/PersonaCard';
import { noticeLateNight } from '../src/lib/insights';
import { THEMES } from '../src/theme/themes';

beforeAll(() => { jest.useFakeTimers(); });
afterAll(() => { jest.useRealTimers(); });

const NOW = new Date('2026-10-05T12:00:00');
const tx = (hour: number, amount: number, daysAgo = 2) => {
  const d = new Date(NOW); d.setDate(d.getDate() - daysAgo); d.setHours(hour, 0, 0, 0);
  return { type: 'debit', amount, date: d } as any;
};

test('noticeLateNight finds a real after-9PM pattern', () => {
  const t = [tx(22, 500), tx(23, 400), tx(21, 450), tx(13, 100), tx(11, 150), tx(16, 120)];
  const r = noticeLateNight(t, NOW)!;
  expect(r.count).toBe(3);
  expect(r.lateAvg).toBe(450);
  expect(r.dayAvg).toBe(123);
  expect(r.pct).toBeGreaterThan(100);
});

test('noticeLateNight stays quiet without a pattern', () => {
  expect(noticeLateNight([], NOW)).toBeNull();
  expect(noticeLateNight([tx(22, 100), tx(23, 100), tx(13, 500)], NOW)).toBeNull();                   // fewer than 3 late purchases
  expect(noticeLateNight([tx(22, 50), tx(23, 50), tx(21, 50), tx(13, 500)], NOW)).toBeNull();          // late spending is lower
  expect(noticeLateNight([tx(22, 900, 60), tx(23, 900, 61), tx(21, 900, 62), tx(13, 10, 2)], NOW)).toBeNull(); // older than 30 days
});

async function render(el: React.ReactElement) {
  let r: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(() => { r = ReactTestRenderer.create(el); });
  await ReactTestRenderer.act(() => { jest.advanceTimersByTime(1500); });
  return r!;
}

test('Reveal, header, banner and persona render', async () => {
  const theme = THEMES.q;
  const r = await render(
    <>
      <Reveal index={3}><Text>hello</Text></Reveal>
      <HomeHeader greeting="Good morning" monthSpend={2022.5} onSettings={() => {}} onWrap={() => {}} theme={theme} />
      <SmartTrackingBanner onPress={() => {}} theme={theme} />
      <PersonaCard persona={{ name: 'The Balanced Spender', desc: 'A healthy mix.', icon: 'scale-balance', color: '#5FD3A2' }} theme={theme} onClose={() => {}} />
    </>,
  );
  const json = JSON.stringify(r.toJSON());
  expect(json).toContain('Good morning');
  expect(json).toContain('Turn on Smart Tracking');
  expect(json).toContain('The Balanced Spender');
  await ReactTestRenderer.act(() => r.unmount());
});

test('QNoticed renders only when there is a pattern and wires the action', async () => {
  const theme = THEMES.q;
  const onExplore = jest.fn();
  const none = await render(<QNoticed transactions={[]} theme={theme} onExplore={onExplore} />);
  expect(none.toJSON()).toBeNull();
  const t = [tx(22, 500), tx(23, 400), tx(21, 450), tx(13, 100), tx(11, 150)];
  const r = await render(<QNoticed transactions={t} theme={theme} onExplore={onExplore} />);
  expect(JSON.stringify(r.toJSON())).toContain('Your spending changes after 9 PM.');
  const btn = r.root.findAll(n => n.props.accessibilityRole === 'button' && typeof n.props.onPress === 'function')[0];
  await ReactTestRenderer.act(() => { btn.props.onPress(); });
  expect(onExplore).toHaveBeenCalled();
  await ReactTestRenderer.act(() => r.unmount());
});
