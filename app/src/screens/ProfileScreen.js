import React from 'react';
import {
  View, Text, StyleSheet, SafeAreaView,
  TouchableOpacity, ScrollView, Alert,
} from 'react-native';
import { colors, spacing, radius } from '../theme';
import { useAuth } from '../hooks/useAuth';

function Row({ label, value, onPress, danger }) {
  return (
    <TouchableOpacity style={s.row} onPress={onPress} disabled={!onPress}>
      <Text style={[s.rowLabel, danger && { color: colors.error }]}>{label}</Text>
      {value && <Text style={s.rowValue}>{value}</Text>}
      {onPress && <Text style={s.rowArrow}>›</Text>}
    </TouchableOpacity>
  );
}

function Section({ title, children }) {
  return (
    <View style={s.section}>
      <Text style={s.sectionTitle}>{title}</Text>
      <View style={s.sectionCard}>{children}</View>
    </View>
  );
}

export default function ProfileScreen({ navigation }) {
  const { user, logout } = useAuth();

  const isPro = user?.subscription === 'pro';
  const analysesLeft = user?.analyses_remaining ?? 5;

  const handleLogout = () => {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: logout },
    ]);
  };

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* Avatar + name */}
        <View style={s.avatar}>
          <Text style={s.avatarEmoji}>⛳</Text>
          <Text style={s.email}>{user?.email}</Text>
          <View style={[s.badge, isPro ? s.badgePro : s.badgeFree]}>
            <Text style={s.badgeText}>{isPro ? '★ PRO' : 'FREE'}</Text>
          </View>
        </View>

        {/* Subscription */}
        {!isPro && (
          <TouchableOpacity style={s.upgradeBanner} onPress={() => navigation.navigate('Paywall')}>
            <View style={s.upgradeBannerText}>
              <Text style={s.upgradeBannerTitle}>Upgrade to Pro</Text>
              <Text style={s.upgradeBannerSub}>
                {analysesLeft} free analyse{analysesLeft !== 1 ? 's' : ''} left this month · Unlimited from $4/mo
              </Text>
            </View>
            <Text style={s.upgradeBannerArrow}>→</Text>
          </TouchableOpacity>
        )}

        <Section title="Account">
          <Row label="Email"        value={user?.email} />
          <Row label="Plan"         value={isPro ? 'Pro' : `Free (${analysesLeft} left)`} />
          {isPro && (
            <Row
              label="Manage Subscription"
              onPress={() => Alert.alert('Manage subscription', 'Open your device Settings → Subscriptions to manage or cancel.')}
            />
          )}
          <Row label="Change Password" onPress={() => Alert.alert('Coming soon', 'Password reset via email will be available soon.')} />
        </Section>

        <Section title="Stats">
          <Row label="Total Analyses" value={user?.total_analyses ?? '0'} />
          <Row label="Average Score"  value={user?.avg_score ? `${user.avg_score}/100` : '—'} />
          <Row label="Member Since"   value={user?.created_at
            ? new Date(user.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
            : '—'
          } />
        </Section>

        <Section title="App">
          <Row label="Rate Pocket Golf Coach" onPress={() => Alert.alert('Coming soon', 'App Store/Play Store rating link will be added at launch.')} />
          <Row label="Send Feedback"         onPress={() => Alert.alert('Coming soon', 'In-app feedback form coming soon.')} />
          <Row label="Privacy Policy"        onPress={() => Alert.alert('Privacy Policy', 'Available at pocketgolfcoach.app/privacy')} />
          <Row label="Terms of Service"      onPress={() => Alert.alert('Terms', 'Available at pocketgolfcoach.app/terms')} />
          <Row label="Version"           value="1.0.0 (beta)" />
        </Section>

        <TouchableOpacity style={s.logoutBtn} onPress={handleLogout}>
          <Text style={s.logoutText}>Sign Out</Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: colors.bg },
  scroll:  { padding: spacing.lg, paddingBottom: 100 },
  avatar:  { alignItems: 'center', marginBottom: spacing.xl },
  avatarEmoji: { fontSize: 56, marginBottom: spacing.md },
  email:   { fontSize: 15, color: colors.grey1, marginBottom: spacing.sm },
  badge: {
    borderRadius: radius.full,
    paddingHorizontal: 14,
    paddingVertical: 4,
  },
  badgePro:    { backgroundColor: colors.teal },
  badgeFree:   { backgroundColor: colors.grey3 },
  badgeText:   { fontSize: 12, fontWeight: '800', color: colors.white, letterSpacing: 0.5 },
  upgradeBanner: {
    backgroundColor: colors.tealDim,
    borderWidth: 1,
    borderColor: colors.teal,
    borderRadius: radius.md,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  upgradeBannerText:  { flex: 1 },
  upgradeBannerTitle: { fontSize: 15, fontWeight: '700', color: colors.white },
  upgradeBannerSub:   { fontSize: 12, color: colors.tealLight, marginTop: 2 },
  upgradeBannerArrow: { fontSize: 20, color: colors.tealLight },
  section:      { marginBottom: spacing.xl },
  sectionTitle: { fontSize: 11, fontWeight: '700', color: colors.grey2, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: spacing.sm },
  sectionCard: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.grey3,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.grey3,
  },
  rowLabel: { flex: 1, fontSize: 15, color: colors.grey1 },
  rowValue: { fontSize: 14, color: colors.grey2, marginRight: 6 },
  rowArrow: { color: colors.grey2, fontSize: 18 },
  logoutBtn: {
    borderWidth: 1,
    borderColor: colors.error,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: 'center',
  },
  logoutText: { color: colors.error, fontSize: 15, fontWeight: '700' },
});
