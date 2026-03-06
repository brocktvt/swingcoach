import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Dimensions, StatusBar, Animated, Easing,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, radius } from '../theme';

const { width, height } = Dimensions.get('window');

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
    body:     "Specific drills for exactly what your swing needs — not generic tips.",
    accent:   colors.tealLight,
  },
];

// ── Golfer swing animation ────────────────────────────────────────────────────
function GolferAnimation({ accent }) {
  const swingAnim = useRef(new Animated.Value(0)).current;
  const ballX     = useRef(new Animated.Value(0)).current;
  const ballY     = useRef(new Animated.Value(0)).current;
  const ballOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const runSwing = () => {
      // Reset ball
      ballX.setValue(0);
      ballY.setValue(0);
      ballOpacity.setValue(1);

      Animated.sequence([
        // Address → top of backswing
        Animated.timing(swingAnim, {
          toValue: 1,
          duration: 600,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        // Brief pause at top
        Animated.delay(150),
        // Downswing through impact
        Animated.timing(swingAnim, {
          toValue: 2,
          duration: 300,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        // Follow through
        Animated.timing(swingAnim, {
          toValue: 3,
          duration: 400,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        // Hold follow through
        Animated.delay(600),
        // Reset to address
        Animated.timing(swingAnim, {
          toValue: 0,
          duration: 500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        // Pause at address
        Animated.delay(800),
      ]).start(() => runSwing());

      // Ball launches at impact timing (~1250ms in)
      setTimeout(() => {
        Animated.parallel([
          Animated.timing(ballX, {
            toValue: 90,
            duration: 700,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.sequence([
            Animated.timing(ballY, {
              toValue: -55,
              duration: 350,
              easing: Easing.out(Easing.quad),
              useNativeDriver: true,
            }),
            Animated.timing(ballY, {
              toValue: 0,
              duration: 350,
              easing: Easing.in(Easing.quad),
              useNativeDriver: true,
            }),
          ]),
          Animated.sequence([
            Animated.delay(600),
            Animated.timing(ballOpacity, {
              toValue: 0,
              duration: 200,
              useNativeDriver: true,
            }),
          ]),
        ]).start();
      }, 1150);
    };

    runSwing();
    return () => {
      swingAnim.stopAnimation();
      ballX.stopAnimation();
      ballY.stopAnimation();
    };
  }, []);

  // Club rotation: address (-35°) → backswing (85°) → impact (-45°) → follow-through (130°)
  const clubRotate = swingAnim.interpolate({
    inputRange:  [0, 1, 2, 3],
    outputRange: ['-35deg', '85deg', '-45deg', '130deg'],
  });

  // Left arm follows club
  const armRotate = swingAnim.interpolate({
    inputRange:  [0, 1, 2, 3],
    outputRange: ['-20deg', '50deg', '-25deg', '80deg'],
  });

  // Slight hip turn
  const hipRotate = swingAnim.interpolate({
    inputRange:  [0, 1, 2, 3],
    outputRange: ['0deg', '-8deg', '5deg', '12deg'],
  });

  return (
    <View style={s.golferScene} pointerEvents="none">

      {/* Floor line */}
      <View style={[s.floorLine, { backgroundColor: accent, opacity: 0.2 }]} />

      {/* ── Golfer body ── */}
      <View style={s.golferBody}>

        {/* Head */}
        <View style={[s.head, { borderColor: accent }]} />

        {/* Torso + hips (slight rotation) */}
        <Animated.View style={[s.torso, { transform: [{ rotate: hipRotate }] }]}>
          <View style={[s.torsoBar, { backgroundColor: accent }]} />

          {/* Arm + club (rotates from shoulder) */}
          <Animated.View style={[s.armPivot, { transform: [{ rotate: clubRotate }] }]}>
            {/* Arm */}
            <View style={[s.arm, { backgroundColor: accent }]} />
            {/* Club shaft */}
            <View style={[s.clubShaft, { backgroundColor: accent }]} />
            {/* Club head */}
            <View style={[s.clubHead, { backgroundColor: accent }]} />
          </Animated.View>
        </Animated.View>

        {/* Legs */}
        <View style={s.legsRow}>
          <View style={[s.leg, { backgroundColor: accent, transform: [{ rotate: '8deg' }] }]} />
          <View style={[s.leg, { backgroundColor: accent, transform: [{ rotate: '-8deg' }] }]} />
        </View>
      </View>

      {/* Ball */}
      <Animated.View style={[
        s.ball,
        { backgroundColor: accent },
        { transform: [{ translateX: ballX }, { translateY: ballY }] },
        { opacity: ballOpacity },
      ]} />

      {/* Ball shadow on floor */}
      <View style={[s.ballShadow, { backgroundColor: accent }]} />

      {/* Simulator screen frame (background) */}
      <View style={[s.simFrame, { borderColor: accent }]} />
      <View style={[s.simInner, { borderColor: accent }]} />
    </View>
  );
}

// ── Main screen ──────────────────────────────────────────────────────────────
export default function OnboardingScreen({ navigation }) {
  const [index, setIndex] = useState(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slide  = SLIDES[index];
  const isLast = index === SLIDES.length - 1;

  const goToSlide = (i) => {
    Animated.timing(fadeAnim, {
      toValue: 0, duration: 150, useNativeDriver: true,
    }).start(() => {
      setIndex(i);
      Animated.timing(fadeAnim, {
        toValue: 1, duration: 200, useNativeDriver: true,
      }).start();
    });
  };

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" />
      <GolferAnimation accent={slide.accent} />

      <SafeAreaView style={s.safe} edges={['top', 'bottom']}>

        {/* Brand + skip */}
        <View style={s.brandRow}>
          <Text style={s.brandMark}>⛳ POCKET GOLF COACH</Text>
          {!isLast && (
            <TouchableOpacity onPress={() => navigation.replace('Login')}>
              <Text style={s.skip}>Skip</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Slide text — fades between slides, no absolute positioning */}
        <Animated.View style={[s.heroArea, { opacity: fadeAnim }]}>
          <Text style={[s.eyebrow, { color: slide.accent }]}>{slide.eyebrow}</Text>
          <Text style={s.headline}>{slide.headline}</Text>
          <View style={[s.accentBar, { backgroundColor: slide.accent }]} />
          <Text style={s.body}>{slide.body}</Text>
        </Animated.View>

        {/* Dots */}
        <View style={s.dotsRow}>
          {SLIDES.map((_, i) => (
            <TouchableOpacity key={i} onPress={() => goToSlide(i)}>
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
              onPress={() => goToSlide(index + 1)}
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
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },

  // ── Golfer scene ──
  golferScene: {
    position: 'absolute',
    top: height * 0.07,
    alignSelf: 'center',
    width: width * 0.7,
    height: height * 0.38,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  floorLine: {
    position: 'absolute',
    bottom: 18,
    left: 0,
    right: 0,
    height: 1,
  },
  simFrame: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    borderWidth: 1,
    borderRadius: 12,
    opacity: 0.08,
  },
  simInner: {
    position: 'absolute',
    top: 6, left: 6, right: 6, bottom: 6,
    borderWidth: 1,
    borderRadius: 8,
    opacity: 0.05,
  },

  // ── Golfer parts ──
  golferBody: {
    alignItems: 'center',
    marginBottom: 20,
  },
  head: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    marginBottom: 4,
  },
  torso: {
    alignItems: 'center',
  },
  torsoBar: {
    width: 3,
    height: 38,
    borderRadius: 2,
    opacity: 0.9,
  },
  armPivot: {
    position: 'absolute',
    top: 8,
    alignItems: 'center',
  },
  arm: {
    width: 2.5,
    height: 26,
    borderRadius: 2,
    opacity: 0.85,
  },
  clubShaft: {
    width: 2,
    height: 44,
    borderRadius: 1,
    opacity: 0.75,
    marginTop: -2,
  },
  clubHead: {
    width: 10,
    height: 7,
    borderRadius: 2,
    opacity: 0.9,
    marginTop: -2,
  },
  legsRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 2,
  },
  leg: {
    width: 3,
    height: 30,
    borderRadius: 2,
    opacity: 0.8,
  },

  // ── Ball ──
  ball: {
    position: 'absolute',
    bottom: 22,
    left: '52%',
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  ballShadow: {
    position: 'absolute',
    bottom: 19,
    left: '52%',
    width: 8,
    height: 3,
    borderRadius: 2,
    opacity: 0.2,
  },

  // ── Layout ──
  safe: { flex: 1, justifyContent: 'space-between' },
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
  skip: { fontSize: 14, color: 'rgba(255,255,255,0.45)' },

  // ── Slide text — fixed height so nothing overlaps ──
  heroArea: {
    paddingHorizontal: spacing.lg,
    minHeight: 180,
    justifyContent: 'flex-start',
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 3,
    marginBottom: spacing.md,
  },
  headline: {
    fontSize: 46,
    fontWeight: '900',
    color: colors.white,
    lineHeight: 50,
    letterSpacing: -1,
  },
  accentBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  body: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.70)',
    lineHeight: 22,
    maxWidth: 300,
  },

  // ── Dots ──
  dotsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  dot: {
    width: 8, height: 8, borderRadius: 4,
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
  btnGhost: { alignItems: 'center', paddingVertical: spacing.sm },
  btnGhostText: { color: 'rgba(255,255,255,0.45)', fontSize: 14 },
});
