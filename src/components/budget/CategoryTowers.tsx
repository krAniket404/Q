import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { Theme } from '../../theme/themes';
import { Typography } from '../../theme/typography';
import { TypeScale } from '../../theme/tokens';
import { useReduceMotion } from '../../hooks/useReduceMotion';

const BAR_H = 150;
export const compact = (v: number) => (v >= 1000 ? `${(v / 1000).toFixed(v >= 10000 ? 0 : 1).replace('.0', '')}k` : `${Math.round(v)}`);
const short = (c: string) => c.split(/[ &]/)[0];

interface Props {
  categories: string[]; spent: { [k: string]: number }; budgets: { [k: string]: number };
  colors: { [k: string]: string }; icons: { [k: string]: string }; theme: Theme; onSelect: (c: string) => void;
}

function Tower({ cat, index, ratio, limit, limitRatio, over, color, icon, value, theme, onPress }: {
  cat: string; index: number; ratio: number; limit: number; limitRatio: number; over: boolean; color: string; icon: string; value: number; theme: Theme; onPress: () => void;
}) {
  const reduce = useReduceMotion();
  const grow = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduce) { grow.setValue(ratio); return undefined; }
    const a = Animated.sequence([Animated.delay(index * 60), Animated.spring(grow, { toValue: ratio, tension: 70, friction: 8, useNativeDriver: true })]);
    a.start();
    return () => a.stop();
  }, [ratio, index, reduce, grow]);
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${cat}: ₹${Math.round(value)} spent, limit ₹${Math.round(limit)}${over ? ', over limit' : ''}. View transactions`}
      onPress={onPress} style={({ pressed }) => [styles.col, { opacity: pressed ? 0.6 : 1 }]}>
      <Text style={[styles.value, { color: over ? theme.danger : theme.textPrimary }]}>₹{compact(value)}</Text>
      <View style={styles.barArea}>
        <View style={[styles.limit, { bottom: limitRatio * BAR_H, backgroundColor: theme.textSecondary }]} />
        <Animated.View style={[styles.bar, { height: BAR_H, backgroundColor: over ? theme.danger : color, transform: [{ scaleY: grow }] }]} />
      </View>
      <Icon name={icon} size={18} color={color} style={{ marginTop: 10 }} />
      <Text style={[styles.name, { color: theme.textSecondary }]} numberOfLines={1}>{short(cat)}</Text>
    </Pressable>
  );
}

/** Spending as a skyline: height is what you spent, the dash is your limit. Tap a tower for its transactions. */
export default function CategoryTowers({ categories, spent, budgets, colors, icons, theme, onSelect }: Props) {
  const active = categories.filter(c => (spent[c] || 0) > 0);
  if (active.length === 0) {
    return <Text style={[styles.empty, { color: theme.textSecondary }]}>No spending yet this month. Towers appear as you spend.</Text>;
  }
  const scale = Math.max(...active.map(c => Math.max(spent[c] || 0, budgets[c] || 0)), 1);
  return (
    <View>
      <Text style={[styles.key, { color: theme.textSecondary }]}>Height is what you spent. The dash is your limit.</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {active.map((c, i) => (
          <Tower key={c} cat={c} index={i} value={spent[c] || 0} ratio={(spent[c] || 0) / scale} limit={budgets[c] || 0} limitRatio={(budgets[c] || 0) / scale}
            over={(spent[c] || 0) >= (budgets[c] || Infinity)} color={colors[c] || theme.textSecondary} icon={icons[c] || 'package-variant-closed'}
            theme={theme} onPress={() => onSelect(c)} />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  key: { fontSize: TypeScale.micro + 1, marginBottom: 14, fontFamily: Typography.fontFamilyRegular },
  row: { alignItems: 'flex-end', paddingRight: 12, gap: 6 },
  col: { width: 62, alignItems: 'center', minHeight: 44 },
  value: { fontSize: TypeScale.micro + 1, marginBottom: 6, fontFamily: Typography.fontFamilyBold },
  barArea: { width: 30, height: BAR_H, justifyContent: 'flex-end' },
  bar: { width: 30, borderRadius: 6, transformOrigin: '50% 100%' },
  limit: { position: 'absolute', left: -6, right: -6, height: 2, borderRadius: 1, opacity: 0.8, zIndex: 2 },
  name: { fontSize: TypeScale.micro, marginTop: 2, fontFamily: Typography.fontFamilyMedium },
  empty: { fontSize: TypeScale.body, lineHeight: 24, fontFamily: Typography.fontFamilyRegular },
});
