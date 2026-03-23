import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, SafeAreaView, Animated, Easing } from 'react-native';
import { colors, spacing } from '../theme';

// ── Step icons: pure React Native shapes, no emoji ───────────────────────────
function UploadIcon({ color }) {
  return (
    <View style={[ic.wrap]}>
      {/* Arrow shaft */}
      <View style={[ic.shaft, { backgroundColor: color }]} />
      {/* Arrow head (chevron) */}
      <View style={ic.headWrap}>
        <View style={[ic.headLeft,  { borderRightColor: color }]} />
        <View style={[ic.headRight, { borderLeftColor:  color }]} />
      </View>
      {/* Base bar */}
      <View style={[ic.base, { backgroundColor: color }]} />
    </View>
  );
}

function BodyIcon({ color }) {
  // Stick-person silhouette
  return (
    <View style={ic.wrap}>
      {/* Head */}
      <View style={[ic.head, { backgroundColor: color }]} />
      {/* Torso */}
      <View style={[ic.torso, { backgroundColor: color }]} />
      {/* Arms */}
      <View style={ic.armRow}>
        <View style={[ic.arm, { backgroundColor: color, transform: [{ rotate: '-35deg' }] }]} />
        <View style={[ic.armGap]} />
        <View style={[ic.arm, { backgroundColor: color, transform: [{ rotate: '35deg'  }] }]} />
      </View>
      {/* Legs */}
      <View style={ic.legRow}>
        <View style={[ic.leg, { backgroundColor: color, transform: [{ rotate: '-12deg' }] }]} />
        <View style={[ic.legGap]} />
        <View style={[ic.leg, { backgroundColor: color, transform: [{ rotate: '12deg'  }] }]} />
      </View>
    </View>
  );
}

function SearchIcon({ color }) {
  return (
    <View style={ic.wrap}>
      {/* Lens ring */}
      <View style={[ic.lens, { borderColor: color }]} />
      {/* Handle */}
      <View style={[ic.handle, { backgroundColor: color }]} />
    </View>
  );
}

function BrainIcon({ color }) {
  // Abstract "AI" — diamond / spark shape
  return (
    <View style={ic.wrap}>
      {/* Central diamond */}
      <View style={[ic.diamond, { backgroundColor: color }]} />
      {/* Rays */}
      {[0, 45, 90, 135].map((deg) => (
        <View key={deg}
          style={[ic.ray, { backgroundColor: color,
            transform: [{ rotate: `${deg}deg` }] }]} />
      ))}
    </View>
  );
}

const STEPS = [
  { Icon: UploadIcon, label: 'Uploading video…' },
  { Icon: BodyIcon,   label: 'Mapping body positions…' },
  { Icon: SearchIcon, label: 'Comparing to pro swing…' },
  { Icon: BrainIcon,  label: 'Generating AI feedback…' },
];

// ── Spinning ring ─────────────────────────────────────────────────────────────
function SpinRing({ spin }) {
  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  return (
    <Animated.View style={[s.ring, { transform: [{ rotate }] }]}>
      <View style={s.ringArc} />
    </Animated.View>
  );
}

export default function ProcessingScreen() {
  const pulse = useRef(new Animated.Value(0)).current;
  const spin  = useRef(new Animated.Value(0)).current;
  const [step, setStep] = React.useState(0);

  useEffect(() => {
    // Pulse animation on icon
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 750, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 750, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    ).start();

    // Spin animation on ring
    Animated.loop(
      Animated.timing(spin, { toValue: 1, duration: 1400, easing: Easing.linear, useNativeDriver: true })
    ).start();

    // Cycle steps
    const interval = setInterval(() => {
      setStep((s) => (s < STEPS.length - 1 ? s + 1 : s));
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1.08] });
  const { Icon } = STEPS[step];
  const iconColor = colors.tealLight;

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.inner}>

        {/* Icon + spinning ring */}
        <View style={s.iconWrap}>
          <SpinRing spin={spin} />
          <Animated.View style={{ transform: [{ scale }] }}>
            <Icon color={iconColor} />
          </Animated.View>
        </View>

        <Text style={s.title}>Analyzing…</Text>
        <Text style={s.stepLabel}>{STEPS[step].label}</Text>

        {/* Progress dots */}
        <View style={s.dots}>
          {STEPS.map((_, i) => (
            <View key={i} style={[s.dot, i <= step && s.dotActive]} />
          ))}
        </View>

        <Text style={s.note}>
          This usually takes 15–30 seconds depending on video length. Please keep the app open.
        </Text>
      </View>
    </SafeAreaView>
  );
}

// ── Icon sub-styles ───────────────────────────────────────────────────────────
const ic = StyleSheet.create({
  wrap:      { width: 68, height: 68, alignItems: 'center', justifyContent: 'center' },

  // Upload icon
  shaft:     { width: 6, height: 26, borderRadius: 3, marginBottom: 0 },
  headWrap:  { flexDirection: 'row', marginBottom: 2 },
  headLeft:  { width: 0, height: 0, borderRightWidth: 12, borderTopWidth: 14,
               borderRightColor: 'transparent', borderTopColor: 'transparent',
               borderStyle: 'solid' },
  headRight: { width: 0, height: 0, borderLeftWidth: 12, borderTopWidth: 14,
               borderLeftColor: 'transparent', borderTopColor: 'transparent',
               borderStyle: 'solid' },
  base:      { width: 36, height: 6, borderRadius: 3, marginTop: 4 },

  // Body icon
  head:      { width: 18, height: 18, borderRadius: 9, marginBottom: 4 },
  torso:     { width: 6, height: 20, borderRadius: 3 },
  armRow:    { flexDirection: 'row', marginTop: -6 },
  arm:       { width: 5, height: 22, borderRadius: 3 },
  armGap:    { width: 6 },
  legRow:    { flexDirection: 'row', marginTop: 2 },
  leg:       { width: 5, height: 26, borderRadius: 3 },
  legGap:    { width: 8 },

  // Search icon
  lens:      { width: 36, height: 36, borderRadius: 18, borderWidth: 5,
               position: 'absolute', top: 6, left: 8 },
  handle:    { width: 5, height: 20, borderRadius: 3,
               position: 'absolute', bottom: 4, right: 10,
               transform: [{ rotate: '45deg' }] },

  // Brain/spark icon
  diamond:   { width: 22, height: 22, backgroundColor: colors.tealLight,
               transform: [{ rotate: '45deg' }] },
  ray:       { width: 4, height: 44, borderRadius: 2,
               position: 'absolute', top: 12 },
});

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: colors.bg },
  inner:  { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },

  // Icon + ring wrapper
  iconWrap: { width: 120, height: 120, alignItems: 'center', justifyContent: 'center',
              marginBottom: spacing.xl },
  ring:     { position: 'absolute', width: 110, height: 110, borderRadius: 55 },
  ringArc:  { width: 110, height: 110, borderRadius: 55,
              borderWidth: 4, borderColor: 'transparent',
              borderTopColor: colors.tealLight, borderRightColor: colors.teal + '66' },

  title:     { fontSize: 26, fontWeight: '800', color: colors.white, marginBottom: spacing.sm },
  stepLabel: { fontSize: 15, color: colors.tealLight, marginBottom: spacing.xl },
  dots:      { flexDirection: 'row', gap: 8, marginBottom: spacing.xl },
  dot:       { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.grey3 },
  dotActive: { backgroundColor: colors.tealLight, width: 20 },
  note:      { fontSize: 12, color: colors.grey2, textAlign: 'center', lineHeight: 18 },
});
