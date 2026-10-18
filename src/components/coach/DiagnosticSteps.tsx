import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import QStatus from '../QStatus';
import Reveal from '../Reveal';
import { Fact } from '../../lib/coachFacts';
import { Theme } from '../../theme/themes';
import { Typography } from '../../theme/typography';
import { TypeScale } from '../../theme/tokens';
import { useReduceMotion } from '../../hooks/useReduceMotion';

/** Shown while the Coach is answering: the real facts Q is looking at, one line at a time. */
export default function DiagnosticSteps({ facts, theme }: { facts: Fact[]; theme: Theme }) {
  const reduce = useReduceMotion();
  const [shown, setShown] = useState(1);
  useEffect(() => {
    if (reduce) { setShown(facts.length); return undefined; }
    setShown(1);
    const id = setInterval(() => setShown(s => Math.min(s + 1, facts.length)), 480);
    return () => clearInterval(id);
  }, [facts, reduce]);

  return (
    <View style={[styles.wrap, { borderColor: theme.border }]} accessible accessibilityLiveRegion="polite" accessibilityLabel="Q is reading your data">
      <QStatus text="reading your data" tone="ai" />
      {facts.slice(0, shown).map((f, i) => (
        <Reveal key={f.label + i}>
          <View style={styles.row}>
            <View style={[styles.dot, { backgroundColor: theme.success }]} />
            <Text style={[styles.line, { color: theme.textSecondary }]}>
              <Text style={{ color: theme.textPrimary, fontFamily: Typography.fontFamilyBold }}>{f.label}</Text>
              {`  ${f.detail}`}
            </Text>
          </View>
        </Reveal>
      ))}
      {shown >= facts.length ? <Text style={[styles.writing, { color: theme.textSecondary }]}>Writing the answer…</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginHorizontal: 4, marginBottom: 10, paddingTop: 14, borderTopWidth: 1 },
  row: { flexDirection: 'row', alignItems: 'flex-start', marginTop: 8 },
  dot: { width: 6, height: 6, borderRadius: 3, marginTop: 8, marginRight: 10 },
  line: { flex: 1, fontSize: TypeScale.micro + 2, lineHeight: 21, fontFamily: Typography.fontFamilyRegular },
  writing: { fontSize: TypeScale.micro + 2, marginTop: 10, fontFamily: Typography.fontFamilyMedium },
});
