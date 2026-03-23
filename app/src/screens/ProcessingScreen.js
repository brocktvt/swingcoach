import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, SafeAreaView, Animated, Easing } from 'react-native';
import { colors, spacing } from '../theme';

// ─────────────────────────────────────────────────────────────────────────────
// STEP ICONS — pure React Native shapes, no emoji, theme-matched
// ─────────────────────────────────────────────────────────────────────────────

/** Video camera — represents "uploading your swing video" */
function CameraIcon({ color }) {
  return (
    <View style={[ic.wrap, { alignItems: 'center', justifyContent: 'center' }]}>
      {/* Camera body */}
      <View style={[ic.camBody, { backgroundColor: color }]}>
        {/* Lens ring */}
        <View style={[ic.camLens, { borderColor: colors.bg }]}>
          <View style={[ic.camLensInner, { backgroundColor: colors.bg }]} />
        </View>
      </View>
      {/* Viewfinder bump */}
      <View style={[ic.camBump, { backgroundColor: color }]} />
      {/* Record light */}
      <View style={[ic.camDot, { backgroundColor: colors.error }]} />
    </View>
  );
}

/** Golf club + ball — represents "comparing to pro swing" */
function GolfIcon({ color }) {
  return (
    <View style={[ic.wrap, { alignItems: 'center', justifyContent: 'center' }]}>
      {/* Club shaft — diagonal line via rotated view */}
      <View style={[ic.shaftWrap, { transform: [{ rotate: '-30deg' }] }]}>
        <View style={[ic.shaft, { backgroundColor: color }]} />
        {/* Club head at bottom */}
        <View style={[ic.clubHead, { backgroundColor: color }]} />
      </View>
      {/* Golf ball */}
      <View style={[ic.ball, { borderColor: color }]}>
        {/* Dimple lines */}
        <View style={[ic.dimple1, { backgroundColor: color, opacity: 0.4 }]} />
        <View style={[ic.dimple2, { backgroundColor: color, opacity: 0.4 }]} />
      </View>
    </View>
  );
}

/** Stick figure with motion arc — "mapping body positions" */
function BodyIcon({ color }) {
  return (
    <View style={ic.wrap}>
      <View style={{ alignItems: 'center' }}>
        {/* Head */}
        <View style={[ic.head, { backgroundColor: color }]} />
        {/* Torso */}
        <View style={[ic.torso, { backgroundColor: color }]} />
        {/* Arms spread wide — golf address position */}
        <View style={ic.armRow}>
          <View style={[ic.armL, { backgroundColor: color }]} />
          <View style={{ width: 18 }} />
          <View style={[ic.armR, { backgroundColor: color }]} />
        </View>
        {/* Legs slightly apart */}
        <View style={ic.legRow}>
          <View style={[ic.leg, { backgroundColor: color, transform: [{ rotate: '-8deg' }] }]} />
          <View style={{ width: 10 }} />
          <View style={[ic.leg, { backgroundColor: color, transform: [{ rotate: '8deg' }] }]} />
        </View>
      </View>
    </View>
  );
}

/** Bar chart + sparkle — "generating AI feedback" */
function AnalysisIcon({ color }) {
  const bars = [0.45, 0.72, 0.55, 0.88, 0.62];
  return (
    <View style={[ic.wrap, { alignItems: 'center', justifyContent: 'center' }]}>
      {/* Bar chart */}
      <View style={ic.chartRow}>
        {bars.map((h, i) => (
          <View key={i} style={[ic.bar, {
            backgroundColor: i === 3 ? colors.tealLight : color,
            height: 40 * h,
            opacity: i === 3 ? 1 : 0.75,
          }]} />
        ))}
      </View>
      {/* Baseline */}
      <View style={[ic.baseline, { backgroundColor: color }]} />
      {/* Sparkle above tallest bar */}
      <View style={ic.sparkleWrap}>
        <View style={[ic.sparkleLine, { backgroundColor: color, transform: [{ rotate: '0deg'  }] }]} />
        <View style={[ic.sparkleLine, { backgroundColor: color, transform: [{ rotate: '90deg' }] }]} />
        <View style={[ic.sparkleLine, { backgroundColor: color, transform: [{ rotate: '45deg' }] }]} />
        <View style={[ic.sparkleLine, { backgroundColor: color, transform: [{ rotate: '135deg'}] }]} />
      </View>
    </View>
  );
}

const STEPS = [
  { Icon: CameraIcon,   label: 'Uploading your swing…' },
  { Icon: BodyIcon,     label: 'Mapping body positions…' },
  { Icon: GolfIcon,     label: 'Comparing to pro swing…' },
  { Icon: AnalysisIcon, label: 'Generating AI feedback…' },
];

// ── Spinning arc ring ─────────────────────────────────────────────────────────
function SpinRing({ spin }) {
  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  return (
    <Animated.View style={[s.ring, { transform: [{ rotate }] }]}>
      <View style={s.ringArc} />
    </Animated.View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function ProcessingScreen() {
  const pulse = useRef(new Animated.Value(0)).current;
  const spin  = useRef(new Animated.Value(0)).current;
  const [step, setStep] = React.useState(0);

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    ).start();

    Animated.loop(
      Animated.timing(spin, { toValue: 1, duration: 1400, easing: Easing.linear, useNativeDriver: true })
    ).start();

    const interval = setInterval(() => {
      setStep((s) => (s < STEPS.length - 1 ? s + 1 : s));
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1.10] });
  const { Icon } = STEPS[step];

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.inner}>

        <View style={s.iconWrap}>
          <SpinRing spin={spin} />
          <Animated.View style={{ transform: [{ scale }] }}>
            <Icon color={colors.tealLight} />
          </Animated.View>
        </View>

        <Text style={s.title}>Analyzing…</Text>
        <Text style={s.stepLabel}>{STEPS[step].label}</Text>

        <View style={s.dots}>
          {STEPS.map((_, i) => (
            <View key={i} style={[s.dot, i <= step && s.dotActive]} />
          ))}
        </View>

        <Text style={s.note}>
          This usually takes 15–30 seconds. Please keep the app open.
        </Text>
      </View>
    </SafeAreaView>
  );
}

// ── Icon sub-styles ───────────────────────────────────────────────────────────
const ic = StyleSheet.create({
  wrap: { width: 66, height: 66 },

  // Camera
  camBody:      { width: 50, height: 34, borderRadius: 6, alignItems: 'center', justifyContent: 'center', position: 'absolute', top: 16, left: 8 },
  camLens:      { width: 22, height: 22, borderRadius: 11, borderWidth: 3, alignItems: 'center', justifyContent: 'center' },
  camLensInner: { width: 8, height: 8, borderRadius: 4 },
  camBump:      { width: 14, height: 9, borderRadius: 3, position: 'absolute', top: 10, left: 25 },
  camDot:       { width: 6, height: 6, borderRadius: 3, position: 'absolute', top: 14, right: 10 },

  // Golf
  shaftWrap:  { position: 'absolute', top: 2, left: 28, alignItems: 'center' },
  shaft:      { width: 5, height: 46, borderRadius: 3 },
  clubHead:   { width: 18, height: 8, borderRadius: 3, marginTop: -2 },
  ball:       { width: 22, height: 22, borderRadius: 11, borderWidth: 3,
                position: 'absolute', bottom: 4, left: 4, alignItems: 'center', justifyContent: 'center' },
  dimple1:    { width: 14, height: 2, borderRadius: 1 },
  dimple2:    { width: 8, height: 2, borderRadius: 1, marginTop: 4 },

  // Body
  head:    { width: 16, height: 16, borderRadius: 8, marginBottom: 3 },
  torso:   { width: 5, height: 18, borderRadius: 3 },
  armRow:  { flexDirection: 'row', marginTop: -8, alignItems: 'center' },
  armL:    { width: 4, height: 20, borderRadius: 2, transform: [{ rotate: '-50deg' }] },
  armR:    { width: 4, height: 20, borderRadius: 2, transform: [{ rotate: '50deg' }] },
  legRow:  { flexDirection: 'row', marginTop: 3 },
  leg:     { width: 4, height: 24, borderRadius: 2 },

  // Analysis chart
  chartRow:    { flexDirection: 'row', alignItems: 'flex-end', gap: 5, height: 42 },
  bar:         { width: 8, borderRadius: 2 },
  baseline:    { width: 58, height: 2, borderRadius: 1, marginTop: 2 },
  sparkleWrap: { position: 'absolute', top: 0, right: 2, width: 18, height: 18, alignItems: 'center', justifyContent: 'center' },
  sparkleLine: { width: 2, height: 14, borderRadius: 1, position: 'absolute' },
});

const s = StyleSheet.create({
  safe:  { flex: 1, backgroundColor: colors.bg },
  inner: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },

  iconWrap: { width: 126, height: 126, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.xl },
  ring:     { position: 'absolute', width: 114, height: 114, borderRadius: 57 },
  ringArc:  { width: 114, height: 114, borderRadius: 57,
              borderWidth: 4, borderColor: 'transparent',
              borderTopColor: colors.tealLight,
              borderRightColor: colors.teal + '55' },

  title:     { fontSize: 26, fontWeight: '800', color: colors.white, marginBottom: spacing.sm },
  stepLabel: { fontSize: 15, color: colors.tealLight, marginBottom: spacing.xl },
  dots:      { flexDirection: 'row', gap: 8, marginBottom: spacing.xl },
  dot:       { width: 8,  height: 8, borderRadius: 4, backgroundColor: colors.grey3 },
  dotActive: { width: 22, height: 8, borderRadius: 4, backgroundColor: colors.tealLight },
  note:      { fontSize: 12, color: colors.grey2, textAlign: 'center', lineHeight: 18 },
});
