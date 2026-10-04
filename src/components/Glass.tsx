import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { GlassLevels } from '../theme/tokens';

interface Props { level?: 1 | 2 | 3 | 4; style?: ViewStyle | ViewStyle[]; children?: React.ReactNode; }

/**
 * Layered glass surface. Higher level = closer to the viewer: more fill, brighter edge, deeper shadow.
 * Uses translucent fills and a top highlight (no blur module), so it is cheap on low-end Android.
 */
export default function Glass({ level = 2, style, children }: Props) {
  const g = GlassLevels[level];
  return (
    <View
      style={[
        {
          borderRadius: g.radius, borderWidth: 1, overflow: 'hidden',
          backgroundColor: `rgba(255,255,255,${g.fill})`, borderColor: `rgba(255,255,255,${g.border})`,
          shadowColor: '#000', shadowOffset: { width: 0, height: 12 * level }, shadowOpacity: g.shadow, shadowRadius: 12 * level, elevation: 2 * level,
        },
        style as ViewStyle,
      ]}>
      <View pointerEvents="none" style={[styles.edge, { backgroundColor: `rgba(255,255,255,${g.highlight})` }]} />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({ edge: { position: 'absolute', top: 0, left: 16, right: 16, height: 1 } });
