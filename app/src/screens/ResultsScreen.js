import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, ScrollView,
  TouchableOpacity, ActivityIndicator, Image,
} from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, spacing, radius, shadow } from '../theme';
import { analysis } from '../services/api';
import { API_BASE_URL } from '../services/api';
import {
  speakCoachingScript,
  speakDrill,
  stopSpeaking,
  buildFallbackScript,
} from '../services/audio';

// ── Score ring ────────────────────────────────────────────────────────────────
function ScoreRing({ score }) {
  const color = score >= 80 ? colors.success : score >= 60 ? colors.warning : colors.error;
  return (
    <View style={[s.ring, { borderColor: color }]}>
      <Text style={[s.ringScore, { color }]}>{score}</Text>
      <Text style={s.ringLabel}>/ 100</Text>
    </View>
  );
}

// ── Phase media: still image + swipeable video clip ───────────────────────────
function PhaseMedia({ phase, phaseImages, analysisId }) {
  const b64 = phaseImages?.[phase];
  const [page, setPage]           = useState(0);
  const [pageWidth, setPageWidth] = useState(0);
  const [clipReady, setClipReady] = useState(false);
  const [clipLoading, setClipLoading] = useState(false);
  const [clipError, setClipError] = useState(false);

  // Create video player upfront (hook must be unconditional)
  const player = useVideoPlayer(null, (p) => {
    p.loop = true;
  });

  const loadClip = async () => {
    if (clipReady || clipLoading || clipError || !analysisId) return;
    setClipLoading(true);
    try {
      const token = await AsyncStorage.getItem('auth_token');
      const url = `${API_BASE_URL}/analyses/${analysisId}/clip/${phase}?token=${encodeURIComponent(token)}`;
      player.replace({ uri: url });
      player.play();
      setClipReady(true);
    } catch (e) {
      console.warn('[SwingCoach] Clip load failed:', e);
      setClipError(true);
    } finally {
      setClipLoading(false);
    }
  };

  // Stop video when scrolled back to still image
  useEffect(() => {
    if (page === 0 && clipReady) {
      try { player.pause(); } catch (_) {}
    } else if (page === 1 && clipReady) {
      try { player.play(); } catch (_) {}
    }
  }, [page]);

  if (!b64) return null;

  const handleScroll = (e) => {
    const w = e.nativeEvent.layoutMeasurement.width;
    if (!w) return;
    const newPage = Math.round(e.nativeEvent.contentOffset.x / w);
    if (newPage !== page) {
      setPage(newPage);
      if (newPage === 1) loadClip();
    }
  };

  const pgStyle = pageWidth > 0 ? { width: pageWidth, height: 260 } : { width: '100%', height: 260 };

  return (
    <View
      style={s.mediaWrap}
      onLayout={(e) => setPageWidth(e.nativeEvent.layout.width)}
    >
      {pageWidth > 0 && (
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScroll}
        scrollEventThrottle={16}
      >
        {/* ── Page 0: annotated still frame ── */}
        <View style={[s.mediaPage, pgStyle]}>
          <Image
            source={{ uri: `data:image/jpeg;base64,${b64}` }}
            style={s.mediaImg}
            resizeMode="cover"
          />
          <View style={s.mediaLabel}>
            <Text style={s.mediaLabelText}>
              {phase.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
            </Text>
          </View>
          {/* Nudge hint — only show if analysis has a video to offer */}
          {analysisId && (
            <View style={s.swipeHint}>
              <Text style={s.swipeHintText}>video ›</Text>
            </View>
          )}
        </View>

        {/* ── Page 1: video clip ── */}
        {analysisId && (
          <View style={[s.mediaPage, pgStyle]}>
            {clipReady ? (
              <VideoView
                player={player}
                style={s.mediaImg}
                contentFit="cover"
                nativeControls={false}
              />
            ) : (
              <View style={s.clipPlaceholder}>
                {clipLoading ? (
                  <>
                    <ActivityIndicator color={colors.tealLight} size="small" />
                    <Text style={s.clipPlaceholderText}>Loading clip…</Text>
                  </>
                ) : clipError ? (
                  <Text style={s.clipPlaceholderText}>Clip unavailable</Text>
                ) : (
                  <Text style={s.clipPlaceholderText}>Swipe to load clip</Text>
                )}
              </View>
            )}
            <View style={s.mediaLabel}>
              <Text style={s.mediaLabelText}>Video Clip</Text>
            </View>
          </View>
        )}
      </ScrollView>
      )}

      {/* Dot indicators */}
      {analysisId && pageWidth > 0 && (
        <View style={s.dotsRow}>
          <View style={[s.dot, page === 0 ? s.dotActive : s.dotInactive]} />
          <View style={[s.dot, page === 1 ? s.dotActive : s.dotInactive]} />
        </View>
      )}
    </View>
  );
}

// ── Positive card ─────────────────────────────────────────────────────────────
function PositiveCard({ item, phaseImages, analysisId }) {
  return (
    <View style={s.positiveCard}>
      <View style={s.positiveHeader}>
        <Text style={s.positiveCheck}>✓</Text>
        <Text style={s.positiveTitle}>{item.title}</Text>
      </View>
      <PhaseMedia phase={item.phase} phaseImages={phaseImages} analysisId={analysisId} />
      <Text style={s.positiveBody}>{item.description}</Text>
      {item.phase && (
        <View style={s.phaseTag}>
          <Text style={s.phaseTagText}>{item.phase.replace(/_/g, ' ')}</Text>
        </View>
      )}
    </View>
  );
}

// ── Issue card ────────────────────────────────────────────────────────────────
function IssueCard({ issue, phaseImages, analysisId }) {
  const severityColor = {
    high:   colors.error,
    medium: colors.warning,
    low:    colors.success,
  }[issue.severity] || colors.grey2;

  return (
    <View style={s.issueCard}>
      <View style={s.issueHeader}>
        <View style={[s.severityDot, { backgroundColor: severityColor }]} />
        <Text style={s.issueTitle}>{issue.title}</Text>
      </View>
      <PhaseMedia phase={issue.phase} phaseImages={phaseImages} analysisId={analysisId} />
      <Text style={s.issueBody}>{issue.description}</Text>
      {issue.phase && (
        <View style={s.phaseTag}>
          <Text style={s.phaseTagText}>{issue.phase.replace(/_/g, ' ')}</Text>
        </View>
      )}
    </View>
  );
}

// ── Drill card ────────────────────────────────────────────────────────────────
function DrillCard({ drill, index, onSpeak }) {
  return (
    <View style={s.drillCard}>
      <View style={s.drillNum}>
        <Text style={s.drillNumText}>{index + 1}</Text>
      </View>
      <View style={s.drillContent}>
        <View style={s.drillTitleRow}>
          <Text style={s.drillTitle}>{drill.title}</Text>
          <TouchableOpacity style={s.drillSpeakBtn} onPress={() => onSpeak(drill)}>
            <Text style={s.drillSpeakIcon}>🔊</Text>
          </TouchableOpacity>
        </View>
        <Text style={s.drillBody}>{drill.instructions}</Text>
        {drill.reps && <Text style={s.drillReps}>📋 {drill.reps}</Text>}
        {drill.fixes_issue && (
          <View style={s.fixesTag}>
            <Text style={s.fixesTagText}>Fixes: {drill.fixes_issue}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

// ── Angle comparison row ──────────────────────────────────────────────────────
function PositionRow({ label, yours, pro, diff }) {
  const ok = Math.abs(diff) < 10;
  return (
    <View style={s.posRow}>
      <Text style={s.posLabel}>{label}</Text>
      <Text style={s.posValue}>{yours}°</Text>
      <Text style={s.posValue}>{pro}°</Text>
      <View style={[s.posDiff, { backgroundColor: ok ? colors.success + '33' : colors.warning + '33' }]}>
        <Text style={[s.posDiffText, { color: ok ? colors.success : colors.warning }]}>
          {diff > 0 ? '+' : ''}{diff}°
        </Text>
      </View>
    </View>
  );
}

// ── Audio player bar ──────────────────────────────────────────────────────────
function AudioBar({ data }) {
  const [playing, setPlaying] = useState(false);

  // Keep screen awake while coaching audio is playing
  useEffect(() => {
    if (playing) {
      activateKeepAwakeAsync();
    } else {
      deactivateKeepAwake();
    }
  }, [playing]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      stopSpeaking();
      deactivateKeepAwake();
    };
  }, []);

  const handleToggle = async () => {
    if (playing) {
      await stopSpeaking();
      setPlaying(false);
    } else {
      setPlaying(true);
      const script = data.coaching_script || buildFallbackScript(data);
      await speakCoachingScript(script, null, () => setPlaying(false));
    }
  };

  return (
    <TouchableOpacity style={[s.audioBar, playing && s.audioBarActive]} onPress={handleToggle}>
      <Text style={s.audioBarIcon}>{playing ? '⏹' : '▶'}</Text>
      <View style={s.audioBarText}>
        <Text style={s.audioBarTitle}>
          {playing ? 'Coaching in progress…' : 'Hear your coaching session'}
        </Text>
        <Text style={s.audioBarSub}>
          {playing
            ? 'Tap to stop'
            : 'Full breakdown read aloud — works through AirPods or speaker'}
        </Text>
      </View>
      {playing && (
        <View style={s.audioBarWave}>
          {[1, 2, 3, 4].map((i) => (
            <View key={i} style={[s.audioBarDot, { opacity: 0.4 + i * 0.15 }]} />
          ))}
        </View>
      )}
    </TouchableOpacity>
  );
}


// ── Main screen ───────────────────────────────────────────────────────────────
export default function ResultsScreen({ route, navigation }) {
  const { analysisId, data: preloaded } = route.params || {};
  const [data,    setData]    = useState(preloaded || null);
  const [loading, setLoading] = useState(!preloaded);
  const [tab,     setTab]     = useState('positives');

  useEffect(() => {
    if (!preloaded && analysisId) {
      analysis.getById(analysisId).then(setData).finally(() => setLoading(false));
    }
  }, [analysisId]);

  if (loading) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.tealLight} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  if (!data) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl }}>
          <Text style={{ color: colors.grey1, textAlign: 'center' }}>
            Couldn't load results. Please try again.
          </Text>
          <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginTop: spacing.lg }}>
            <Text style={{ color: colors.tealLight }}>← Go back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const positives   = data.positives || [];
  const issues      = data.issues    || [];
  const drills      = data.drills    || [];
  const angles      = data.angle_comparisons || [];
  const phaseImages = data.phase_images || {};
  const aid         = data.id;   // analysis ID for clip URLs

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* Back */}
        <TouchableOpacity onPress={() => navigation.navigate('Home')} style={s.back}>
          <Text style={s.backText}>← Home</Text>
        </TouchableOpacity>

        {/* Summary header */}
        <View style={s.summaryCard}>
          <ScoreRing score={data.overall_score} />
          <View style={s.summaryInfo}>
            <Text style={s.summaryClub}>
              {data.club_type?.charAt(0).toUpperCase() + data.club_type?.slice(1)} swing
            </Text>
            <Text style={s.summaryPro}>vs {data.pro_name}</Text>
            <Text style={s.summaryDate}>
              {new Date(data.created_at).toLocaleDateString('en-US', {
                month: 'long', day: 'numeric', year: 'numeric',
              })}
            </Text>
          </View>
        </View>

        {/* AI Summary text */}
        {data.summary && (
          <View style={s.summaryText}>
            <Text style={s.summaryLabel}>AI Summary</Text>
            <Text style={s.summaryBody}>{data.summary}</Text>
          </View>
        )}

        {/* ── Audio coaching bar ── */}
        <AudioBar data={data} />

        {/* Tabs */}
        <View style={s.tabs}>
          {[
            { id: 'positives', label: `✓ Good (${positives.length})` },
            { id: 'issues',    label: `⚠ Fix (${issues.length})` },
            { id: 'drills',    label: `🏋 Drills (${drills.length})` },
            { id: 'angles',    label: '📐 Angles' },
          ].map((t) => (
            <TouchableOpacity
              key={t.id}
              style={[s.tab, tab === t.id && s.tabActive]}
              onPress={() => setTab(t.id)}
            >
              <Text style={[s.tabText, tab === t.id && s.tabTextActive]}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Positives tab */}
        {tab === 'positives' && (
          <View>
            {positives.length === 0 ? (
              <Text style={s.emptyTab}>Processing positives…</Text>
            ) : (
              positives.map((item, i) => (
                <PositiveCard key={i} item={item} phaseImages={phaseImages} analysisId={aid} />
              ))
            )}
          </View>
        )}

        {/* Issues tab */}
        {tab === 'issues' && (
          <View>
            {issues.length === 0 ? (
              <Text style={s.emptyTab}>No issues detected — great swing! 🎉</Text>
            ) : (
              issues.map((issue, i) => (
                <IssueCard key={i} issue={issue} phaseImages={phaseImages} analysisId={aid} />
              ))
            )}
          </View>
        )}

        {/* Drills tab */}
        {tab === 'drills' && (
          <View>
            {drills.length === 0 ? (
              <Text style={s.emptyTab}>No drills recommended — keep doing what you're doing!</Text>
            ) : (
              drills.map((drill, i) => (
                <DrillCard key={i} drill={drill} index={i} onSpeak={speakDrill} />
              ))
            )}
            {drills.length > 0 && (
              <View style={s.drillsTip}>
                <Text style={s.drillsTipText}>
                  💡 Tap 🔊 on any drill to have it read aloud while you practice
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Angles tab */}
        {tab === 'angles' && (
          <View>
            <View style={s.anglesHeader}>
              <Text style={s.anglesHeaderCell}>Position</Text>
              <Text style={s.anglesHeaderCell}>Yours</Text>
              <Text style={s.anglesHeaderCell}>Pro</Text>
              <Text style={s.anglesHeaderCell}>Δ</Text>
            </View>
            {angles.length === 0 ? (
              <Text style={s.emptyTab}>Angle data not available for this analysis.</Text>
            ) : (
              angles.map((a, i) => (
                <PositionRow key={i} label={a.label} yours={a.yours} pro={a.pro} diff={a.diff} />
              ))
            )}
          </View>
        )}

        {/* Analyze another */}
        <TouchableOpacity style={s.btnAnother} onPress={() => navigation.navigate('Camera')}>
          <Text style={s.btnAnotherText}>Analyze Another Swing</Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: colors.bg },
  scroll:  { padding: spacing.lg, paddingBottom: 100 },
  back:    { marginBottom: spacing.md },
  backText:{ color: colors.grey2, fontSize: 14 },

  summaryCard: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.grey3,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    marginBottom: spacing.md,
    ...shadow.card,
  },
  ring:        { width: 90, height: 90, borderRadius: 45, borderWidth: 4, alignItems: 'center', justifyContent: 'center' },
  ringScore:   { fontSize: 28, fontWeight: '800' },
  ringLabel:   { fontSize: 11, color: colors.grey2 },
  summaryInfo: { flex: 1 },
  summaryClub: { fontSize: 18, fontWeight: '800', color: colors.white },
  summaryPro:  { fontSize: 13, color: colors.tealLight, marginTop: 2 },
  summaryDate: { fontSize: 12, color: colors.grey2, marginTop: 4 },

  summaryText: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.grey3,
    borderLeftWidth: 3,
    borderLeftColor: colors.teal,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  summaryLabel: { fontSize: 11, fontWeight: '700', color: colors.tealLight, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 },
  summaryBody:  { fontSize: 14, color: colors.grey1, lineHeight: 22 },

  // Audio bar
  audioBar: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.grey3,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  audioBarActive: { borderColor: colors.teal, backgroundColor: colors.tealDim },
  audioBarIcon:   { fontSize: 22 },
  audioBarText:   { flex: 1 },
  audioBarTitle:  { fontSize: 14, fontWeight: '700', color: colors.white },
  audioBarSub:    { fontSize: 11, color: colors.grey2, marginTop: 2 },
  audioBarWave:   { flexDirection: 'row', gap: 3, alignItems: 'center' },
  audioBarDot:    { width: 4, height: 16, backgroundColor: colors.tealLight, borderRadius: 2 },

  tabs:         { flexDirection: 'row', marginBottom: spacing.lg, backgroundColor: colors.bgCard, borderRadius: radius.md, padding: 4 },
  tab:          { flex: 1, paddingVertical: 9, alignItems: 'center', borderRadius: radius.sm },
  tabActive:    { backgroundColor: colors.teal },
  tabText:      { fontSize: 10, fontWeight: '600', color: colors.grey2 },
  tabTextActive:{ color: colors.white },

  // Positive cards
  positiveCard: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.success + '55',
    borderLeftWidth: 3,
    borderLeftColor: colors.success,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  positiveHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  positiveCheck:  { fontSize: 16, color: colors.success, fontWeight: '800' },
  positiveTitle:  { fontSize: 15, fontWeight: '700', color: colors.white, flex: 1 },
  positiveBody:   { fontSize: 13, color: colors.grey1, lineHeight: 20 },

  // Issue cards
  issueCard: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.grey3,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  issueHeader:  { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  severityDot:  { width: 8, height: 8, borderRadius: 4 },
  issueTitle:   { fontSize: 15, fontWeight: '700', color: colors.white, flex: 1 },
  issueBody:    { fontSize: 13, color: colors.grey1, lineHeight: 20 },

  // Phase media (still + video pager)
  mediaWrap: {
    borderRadius: radius.sm,
    overflow: 'hidden',
    marginBottom: 10,
    marginTop: 6,
    backgroundColor: colors.bgAlt,
    borderWidth: 1,
    borderColor: colors.grey3,
  },
  mediaScroll: { width: '100%' },
  mediaPage: {
    width: 310,        // fixed — matches card inner width (adjust if needed)
    height: 260,
    position: 'relative',
    overflow: 'hidden',
  },
  mediaImg: {
    width: '100%',
    height: '100%',
  },
  mediaLabel: {
    position: 'absolute',
    top: 0,
    left: 0,
    backgroundColor: 'rgba(8,14,24,0.75)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderBottomRightRadius: radius.sm,
  },
  mediaLabelText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.tealLight,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  swipeHint: {
    position: 'absolute',
    bottom: 6,
    right: 8,
    backgroundColor: 'rgba(8,14,24,0.65)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  swipeHintText: { fontSize: 10, color: colors.grey2 },

  clipPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.bgAlt,
  },
  clipPlaceholderText: { fontSize: 12, color: colors.grey2 },

  // Dot indicators
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 6,
    backgroundColor: colors.bgAlt,
  },
  dot:        { width: 6, height: 6, borderRadius: 3 },
  dotActive:  { backgroundColor: colors.tealLight },
  dotInactive:{ backgroundColor: colors.grey3 },

  phaseTag: {
    alignSelf: 'flex-start',
    backgroundColor: colors.bgAlt,
    borderRadius: radius.full,
    paddingHorizontal: 10,
    paddingVertical: 3,
    marginTop: 8,
  },
  phaseTagText: { fontSize: 11, color: colors.grey2, textTransform: 'capitalize' },

  // Drill cards
  drillCard: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.grey3,
    padding: spacing.md,
    marginBottom: spacing.sm,
    flexDirection: 'row',
    gap: spacing.md,
  },
  drillNum:      { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.tealDim, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.teal },
  drillNumText:  { color: colors.tealLight, fontWeight: '800', fontSize: 14 },
  drillContent:  { flex: 1 },
  drillTitleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  drillTitle:    { fontSize: 15, fontWeight: '700', color: colors.white, flex: 1 },
  drillSpeakBtn: { padding: 4 },
  drillSpeakIcon:{ fontSize: 18 },
  drillBody:     { fontSize: 13, color: colors.grey1, lineHeight: 20 },
  drillReps:     { fontSize: 12, color: colors.grey2, marginTop: 6 },
  fixesTag: {
    alignSelf: 'flex-start',
    backgroundColor: colors.tealDim,
    borderRadius: radius.full,
    paddingHorizontal: 10,
    paddingVertical: 3,
    marginTop: 8,
    borderWidth: 1,
    borderColor: colors.teal,
  },
  fixesTagText:  { fontSize: 11, color: colors.tealLight },
  drillsTip: {
    backgroundColor: colors.bgAlt,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: colors.grey3,
  },
  drillsTipText: { fontSize: 12, color: colors.grey2, textAlign: 'center' },

  // Angles
  anglesHeader:      { flexDirection: 'row', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.grey3, marginBottom: spacing.sm },
  anglesHeaderCell:  { flex: 1, fontSize: 11, fontWeight: '700', color: colors.grey2, textTransform: 'uppercase' },
  posRow:            { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.grey3 + '66' },
  posLabel:          { flex: 1.5, fontSize: 13, color: colors.grey1 },
  posValue:          { flex: 1, fontSize: 13, color: colors.white, fontWeight: '600', textAlign: 'center' },
  posDiff:           { flex: 1, borderRadius: radius.sm, paddingVertical: 4, alignItems: 'center' },
  posDiffText:       { fontSize: 12, fontWeight: '700' },

  emptyTab:   { color: colors.grey2, textAlign: 'center', marginTop: spacing.xl, fontStyle: 'italic' },
  btnAnother: {
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.teal,
    borderRadius: radius.md,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: spacing.xl,
  },
  btnAnotherText: { color: colors.tealLight, fontSize: 16, fontWeight: '700' },
});
