import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import AnimatedNumber from '../AnimatedNumber';
import { Theme } from '../../theme/themes';
import { Typography } from '../../theme/typography';
import { TypeScale } from '../../theme/tokens';
import { useReduceMotion } from '../../hooks/useReduceMotion';

interface Props { totalBudget: number; totalSpent: number; daysLeft: number; daysInMonth: number; elapsed: number; monthName: string; theme: Theme; }

export type PaceState = 'over' | 'ahead' | 'on' | 'under';
/** Compares how much of the budget is gone with how much of the month is gone. */
export function paceState(totalBudget: number, totalSpent: number, elapsed: number): PaceState {
  if (totalBudget <= 0) { return 'on'; }
  const spentFrac = totalSpent / totalBudget;
  if (spentFrac >= 1) { return 'over'; }
  if (spentFrac > elapsed + 0.05) { return 'ahead'; }
  if (spentFrac < elapsed - 0.15) { return 'under'; }
  return 'on';
}
const LABEL: Record<PaceState, string> = { over: 'Over budget', ahead: 'Ahead of pace', on: 'On pace', under: 'Under pace' };

/** The one number that matters: what you can spend per day, with a pace line showing money against time. */
export default function PaceHero({ totalBudget, totalSpent, daysLeft, daysInMonth, elapsed, monthName, theme }: Props) {
  const reduce = useReduceMotion();
  const remaining = totalBudget - totalSpent;
  const state = paceState(totalBudget, totalSpent, elapsed);
  const color = state === 'over' ? theme.danger : state === 'ahead' ? theme.warning : theme.success;
  const frac = totalBudget > 0 ? Math.min(totalSpent / totalBudget, 1) : 0;
  const fill = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduce) { fill.setValue(frac); return undefined; }
    const a = Animated.timing(fill, { toValue: frac, duration: 900, easing: Easing.out(Easing.cubic), useNativeDriver: true });
    a.start();
    return () => a.stop();
  }, [frac, reduce, fill]);
  const perDay = remaining > 0 ? Math.round(remaining / Math.max(daysLeft, 1)) : 0;

  return (
    <View style={styles.wrap}>
      <Text style={[styles.label, { color: theme.textSecondary }]}>{state === 'over' ? 'This month' : 'You can spend'}</Text>
      {state === 'over' ? (
        <Text style={[styles.big, { color: theme.danger }]}>₹{Math.abs(Math.round(remaining)).toLocaleString('en-IN')}<Text style={styles.per}> over</Text></Text>
      ) : (
        <Text style={[styles.big, { color: theme.textPrimary }]}>₹<AnimatedNumber value={perDay} duration={900} /><Text style={[styles.per, { color: theme.textSecondary }]}> a day</Text></Text>
      )}
      <Text style={[styles.sub, { color: theme.textSecondary }]}>
        ₹{Math.max(Math.round(remaining), 0).toLocaleString('en-IN')} left of ₹{totalBudget.toLocaleString('en-IN')} for {monthName} · {daysLeft} day{daysLeft === 1 ? '' : 's'} to go
      </Text>

      <View style={styles.track} accessible accessibilityRole="progressbar"
        accessibilityLabel={`${Math.round(frac * 100)} percent of the budget used, ${Math.round(elapsed * 100)} percent of the month gone. ${LABEL[state]}`}>
        <Animated.View style={[styles.fill, { backgroundColor: color, transform: [{ scaleX: fill }] }]} />
        <View style={[styles.today, { left: `${Math.min(Math.max(elapsed, 0), 1) * 100}%`, backgroundColor: theme.textPrimary }]} />
      </View>
      <View style={styles.legend}>
        <Text style={[styles.legendTxt, { color }]}>{LABEL[state]}</Text>
        <Text style={[styles.legendTxt, { color: theme.textSecondary }]}>Day {Math.max(daysInMonth - daysLeft, 1)} of {daysInMonth}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 4, marginBottom: 30 },
  label: { fontSize: TypeScale.label, fontFamily: Typography.fontFamilyMedium },
  big: { fontSize: 58, letterSpacing: -2.5, marginTop: 2, fontFamily: Typography.fontFamilyLight },
  per: { fontSize: 22, letterSpacing: -0.5, fontFamily: Typography.fontFamilyMedium },
  sub: { fontSize: TypeScale.body - 1, lineHeight: 23, marginTop: 4, fontFamily: Typography.fontFamilyRegular },
  track: { height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.1)', marginTop: 22, justifyContent: 'center' },
  fill: { position: 'absolute', left: 0, top: 0, bottom: 0, width: '100%', borderRadius: 3, transformOrigin: '0% 50%' },
  today: { position: 'absolute', width: 2, height: 16, top: -5, marginLeft: -1, borderRadius: 1 },
  legend: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 },
  legendTxt: { fontSize: TypeScale.micro + 1, fontFamily: Typography.fontFamilyBold },
});
