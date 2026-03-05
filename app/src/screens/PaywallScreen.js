import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  SafeAreaView, ScrollView, ActivityIndicator, Alert,
} from 'react-native';
import { colors, spacing, radius, shadow } from '../theme';

const PLANS = [
  {
    id:       'monthly',
    label:    'Monthly',
    price:    '$7.99',
    period:   'per month',
    saving:   null,
    popular:  false,
  },
  {
    id:       'annual',
    label:    'Annual',
    price:    '$47.99',
    period:   'per year',
    saving:   'Save 50%',
    popular:  true,
    perMonth: '$4.00/mo',
  },
];

const FEATURES = [
  { emoji: '🎥', text: 'Unlimited swing analyses' },
  { emoji: '📊', text: 'Full angle & position breakdowns' },
  { emoji: '🏋️', text: 'Personalized drill library' },
  { emoji: '📈', text: 'Swing history & progress tracking' },
  { emoji: '🏌️', text: 'All pro comparisons unlocked' },
  { emoji: '⚡', text: 'Priority processing' },
];

export default function PaywallScreen({ navigation }) {
  const [selected, setSelected] = useState('annual');
  const [loading,  setLoading]  = useState(false);

  const handleSubscribe = async () => {
    setLoading(true);
    try {
      // TODO: wire up RevenueCat purchase flow
      // import Purchases from 'react-native-purchases';
      // const offerings = await Purchases.getOfferings();
      // const pkg = selected === 'annual' ? offerings.current.annual : offerings.current.monthly;
      // const { customerInfo } = await Purchases.purchasePackage(pkg);
      Alert.alert(
        'Coming soon',
        'Subscription payments are being set up. Check back soon!',
        [{ text: 'OK' }]
      );
    } catch (err) {
      if (!err.userCancelled) {
        Alert.alert('Purchase failed', err.message || 'Something went wrong. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const plan = PLANS.find((p) => p.id === selected);

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* Close button */}
        <TouchableOpacity style={s.close} onPress={() => navigation.goBack()}>
          <Text style={s.closeText}>✕</Text>
        </TouchableOpacity>

        {/* Header */}
        <Text style={s.emoji}>⛳</Text>
        <Text style={s.title}>Go Pro</Text>
        <Text style={s.sub}>
          Serious about improving? Get unlimited analyses, personalized drills, and full progress tracking.
        </Text>

        {/* Features */}
        <View style={s.features}>
          {FEATURES.map((f, i) => (
            <View key={i} style={s.featureRow}>
              <Text style={s.featureEmoji}>{f.emoji}</Text>
              <Text style={s.featureText}>{f.text}</Text>
            </View>
          ))}
        </View>

        {/* Plan selector */}
        <View style={s.plans}>
          {PLANS.map((p) => (
            <TouchableOpacity
              key={p.id}
              style={[s.planCard, selected === p.id && s.planCardSelected]}
              onPress={() => setSelected(p.id)}
            >
              {p.popular && (
                <View style={s.popularBadge}>
                  <Text style={s.popularText}>BEST VALUE</Text>
                </View>
              )}
              <Text style={s.planLabel}>{p.label}</Text>
              <Text style={[s.planPrice, selected === p.id && { color: colors.tealLight }]}>{p.price}</Text>
              <Text style={s.planPeriod}>{p.period}</Text>
              {p.perMonth && <Text style={s.planPerMonth}>{p.perMonth}</Text>}
              {p.saving && (
                <View style={s.savingBadge}>
                  <Text style={s.savingText}>{p.saving}</Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* Subscribe CTA */}
        <TouchableOpacity style={s.btnSubscribe} onPress={handleSubscribe} disabled={loading}>
          {loading
            ? <ActivityIndicator color={colors.white} />
            : <Text style={s.btnSubscribeText}>
                Subscribe — {plan?.price} {selected === 'annual' ? '/ year' : '/ month'}
              </Text>
          }
        </TouchableOpacity>

        <Text style={s.legal}>
          Cancel anytime. Billed through the App Store / Google Play. Renews automatically.
          Subscriptions managed in your device's account settings.
        </Text>

        <View style={s.freeTier}>
          <Text style={s.freeTierText}>Not ready? Free tier includes 5 analyses per month.</Text>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={s.freeTierLink}>Continue with Free →</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: spacing.lg, paddingBottom: 60 },
  close:  { alignSelf: 'flex-end', padding: spacing.sm },
  closeText: { color: colors.grey2, fontSize: 20 },
  emoji:  { fontSize: 56, textAlign: 'center', marginBottom: spacing.md },
  title:  { fontSize: 30, fontWeight: '800', color: colors.white, textAlign: 'center' },
  sub:    { fontSize: 14, color: colors.grey2, textAlign: 'center', lineHeight: 21, marginTop: spacing.sm, marginBottom: spacing.xl },
  features: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.grey3,
    padding: spacing.lg,
    marginBottom: spacing.xl,
    gap: 12,
  },
  featureRow:  { flexDirection: 'row', alignItems: 'center', gap: 12 },
  featureEmoji:{ fontSize: 20 },
  featureText: { fontSize: 14, color: colors.grey1, flex: 1 },
  plans:       { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.lg },
  planCard: {
    flex: 1,
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: colors.grey3,
    padding: spacing.md,
    alignItems: 'center',
    position: 'relative',
    paddingTop: 28,
  },
  planCardSelected: { borderColor: colors.teal, backgroundColor: colors.tealDim },
  popularBadge: {
    position: 'absolute',
    top: -12,
    backgroundColor: colors.teal,
    borderRadius: radius.full,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  popularText:  { fontSize: 10, fontWeight: '800', color: colors.white, letterSpacing: 0.5 },
  planLabel:    { fontSize: 12, fontWeight: '700', color: colors.grey2, textTransform: 'uppercase', marginBottom: 6 },
  planPrice:    { fontSize: 26, fontWeight: '800', color: colors.white },
  planPeriod:   { fontSize: 11, color: colors.grey2, marginTop: 2 },
  planPerMonth: { fontSize: 11, color: colors.tealLight, marginTop: 4 },
  savingBadge: {
    marginTop: 8,
    backgroundColor: colors.success + '33',
    borderRadius: radius.full,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  savingText: { fontSize: 11, fontWeight: '700', color: colors.success },
  btnSubscribe: {
    backgroundColor: colors.teal,
    borderRadius: radius.md,
    paddingVertical: 18,
    alignItems: 'center',
    marginBottom: spacing.md,
    ...shadow.card,
  },
  btnSubscribeText: { color: colors.white, fontSize: 17, fontWeight: '800' },
  legal:   { fontSize: 11, color: colors.grey2, textAlign: 'center', lineHeight: 16, marginBottom: spacing.xl },
  freeTier:{ alignItems: 'center', gap: 6 },
  freeTierText: { fontSize: 13, color: colors.grey2 },
  freeTierLink: { fontSize: 13, color: colors.tealLight, fontWeight: '600' },
});
