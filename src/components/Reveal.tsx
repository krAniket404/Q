import React, { useEffect, useRef } from 'react';
import { Animated, ViewStyle } from 'react-native';
import { useReduceMotion } from '../hooks/useReduceMotion';

/** Staggered entrance: fades in and settles upward. `index` sets the order (about 70ms apart). */
export default function Reveal({ index = 0, children, style }: { index?: number; children: React.ReactNode; style?: ViewStyle }) {
  const reduce = useReduceMotion();
  const o = useRef(new Animated.Value(0)).current;
  const y = useRef(new Animated.Value(18)).current;
  useEffect(() => {
    if (reduce) { o.setValue(1); y.setValue(0); return undefined; }
    const run = Animated.sequence([
      Animated.delay(Math.min(index, 7) * 70),
      Animated.parallel([
        Animated.timing(o, { toValue: 1, duration: 360, useNativeDriver: true }),
        Animated.spring(y, { toValue: 0, tension: 110, friction: 11, useNativeDriver: true }),
      ]),
    ]);
    run.start();
    return () => run.stop();
  }, [index, reduce, o, y]);
  return <Animated.View style={[{ opacity: o, transform: [{ translateY: y }] }, style]}>{children}</Animated.View>;
}
