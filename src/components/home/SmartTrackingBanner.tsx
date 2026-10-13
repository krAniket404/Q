import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { Theme } from '../../theme/themes';
import { Typography } from '../../theme/typography';
import { Palette, TypeScale } from '../../theme/tokens';

/** A quiet prompt row, not a blue box: hairline edges, an amber dot, and one clear action. */
export default function SmartTrackingBanner({ onPress, theme }: { onPress: () => void; theme: Theme }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel="Enable Smart Tracking" onPress={onPress}
      style={({ pressed }) => [styles.row, { borderColor: theme.border, opacity: pressed ? 0.65 : 1 }]}>
      <View style={[styles.dot, { backgroundColor: Palette.amber }]} />
      <View style={{ flex: 1 }}>
        <Text style={[styles.title, { color: theme.textPrimary }]}>Turn on Smart Tracking</Text>
        <Text style={[styles.sub, { color: theme.textSecondary }]}>Capture transactions from GPay, PhonePe and more.</Text>
      </View>
      <Icon name="chevron-right" size={22} color={theme.textSecondary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, paddingHorizontal: 4, borderTopWidth: 1, borderBottomWidth: 1, marginBottom: 22, minHeight: 64 },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 14 },
  title: { fontSize: TypeScale.body, fontFamily: Typography.fontFamilyBold },
  sub: { fontSize: TypeScale.micro + 1, marginTop: 2, fontFamily: Typography.fontFamilyRegular },
});
