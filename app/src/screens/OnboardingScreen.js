/**
 * OnboardingScreen.js
 *
 * Full-screen video background with a dark overlay.
 * Nike / Peloton-style: big bold headline, minimal copy, one action per screen.
 *
 * ─── VIDEO SETUP ────────────────────────────────────────────────────────────
 * Download any free golf swing clip (royalty-free) and save it to:
 *   app/assets/bg-swing.mp4
 *
 * Good free sources (no attribution required):
 *   https://www.pexels.com/search/videos/golf%20swing/
 *   https://pixabay.com/videos/search/golf%20course/
 *
 * If the file is missing the screen falls back to a clean dark gradient.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Dimensions, StatusBar, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { VideoView, useVideoPlayer } from 'expo-video';
import { colors, spacing, radius } from '../theme';

const { width, height } = Dimensions.get('window');

// ── Slide content ─────────────────────────────────────────────────────────────
const SLIDES = [
  {
    eyebrow: 'STEP 1',
    headline: 'Swing.\nAnalyzed.',
    body: 'Film yourself from the side. Any phone camera works — no gear required.',
    accent: colors.tealLight,
  },
  {
    eyebrow: 'STEP 2',
    headline: 'Compare to\nthe pros.',
    body: 'AI maps 33 points on your body and lines them up against Rory, Tiger, and more.',
    accent: colors.gold,
  },
  {
    eyebrow: 'STEP 3',
    headline: 'Fix the\nright things.',
    body: "Not 'keep your head down.' Specific drills for exactly what your swing needs.",
    accent: colors.tealLight,
  },
];

// ─────────────────────────────────────────────────────────────────────────────

let bgVideo;
try {
  // If the file exists this works at bundle time.
  bgVideo = require('../../assets/bg-swing.mp4');
} catch {
  bgVideo = null;
}

// ── Video background component ───────────────────────────────────────────────
function VideoBackground() {
  const player = useVideoPlayer(bgVideo, (p) => {
    p.loop   = true;
    p.muted  = true;
    p.play();
  });

  if (!bgVideo) return null;

  return (
    <VideoView
      player={player}
      style={StyleSheet.absoluteFill}
      contentFit="cover"
      nativeControls={false}
      allowsFullscreen={false}
    />
  );
}

// ── Main screen ──────────────────────────────────────────────────────────────
export default function OnboardingScreen({ navigation }) {
  const [index, setIndex] = useState(0);
  const slide = SLIDES[index];
  const isLast = index === SLIDES.length - 1;

  const goNext = () => {
    if (isLast) {
      navigation.replace('Register');
    } else {
      setIndex(index + 1);
    }
  };

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* ── Background ── */}
      <VideoBackground />
      {/* Dark overlay — heavier at bottom for legibility */}
      <View style={s.overlayTop} />
      <View style={s.overlayBottom} />

      <SafeAreaView style={s.safe} edges={['top', 'bottom']}>

        {/* ── Brand mark ── */}
        <View style={s.brandRow}>
          <Text style={s.brandMark}>⛳ SWINGCOACH</Text>
          {!isLast && (
            <TouchableOpacity onPress={() => navigation.replace('Login')}>
              <Text style={s.skip}>Skip</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ── Slide content ── */}
        <View style={s.heroArea}>
          <Text style={[s.eyebrow, { color: slide.accent }]}>{slide.eyebrow}</Text>
          <Text style={s.headline}>{slide.headline}</Text>
          <View style={[s.accentBar, { backgroundColor: slide.accent }]} />
          <Text style={s.body}>{slide.body}</Text>
        </View>

        {/* ── Progress dots ── */}
        <View style={s.dotsRow}>
          {SLIDES.map((_, i) => (
            <TouchableOpacity key={i} onPress={() => setIndex(i)}>
              <View style={[
                s.dot,
                i === index && { width: 28, backgroundColor: slide.accent },
                i < index   && { backgroundColor: 'rgba(255,255,255,0.35)' },
              ]} />
            </TouchableOpacity>
          ))}
        </View>

        {/* ── CTA ── */}
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
              onPress={goNext}
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
const OVERLAY_COLOR_TOP    = 'rgba(8,14,24,0.40)';
const OVERLAY_COLOR_BOTTOM = 'rgba(8,14,24,0.80)';

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,  // shows if no video
  },

  // Two overlay layers — top is lighter so the video still reads
  overlayTop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: OVERLAY_COLOR_TOP,
  },
  overlayBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: height * 0.55,
    backgroundColor: OVERLAY_COLOR_BOTTOM,
  },

  safe: {
    flex: 1,
    justifyContent: 'space-between',
  },

  // ── Brand row ──
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
    color: 'rgba(255,255,255,0.55)',
  },

  // ── Hero ──
  heroArea: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 3,
    marginBottom: spacing.md,
  },
  headline: {
    fontSize: 52,
    fontWeight: '900',
    color: colors.white,
    lineHeight: 56,
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
    color: 'rgba(255,255,255,0.75)',
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
    color: colors.bg,       // dark text on bright button
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  btnGhost: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  btnGhostText: {
    color: 'rgba(255,255,255,0.50)',
    fontSize: 14,
  },
});
