// Shared design tokens, mirrored from the Q website so app and site feel like one product.
export const Palette = {
  bg: '#0A0A09',
  ink: '#ECEBE6',      // primary text
  silver: '#B9B8B2',   // secondary text
  smoke: '#85847F',    // tertiary text (still readable on bg)
  emerald: '#5FD3A2',  // success / intelligence
  amber: '#E0A84F',    // caution
  red: '#E0675A',      // impulse / warning
  ai: '#8FB4E8',       // AI, used sparingly
};

// Never go below `micro` for text users need to read.
export const TypeScale = { micro: 13, label: 15, body: 17, lead: 22, h2: 42, hero: 56 };

// Four physical glass levels: 1 open surface, 2 normal card, 3 interactive, 4 hero object.
export const GlassLevels = {
  1: { fill: 0.025, border: 0.05, highlight: 0.08, shadow: 0.2, radius: 20 },
  2: { fill: 0.05, border: 0.09, highlight: 0.16, shadow: 0.3, radius: 24 },
  3: { fill: 0.08, border: 0.14, highlight: 0.26, shadow: 0.4, radius: 28 },
  4: { fill: 0.11, border: 0.2, highlight: 0.36, shadow: 0.5, radius: 32 },
} as const;

export type QCoreState = 'idle' | 'analyzing' | 'noticed' | 'warning' | 'insight' | 'success';

// Behavior per QCore state: same object, different behavior.
export const CoreStates: Record<QCoreState, {
  color: string; spinMs: number; pulseMs: number; pulseAmp: number; halo: [number, number]; jitter: number;
}> = {
  idle:      { color: Palette.ink,     spinMs: 22000, pulseMs: 3200, pulseAmp: 0.02, halo: [0.05, 0.1],  jitter: 0 },
  analyzing: { color: Palette.ink,     spinMs: 5000,  pulseMs: 1400, pulseAmp: 0.04, halo: [0.06, 0.14], jitter: 0 },
  noticed:   { color: Palette.ink,     spinMs: 16000, pulseMs: 1200, pulseAmp: 0.07, halo: [0.1, 0.22],  jitter: 0 },
  warning:   { color: Palette.red,     spinMs: 9000,  pulseMs: 700,  pulseAmp: 0.03, halo: [0.1, 0.24],  jitter: 1.5 },
  insight:   { color: Palette.silver,  spinMs: 90000, pulseMs: 4000, pulseAmp: 0.01, halo: [0.08, 0.12], jitter: 0 },
  success:   { color: Palette.emerald, spinMs: 14000, pulseMs: 2600, pulseAmp: 0.09, halo: [0.12, 0.28], jitter: 0 },
};

// Spring feel used on the website (overshoot then settle).
export const Spring = { tension: 120, friction: 9 };
