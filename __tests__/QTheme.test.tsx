import React from 'react';
import { Text } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import QCore from '../src/components/QCore';
import QStatus from '../src/components/QStatus';
import Glass from '../src/components/Glass';
import WellnessCard, { coreStateFor } from '../src/components/WellnessCard';
import { THEMES } from '../src/theme/themes';
import { CoreStates, TypeScale } from '../src/theme/tokens';

beforeAll(() => { jest.useFakeTimers(); });
afterAll(() => { jest.useRealTimers(); });

const states = Object.keys(CoreStates) as (keyof typeof CoreStates)[];

test.each(states)('QCore renders in %s state', async state => {
  let r: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(() => {
    r = ReactTestRenderer.create(<QCore state={state}><Text>742</Text></QCore>);
  });
  expect(r!.toJSON()).toBeTruthy();
  await ReactTestRenderer.act(() => r!.unmount());
});

test('QStatus and Glass render', async () => {
  let r: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(() => {
    r = ReactTestRenderer.create(<Glass level={4}><QStatus text="found a time pattern" tone="ai" /></Glass>);
  });
  expect(r!.toJSON()).toBeTruthy();
  await ReactTestRenderer.act(() => r!.unmount());
});

test('coreStateFor maps scores to states', () => {
  const z = { discipline: 0, impulse: 0, volatility: 0, wellness: 0, savingsRate: 0 };
  expect(coreStateFor(z).state).toBe('analyzing');
  expect(coreStateFor({ ...z, wellness: 50, impulse: 80 }).state).toBe('warning');
  expect(coreStateFor({ ...z, wellness: 80, impulse: 20 }).state).toBe('success');
  expect(coreStateFor({ ...z, wellness: 50, impulse: 20 }).state).toBe('insight');
});

test('WellnessCard renders with the Q theme', async () => {
  let r: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(() => {
    r = ReactTestRenderer.create(
      <WellnessCard theme={THEMES.q} scores={{ discipline: 86, impulse: 40, volatility: 38, wellness: 74, savingsRate: 91 }} />,
    );
  });
  expect(JSON.stringify(r!.toJSON())).toContain('Financial wellness');
  await ReactTestRenderer.act(() => r!.unmount());
});

test('no readable text is below the micro size', () => {
  expect(TypeScale.micro).toBeGreaterThanOrEqual(13);
});
