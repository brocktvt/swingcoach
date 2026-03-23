import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, FlatList,
  TouchableOpacity, ActivityIndicator, RefreshControl,
} from 'react-native';
import { colors, spacing, radius } from '../theme';
import { analysis } from '../services/api';

function scoreColor(score) {
  if (score >= 80) return colors.success;
  if (score >= 60) return colors.warning;
  return colors.error;
}

function HistoryItem({ item, onPress, delta }) {
  const clubEmoji = { driver: '🏌️', iron: '⛳', wedge: '🎯', putter: '🕳️' };
  const date = new Date(item.created_at).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
  const color = scoreColor(item.overall_score);

  // delta: positive = improved, negative = dropped, null = oldest swing (no prior)
  const deltaColor = delta > 0 ? colors.success : delta < 0 ? colors.error : colors.grey2;
  const deltaLabel = delta == null ? null
    : delta === 0 ? '→'
    : delta > 0   ? `↑ +${delta}`
    : `↓ ${delta}`;

  return (
    <TouchableOpacity style={s.item} onPress={() => onPress(item)}>
      <View style={s.scoreCol}>
        <View style={[s.scoreBadge, { borderColor: color }]}>
          <Text style={[s.scoreText, { color }]}>{item.overall_score}</Text>
        </View>
        {deltaLabel && (
          <Text style={[s.deltaText, { color: deltaColor }]}>{deltaLabel}</Text>
        )}
      </View>
      <View style={s.itemInfo}>
        <Text style={s.itemClub}>
          {clubEmoji[item.club_type] || '🏌️'}{' '}
          {item.club_type?.charAt(0).toUpperCase() + item.club_type?.slice(1)} Swing
        </Text>
        <Text style={s.itemMeta}>vs {item.pro_name} · {date}</Text>
        <Text style={s.itemIssues}>
          {item.issue_count} issue{item.issue_count !== 1 ? 's' : ''} · {item.drill_count} drill{item.drill_count !== 1 ? 's' : ''}
        </Text>
      </View>
      <Text style={s.arrow}>›</Text>
    </TouchableOpacity>
  );
}

export default function HistoryScreen({ navigation }) {
  const [items,      setItems]      = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [empty,      setEmpty]      = useState(false);

  const load = useCallback(async (refresh = false) => {
    try {
      const data = await analysis.getHistory(50);
      const list = data.analyses || [];
      setItems(list);
      setEmpty(list.length === 0);
    } catch {
      setEmpty(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, []);

  const onRefresh = () => { setRefreshing(true); load(true); };

  const goToResult = (item) => {
    navigation.navigate('Analyze', {
      screen: 'Results',
      params: { analysisId: item.id },
    });
  };

  if (loading) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.centered}>
          <ActivityIndicator color={colors.tealLight} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <Text style={s.title}>Swing History</Text>
        <Text style={s.sub}>{items.length} analysis{items.length !== 1 ? 'es' : ''} total</Text>
      </View>
      {empty ? (
        <View style={s.centered}>
          <Text style={s.emptyEmoji}>🏌️</Text>
          <Text style={s.emptyTitle}>No swings yet</Text>
          <Text style={s.emptyBody}>Head to the Analyze tab to record your first swing.</Text>
          <TouchableOpacity style={s.btnGo} onPress={() => navigation.navigate('Analyze')}>
            <Text style={s.btnGoText}>Analyze a Swing</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={({ item, index }) => {
            // items are newest-first; delta = this score minus the previous (older) score
            const prev  = items[index + 1];
            const delta = prev ? item.overall_score - prev.overall_score : null;
            return <HistoryItem item={item} onPress={goToResult} delta={delta} />;
          }}
          contentContainerStyle={s.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.tealLight} />}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: colors.bg },
  centered:{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  header:  { padding: spacing.lg, paddingBottom: spacing.sm },
  title:   { fontSize: 26, fontWeight: '800', color: colors.white },
  sub:     { fontSize: 13, color: colors.grey2, marginTop: 4 },
  list:    { padding: spacing.lg, paddingTop: spacing.sm, paddingBottom: 100 },
  item: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.grey3,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  scoreCol:    { alignItems: 'center', width: 58 },
  scoreBadge:  { width: 52, height: 52, borderRadius: 26, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  scoreText:   { fontSize: 17, fontWeight: '800' },
  deltaText:   { fontSize: 11, fontWeight: '700', marginTop: 3 },
  itemInfo:    { flex: 1 },
  itemClub:    { fontSize: 15, fontWeight: '700', color: colors.white },
  itemMeta:    { fontSize: 12, color: colors.grey2, marginTop: 2 },
  itemIssues:  { fontSize: 12, color: colors.tealLight, marginTop: 2 },
  arrow:       { color: colors.grey2, fontSize: 22 },
  emptyEmoji:  { fontSize: 52, marginBottom: spacing.md },
  emptyTitle:  { fontSize: 18, fontWeight: '800', color: colors.white, marginBottom: 6 },
  emptyBody:   { fontSize: 13, color: colors.grey2, textAlign: 'center', marginBottom: spacing.lg },
  btnGo: {
    backgroundColor: colors.teal,
    borderRadius: radius.md,
    paddingHorizontal: spacing.xl,
    paddingVertical: 14,
  },
  btnGoText: { color: colors.white, fontWeight: '700', fontSize: 15 },
});
