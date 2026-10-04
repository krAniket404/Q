import React, { useEffect, useState } from 'react';
import { LayoutChangeEvent, NativeScrollEvent, NativeSyntheticEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  makeMutable, useAnimatedStyle, useDerivedValue, useReducedMotion, useSharedValue, withSpring, withTiming,
} from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { Theme } from '../theme/themes';
import { Typography } from '../theme/typography';
import { TypeScale } from '../theme/tokens';

export type TabId = 'dashboard' | 'transactions' | 'budgets' | 'coach' | 'settings';
const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: 'dashboard', label: 'Home', icon: 'view-dashboard-outline' },
  { id: 'transactions', label: 'Spend', icon: 'swap-horizontal' },
  { id: 'budgets', label: 'Budget', icon: 'chart-pie' },
  { id: 'coach', label: 'Coach', icon: 'robot-outline' },
  { id: 'settings', label: 'More', icon: 'cog-outline' },
];

/** 1 = bar shown, 0 = bar tucked away. Screens drive it through `onTabBarScroll`. */
export const tabBarVisible = makeMutable(1);
let lastY = 0;
/** Pass to a ScrollView/FlatList: hides the bar while reading down, brings it back on scroll up. */
export function onTabBarScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
  const y = e.nativeEvent.contentOffset.y;
  const dy = y - lastY;
  if (y < 40 || dy < -8) { if (tabBarVisible.value !== 1) tabBarVisible.value = 1; }
  else if (dy > 8) { if (tabBarVisible.value !== 0) tabBarVisible.value = 0; }
  lastY = y;
}

export const TAB_BAR_CLEARANCE = 150; // bottom padding scroll content needs so nothing hides behind the bar

const SPRING = { damping: 17, stiffness: 240, mass: 0.7 }; // slight overshoot, then settle

function TabItem({ tab, active, color, onPress, reduce }: {
  tab: (typeof TABS)[number]; active: boolean; color: string; onPress: () => void; reduce: boolean;
}) {
  const press = useSharedValue(1);
  const lift = useDerivedValue(() => (reduce ? (active ? -2 : 0) : withSpring(active ? -3 : 0, SPRING)));
  const style = useAnimatedStyle(() => ({ transform: [{ scale: press.value }, { translateY: lift.value }] }));
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityLabel={tab.label}
      accessibilityState={{ selected: active }}
      onPress={onPress}
      onPressIn={() => { press.value = withTiming(0.9, { duration: 90 }); }}
      onPressOut={() => { press.value = reduce ? 1 : withSpring(1, SPRING); }}
      style={styles.item}>
      <Animated.View style={[styles.itemInner, style]}>
        <Icon name={tab.icon} size={24} color={color} />
        <Text style={[styles.label, { color, fontFamily: active ? Typography.fontFamilyBold : Typography.fontFamilyMedium }]}>{tab.label}</Text>
      </Animated.View>
    </Pressable>
  );
}

export default function FloatingTabBar({ active, onChange, theme }: { active: TabId; onChange: (t: TabId) => void; theme: Theme }) {
  const reduce = useReducedMotion();
  const [w, setW] = useState(0);
  const index = TABS.findIndex(t => t.id === active);
  const itemW = w / TABS.length;

  useEffect(() => { tabBarVisible.value = 1; }, [active]); // a new screen always starts with the bar visible

  const x = useDerivedValue(() => (reduce ? index * itemW : withSpring(index * itemW, SPRING)));
  const indicator = useAnimatedStyle(() => ({ width: itemW, transform: [{ translateX: x.value }] }));
  const slide = useDerivedValue(() => (reduce ? (tabBarVisible.value ? 0 : 140) : withSpring(tabBarVisible.value ? 0 : 140, { damping: 20, stiffness: 200 })));
  const wrap = useAnimatedStyle(() => ({ transform: [{ translateY: slide.value }] }));

  return (
    <Animated.View style={[styles.wrap, wrap]} pointerEvents="box-none">
      {/* Soft fade so content never collides with the bar */}
      <Svg style={styles.fade} pointerEvents="none" width="100%" height={150}>
        <Defs>
          <LinearGradient id="f" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={theme.bg} stopOpacity={0} />
            <Stop offset="0.55" stopColor={theme.bg} stopOpacity={0.88} />
            <Stop offset="1" stopColor={theme.bg} stopOpacity={0.98} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="150" fill="url(#f)" />
      </Svg>
      <View style={[styles.bar, { borderColor: theme.border }]} accessibilityRole="tablist" onLayout={(e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width)}>
        {w > 0 && <Animated.View pointerEvents="none" style={[styles.indicator, indicator]}><View style={[styles.pill, { backgroundColor: theme.glassStrong }]} /></Animated.View>}
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
  fade: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  bar: { flexDirection: 'row', height: 66, borderRadius: 33, borderWidth: 1, backgroundColor: 'rgba(16,16,15,0.96)', overflow: 'hidden', elevation: 8, shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 18, shadowOffset: { width: 0, height: 8 } },
  item: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  itemInner: { alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: TypeScale.micro - 1, marginTop: 3 },
  indicator: { position: 'absolute', top: 0, bottom: 0, left: 0, padding: 6 },
  pill: { flex: 1, borderRadius: 27 },
});
