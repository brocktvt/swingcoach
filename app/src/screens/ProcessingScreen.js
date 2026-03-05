import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, SafeAreaView, Animated, Easing } from 'react-native';
import { colors, spacing } from '../theme';

const STEPS = [
  { emoji: '📤', label: 'Uploading video…' },
  { emoji: '🦴', label: 'Mapping body positions…' },
  { emoji: '🔍', label: 'Comparing to pro swing…' },
  { emoji: '🤖', label: 'Generating feedback…' },
];

export default function ProcessingScreen() {
  const pulse = useRef(new Animated.Value(0)).current;
  const [step, setStep] = React.useState(0);

  useEffect(() => {
    // Pulse animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    ).start();

    // Step through messages
    const interval = setInterval(() => {
      setStep((s) => (s < STEPS.length - 1 ? s + 1 : s));
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] });

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.inner}>
        <Animated.Text style={[s.emoji, { transform: [{ scale }] }]}>
          {STEPS[step].emoji}
        </Animated.Text>
        <Text style={s.title}>Analyzing…</Text>
        <Text style={s.stepLabel}>{STEPS[step].label}</Text>

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

const s = StyleSheet.create({
  safe:      { flex: 1, backgroundColor: colors.bg },
  inner:     { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
  emoji:     { fontSize: 72, marginBottom: spacing.xl },
  title:     { fontSize: 26, fontWeight: '800', color: colors.white, marginBottom: spacing.sm },
  stepLabel: { fontSize: 15, color: colors.tealLight, marginBottom: spacing.xl },
  dots:      { flexDirection: 'row', gap: 8, marginBottom: spacing.xl },
  dot:       { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.grey3 },
  dotActive: { backgroundColor: colors.tealLight },
  note:      { fontSize: 12, color: colors.grey2, textAlign: 'center', lineHeight: 18 },
});
