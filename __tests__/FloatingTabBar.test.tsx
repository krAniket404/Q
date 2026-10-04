import React from 'react';
import ReactTestRenderer from 'react-test-renderer';

jest.setTimeout(30000);
// Minimal stand-in for Reanimated: the real module needs the native runtime.
jest.mock('react-native-reanimated', () => {
  const { View } = require('react-native');
  const mut = (v: any) => ({ value: v });
  return {
    __esModule: true,
    default: { View },
    makeMutable: mut,
    useSharedValue: (v: any) => mut(v),
    useDerivedValue: (fn: () => any) => ({ get value() { return fn(); } }),
    useAnimatedStyle: (fn: () => any) => fn(),
    useReducedMotion: () => false,
    withSpring: (v: any) => v,
    withTiming: (v: any) => v,
  };
});
jest.mock('react-native-vector-icons/MaterialCommunityIcons', () => 'Icon');

import FloatingTabBar, { onTabBarScroll, tabBarVisible, TAB_BAR_CLEARANCE } from '../src/components/FloatingTabBar';
import { THEMES } from '../src/theme/themes';

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
  tabBarVisible.value = 1;
  onTabBarScroll(scroll(10));
  onTabBarScroll(scroll(200));
  expect(tabBarVisible.value).toBe(0);
  onTabBarScroll(scroll(150));
  expect(tabBarVisible.value).toBe(1);
  onTabBarScroll(scroll(400));
  onTabBarScroll(scroll(10));
  expect(tabBarVisible.value).toBe(1);
});

test('content clearance is larger than the bar height', () => {
  expect(TAB_BAR_CLEARANCE).toBeGreaterThanOrEqual(66 + 14);
});
