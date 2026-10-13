import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, PanResponder, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import QStatus from '../QStatus';
import { Theme } from '../../theme/themes';
import { Typography } from '../../theme/typography';
import { TypeScale } from '../../theme/tokens';
import { useReduceMotion } from '../../hooks/useReduceMotion';
import { ParsedTransaction } from '../../lib/smsParser';
import { busiestHour, formatHour, hourOf, isLateNight, lastMonthDebits, windowStats } from '../../lib/rhythm';

const TAU = Math.PI * 2;
const MAX_DOTS = 140;

/** The 24-hour dial: every dot is a purchase placed at the hour you made it. Drag or tap to read any hour. */
export default function RhythmDial({ transactions, theme }: { transactions: ParsedTransaction[]; theme: Theme }) {
  const { width } = useWindowDimensions();
  const size = Math.min(width - 48, 340);
  const R = size / 2;
  const reduce = useReduceMotion();
  const debits = useMemo(() => lastMonthDebits(transactions), [transactions]);
  const avg = useMemo(() => (debits.length ? debits.reduce((s, t) => s + t.amount, 0) / debits.length : 0), [debits]);
  const start = useMemo(() => busiestHour(debits), [debits]);
  const [hour, setHour] = useState(start);
  const box = useRef<View>(null);
  const origin = useRef({ x: 0, y: 0 });
  const unwrapped = useRef((start / 24) * 360);
  const angle = useRef(new Animated.Value((start / 24) * 360)).current;

  useEffect(() => { setHour(start); }, [start]);

  useEffect(() => {
    const target = (hour / 24) * 360;
    const delta = ((target - unwrapped.current + 540) % 360) - 180; // shortest way round
    unwrapped.current += delta;
    if (reduce) { angle.setValue(unwrapped.current); return undefined; }
    const a = Animated.spring(angle, { toValue: unwrapped.current, tension: 90, friction: 12, useNativeDriver: true });
    a.start();
    return () => a.stop();
  }, [hour, reduce, angle]);

  const fromPoint = (x: number, y: number) => {
    const a = Math.atan2(y - R, x - R) + Math.PI / 2;
    setHour((Math.round((((a / TAU) * 24 + 24) % 24) * 4) / 4) % 24);
  };
  const pan = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 6 && Math.abs(g.dx) > Math.abs(g.dy),
    onPanResponderGrant: () => { box.current?.measureInWindow((x, y) => { origin.current = { x, y }; }); },
    onPanResponderMove: (_, g) => fromPoint(g.moveX - origin.current.x, g.moveY - origin.current.y),
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [R]);

  const step = (d: number) => setHour(h => (h + d + 24) % 24);
  const stats = useMemo(() => windowStats(debits, hour, avg), [debits, hour, avg]);
  const dots = useMemo(() => {
    const every = Math.max(1, Math.ceil(debits.length / MAX_DOTS));
    return debits.filter((_, i) => i % every === 0).map((t, i) => {
      const a = (hourOf(t.date) / 24) * TAU - Math.PI / 2;
      const rel = avg > 0 ? Math.min(t.amount / (avg * 3), 1) : 0.3;
      const r = R * 0.5 + R * 0.34 * rel;
      const d = 4 + rel * 7;
      const late = isLateNight(t.date.getHours());
      const color = late ? (t.amount >= avg ? theme.danger : theme.warning) : theme.textSecondary;
      return { key: `${t.id || i}-${i}`, x: R + Math.cos(a) * r - d / 2, y: R + Math.sin(a) * r - d / 2, d, color, late };
    });
  }, [debits, avg, R, theme]);

  if (debits.length < 5) { return null; }
  const lateWindow = isLateNight(Math.floor(start));
  const levelColor = stats.level === 'HIGH' ? theme.danger : stats.level === 'MEDIUM' ? theme.warning : theme.success;
  const spin = angle.interpolate({ inputRange: [-3600, 3600], outputRange: ['-3600deg', '3600deg'] });

  return (
    <View style={styles.wrap}>
      <QStatus text={lateWindow ? 'found a late-night pattern' : 'found your busiest hour'} tone={lateWindow ? 'warn' : 'ok'} />
      <Text style={[styles.title, { color: theme.textPrimary }]}>Your money has a rhythm.</Text>
      <Text style={[styles.hint, { color: theme.textSecondary }]}>Each dot is a purchase, placed at the hour you made it. Drag around the dial.</Text>

      <View
        ref={box}
        collapsable={false}
        {...pan.panHandlers}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={`Hour of day: ${formatHour(hour)}. ${stats.count} purchases, impulse activity ${stats.level}`}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={e => step(e.nativeEvent.actionName === 'increment' ? 1 : -1)}
        style={{ alignSelf: 'center', width: size, height: size, marginTop: 18 }}>
        <Pressable style={StyleSheet.absoluteFill} onPress={e => fromPoint(e.nativeEvent.locationX, e.nativeEvent.locationY)}>
          <View pointerEvents="none" style={[styles.ring, { width: size, height: size, borderRadius: R, borderColor: theme.border }]} />
          <View pointerEvents="none" style={[styles.ring, { left: R * 0.5, top: R * 0.5, width: R, height: R, borderRadius: R / 2, borderColor: theme.border }]} />
          {Array.from({ length: 24 }).map((_, h) => {
            const major = h % 6 === 0;
            const late = isLateNight(h);
            return (
              <View key={h} pointerEvents="none" style={{
                position: 'absolute', left: R - 0.75, top: R - 4, width: 1.5, height: major ? 12 : 7,
                backgroundColor: late ? theme.warning : theme.textSecondary, opacity: major ? 0.9 : 0.45,
                transform: [{ rotate: `${h * 15}deg` }, { translateY: -(R - 6) }],
              }} />
            );
          })}
          {[['12a', 0], ['6a', 6], ['12p', 12], ['6p', 18]].map(([l, h]) => {
            const a = ((h as number) / 24) * TAU - Math.PI / 2;
            return <Text key={l as string} pointerEvents="none" style={[styles.axis, { color: theme.textSecondary, left: R + Math.cos(a) * (R - 30) - 14, top: R + Math.sin(a) * (R - 30) - 9 }]}>{l}</Text>;
          })}
          {dots.map(d => (
            <View key={d.key} pointerEvents="none" style={{ position: 'absolute', left: d.x, top: d.y, width: d.d, height: d.d, borderRadius: d.d / 2, backgroundColor: d.color, opacity: d.late ? 0.95 : 0.6 }} />
          ))}
          <Animated.View pointerEvents="none" style={{
            position: 'absolute', left: R - 0.75, top: R * 0.06, width: 1.5, height: R * 0.94,
            backgroundColor: theme.textPrimary, transformOrigin: '50% 100%', transform: [{ rotate: spin }],
          }}>
            <View style={[styles.bead, { backgroundColor: theme.textPrimary }]} />
          </Animated.View>
          <View pointerEvents="none" style={[styles.hub, { left: R - 4, top: R - 4, backgroundColor: theme.textPrimary }]} />
        </Pressable>
      </View>

      <View style={styles.readout} accessibilityLiveRegion="polite">
        <Text style={[styles.time, { color: theme.textPrimary }]}>{formatHour(hour)}</Text>
        <Text style={[styles.line, { color: theme.textSecondary }]}>{stats.count} purchases · ₹{stats.total.toLocaleString('en-IN')}</Text>
        <Text style={[styles.line, { color: levelColor }]}>Impulse activity: {stats.level}</Text>
      </View>
      <View style={styles.steps}>
        <Pressable accessibilityRole="button" onPress={() => step(-1)} style={[styles.stepBtn, { borderColor: theme.border }]}><Text style={[styles.stepTxt, { color: theme.textPrimary }]}>Earlier</Text></Pressable>
        <Pressable accessibilityRole="button" onPress={() => step(1)} style={[styles.stepBtn, { borderColor: theme.border }]}><Text style={[styles.stepTxt, { color: theme.textPrimary }]}>Later</Text></Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 8, marginBottom: 18 },
  title: { fontSize: 30, lineHeight: 34, letterSpacing: -1, marginTop: 12, fontFamily: Typography.fontFamilyBold },
  hint: { fontSize: TypeScale.body, lineHeight: 24, marginTop: 8, fontFamily: Typography.fontFamilyRegular },
  ring: { position: 'absolute', left: 0, top: 0, borderWidth: 1 },
  axis: { position: 'absolute', width: 28, textAlign: 'center', fontSize: TypeScale.micro - 1, fontFamily: Typography.fontFamilyMedium },
  bead: { position: 'absolute', top: -4, left: -3.75, width: 9, height: 9, borderRadius: 4.5 },
  hub: { position: 'absolute', width: 8, height: 8, borderRadius: 4 },
  readout: { alignItems: 'center', marginTop: 16, minHeight: 104 },
  time: { fontSize: 44, letterSpacing: -1.5, fontFamily: Typography.fontFamilyLight },
  line: { fontSize: TypeScale.body, marginTop: 4, fontFamily: Typography.fontFamilyMedium },
  steps: { flexDirection: 'row', justifyContent: 'center', gap: 12, marginTop: 10 },
  stepBtn: { minHeight: 46, minWidth: 110, borderRadius: 23, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  stepTxt: { fontSize: TypeScale.label, fontFamily: Typography.fontFamilyBold },
});
