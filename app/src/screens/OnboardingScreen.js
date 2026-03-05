import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Dimensions, StatusBar, SafeAreaView,
} from 'react-native';
import { colors, spacing, radius } from '../theme';

const { width } = Dimensions.get('window');

const SLIDES = [
  {
    emoji: '🎥',
    title: 'Record Your Swing',
    body:  'Film yourself from the side or behind. Any phone camera works — no special equipment needed.',
  },
  {
    emoji: '🤖',
    title: 'AI Breaks It Down',
    body:  'Our engine maps 33 points on your body and compares your positions to a pro swing frame by frame.',
  },
  {
    emoji: '🏌️',
    title: 'Get Specific Fixes',
    body:  "Not just 'keep your head down.' Real, actionable feedback on exactly what to change and how to practice it.",
  },
];

export default function OnboardingScreen({ navigation }) {
  const [index, setIndex] = useState(0);
  const slide = SLIDES[index];
  const last  = index === SLIDES.length - 1;

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="light-content" />

      {/* Skip */}
      {!last && (
        <TouchableOpacity style={s.skip} onPress={() => navigation.replace('Login')}>
          <Text style={s.skipText}>Skip</Text>
        </TouchableOpacity>
      )}

      {/* Slide content */}
      <View style={s.content}>
        <Text style={s.emoji}>{slide.emoji}</Text>
        <Text style={s.title}>{slide.title}</Text>
        <Text style={s.body}>{slide.body}</Text>
      </View>

      {/* Dots */}
      <View style={s.dots}>
        {SLIDES.map((_, i) => (
          <View key={i} style={[s.dot, i === index && s.dotActive]} />
        ))}
      </View>

      {/* CTA */}
      <View style={s.footer}>
        {last ? (
          <>
            <TouchableOpacity style={s.btnPrimary} onPress={() => navigation.replace('Register')}>
              <Text style={s.btnPrimaryText}>Get Started — Free</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.btnGhost} onPress={() => navigation.replace('Login')}>
              <Text style={s.btnGhostText}>I already have an account</Text>
            </TouchableOpacity>
          </>
        ) : (
          <TouchableOpacity style={s.btnPrimary} onPress={() => setIndex(index + 1)}>
            <Text style={s.btnPrimaryText}>Next</Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:      { flex: 1, backgroundColor: colors.bg },
  skip:      { alignSelf: 'flex-end', padding: spacing.lg },
  skipText:  { color: colors.grey2, fontSize: 14 },
  content:   { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl },
  emoji:     { fontSize: 72, marginBottom: spacing.xl },
  title:     { fontSize: 32, fontWeight: '800', color: colors.white, textAlign: 'center', marginBottom: spacing.md },
  body:      { fontSize: 16, color: colors.grey1, textAlign: 'center', lineHeight: 24 },
  dots:      { flexDirection: 'row', gap: 8, justifyContent: 'center', marginBottom: spacing.xl },
  dot:       { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.grey3 },
  dotActive: { backgroundColor: colors.tealLight, width: 24 },
  footer:    { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl, gap: spacing.md },
  btnPrimary: {
    backgroundColor: colors.teal,
    borderRadius: radius.md,
    paddingVertical: 16,
    alignItems: 'center',
  },
  btnPrimaryText: { color: colors.white, fontSize: 16, fontWeight: '700' },
  btnGhost:       { alignItems: 'center', paddingVertical: spacing.sm },
  btnGhostText:   { color: colors.grey2, fontSize: 14 },
});
