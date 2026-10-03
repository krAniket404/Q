import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import QCore from './QCore';
import QStatus from './QStatus';
import Glass from './Glass';
import { Typography } from '../theme/typography';
import { TypeScale, QCoreState } from '../theme/tokens';
import { getScoreColor as getDynamicScoreColor } from '../theme/scoreColor';
import AnimatedNumber from './AnimatedNumber';
import { Theme, THEMES } from '../theme/themes';

function createStyles(C: Theme) {
  return StyleSheet.create({
  glassCardHeavy: {
    backgroundColor: 'rgba(255,255,255,0.07)', borderColor: 'rgba(255,255,255,0.08)', borderTopColor: 'rgba(255,255,255,0.2)',
    borderWidth: 1, borderRadius: 32,
    shadowColor: "#000", shadowOffset: { width: 0, height: 16 }, shadowOpacity: 0.4, shadowRadius: 32, elevation: 8,
  },
  cardHeaderTitle: { color: C.textSecondary, fontSize: TypeScale.label, fontWeight: '700', marginBottom: 6, fontFamily: Typography.fontFamilyBold },
  coreScore: { color: C.textPrimary, fontSize: 38, letterSpacing: -1.5, fontFamily: Typography.fontFamilyLight },
  coreLabel: { color: C.textSecondary, fontSize: TypeScale.micro, marginTop: -2, fontFamily: Typography.fontFamilyMedium },
  ringWrap: { width: 116, height: 116, justifyContent: 'center', alignItems: 'center', marginRight: 18 },
  meterContainer: { marginBottom: 16 },
  meterLabelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  meterLabel: { color: C.textSecondary, fontSize: TypeScale.micro + 1, fontFamily: Typography.fontFamilyMedium },
  meterValue: { color: C.textPrimary, fontSize: TypeScale.micro + 1, fontWeight: '700', fontFamily: Typography.fontFamilyBold },
  meterBackground: { height: 6, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.06)' },
  meterFill: { height: '100%', borderRadius: 999 },
});
}

interface Props {
  scores: { discipline: number; impulse: number; volatility: number; wellness: number; savingsRate: number };
  theme: Theme;
}

type Scores = Props['scores'];

/** Maps the current numbers to a QCore state and the one-line status Q shows above them. */
export function coreStateFor(s: Scores): { state: QCoreState; text: string; tone: 'ok' | 'warn' | 'alert' | 'ai' } {
  if (s.wellness === 0 && s.discipline === 0 && s.impulse === 0) return { state: 'analyzing', text: 'is reading your transactions', tone: 'ai' };
  if (s.impulse >= 70) return { state: 'warning', text: 'noticed impulse activity', tone: 'alert' };
  if (s.wellness >= 70) return { state: 'success', text: 'your behavior looks steady', tone: 'ok' };
  return { state: 'insight', text: 'found where to improve', tone: 'warn' };
}

export default function WellnessCard({ scores, theme }: Props) {
  const C = theme || THEMES.azure;
  const styles = useMemo(() => createStyles(C), [C]);
  const core = coreStateFor(scores);
  return (
    <Glass level={3} style={{ padding: 22, marginBottom: 18 }}>
      <QStatus text={core.text} tone={core.tone} />
      <Text style={[styles.cardHeaderTitle, { marginTop: 10, marginBottom: 18 }]}>Financial wellness</Text>

      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        {/* Left Side: Circle */}
        <View style={styles.ringWrap}>
          <QCore state={core.state} size={112}>
            <Text style={styles.coreScore}><AnimatedNumber value={scores.wellness} duration={1000} /></Text>
            <Text style={styles.coreLabel}>Score</Text>
          </QCore>
        </View>

        {/* Right Side: Meters */}
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <View style={styles.meterContainer}>
            <View style={styles.meterLabelRow}>
              <Text style={[styles.meterLabel, { color: C.textSecondary }]}>Discipline</Text>
              <Text style={[styles.meterValue, { color: C.textPrimary }]}>
                <AnimatedNumber value={scores.discipline} duration={1000} />/100
              </Text>
            </View>
            <View style={styles.meterBackground}>
              <View style={[styles.meterFill, { width: `${scores.discipline}%`, backgroundColor: getDynamicScoreColor(scores.discipline, 'higher_is_better', C) }]} />
            </View>
          </View>

          <View style={styles.meterContainer}>
            <View style={styles.meterLabelRow}>
              <Text style={[styles.meterLabel, { color: C.textSecondary }]}>Impulse Index</Text>
              <Text style={[styles.meterValue, { color: C.textPrimary }]}>
                <AnimatedNumber value={scores.impulse} duration={1200} />/100
              </Text>
            </View>
            <View style={styles.meterBackground}>
              <View style={[styles.meterFill, { width: `${scores.impulse}%`, backgroundColor: getDynamicScoreColor(scores.impulse, 'lower_is_better', C) }]} />
            </View>
          </View>

          <View style={styles.meterContainer}>
            <View style={styles.meterLabelRow}>
              <Text style={[styles.meterLabel, { color: C.textSecondary }]}>Volatility</Text>
              <Text style={[styles.meterValue, { color: C.textPrimary }]}>
                <AnimatedNumber value={scores.volatility} duration={1400} />/100
              </Text>
            </View>
            <View style={styles.meterBackground}>
              <View style={[styles.meterFill, { width: `${scores.volatility}%`, backgroundColor: getDynamicScoreColor(scores.volatility, 'lower_is_better', C) }]} />
            </View>
          </View>

          <View style={styles.meterContainer}>
            <View style={styles.meterLabelRow}>
              <Text style={[styles.meterLabel, { color: C.textSecondary }]}>Savings Rate</Text>
              <Text style={[styles.meterValue, { color: C.textPrimary }]}>
                <AnimatedNumber value={Math.round(scores.savingsRate)} duration={1600} />/100
              </Text>
            </View>
            <View style={styles.meterBackground}>
              <View style={[styles.meterFill, { width: `${scores.savingsRate}%`, backgroundColor: getDynamicScoreColor(scores.savingsRate, 'higher_is_better', C) }]} />
            </View>
          </View>
        </View>
      </View>
    </Glass>
  );
}
