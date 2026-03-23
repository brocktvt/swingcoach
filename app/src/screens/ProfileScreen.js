import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView,
  TouchableOpacity, ScrollView, Alert, TextInput,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { colors, spacing, radius } from '../theme';
import { useAuth } from '../hooks/useAuth';
import { profile as profileApi } from '../services/api';

// ── Sub-components ────────────────────────────────────────────────────────────

function Row({ label, value, onPress, danger }) {
  return (
    <TouchableOpacity style={s.row} onPress={onPress} disabled={!onPress}>
      <Text style={[s.rowLabel, danger && { color: colors.error }]}>{label}</Text>
      {value !== undefined && value !== null && (
        <Text style={s.rowValue}>{value}</Text>
      )}
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

function EditRow({ label, value, placeholder, onChangeText, keyboardType = 'default', unit }) {
  return (
    <View style={s.editRow}>
      <Text style={s.editRowLabel}>{label}</Text>
      <View style={s.editRowRight}>
        <TextInput
          style={s.editInput}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.grey2}
          keyboardType={keyboardType}
          returnKeyType="done"
        />
        {unit && <Text style={s.editUnit}>{unit}</Text>}
      </View>
    </View>
  );
}

function ChipRow({ label, options, value, onChange }) {
  return (
    <View style={s.chipRow}>
      <Text style={s.chipLabel}>{label}</Text>
      <View style={s.chipGroup}>
        {options.map(opt => (
          <TouchableOpacity
            key={opt.value}
            style={[s.chip, value === opt.value && s.chipActive]}
            onPress={() => onChange(opt.value)}
          >
            <Text style={[s.chipText, value === opt.value && s.chipTextActive]}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function feetInchesToIn(feet, inches) {
  const f = parseFloat(feet) || 0;
  const i = parseFloat(inches) || 0;
  return f * 12 + i;
}

function inToFeetInches(totalIn) {
  if (!totalIn) return { feet: '', inches: '' };
  const f = Math.floor(totalIn / 12);
  const i = Math.round(totalIn % 12);
  return { feet: String(f), inches: String(i) };
}

const GOAL_LABELS = {
  hit_further:   'Hit it further',
  iron_accuracy: 'Iron accuracy',
  chipping:      'Chipping & pitching',
  fix_shape:     'Fix my slice/hook',
  consistency:   'Consistency',
  scoring:       'Lower my scores',
  putting:       'Putting',
};

// ── Main screen ───────────────────────────────────────────────────────────────

export default function ProfileScreen({ navigation }) {
  const { user, logout } = useAuth();

  const isPro        = user?.subscription === 'pro';
  const analysesLeft = user?.analyses_remaining ?? 5;

  const [golferProfile, setGolferProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [editing, setEditing] = useState(false);

  // Edit fields
  const [firstName,    setFirstName]    = useState('');
  const [handicap,     setHandicap]     = useState('');
  const [rounds,       setRounds]       = useState('');
  const [age,          setAge]          = useState('');
  const [heightFeet,   setHeightFeet]   = useState('');
  const [heightInches, setHeightInches] = useState('');
  const [weight,       setWeight]       = useState('');
  const [handedness,      setHandedness]      = useState('right');
  const [goal,            setGoal]            = useState(null);
  const [secondaryGoal,   setSecondaryGoal]   = useState(null);

  const loadProfile = useCallback(async () => {
    try {
      setProfileLoading(true);
      const data = await profileApi.get();
      setGolferProfile(data);
      setFirstName(data.first_name || '');
      setHandicap(data.handicap != null ? String(data.handicap) : '');
      setRounds(data.rounds_per_year != null ? String(data.rounds_per_year) : '');
      setAge(data.age != null ? String(data.age) : '');
      const { feet, inches } = inToFeetInches(data.height_in);
      setHeightFeet(feet);
      setHeightInches(inches);
      setWeight(data.weight_lbs != null ? String(data.weight_lbs) : '');
      setHandedness(data.handedness || 'right');
      setGoal(data.primary_goal || null);
      setSecondaryGoal(data.secondary_goal || null);
    } catch {
      // No profile yet — that's fine
    } finally {
      setProfileLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { loadProfile(); }, [loadProfile]));

  const handleSave = async () => {
    setSaving(true);
    try {
      const heightIn = feetInchesToIn(heightFeet, heightInches);
      const payload = { handedness };
      if (firstName.trim() !== '') payload.first_name = firstName.trim();
      if (handicap !== '')  payload.handicap        = parseFloat(handicap);
      if (rounds !== '')    payload.rounds_per_year = parseInt(rounds, 10);
      if (age !== '')       payload.age             = parseInt(age, 10);
      if (heightIn > 0)     payload.height_in       = heightIn;
      if (weight !== '')    payload.weight_lbs      = parseFloat(weight);
      if (goal)                                    payload.primary_goal   = goal;
      if (secondaryGoal && secondaryGoal !== goal) payload.secondary_goal = secondaryGoal;

      const updated = await profileApi.save(payload);
      setGolferProfile(updated);
      setEditing(false);
    } catch (e) {
      Alert.alert('Save failed', e?.response?.data?.detail || 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: logout },
    ]);
  };

  const goalOptions = [
    { label: 'Hit it further',    value: 'hit_further' },
    { label: 'Iron accuracy',     value: 'iron_accuracy' },
    { label: 'Chipping & pitching', value: 'chipping' },
    { label: 'Fix my slice/hook', value: 'fix_shape' },
    { label: 'Consistency',       value: 'consistency' },
    { label: 'Lower my scores',   value: 'scoring' },
    { label: 'Putting',           value: 'putting' },
  ];

  const handednessOptions = [
    { label: 'Right-handed', value: 'right' },
    { label: 'Left-handed',  value: 'left'  },
  ];

  const suggestedPro = golferProfile?.suggested_pro;
  const hasProfile   = golferProfile?.handicap != null || golferProfile?.age != null;

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* Avatar */}
        <View style={s.avatar}>
          <Text style={s.avatarEmoji}>⛳</Text>
          {golferProfile?.first_name ? (
            <Text style={s.displayName}>{golferProfile.first_name}</Text>
          ) : null}
          <Text style={s.email}>{user?.email}</Text>
          <View style={[s.badge, isPro ? s.badgePro : s.badgeFree]}>
            <Text style={s.badgeText}>{isPro ? '★ PRO' : 'FREE'}</Text>
          </View>
        </View>

        {/* Upgrade banner */}
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

        {/* ── Golfer Profile ───────────────────────────────────────────── */}
        <View style={s.section}>
          <View style={s.sectionHeaderRow}>
            <Text style={s.sectionTitle}>GOLFER PROFILE</Text>
            {!editing && !profileLoading && (
              <TouchableOpacity onPress={() => setEditing(true)}>
                <Text style={s.editBtn}>{hasProfile ? 'Edit' : 'Set up →'}</Text>
              </TouchableOpacity>
            )}
          </View>

          {profileLoading ? (
            <ActivityIndicator color={colors.teal} style={{ marginVertical: spacing.md }} />
          ) : editing ? (
            <View style={s.sectionCard}>
              <EditRow label="First name" value={firstName} placeholder="e.g. Brock" onChangeText={setFirstName} />
              <ChipRow label="Dominant hand" options={handednessOptions} value={handedness} onChange={setHandedness} />
              <EditRow label="Handicap" value={handicap} placeholder="e.g. 14.5  (leave blank if none)" onChangeText={setHandicap} keyboardType="decimal-pad" />
              <EditRow label="Rounds / year" value={rounds} placeholder="e.g. 20" onChangeText={setRounds} keyboardType="number-pad" />
              <EditRow label="Age" value={age} placeholder="e.g. 42" onChangeText={setAge} keyboardType="number-pad" />
              {/* Height — two inputs */}
              <View style={s.editRow}>
                <Text style={s.editRowLabel}>Height</Text>
                <View style={[s.editRowRight, { gap: 6 }]}>
                  <TextInput style={[s.editInput, { width: 44 }]} value={heightFeet} onChangeText={setHeightFeet} placeholder="5" placeholderTextColor={colors.grey2} keyboardType="number-pad" returnKeyType="next" />
                  <Text style={s.editUnit}>ft</Text>
                  <TextInput style={[s.editInput, { width: 44 }]} value={heightInches} onChangeText={setHeightInches} placeholder="10" placeholderTextColor={colors.grey2} keyboardType="number-pad" returnKeyType="done" />
                  <Text style={s.editUnit}>in</Text>
                </View>
              </View>
              <EditRow label="Weight" value={weight} placeholder="e.g. 185" onChangeText={setWeight} keyboardType="decimal-pad" unit="lbs" />
              <ChipRow label="Primary goal" options={goalOptions} value={goal} onChange={(v) => { setGoal(v); if (secondaryGoal === v) setSecondaryGoal(null); }} />
              <ChipRow label="Also working on (optional)" options={goalOptions.filter(o => o.value !== goal)} value={secondaryGoal} onChange={(v) => setSecondaryGoal(secondaryGoal === v ? null : v)} />
              <View style={s.editActions}>
                <TouchableOpacity style={s.cancelBtn} onPress={() => { setEditing(false); loadProfile(); }}>
                  <Text style={s.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.saveBtn, saving && s.saveBtnDisabled]} onPress={handleSave} disabled={saving}>
                  {saving
                    ? <ActivityIndicator color={colors.white} size="small" />
                    : <Text style={s.saveBtnText}>Save Profile</Text>
                  }
                </TouchableOpacity>
              </View>
            </View>
          ) : hasProfile ? (
            <View style={s.sectionCard}>
              {golferProfile.first_name && <Row label="Name" value={golferProfile.first_name} />}
              <Row label="Dominant hand" value={handedness === 'right' ? 'Right-handed' : 'Left-handed'} />
              <Row label="Handicap"      value={golferProfile.handicap != null ? String(golferProfile.handicap) : 'None'} />
              {golferProfile.rounds_per_year != null && <Row label="Rounds / year" value={String(golferProfile.rounds_per_year)} />}
              {golferProfile.age != null && <Row label="Age" value={String(golferProfile.age)} />}
              {golferProfile.height_in != null && (
                <Row label="Height" value={`${Math.floor(golferProfile.height_in / 12)}'${Math.round(golferProfile.height_in % 12)}"`} />
              )}
              {golferProfile.weight_lbs != null && <Row label="Weight" value={`${golferProfile.weight_lbs} lbs`} />}
              {golferProfile.primary_goal && <Row label="Primary goal" value={GOAL_LABELS[golferProfile.primary_goal] || golferProfile.primary_goal} />}
              {golferProfile.secondary_goal && <Row label="Also working on" value={GOAL_LABELS[golferProfile.secondary_goal] || golferProfile.secondary_goal} />}
            </View>
          ) : (
            <TouchableOpacity style={s.emptyProfile} onPress={() => setEditing(true)}>
              <Text style={s.emptyProfileText}>
                Add your golf profile so your coaching feedback is tailored to your skill level and goals.
              </Text>
              <Text style={s.emptyProfileCta}>Set up profile →</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ── Suggested Pro ───────────────────────────────────────────────── */}
        {suggestedPro && !editing && (
          <View style={s.suggestedProCard}>
            <Text style={s.suggestedProLabel}>YOUR SUGGESTED PRO</Text>
            <Text style={s.suggestedProName}>{suggestedPro.name}</Text>
            <Text style={s.suggestedProReason}>{suggestedPro.match_reason}</Text>
            <Text style={s.suggestedProStyle}>{suggestedPro.style}</Text>
          </View>
        )}

        {/* ── Account ─────────────────────────────────────────────────────── */}
        <Section title="ACCOUNT">
          <Row label="Email"        value={user?.email} />
          <Row label="Plan"         value={isPro ? 'Pro' : `Free (${analysesLeft} left)`} />
          {isPro && (
            <Row label="Manage Subscription" onPress={() => Alert.alert('Manage subscription', 'Open your device Settings → Subscriptions to manage or cancel.')} />
          )}
          <Row label="Change Password" onPress={() => Alert.alert('Coming soon', 'Password reset via email will be available soon.')} />
        </Section>

        <Section title="STATS">
          <Row label="Total Analyses" value={String(user?.total_analyses ?? 0)} />
          <Row label="Average Score"  value={user?.avg_score ? `${user.avg_score}/100` : '—'} />
          <Row label="Member Since"   value={user?.created_at
            ? new Date(user.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
            : '—'
          } />
        </Section>

        <Section title="APP">
          <Row label="Rate Pocket Golf Coach" onPress={() => Alert.alert('Coming soon', 'App Store rating link added at launch.')} />
          <Row label="Send Feedback"          onPress={() => Alert.alert('Coming soon', 'In-app feedback form coming soon.')} />
          <Row label="Privacy Policy"         onPress={() => Alert.alert('Privacy Policy', 'Available at pocketgolfcoach.app/privacy')} />
          <Row label="Terms of Service"       onPress={() => Alert.alert('Terms', 'Available at pocketgolfcoach.app/terms')} />
          <Row label="Version"            value="1.0.0 (beta)" />
        </Section>

        <TouchableOpacity style={s.logoutBtn} onPress={handleLogout}>
          <Text style={s.logoutText}>Sign Out</Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: spacing.lg, paddingBottom: 100 },

  avatar:      { alignItems: 'center', marginBottom: spacing.xl },
  avatarEmoji: { fontSize: 56, marginBottom: spacing.md },
  displayName: { fontSize: 22, fontWeight: '700', color: colors.white, marginBottom: 4 },
  email:       { fontSize: 15, color: colors.grey1, marginBottom: spacing.sm },
  badge:       { borderRadius: radius.full, paddingHorizontal: 14, paddingVertical: 4 },
  badgePro:    { backgroundColor: colors.teal },
  badgeFree:   { backgroundColor: colors.grey3 },
  badgeText:   { fontSize: 12, fontWeight: '800', color: colors.white, letterSpacing: 0.5 },

  upgradeBanner: {
    backgroundColor: colors.tealDim, borderWidth: 1, borderColor: colors.teal,
    borderRadius: radius.md, padding: spacing.md,
    flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xl,
  },
  upgradeBannerText:  { flex: 1 },
  upgradeBannerTitle: { fontSize: 15, fontWeight: '700', color: colors.white },
  upgradeBannerSub:   { fontSize: 12, color: colors.tealLight, marginTop: 2 },
  upgradeBannerArrow: { fontSize: 20, color: colors.tealLight },

  section:          { marginBottom: spacing.xl },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  sectionTitle:     { fontSize: 11, fontWeight: '700', color: colors.grey2, textTransform: 'uppercase', letterSpacing: 0.8 },
  editBtn:          { fontSize: 14, color: colors.tealLight, fontWeight: '600' },
  sectionCard:      {
    backgroundColor: colors.bgCard, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.grey3, overflow: 'hidden',
  },

  row:      { flexDirection: 'row', alignItems: 'center', padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.grey3 },
  rowLabel: { flex: 1, fontSize: 15, color: colors.grey1 },
  rowValue: { fontSize: 14, color: colors.grey2, marginRight: 6 },
  rowArrow: { color: colors.grey2, fontSize: 18 },

  editRow:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.grey3 },
  editRowLabel: { flex: 1, fontSize: 15, color: colors.grey1 },
  editRowRight: { flexDirection: 'row', alignItems: 'center' },
  editInput:    { fontSize: 15, color: colors.white, textAlign: 'right', minWidth: 80, paddingVertical: 2, borderBottomWidth: 1, borderBottomColor: colors.teal },
  editUnit:     { fontSize: 13, color: colors.grey2, marginLeft: 4 },

  chipRow:   { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.grey3 },
  chipLabel: { fontSize: 13, color: colors.grey2, marginBottom: spacing.sm },
  chipGroup: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip:      { borderRadius: radius.full, borderWidth: 1, borderColor: colors.grey3, paddingHorizontal: 12, paddingVertical: 5, backgroundColor: colors.bgAlt },
  chipActive:     { backgroundColor: colors.teal, borderColor: colors.teal },
  chipText:       { fontSize: 13, color: colors.grey2 },
  chipTextActive: { color: colors.white, fontWeight: '600' },

  editActions:     { flexDirection: 'row', padding: spacing.md, gap: 10 },
  cancelBtn:       { flex: 1, borderWidth: 1, borderColor: colors.grey3, borderRadius: radius.md, paddingVertical: 12, alignItems: 'center' },
  cancelBtnText:   { color: colors.grey1, fontSize: 15 },
  saveBtn:         { flex: 2, backgroundColor: colors.teal, borderRadius: radius.md, paddingVertical: 12, alignItems: 'center' },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText:     { color: colors.white, fontSize: 15, fontWeight: '700' },

  emptyProfile:     { backgroundColor: colors.bgCard, borderRadius: radius.md, borderWidth: 1, borderColor: colors.grey3, padding: spacing.md },
  emptyProfileText: { fontSize: 14, color: colors.grey2, lineHeight: 20, marginBottom: spacing.sm },
  emptyProfileCta:  { fontSize: 14, color: colors.tealLight, fontWeight: '600' },

  suggestedProCard:   { backgroundColor: colors.tealDim, borderRadius: radius.md, borderWidth: 1, borderColor: colors.teal, padding: spacing.md, marginBottom: spacing.xl },
  suggestedProLabel:  { fontSize: 10, fontWeight: '800', color: colors.tealLight, letterSpacing: 0.8, marginBottom: 4 },
  suggestedProName:   { fontSize: 20, fontWeight: '800', color: colors.white, marginBottom: 4 },
  suggestedProReason: { fontSize: 13, color: colors.tealLight, marginBottom: 6, lineHeight: 18 },
  suggestedProStyle:  { fontSize: 12, color: colors.grey2, lineHeight: 17, fontStyle: 'italic' },

  logoutBtn:  { borderWidth: 1, borderColor: colors.error, borderRadius: radius.md, paddingVertical: 14, alignItems: 'center' },
  logoutText: { color: colors.error, fontSize: 15, fontWeight: '700' },
});
