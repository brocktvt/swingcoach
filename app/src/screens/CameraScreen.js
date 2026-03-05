import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  SafeAreaView, ScrollView, Alert, ActivityIndicator,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { colors, spacing, radius } from '../theme';
import { analysis, pros } from '../services/api';

const CLUB_TYPES = [
  { id: 'driver', label: 'Driver',  emoji: '🏌️' },
  { id: 'iron',   label: 'Iron',    emoji: '⛳' },
  { id: 'wedge',  label: 'Wedge',   emoji: '🎯' },
  { id: 'putter', label: 'Putter',  emoji: '🕳️' },
];

// Fallback pro list (replaced by API once backend is live)
const FALLBACK_PROS = [
  { id: 'rory_mcilroy',  name: 'Rory McIlroy',  note: 'Powerful rotation, consistent tempo' },
  { id: 'tiger_woods',   name: 'Tiger Woods',   note: 'Textbook fundamentals, elite precision' },
  { id: 'adam_scott',    name: 'Adam Scott',    note: 'Smooth, upright — great for amateurs to copy' },
  { id: 'jon_rahm',      name: 'Jon Rahm',      note: 'Compact backswing, powerful through impact' },
  { id: 'nelly_korda',   name: 'Nelly Korda',   note: 'Tour-perfect tempo and balance' },
];

function Chip({ label, emoji, selected, onPress }) {
  return (
    <TouchableOpacity
      style={[s.chip, selected && s.chipSelected]}
      onPress={onPress}
    >
      <Text style={s.chipEmoji}>{emoji}</Text>
      <Text style={[s.chipLabel, selected && s.chipLabelSelected]}>{label}</Text>
    </TouchableOpacity>
  );
}

function ProCard({ pro, selected, onPress }) {
  return (
    <TouchableOpacity
      style={[s.proCard, selected && s.proCardSelected]}
      onPress={onPress}
    >
      <Text style={[s.proName, selected && { color: colors.tealLight }]}>{pro.name}</Text>
      <Text style={s.proNote}>{pro.note}</Text>
    </TouchableOpacity>
  );
}

export default function CameraScreen({ navigation }) {
  const [clubType,      setClubType]      = useState('driver');
  const [proRef,        setProRef]        = useState('rory_mcilroy');
  const [uploading,     setUploading]     = useState(false);
  const [uploadPct,     setUploadPct]     = useState(0);

  const pickVideo = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission required', 'Please allow access to your photo library in Settings.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      videoMaxDuration: 30,
      quality: 0.8,
    });
    if (!result.canceled && result.assets?.[0]) {
      uploadSwing(result.assets[0].uri);
    }
  };

  const recordVideo = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission required', 'Please allow camera access in Settings.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      videoMaxDuration: 30,
      quality: 0.8,
    });
    if (!result.canceled && result.assets?.[0]) {
      uploadSwing(result.assets[0].uri);
    }
  };

  const uploadSwing = async (videoUri) => {
    setUploading(true);
    setUploadPct(0);
    navigation.navigate('Processing', { status: 'uploading' });
    try {
      const result = await analysis.analyzeSwing(
        videoUri,
        clubType,
        proRef,
        (pct) => setUploadPct(pct),
      );
      navigation.replace('Results', { analysisId: result.id, data: result });
    } catch (err) {
      navigation.goBack();
      const msg = err?.response?.data?.detail;
      if (msg?.includes('limit')) {
        Alert.alert('Monthly limit reached', 'Upgrade to Pro for unlimited swing analyses.', [
          { text: 'See Plans', onPress: () => navigation.navigate('Paywall') },
          { text: 'Cancel', style: 'cancel' },
        ]);
      } else {
        Alert.alert('Upload failed', msg || 'Something went wrong. Try again.');
      }
    } finally {
      setUploading(false);
    }
  };

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        <Text style={s.title}>Analyze Swing</Text>
        <Text style={s.sub}>Choose your club and a pro to compare against, then record or upload your swing.</Text>

        {/* Club selection */}
        <Text style={s.label}>Club type</Text>
        <View style={s.chips}>
          {CLUB_TYPES.map((c) => (
            <Chip
              key={c.id}
              label={c.label}
              emoji={c.emoji}
              selected={clubType === c.id}
              onPress={() => setClubType(c.id)}
            />
          ))}
        </View>

        {/* Pro selection */}
        <Text style={s.label}>Compare against</Text>
        {FALLBACK_PROS.map((p) => (
          <ProCard
            key={p.id}
            pro={p}
            selected={proRef === p.id}
            onPress={() => setProRef(p.id)}
          />
        ))}

        {/* Video buttons */}
        <Text style={s.label}>Your swing</Text>
        <TouchableOpacity style={s.btnRecord} onPress={recordVideo} disabled={uploading}>
          <Text style={s.btnRecordText}>🎥  Record Now</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.btnUpload} onPress={pickVideo} disabled={uploading}>
          <Text style={s.btnUploadText}>📂  Upload from Library</Text>
        </TouchableOpacity>

        <Text style={s.hint}>
          Tip: Film from directly down-the-line or face-on, landscape mode, at waist height. Keep the full body in frame.
        </Text>

      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: colors.bg },
  scroll:  { padding: spacing.lg, paddingBottom: 100 },
  title:   { fontSize: 26, fontWeight: '800', color: colors.white, marginBottom: 6 },
  sub:     { fontSize: 14, color: colors.grey2, lineHeight: 20, marginBottom: spacing.xl },
  label:   { fontSize: 13, fontWeight: '700', color: colors.tealLight, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: spacing.sm, marginTop: spacing.md },
  chips:   { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.sm },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.grey3,
    borderRadius: radius.full,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipSelected:      { borderColor: colors.teal, backgroundColor: colors.tealDim },
  chipEmoji:         { fontSize: 16 },
  chipLabel:         { fontSize: 14, color: colors.grey1 },
  chipLabelSelected: { color: colors.tealLight, fontWeight: '600' },
  proCard: {
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.grey3,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  proCardSelected: { borderColor: colors.teal, backgroundColor: colors.tealDim },
  proName:  { fontSize: 15, fontWeight: '700', color: colors.white, marginBottom: 4 },
  proNote:  { fontSize: 12, color: colors.grey2 },
  btnRecord: {
    backgroundColor: colors.teal,
    borderRadius: radius.md,
    paddingVertical: 18,
    alignItems: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  btnRecordText:  { color: colors.white, fontSize: 17, fontWeight: '700' },
  btnUpload: {
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.grey3,
    borderRadius: radius.md,
    paddingVertical: 18,
    alignItems: 'center',
  },
  btnUploadText: { color: colors.grey1, fontSize: 17, fontWeight: '600' },
  hint:   { fontSize: 12, color: colors.grey2, textAlign: 'center', marginTop: spacing.lg, lineHeight: 18 },
});
