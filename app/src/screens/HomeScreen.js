import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, SafeAreaView, StatusBar, RefreshControl,
} from 'react-native';
import { colors, spacing, radius, shadow } from '../theme';
import { analysis, profile as profileApi } from '../services/api';
import { useAuth } from '../hooks/useAuth';

// ── Rotating filming tips ─────────────────────────────────────────────────────
const TIPS = [
  {
    title: '📐 Camera position',
    body:  'Film from the side, perpendicular to your target line, at waist height. Landscape mode, full body in frame.',
  },
  {
    title: '☀️ Lighting matters',
    body:  'Bright, even light helps the AI find your joints. Outdoors on a cloudy day is ideal — avoid strong backlighting.',
  },
  {
    title: '🎯 Full body in frame',
    body:  'Make sure your feet and the top of your head are both visible throughout the entire swing, not just at address.',
  },
  {
    title: '🔁 Consistency is key',
    body:  'Use the same camera angle each session so your scores are directly comparable over time.',
  },
  {
    title: '⏱️ Clip length',
    body:  'A 5–15 second clip works best. Include your full setup, swing, and finish — don\'t cut too early.',
  },
  {
    title: '👟 Show your feet',
    body:  'Keep your feet in frame. Weight transfer and foot position are key signals for impact analysis.',
  },
  {
    title: '📱 Stabilize your phone',
    body:  'Prop your phone against a bag or use a small tripod. A shaky camera reduces tracking accuracy.',
  },
  {
    title: '🏌️ Real swings only',
    body:  'Film a genuine full-speed swing — slow-motion or practice swings can confuse the motion detection.',
  },
];

// ── Stat cards ────────────────────────────────────────────────────────────────
function StatCard({ value, label }) {
  return (
    <View style={s.statCard}>
      <Text style={s.statValue}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );
}

// ── Monthly usage progress bar ────────────────────────────────────────────────
const FREE_LIMIT = 5;
function UsageCard({ used, isPro }) {
  if (isPro) {
    return (
      <View style={s.statCard}>
        <Text style={s.statValue}>∞</Text>
        <Text style={s.statLabel}>Unlimited</Text>
      </View>
    );
  }
  const remaining = Math.max(0, FREE_LIMIT - used);
  const pct       = Math.min(1, used / FREE_LIMIT);
  const barColor  = remaining === 0 ? colors.error : remaining === 1 ? colors.warning : colors.tealLight;
  return (
    <View style={[s.statCard, { justifyContent: 'space-between' }]}>
      <Text style={[s.statValue, { color: barColor }]}>{remaining}</Text>
      <Text style={s.statLabel}>Left this month</Text>
      <View style={s.usageBarBg}>
        <View style={[s.usageBarFill, { width: `${pct * 100}%`, backgroundColor: barColor }]} />
      </View>
    </View>
  );
}

// ── Recent item ───────────────────────────────────────────────────────────────
function RecentItem({ item, onPress }) {
  const clubEmoji = { driver: '🏌️', iron: '⛳', wedge: '🎯', putter: '🕳️' };
  const date = new Date(item.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return (
    <TouchableOpacity style={s.recentItem} onPress={() => onPress(item)}>
      <Text style={s.recentEmoji}>{clubEmoji[item.club_type] || '🏌️'}</Text>
      <View style={s.recentInfo}>
        <Text style={s.recentClub}>{item.club_type?.charAt(0).toUpperCase() + item.club_type?.slice(1)} Swing</Text>
        <Text style={s.recentDate}>{date} · vs {item.pro_name}</Text>
      </View>
      <View style={[s.scoreBadge, { backgroundColor: scoreColor(item.overall_score) }]}>
        <Text style={s.scoreText}>{item.overall_score}</Text>
      </View>
    </TouchableOpacity>
  );
}

function scoreColor(score) {
  if (score >= 80) return colors.success;
  if (score >= 60) return colors.warning;
  return colors.error;
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function HomeScreen({ navigation }) {
  const { user } = useAuth();
  const [history,    setHistory]    = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [firstName,  setFirstName]  = useState('');
  const [tip]                       = useState(() => TIPS[Math.floor(Math.random() * TIPS.length)]);

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async (isRefresh = false) => {
    try {
      const [histData, profileData] = await Promise.allSettled([
        analysis.getHistory(5),
        profileApi.get(),
      ]);
      if (histData.status === 'fulfilled') {
        setHistory(histData.value.analyses || []);
      }
      if (profileData.status === 'fulfilled' && profileData.value?.first_name) {
        setFirstName(profileData.value.first_name);
      } else {
        setFirstName(user?.email?.split('@')[0] || 'Golfer');
      }
    } catch {
      setFirstName(user?.email?.split('@')[0] || 'Golfer');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => { setRefreshing(true); loadAll(true); };

  const isPro          = user?.subscription === 'pro';
  const analysesUsed   = user?.analyses_this_month ?? 0;
  const analysesLeft   = Math.max(0, FREE_LIMIT - analysesUsed);

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="light-content" />
      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.tealLight}
          />
        }
      >

        {/* Header */}
        <View style={s.header}>
          <View>
            <Text style={s.greeting}>
              Hey, {firstName || user?.email?.split('@')[0] || 'Golfer'} 👋
            </Text>
            <Text style={s.sub}>Ready to fix that swing?</Text>
          </View>
          {!isPro && (
            <TouchableOpacity style={s.proBadge} onPress={() => navigation.navigate('Paywall')}>
              <Text style={s.proBadgeText}>Go Pro</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Stats row */}
        <View style={s.statsRow}>
          <StatCard value={user?.total_analyses ?? 0} label="Total Swings" />
          <UsageCard used={analysesUsed} isPro={isPro} />
          <StatCard value={user?.avg_score ? Math.round(user.avg_score) : '—'} label="Avg Score" />
        </View>

        {/* Analyze CTA */}
        <TouchableOpacity
          style={s.analyzeCta}
          onPress={() => {
            if (!isPro && analysesLeft <= 0) {
              navigation.navigate('Paywall');
            } else {
              navigation.navigate('Analyze');
            }
          }}
        >
          <Text style={s.analyzeCtaIcon}>🎥</Text>
          <View style={s.analyzeCtaText}>
            <Text style={s.analyzeCtaTitle}>Analyze a Swing</Text>
            <Text style={s.analyzeCtaSub}>Record or upload a video to get started</Text>
          </View>
          <Text style={s.analyzeCtaArrow}>→</Text>
        </TouchableOpacity>

        {/* Rotating tip */}
        <View style={s.tipBanner}>
          <Text style={s.tipTitle}>{tip.title}</Text>
          <Text style={s.tipBody}>{tip.body}</Text>
        </View>

        {/* Recent analyses */}
        <Text style={s.sectionTitle}>Recent Analyses</Text>
        {loading ? (
          <Text style={s.empty}>Loading…</Text>
        ) : history.length === 0 ? (
          <View style={s.emptyCard}>
            <Text style={s.emptyEmoji}>🏌️</Text>
            <Text style={s.emptyTitle}>No swings yet</Text>
            <Text style={s.emptyBody}>Hit the button above to analyze your first swing.</Text>
          </View>
        ) : (
          history.map((item) => (
            <RecentItem
              key={item.id}
              item={item}
              onPress={(i) => navigation.navigate('Analyze', {
                screen: 'Results',
                params: { analysisId: i.id },
              })}
            />
          ))
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:       { flex: 1, backgroundColor: colors.bg },
  scroll:     { padding: spacing.lg, paddingBottom: 100 },
  header:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xl },
  greeting:   { fontSize: 22, fontWeight: '800', color: colors.white },
  sub:        { fontSize: 13, color: colors.grey2, marginTop: 2 },
  proBadge: {
    backgroundColor: colors.teal,
    borderRadius: radius.full,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  proBadgeText: { color: colors.white, fontSize: 13, fontWeight: '700' },

  statsRow:   { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.lg },
  statCard:   {
    flex: 1,
    backgroundColor: colors.bgCard,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.grey3,
  },
  statValue:  { fontSize: 24, fontWeight: '800', color: colors.tealLight },
  statLabel:  { fontSize: 11, color: colors.grey2, marginTop: 4, textAlign: 'center' },

  // Usage progress bar
  usageBarBg: {
    width: '100%',
    height: 4,
    backgroundColor: colors.grey3,
    borderRadius: 2,
    marginTop: 6,
    overflow: 'hidden',
  },
  usageBarFill: { height: '100%', borderRadius: 2 },

  analyzeCta: {
    backgroundColor: colors.teal,
    borderRadius: radius.lg,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
    ...shadow.card,
  },
  analyzeCtaIcon:  { fontSize: 32, marginRight: spacing.md },
  analyzeCtaText:  { flex: 1 },
  analyzeCtaTitle: { fontSize: 18, fontWeight: '800', color: colors.white },
  analyzeCtaSub:   { fontSize: 13, color: 'rgba(255,255,255,0.75)', marginTop: 2 },
  analyzeCtaArrow: { fontSize: 20, color: colors.white },

  tipBanner: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.grey3,
    borderLeftWidth: 3,
    borderLeftColor: colors.teal,
    padding: spacing.md,
    marginBottom: spacing.xl,
  },
  tipTitle:   { fontSize: 13, fontWeight: '700', color: colors.white, marginBottom: 6 },
  tipBody:    { fontSize: 12, color: colors.grey2, lineHeight: 18 },

  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.white, marginBottom: spacing.md },
  empty:        { color: colors.grey2, textAlign: 'center', marginTop: spacing.xl },
  emptyCard:    { backgroundColor: colors.bgCard, borderRadius: radius.md, padding: spacing.xl, alignItems: 'center', borderWidth: 1, borderColor: colors.grey3 },
  emptyEmoji:   { fontSize: 40, marginBottom: spacing.md },
  emptyTitle:   { fontSize: 16, fontWeight: '700', color: colors.white, marginBottom: 6 },
  emptyBody:    { fontSize: 13, color: colors.grey2, textAlign: 'center' },

  recentItem: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.md,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.grey3,
    marginBottom: spacing.sm,
  },
  recentEmoji: { fontSize: 28, marginRight: spacing.md },
  recentInfo:  { flex: 1 },
  recentClub:  { fontSize: 15, fontWeight: '600', color: colors.white },
  recentDate:  { fontSize: 12, color: colors.grey2, marginTop: 2 },
  scoreBadge:  { borderRadius: radius.full, width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  scoreText:   { fontSize: 14, fontWeight: '800', color: colors.white },
});
