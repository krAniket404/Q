import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import QStatus from '../QStatus';
import { noticeLateNight } from '../../lib/insights';
import { ParsedTransaction } from '../../lib/smsParser';
import { Theme } from '../../theme/themes';
import { Typography } from '../../theme/typography';
import { TypeScale } from '../../theme/tokens';

interface Props { transactions: ParsedTransaction[]; theme: Theme; onExplore?: () => void; }

/** Q surfacing something it found in your own data. Renders nothing until there is a real pattern. */
export default function QNoticed({ transactions, theme, onExplore }: Props) {
  const found = useMemo(() => noticeLateNight(transactions), [transactions]);
  if (!found) { return null; }
  return (
    <View style={[styles.wrap, { borderColor: theme.border }]} accessible accessibilityLabel={`Q noticed. Your spending changes after 9 PM. ${found.count} purchases.`}>
      <QStatus text="noticed" tone="ok" />
      <Text style={[styles.headline, { color: theme.textPrimary }]}>Your spending changes after 9 PM.</Text>
      <Text style={[styles.body, { color: theme.textSecondary }]}>
        {found.count} purchases after 9 PM in the last 30 days.
      </Text>
      <View style={styles.stats}>
        <View><Text style={[styles.statLabel, { color: theme.textSecondary }]}>After 9 PM</Text><Text style={[styles.statValue, { color: theme.warning }]}>₹{found.lateAvg.toLocaleString('en-IN')}</Text></View>
        <View><Text style={[styles.statLabel, { color: theme.textSecondary }]}>Daytime</Text><Text style={[styles.statValue, { color: theme.textPrimary }]}>₹{found.dayAvg.toLocaleString('en-IN')}</Text></View>
        <View><Text style={[styles.statLabel, { color: theme.textSecondary }]}>Difference</Text><Text style={[styles.statValue, { color: theme.textPrimary }]}>+{found.pct}%</Text></View>
      </View>
      {onExplore ? (
        <Pressable accessibilityRole="button" onPress={onExplore} hitSlop={8} style={({ pressed }) => [styles.link, { opacity: pressed ? 0.6 : 1 }]}>
          <Text style={[styles.linkText, { color: theme.textPrimary, borderBottomColor: theme.textSecondary }]}>Explore pattern</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderTopWidth: 1, paddingTop: 20, paddingHorizontal: 4, marginBottom: 26 },
  headline: { fontSize: 26, lineHeight: 31, letterSpacing: -0.8, marginTop: 12, fontFamily: Typography.fontFamilyBold },
  body: { fontSize: TypeScale.body, lineHeight: 24, marginTop: 8, fontFamily: Typography.fontFamilyRegular },
  stats: { flexDirection: 'row', gap: 28, marginTop: 16 },
  statLabel: { fontSize: TypeScale.micro, fontFamily: Typography.fontFamilyMedium },
  statValue: { fontSize: 24, letterSpacing: -0.6, marginTop: 2, fontFamily: Typography.fontFamilyLight },
  link: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center', marginTop: 8 },
  linkText: { fontSize: TypeScale.body, fontFamily: Typography.fontFamilyBold, borderBottomWidth: 1 },
});
