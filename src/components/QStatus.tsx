import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { Palette, TypeScale } from '../theme/tokens';
import { Typography } from '../theme/typography';
import { useReduceMotion } from '../hooks/useReduceMotion';

type Tone = 'ok' | 'warn' | 'alert' | 'ai';
const TONE: Record<Tone, string> = { ok: Palette.emerald, warn: Palette.amber, alert: Palette.red, ai: Palette.ai };

/** The small recurring "Q ● found a pattern" line that introduces an insight. */
export default function QStatus({ text, tone = 'ok' }: { text: string; tone?: Tone }) {
  const still = useReduceMotion();
  const o = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    o.setValue(1);
    if (still) { return undefined; }
    const l = Animated.loop(Animated.sequence([
      Animated.timing(o, { toValue: 0.25, duration: 1200, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.timing(o, { toValue: 1, duration: 1200, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    ]));
    l.start();
    return () => l.stop();
  }, [still, o]);
  return (
    <View style={styles.row} accessible accessibilityLabel={`Q ${text}`}>
      <Text style={styles.q}>Q</Text>
      <Animated.View style={[styles.dot, { backgroundColor: TONE[tone], opacity: o }]} />
      <Text style={styles.text}>{text.toUpperCase()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  q: { color: Palette.ink, fontSize: TypeScale.label, fontFamily: Typography.fontFamilyHeavy, marginRight: 8 },
  dot: { width: 6, height: 6, borderRadius: 3, marginRight: 8 },
  text: { color: Palette.smoke, fontSize: TypeScale.micro, letterSpacing: 1, fontFamily: Typography.fontFamilyMedium },
});
