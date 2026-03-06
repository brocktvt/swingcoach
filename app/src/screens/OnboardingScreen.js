import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Dimensions, StatusBar, Animated, Easing,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, radius } from '../theme';

const { width, height } = Dimensions.get('window');

// ── Slide content ─────────────────────────────────────────────────────────────
const SLIDES = [
  {
    eyebrow:  'STEP 1',
    headline: 'Swing.\nAnalyzed.',
    body:     'Film yourself from the side. Any phone camera works — no gear required.',
    accent:   colors.tealLight,
  },
  {
    eyebrow:  'STEP 2',
    headline: 'Compare to\nthe pros.',
    body:     'AI maps 33 points on your body and lines them up against Rory, Tiger, and more.',
    accent:   colors.gold,
  },
  {
    eyebrow:  'STEP 3',
    headline: 'Fix the\nright things.',
    body:     "Not 'keep your head down.' Specific drills for exactly what your swing needs.",
    accent:   colors.tealLight,
  },
];

// ── Animated swing arc background ─────────────────────────────────────────────
function SwingArc({ accent }) {
  const swingAnim  = useRef(new Animated.Value(0)).current;
  const pulseAnim  = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Pendulum swing
    Animated.loop(
      Animated.sequence([
        Animated.timing(swingAnim, {
          toValue: 1,
          duration: 1600,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(swingAnim, {
          toValue: 0,
          duration: 1600,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Subtle pulse on the glow ring
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.08,
          duration: 1600,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1600,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  const rotate = swingAnim.interpolate({
    inputRange:  [0, 1],
    outputRange: ['-38deg', '38deg'],
  });

  return (
    <View style={s.arcWrapper} pointerEvents="none">
      {/* Outer glow ring */}
      <Animated.View style={[
        s.glowRing,
        { borderColor: accent, transform: [{ scale: pulseAnim }] },
      ]} />

      {/* Static inner ring */}
      <View style={[s.innerRing, { borderColor: accent }]} />

      {/* Swinging club shaft */}
      <Animated.View style={[s.shaftPivot, { transform: [{ rotate }] }]}>
        <View style={[s.shaft, { backgroundColor: accent }]} />
        {/* Club head dot */}
        <View style={[s.clubHead, { backgroundColor: accent }]} />
      </Animated.View>

      {/* Ball dot at centre */}
      <View style={[s.ball, { backgroundColor: accent }]} />
    </View>
  );
}

// ── Slide fade wrapper ────────────────────────────────────────────────────────
function SlideContent({ slide, visible }) {
  const fadeAnim = useRef(new Animated.Value(visible ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue:         visible ? 1 : 0,
      duration:        300,
      useNativeDriver: true,
    }).start();
  }, [visible]);

  return (
    <Animated.View style={[s.slideContent, { opacity: fadeAnim }]}>
      <Text style={[s.eyebrow, { color: slide.accent }]}>{slide.eyebrow}</Text>
      <Text style={s.headline}>{slide.headline}</Text>
      <View style={[s.accentBar, { backgroundColor: slide.accent }]} />
      <Text style={s.body}>{slide.body}</Text>
    </Animated.View>
  );
}

// ── Main screen ──────────────────────────────────────────────────────────────
export default function OnboardingScreen({ navigation }) {
  const [index, setIndex] = useState(0);
  const slide  = SLIDES[index];
  const isLast = index === SLIDES.length - 1;

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" />

      {/* Animated background art */}
      <SwingArc accent={slide.accent} />

      <SafeAreaView style={s.safe} edges={['top', 'bottom']}>

        {/* Brand + skip */}
        <View style={s.brandRow}>
          <Text style={s.brandMark}>⛳ SWINGCOACH</Text>
          {!isLast && (
            <TouchableOpacity onPress={() => navigation.replace('Login')}>
              <Text style={s.skip}>Skip</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Slide content */}
        <View style={s.heroArea}>
          {SLIDES.map((sl, i) => (
            <SlideContent key={i} slide={sl} visible={i === index} />
          ))}
        </View>

        {/* Progress dots */}
        <View style={s.dotsRow}>
          {SLIDES.map((_, i) => (
            <TouchableOpacity key={i} onPress={() => setIndex(i)}>
              <View style={[
                s.dot,
                i === index && { width: 28, backgroundColor: slide.accent },
                i <  index  && { backgroundColor: 'rgba(255,255,255,0.3)' },
              ]} />
            </TouchableOpacity>
          ))}
        </View>

        {/* CTA */}
        <View style={s.footer}>
          {isLast ? (
            <>
              <TouchableOpacity
                style={[s.btnPrimary, { backgroundColor: slide.accent }]}
                onPress={() => navigation.replace('Register')}
                activeOpacity={0.85}
              >
                <Text style={s.btnPrimaryText}>Get Started — It's Free</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={s.btnGhost}
                onPress={() => navigation.replace('Login')}
              >
                <Text style={s.btnGhostText}>Already have an account</Text>
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity
              style={[s.btnPrimary, { backgroundColor: slide.accent }]}
              onPress={() => setIndex(index + 1)}
              activeOpacity={0.85}
            >
              <Text style={s.btnPrimaryText}>Next  →</Text>
            </TouchableOpacity>
          )}
        </View>

      </SafeAreaView>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const ARC_SIZE   = width * 0.82;
const SHAFT_LEN  = ARC_SIZE * 0.46;

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },

  // ── Arc background ──
  arcWrapper: {
    position: 'absolute',
    top:   height * 0.08,
    alignSelf: 'center',
    width:  ARC_SIZE,
    height: ARC_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glowRing: {
    position: 'absolute',
    width:  ARC_SIZE,
    height: ARC_SIZE,
    borderRadius: ARC_SIZE / 2,
    borderWidth: 1.5,
    opacity: 0.18,
  },
  innerRing: {
    position: 'absolute',
    width:  ARC_SIZE * 0.65,
    height: ARC_SIZE * 0.65,
    borderRadius: ARC_SIZE,
    borderWidth: 1,
    opacity: 0.12,
  },
  shaftPivot: {
    position: 'absolute',
    width:  2,
    height: SHAFT_LEN,
    alignItems: 'center',
    // Pivot from the top centre (the grip end)
    top: ARC_SIZE / 2 - SHAFT_LEN,
    transformOrigin: 'bottom',
  },
  shaft: {
    width:  3,
    height: SHAFT_LEN,
    borderRadius: 2,
    opacity: 0.85,
  },
  clubHead: {
    width:  14,
    height: 14,
    borderRadius: 7,
    marginTop: -7,
    opacity: 0.9,
  },
  ball: {
    width:  10,
    height: 10,
    borderRadius: 5,
    opacity: 0.7,
  },

  // ── Layout ──
  safe: {
    flex: 1,
    justifyContent: 'space-between',
  },
  brandRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  brandMark: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.white,
    letterSpacing: 2,
    opacity: 0.9,
  },
  skip: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.45)',
  },

  // ── Slide ──
  heroArea: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    marginTop: height * 0.38,  // pushes text below the arc art
  },
  slideContent: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 3,
    marginBottom: spacing.md,
  },
  headline: {
    fontSize: 50,
    fontWeight: '900',
    color: colors.white,
    lineHeight: 54,
    letterSpacing: -1,
  },
  accentBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  body: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.70)',
    lineHeight: 24,
    maxWidth: 300,
  },

  // ── Dots ──
  dotsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },

  // ── Footer ──
  footer: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    gap: spacing.sm,
  },
  btnPrimary: {
    borderRadius: radius.md,
    paddingVertical: 17,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  btnPrimaryText: {
    color: colors.bg,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  btnGhost: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  btnGhostText: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 14,
  },
});
