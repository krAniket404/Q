import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import QCore from '../QCore';
import { Theme } from '../../theme/themes';
import { Typography } from '../../theme/typography';
import { TypeScale } from '../../theme/tokens';

interface Props { persona: { name: string; desc: string; icon: string; color: string }; theme: Theme; onClose?: () => void; }

/** Persona as an identity, not a category: the core holds its sigil, the name is the headline. */
export default function PersonaCard({ persona, theme, onClose }: Props) {
  return (
    <View style={[styles.wrap, { borderColor: theme.border }]}>
      <View style={styles.row}>
        <QCore state="insight" size={84}>
          <Icon name={persona.icon} size={26} color={persona.color} />
        </QCore>
        <View style={{ flex: 1, marginLeft: 16 }}>
          <Text style={[styles.label, { color: theme.textSecondary }]}>Your financial persona</Text>
          <Text style={[styles.name, { color: persona.color }]}>{persona.name}</Text>
        </View>
        {onClose ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Hide persona card" onPress={onClose} hitSlop={10} style={styles.close}>
            <Icon name="close" size={20} color={theme.textSecondary} />
          </Pressable>
        ) : null}
      </View>
      <Text style={[styles.desc, { color: theme.textSecondary }]}>{persona.desc}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderTopWidth: 1, paddingTop: 22, paddingHorizontal: 4, marginBottom: 26 },
  row: { flexDirection: 'row', alignItems: 'center' },
  label: { fontSize: TypeScale.micro, fontFamily: Typography.fontFamilyMedium },
  name: { fontSize: 28, lineHeight: 32, letterSpacing: -0.9, marginTop: 4, fontFamily: Typography.fontFamilyBold },
  desc: { fontSize: TypeScale.body, lineHeight: 25, marginTop: 14, fontFamily: Typography.fontFamilyRegular },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-start', marginRight: -8 },
});
