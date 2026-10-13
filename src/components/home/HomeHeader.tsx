import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import AnimatedNumber from '../AnimatedNumber';
import { Theme } from '../../theme/themes';
import { Typography } from '../../theme/typography';
import { TypeScale } from '../../theme/tokens';

interface Props { greeting: string; monthSpend: number; onSettings: () => void; onWrap: () => void; theme: Theme; }

/** Open-canvas header: the month's spend is the hero number, with no box around it. */
export default function HomeHeader({ greeting, monthSpend, onSettings, onWrap, theme }: Props) {
  return (
    <View style={styles.row}>
      <View style={{ flex: 1 }}>
        <Text style={[styles.greeting, { color: theme.textSecondary }]}>{greeting}</Text>
        <Text style={[styles.amount, { color: theme.textPrimary }]} accessibilityLabel={`Spent this month: ${Math.round(monthSpend)} rupees`}>
          ₹<AnimatedNumber value={Math.round(monthSpend)} duration={900} />
        </Text>
        <Text style={[styles.caption, { color: theme.textSecondary }]}>spent this month</Text>
      </View>
      <View style={styles.actions}>
        <Pressable accessibilityRole="button" accessibilityLabel="Open settings" onPress={onSettings}
          style={({ pressed }) => [styles.iconBtn, { borderColor: theme.border, opacity: pressed ? 0.6 : 1 }]}>
          <Icon name="tune-variant" size={20} color={theme.textSecondary} />
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Open monthly wrap" onPress={onWrap}
          style={({ pressed }) => [styles.wrap, { borderColor: theme.border, opacity: pressed ? 0.6 : 1 }]}>
          <Icon name="gift-outline" size={18} color={theme.textPrimary} />
          <Text style={[styles.wrapText, { color: theme.textPrimary }]}>Wrap</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 4, marginBottom: 22 },
  greeting: { fontSize: TypeScale.label, fontFamily: Typography.fontFamilyMedium },
  amount: { fontSize: 46, letterSpacing: -2, marginTop: 2, fontFamily: Typography.fontFamilyLight },
  caption: { fontSize: TypeScale.micro, marginTop: -2, fontFamily: Typography.fontFamilyMedium },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconBtn: { width: 46, height: 46, borderRadius: 23, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  wrap: { minHeight: 46, borderRadius: 23, borderWidth: 1, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 8 },
  wrapText: { fontSize: TypeScale.label, fontFamily: Typography.fontFamilyBold },
});
