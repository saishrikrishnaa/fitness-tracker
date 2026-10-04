import React, { useState, useCallback, useMemo } from 'react';
import {
  ScrollView,
  View,
  Text,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Trash2, Sparkles } from 'lucide-react-native';
import { GlassCard } from '../../components/GlassCard';
import { COLORS } from '../../constants/theme';
import { FitnessLogEntry } from '../../types/fitness';
import { getLogEntries, deleteLogEntry, deduplicateFitnessLogs } from '../../db/database';

function parseDateParts(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function formatDateParts(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function calculateDailyAverages(logs: FitnessLogEntry[]): number {
  if (!logs || logs.length === 0) return 0;
  const dayTotals: { [date: string]: number } = {};
  for (const log of logs) {
    dayTotals[log.date] = (dayTotals[log.date] || 0) + (log.calories || 0);
  }
  const totals = Object.values(dayTotals);
  if (totals.length === 0) return 0;
  return totals.reduce((a, b) => a + b, 0) / totals.length;
}

export function calculateStreak(logs: FitnessLogEntry[], referenceDateStr?: string): number {
  if (!logs || logs.length === 0) return 0;
  const loggedDates = new Set(logs.map((l) => l.date));

  let refDate: Date;
  if (referenceDateStr) {
    refDate = parseDateParts(referenceDateStr);
  } else {
    const now = new Date();
    refDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }

  const todayStr = formatDateParts(refDate);

  if (loggedDates.has(todayStr)) {
    let streak = 0;
    const d = new Date(refDate);
    while (loggedDates.has(formatDateParts(d))) {
      streak++;
      d.setDate(d.getDate() - 1);
    }
    return streak;
  }

  const yesterday = new Date(refDate);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = formatDateParts(yesterday);

  if (loggedDates.has(yesterdayStr)) {
    let streak = 0;
    const d = new Date(yesterday);
    while (loggedDates.has(formatDateParts(d))) {
      streak++;
      d.setDate(d.getDate() - 1);
    }
    return streak;
  }

  return 0;
}

export default function AnalyticsScreen(): JSX.Element {
  const insets = useSafeAreaInsets();
  const [logs, setLogs] = useState<FitnessLogEntry[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [isDeduplicating, setIsDeduplicating] = useState(false);

  const loadData = useCallback(async () => {
    try {
      await deduplicateFitnessLogs().catch(() => 0);
      const data = await getLogEntries();
      setLogs(data);
    } catch {
      // Gracefully retain existing state on error
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleDeleteLog = (id: number) => {
    Alert.alert(
      'Delete Log Entry',
      'Are you sure you want to remove this log from your history?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteLogEntry(id);
              await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
              await loadData();
            } catch (err: any) {
              Alert.alert('Error', err?.message || 'Failed to delete log entry.');
            }
          },
        },
      ]
    );
  };

  const handleManualDeduplicate = async () => {
    try {
      setIsDeduplicating(true);
      const removedCount = await deduplicateFitnessLogs();
      await loadData();
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      if (removedCount > 0) {
        Alert.alert('Logs Deduplicated', `Successfully removed ${removedCount} duplicate log ${removedCount === 1 ? 'entry' : 'entries'}.`);
      } else {
        Alert.alert('Logs Clean', 'No duplicate log entries found.');
      }
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to deduplicate logs.');
    } finally {
      setIsDeduplicating(false);
    }
  };

  const mealLogs = useMemo(() => logs.filter((l) => (l.calories && l.calories > 0) || l.meal_type), [logs]);
  const avgCalories = useMemo(() => calculateDailyAverages(logs), [logs]);
  const streak = useMemo(() => calculateStreak(logs), [logs]);
  const latestWeight = useMemo(
    () => logs.find((l) => l.weight_kg !== null && l.weight_kg !== undefined)?.weight_kg,
    [logs]
  );

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 10 }]}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={COLORS.primary}
        />
      }
      testID="analytics-scroll"
    >
      <View style={styles.headerRow}>
        <View style={styles.headerTextContainer}>
          <Text style={styles.title}>Analytics 📊</Text>
          <Text style={styles.subtitle}>Daily metrics & intake progression</Text>
        </View>
        <TouchableOpacity
          style={styles.dedupBtn}
          onPress={handleManualDeduplicate}
          disabled={isDeduplicating}
          testID="deduplicate-logs-btn"
        >
          <Sparkles size={16} color={COLORS.primary} />
          <Text style={styles.dedupBtnText}>Deduplicate</Text>
        </TouchableOpacity>
      </View>

      {/* Metrics Row 1 */}
      <View style={styles.metricRow}>
        <GlassCard style={styles.metricCard}>
          <Text style={styles.metricLabel}>Total Meals</Text>
          <Text style={styles.metricValue}>{mealLogs.length}</Text>
        </GlassCard>

        <GlassCard style={styles.metricCard}>
          <Text style={styles.metricLabel}>Avg Calories</Text>
          <Text style={styles.metricValue}>{avgCalories > 0 ? `${avgCalories.toFixed(0)} kcal` : '0 kcal'}</Text>
        </GlassCard>
      </View>

      {/* Metrics Row 2 */}
      <View style={styles.metricRow}>
        <GlassCard style={styles.metricCard}>
          <Text style={styles.metricLabel}>Latest Weight</Text>
          <Text style={styles.metricValue}>{latestWeight !== undefined && latestWeight !== null ? `${latestWeight} kg` : 'N/A'}</Text>
        </GlassCard>

        <GlassCard style={styles.metricCard}>
          <Text style={styles.metricLabel}>Streak</Text>
          <Text style={styles.metricValue}>🔥 {streak} {streak === 1 ? 'Day' : 'Days'}</Text>
        </GlassCard>
      </View>

      {/* Recent History Breakdown */}
      <Text style={styles.sectionHeader}>Recent Logs</Text>
      {logs.length === 0 ? (
        <GlassCard>
          <Text style={styles.emptyText}>No logs yet. Head to Log tab to record your first meal!</Text>
        </GlassCard>
      ) : (
        logs.slice(0, 20).map((log) => (
          <GlassCard key={log.id} style={styles.logCard}>
            <View style={styles.logHeader}>
              <View style={styles.logHeaderLeft}>
                <Text style={styles.logMealType}>{log.meal_type}</Text>
                <Text style={styles.logDate}>{log.date}</Text>
              </View>
              <TouchableOpacity
                style={styles.deleteBtn}
                onPress={() => handleDeleteLog(log.id)}
                testID={`delete-log-${log.id}`}
              >
                <Trash2 size={16} color={COLORS.textMuted} />
              </TouchableOpacity>
            </View>
            <Text style={styles.logCalories}>{log.calories} kcal</Text>
            <Text style={styles.logMacros}>
              P: {log.protein_g}g · C: {log.carbs_g}g · F: {log.fat_g}g
            </Text>
            {log.weight_kg !== null && log.weight_kg !== undefined && (
              <Text style={styles.logNotes}>⚖️ {log.weight_kg} kg</Text>
            )}
            {log.workout_notes ? (
              <Text style={styles.logNotes}>🏋️ {log.workout_notes}</Text>
            ) : null}
            {log.wind_down ? (
              <Text style={styles.logNotes}>🌙 {log.wind_down}</Text>
            ) : null}
          </GlassCard>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: 20, paddingBottom: 60 },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  headerTextContainer: {
    flex: 1,
  },
  title: { fontSize: 32, fontWeight: '800', color: COLORS.text, marginBottom: 2 },
  subtitle: { fontSize: 14, color: COLORS.textSecondary },
  dedupBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(6, 182, 212, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(6, 182, 212, 0.25)',
    marginTop: 4,
  },
  dedupBtnText: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  metricRow: { flexDirection: 'row', gap: 12, marginBottom: 4 },
  metricCard: { flex: 1, padding: 16, alignItems: 'center' },
  metricLabel: { color: COLORS.textSecondary, fontSize: 12, fontWeight: '600', marginBottom: 6 },
  metricValue: { color: COLORS.primary, fontSize: 18, fontWeight: '800' },
  sectionHeader: { color: COLORS.text, fontSize: 16, fontWeight: '700', marginTop: 16, marginBottom: 12 },
  emptyText: { color: COLORS.textSecondary, textAlign: 'center', padding: 20, fontSize: 14 },
  logCard: { padding: 16, marginBottom: 12 },
  logHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  logHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logMealType: { color: COLORS.primary, fontSize: 14, fontWeight: '700' },
  logDate: { color: COLORS.textMuted, fontSize: 12 },
  deleteBtn: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  logCalories: { color: COLORS.text, fontSize: 20, fontWeight: '800' },
  logMacros: { color: COLORS.textSecondary, fontSize: 13, marginTop: 4 },
  logNotes: { color: COLORS.textMuted, fontSize: 12, marginTop: 6 },
});
