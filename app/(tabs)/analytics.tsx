import React, { useEffect, useState } from 'react';
import {
  ScrollView,
  View,
  Text,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GlassCard } from '../../components/GlassCard';
import { COLORS } from '../../constants/theme';
import { FitnessLogEntry } from '../../types/fitness';
import { getLogEntries } from '../../db/database';

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

  const loadData = async () => {
    try {
      const data = await getLogEntries();
      setLogs(data);
    } catch {
      // Gracefully retain existing state on error
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const avgCalories = calculateDailyAverages(logs);
  const streak = calculateStreak(logs);
  const latestWeight = logs.find((l) => l.weight_kg !== null && l.weight_kg !== undefined)?.weight_kg;

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
      <Text style={styles.title}>Analytics 📊</Text>
      <Text style={styles.subtitle}>Daily metrics & intake progression</Text>

      {/* Metrics Row 1 */}
      <View style={styles.metricRow}>
        <GlassCard style={styles.metricCard}>
          <Text style={styles.metricLabel}>Total Meals</Text>
          <Text style={styles.metricValue}>{logs.length}</Text>
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
        logs.slice(0, 15).map((log) => (
          <GlassCard key={log.id} style={styles.logCard}>
            <View style={styles.logHeader}>
              <Text style={styles.logMealType}>{log.meal_type}</Text>
              <Text style={styles.logDate}>{log.date}</Text>
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
  title: { fontSize: 32, fontWeight: '800', color: COLORS.text, marginBottom: 2 },
  subtitle: { fontSize: 14, color: COLORS.textSecondary, marginBottom: 20 },
  metricRow: { flexDirection: 'row', gap: 12, marginBottom: 4 },
  metricCard: { flex: 1, padding: 16, alignItems: 'center' },
  metricLabel: { color: COLORS.textSecondary, fontSize: 12, fontWeight: '600', marginBottom: 6 },
  metricValue: { color: COLORS.primary, fontSize: 18, fontWeight: '800' },
  sectionHeader: { color: COLORS.text, fontSize: 16, fontWeight: '700', marginTop: 16, marginBottom: 12 },
  emptyText: { color: COLORS.textSecondary, textAlign: 'center', padding: 20, fontSize: 14 },
  logCard: { padding: 16, marginBottom: 12 },
  logHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  logMealType: { color: COLORS.primary, fontSize: 14, fontWeight: '700' },
  logDate: { color: COLORS.textMuted, fontSize: 12 },
  logCalories: { color: COLORS.text, fontSize: 20, fontWeight: '800' },
  logMacros: { color: COLORS.textSecondary, fontSize: 13, marginTop: 4 },
  logNotes: { color: COLORS.textMuted, fontSize: 12, marginTop: 6 },
});
