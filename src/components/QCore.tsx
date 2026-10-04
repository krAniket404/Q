import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View, ViewStyle } from 'react-native';
import { CoreStates, QCoreState } from '../theme/tokens';
import { useReduceMotion } from '../hooks/useReduceMotion';

interface Props {
  state?: QCoreState;
  size?: number;
  style?: ViewStyle;
  children?: React.ReactNode; // usually the score, rendered inside the core
}

/**
 * QCore: Q's recurring identity object. A dark glass sphere with two tilted orbit rings.
 * The form stays the same; speed, pulse and color change with `state`.
 * Built on the core Animated API (native driver), so it needs no extra native modules.
 */
export default function QCore({ state = 'idle', size = 108, style, children }: Props) {
  const cfg = CoreStates[state];
  const still = useReduceMotion();
  const spin = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    spin.setValue(0);
    pulse.setValue(0);
    if (still) { return undefined; }
    const s = Animated.loop(Animated.timing(spin, { toValue: 1, duration: cfg.spinMs, easing: Easing.linear, useNativeDriver: true }));
    const p = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: cfg.pulseMs, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0, duration: cfg.pulseMs, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    ]));
    s.start();
    p.start();
    return () => { s.stop(); p.stop(); };
  }, [state, still, cfg.spinMs, cfg.pulseMs, spin, pulse]);

  const deg = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const degRev = spin.interpolate({ inputRange: [0, 1], outputRange: ['360deg', '0deg'] });
  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1 + cfg.pulseAmp] });
  const halo = pulse.interpolate({ inputRange: [0, 1], outputRange: cfg.halo });
  const jitter = pulse.interpolate({ inputRange: [0, 1], outputRange: [-cfg.jitter, cfg.jitter] });

  const sphere = size * 0.74;
  const ring = (d: number) => ({
    position: 'absolute' as const, width: d, height: d, borderRadius: d / 2, borderWidth: 1.2,
    borderColor: 'rgba(236,235,230,0.14)', borderTopColor: cfg.color,
  });

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={`Q core, ${state}`}
      style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, style]}>
      <Animated.View
        pointerEvents="none"
        style={[{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: size / 2, backgroundColor: cfg.color, opacity: halo, transform: [{ scale: 1.15 }] }]}
      />
      <Animated.View style={{ transform: [{ translateX: jitter }, { scale }], alignItems: 'center', justifyContent: 'center' }}>
        <View style={[styles.sphere, { width: sphere, height: sphere, borderRadius: sphere / 2 }]}>
          <View style={[styles.spec, { width: sphere * 0.5, height: sphere * 0.5, borderRadius: sphere / 4, top: sphere * 0.08, left: sphere * 0.12 }]} />
        </View>
        <Animated.View pointerEvents="none" style={[ring(size * 1.02), { transform: [{ perspective: 700 }, { rotateX: '68deg' }, { rotateZ: deg }] }]} />
        <Animated.View pointerEvents="none" style={[ring(size * 0.84), { transform: [{ perspective: 700 }, { rotateX: '52deg' }, { rotateZ: degRev }] }]} />
      </Animated.View>
      {children ? <View style={styles.center} pointerEvents="none">{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  sphere: { backgroundColor: '#101012', borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)', overflow: 'hidden' },
  spec: { position: 'absolute', backgroundColor: 'rgba(255,255,255,0.09)' },
  center: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
});
