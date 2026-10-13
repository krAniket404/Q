import React, { useEffect, useRef, useState } from 'react';
import { Animated, LayoutChangeEvent, NativeScrollEvent, NativeSyntheticEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { Theme } from '../theme/themes';
import { Typography } from '../theme/typography';
import { TypeScale } from '../theme/tokens';
import { useReduceMotion } from '../hooks/useReduceMotion';

export type TabId = 'dashboard' | 'transactions' | 'budgets' | 'coach' | 'settings';
const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: 'dashboard', label: 'Home', icon: 'view-dashboard-outline' },
  { id: 'transactions', label: 'Spend', icon: 'swap-horizontal' },
  { id: 'budgets', label: 'Budget', icon: 'chart-pie' },
  { id: 'coach', label: 'Coach', icon: 'robot-outline' },
  { id: 'settings', label: 'More', icon: 'cog-outline' },
];

// Bar visibility is shared state so any screen can drive it from its scroll handler.
let visible = 1; // 1 = shown, 0 = tucked away
const listeners = new Set<(v: number) => void>();
export const getTabBarVisible = () => visible;
export function setTabBarVisible(v: number) {
  if (v === visible) { return; }
  visible = v;
  listeners.forEach(l => l(v));
}

let lastY = 0;
/** Pass to a ScrollView/FlatList: hides the bar while reading down, brings it back on scroll up. */
export function onTabBarScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
  const y = e.nativeEvent.contentOffset.y;
  const dy = y - lastY;
  if (y < 40 || dy < -8) { setTabBarVisible(1); } else if (dy > 8) { setTabBarVisible(0); }
  lastY = y;
}

export const TAB_BAR_CLEARANCE = 150; // bottom padding scroll content needs so nothing hides behind the bar
const SPRING = { tension: 170, friction: 9, useNativeDriver: true }; // slight overshoot, then settle
const FADE_STEPS = 8;

function TabItem({ tab, active, color, onPress, reduce }: {
  tab: (typeof TABS)[number]; active: boolean; color: string; onPress: () => void; reduce: boolean;
}) {
  const press = useRef(new Animated.Value(1)).current;
  const lift = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const to = active ? -3 : 0;
    if (reduce) { lift.setValue(to); return undefined; }
    const a = Animated.spring(lift, { toValue: to, ...SPRING });
    a.start();
    return () => a.stop();
  }, [active, reduce, lift]);
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityLabel={tab.label}
      accessibilityState={{ selected: active }}
      onPress={onPress}
      onPressIn={() => { Animated.timing(press, { toValue: 0.9, duration: 90, useNativeDriver: true }).start(); }}
      onPressOut={() => { if (reduce) { press.setValue(1); } else { Animated.spring(press, { toValue: 1, ...SPRING }).start(); } }}
      style={styles.item}>
      <Animated.View style={[styles.itemInner, { transform: [{ scale: press }, { translateY: lift }] }]}>
        <Icon name={tab.icon} size={24} color={color} />
        <Text style={[styles.label, { color, fontFamily: active ? Typography.fontFamilyBold : Typography.fontFamilyMedium }]}>{tab.label}</Text>
      </Animated.View>
    </Pressable>
  );
}

export default function FloatingTabBar({ active, onChange, theme }: { active: TabId; onChange: (t: TabId) => void; theme: Theme }) {
  const reduce = useReduceMotion();
  const [w, setW] = useState(0);
  const index = TABS.findIndex(t => t.id === active);
  const itemW = w / TABS.length;
  const x = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(0)).current;

  useEffect(() => { setTabBarVisible(1); }, [active]); // a new screen always starts with the bar visible

  useEffect(() => {
    if (reduce) { x.setValue(index * itemW); return undefined; }
    const a = Animated.spring(x, { toValue: index * itemW, ...SPRING });
    a.start();
    return () => a.stop();
  }, [index, itemW, reduce, x]);

  useEffect(() => {
    const apply = (v: number) => {
      const to = v ? 0 : 140;
      if (reduce) { slide.setValue(to); return; }
      Animated.spring(slide, { toValue: to, tension: 120, friction: 12, useNativeDriver: true }).start();
    };
    listeners.add(apply);
    return () => { listeners.delete(apply); };
  }, [reduce, slide]);

  return (
    <Animated.View style={[styles.wrap, { transform: [{ translateY: slide }] }]} pointerEvents="box-none">
      {/* Soft fade so content never collides with the bar */}
      <View style={styles.fade} pointerEvents="none">
        {Array.from({ length: FADE_STEPS }).map((_, i) => (
          <View key={i} style={{ flex: 1, backgroundColor: theme.bg, opacity: ((i + 1) / FADE_STEPS) * 0.97 }} />
        ))}
      </View>
      <View style={[styles.bar, { borderColor: theme.border }]} accessibilityRole="tablist" onLayout={(e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width)}>
        {w > 0 && (
          <Animated.View pointerEvents="none" style={[styles.indicator, { width: itemW, transform: [{ translateX: x }] }]}>
            <View style={[styles.pill, { backgroundColor: theme.glassStrong }]} />
          </Animated.View>
        )}
        {TABS.map(t => (
          <TabItem key={t.id} tab={t} reduce={reduce} active={t.id === active}
            color={t.id === active ? theme.accent : theme.textSecondary} onPress={() => onChange(t.id)} />
        ))}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 150, justifyContent: 'flex-end', paddingHorizontal: 16, paddingBottom: 14 },
  fade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 150 },
  bar: { flexDirection: 'row', height: 66, borderRadius: 33, borderWidth: 1, backgroundColor: 'rgba(16,16,15,0.96)', overflow: 'hidden', elevation: 8, shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 18, shadowOffset: { width: 0, height: 8 } },
  item: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  itemInner: { alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: TypeScale.micro - 1, marginTop: 3 },
  indicator: { position: 'absolute', top: 0, bottom: 0, left: 0, padding: 6 },
  pill: { flex: 1, borderRadius: 27 },
});
