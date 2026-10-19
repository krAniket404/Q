import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View, TouchableOpacity, Alert } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import QStatus from '../QStatus';
import { noticeLateNight } from '../../lib/insights';
import { ParsedTransaction } from '../../lib/smsParser';
import { Theme } from '../../theme/themes';
import { Typography } from '../../theme/typography';
import { TypeScale } from '../../theme/tokens';
import { buildRiskProfile, RiskWindow } from '../../ml/riskProfile';
import { NotificationAction } from '../../ml/notificationPlanner';

interface Props {
  transactions: ParsedTransaction[];
  theme: Theme;
  onExplore?: () => void;
  worthItTxnIds?: string[];
  onAction?: (action: NotificationAction, key: string) => void;
}

/** Q surfacing something it found in your own data or predicted via ML risk profiling. */
export default function QNoticed({ transactions, theme, onExplore, worthItTxnIds, onAction }: Props) {
  const found = useMemo(() => noticeLateNight(transactions), [transactions]);
  const riskProfile = useMemo(() => {
    const labels: Record<string, 'worth_it' | 'impulse'> = {};
    if (worthItTxnIds) {
      worthItTxnIds.forEach(id => { labels[id] = 'worth_it'; });
    }
    return buildRiskProfile(transactions, { labels });
  }, [transactions, worthItTxnIds]);

  const topWindow: RiskWindow | undefined = riskProfile.windows[0];

  if (!found && !topWindow) { return null; }

  const handleActionPress = (action: NotificationAction, key: string, label: string) => {
    if (action === 'hold_24h') {
      Alert.alert("24-Hour Hold Activated 🛡️", `Spending hold enabled for ${label}. We will help you pause before impulse buying!`);
    } else if (action === 'snooze') {
      Alert.alert("Snoozed ⏰", "Risk heads-up snoozed for 24 hours.");
    } else if (action === 'not_helpful') {
      Alert.alert("Feedback Saved 🤐", "This alert will stay quiet for the next 14 days.");
    }
    if (onAction) {
      onAction(action, key);
    }
  };

  return (
    <View style={[styles.wrap, { borderColor: theme.border }]} accessible accessibilityLabel="Q noticed spending pattern">
      <QStatus text="ML risk window" tone="ok" />

      {topWindow ? (
        <View style={styles.windowCard}>
          <Text style={[styles.headline, { color: theme.textPrimary }]}>
            {topWindow.label} is your highest spending window
          </Text>
          <Text style={[styles.body, { color: theme.textSecondary }]}>
            About ₹{Math.round(topWindow.expected).toLocaleString('en-IN')} usually moves in these hours ({Math.round(topWindow.share * 100)}% of weekly spend).
          </Text>

          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: `${theme.accent}20`, borderColor: theme.accent }]}
              onPress={() => handleActionPress('hold_24h', `risk:${topWindow.key}`, topWindow.label)}
            >
              <Icon name="shield-lock-outline" size={14} color={theme.accent} style={{ marginRight: 4 }} />
              <Text style={[styles.actionBtnText, { color: theme.accent }]}>Hold 24h</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: 'rgba(255,255,255,0.06)', borderColor: theme.border }]}
              onPress={() => handleActionPress('snooze', `risk:${topWindow.key}`, topWindow.label)}
            >
              <Icon name="clock-outline" size={14} color={theme.textSecondary} style={{ marginRight: 4 }} />
              <Text style={[styles.actionBtnText, { color: theme.textSecondary }]}>Snooze</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: 'rgba(255,255,255,0.06)', borderColor: theme.border }]}
              onPress={() => handleActionPress('not_helpful', `risk:${topWindow.key}`, topWindow.label)}
            >
              <Icon name="thumb-down-outline" size={14} color={theme.textSecondary} style={{ marginRight: 4 }} />
              <Text style={[styles.actionBtnText, { color: theme.textSecondary }]}>Not helpful</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : found ? (
        <View>
          <Text style={[styles.headline, { color: theme.textPrimary }]}>Your spending changes after 9 PM.</Text>
          <Text style={[styles.body, { color: theme.textSecondary }]}>
            {found.count} purchases after 9 PM in the last 30 days.
          </Text>
          <View style={styles.stats}>
            <View><Text style={[styles.statLabel, { color: theme.textSecondary }]}>After 9 PM</Text><Text style={[styles.statValue, { color: theme.warning }]}>₹{found.lateAvg.toLocaleString('en-IN')}</Text></View>
            <View><Text style={[styles.statLabel, { color: theme.textSecondary }]}>Daytime</Text><Text style={[styles.statValue, { color: theme.textPrimary }]}>₹{found.dayAvg.toLocaleString('en-IN')}</Text></View>
            <View><Text style={[styles.statLabel, { color: theme.textSecondary }]}>Difference</Text><Text style={[styles.statValue, { color: theme.textPrimary }]}>+{found.pct}%</Text></View>
          </View>
        </View>
      ) : null}

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
  windowCard: { marginTop: 4 },
  headline: { fontSize: 24, lineHeight: 30, letterSpacing: -0.8, marginTop: 10, fontFamily: Typography.fontFamilyBold },
  body: { fontSize: TypeScale.body, lineHeight: 22, marginTop: 6, fontFamily: Typography.fontFamilyRegular },
  actionRow: { flexDirection: 'row', gap: 8, marginTop: 14 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, borderWidth: 1 },
  actionBtnText: { fontSize: 12, fontWeight: '700' },
  stats: { flexDirection: 'row', gap: 28, marginTop: 16 },
  statLabel: { fontSize: TypeScale.micro, fontFamily: Typography.fontFamilyMedium },
  statValue: { fontSize: 24, letterSpacing: -0.6, marginTop: 2, fontFamily: Typography.fontFamilyLight },
  link: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center', marginTop: 12 },
  linkText: { fontSize: TypeScale.body, fontFamily: Typography.fontFamilyBold, borderBottomWidth: 1 },
});
