import React from 'react';
import ReactTestRenderer from 'react-test-renderer';

jest.setTimeout(30000);
jest.mock('react-native-vector-icons/MaterialCommunityIcons', () => 'Icon');

import FloatingTabBar, { getTabBarVisible, onTabBarScroll, setTabBarVisible, TAB_BAR_CLEARANCE } from '../src/components/FloatingTabBar';
import { THEMES } from '../src/theme/themes';

beforeAll(() => { jest.useFakeTimers(); });
afterAll(() => { jest.useRealTimers(); });

const scroll = (y: number) => ({ nativeEvent: { contentOffset: { y } } } as any);

test('renders five tabs and reports presses', async () => {
  const onChange = jest.fn();
  let r: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(() => {
    r = ReactTestRenderer.create(<FloatingTabBar active="dashboard" onChange={onChange} theme={THEMES.q} />);
  });
  const nodes = r!.root.findAll(n => n.props.accessibilityRole === 'tab' && typeof n.props.onPress === 'function');
  const labels = [...new Set(nodes.map(n => n.props.accessibilityLabel))];
  expect(labels).toEqual(['Home', 'Spend', 'Budget', 'Coach', 'More']);
  expect(nodes.find(n => n.props.accessibilityLabel === 'Home')!.props.accessibilityState.selected).toBe(true);
  expect(nodes.find(n => n.props.accessibilityLabel === 'Budget')!.props.accessibilityState.selected).toBe(false);
  await ReactTestRenderer.act(() => { nodes.find(n => n.props.accessibilityLabel === 'Budget')!.props.onPress(); });
  expect(onChange).toHaveBeenCalledWith('budgets');
  await ReactTestRenderer.act(() => r!.unmount());
});

test('bar hides when scrolling down and returns when scrolling up', () => {
  setTabBarVisible(1);
  onTabBarScroll(scroll(10));
  onTabBarScroll(scroll(200));
  expect(getTabBarVisible()).toBe(0);
  onTabBarScroll(scroll(150));
  expect(getTabBarVisible()).toBe(1);
  onTabBarScroll(scroll(400));
  onTabBarScroll(scroll(10));
  expect(getTabBarVisible()).toBe(1);
});

test('hiding the bar drives the slide animation without errors', async () => {
  let r: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(() => {
    r = ReactTestRenderer.create(<FloatingTabBar active="coach" onChange={() => {}} theme={THEMES.q} />);
  });
  await ReactTestRenderer.act(() => { setTabBarVisible(0); jest.advanceTimersByTime(600); });
  await ReactTestRenderer.act(() => { setTabBarVisible(1); jest.advanceTimersByTime(600); });
  await ReactTestRenderer.act(() => r!.unmount());
});

test('content clearance is larger than the bar height', () => {
  expect(TAB_BAR_CLEARANCE).toBeGreaterThanOrEqual(66 + 14);
});
