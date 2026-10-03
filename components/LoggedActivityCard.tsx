import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Utensils, Dumbbell, Scale, Moon, Camera, CheckCircle2 } from 'lucide-react-native';
import { COLORS } from '../constants/theme';
import { ChatExtractedData } from '../types/fitness';

export interface LoggedActivityCardProps {
  data?: ChatExtractedData | null;
}

export function LoggedActivityCard({ data }: LoggedActivityCardProps): JSX.Element | null {
  if (!data || !data.has_data) {
    return null;
  }

  const { nutrition, workout, weight_kg, recovery, is_progress_photo } = data;

  return (
    <View style={styles.card} testID="logged-activity-card">
      <View style={styles.header}>
        <CheckCircle2 size={18} color={COLORS.success} />
        <Text style={styles.headerTitle}>✨ Logged to Fuel</Text>
      </View>

      {/* Nutrition Badge */}
      {nutrition && (
        <View style={styles.section} testID="nutrition-badge">
          <View style={styles.sectionHeader}>
            <Utensils size={15} color={COLORS.primary} />
            <Text style={styles.sectionTitle}>Nutrition</Text>
            <View style={styles.mealTypePill}>
              <Text style={styles.mealTypeText}>{nutrition.meal_type}</Text>
            </View>
            <Text style={styles.caloriesText}>{nutrition.calories} kcal</Text>
          </View>

          <View style={styles.macroRow}>
            <View style={[styles.macroPill, { borderColor: COLORS.success, backgroundColor: 'rgba(16, 185, 129, 0.1)' }]}>
              <Text style={[styles.macroPillText, { color: COLORS.success }]}>
                Protein: {nutrition.protein_g}g
              </Text>
            </View>
            <View style={[styles.macroPill, { borderColor: COLORS.primary, backgroundColor: 'rgba(6, 182, 212, 0.1)' }]}>
              <Text style={[styles.macroPillText, { color: COLORS.primary }]}>
                Carbs: {nutrition.carbs_g}g
              </Text>
            </View>
            <View style={[styles.macroPill, { borderColor: COLORS.warning, backgroundColor: 'rgba(245, 158, 11, 0.1)' }]}>
              <Text style={[styles.macroPillText, { color: COLORS.warning }]}>
                Fat: {nutrition.fat_g}g
              </Text>
            </View>
          </View>

          {Array.isArray(nutrition.food_items) && nutrition.food_items.length > 0 && (
            <Text style={styles.foodItemsText}>
              Items: {nutrition.food_items.join(', ')}
            </Text>
          )}
        </View>
      )}

      {/* Workout Badge */}
      {workout && (
        <View style={styles.section} testID="workout-badge">
          <View style={styles.sectionHeader}>
            <Dumbbell size={15} color={COLORS.primary} />
            <Text style={styles.sectionTitle}>Workout</Text>
            {workout.duration_mins != null && (
              <View style={styles.durationPill}>
                <Text style={styles.durationText}>{workout.duration_mins} mins</Text>
              </View>
            )}
          </View>
          <Text style={styles.detailText}>{workout.workout_notes}</Text>
        </View>
      )}

      {/* Body Weight Badge */}
      {weight_kg != null && (
        <View style={styles.section} testID="weight-badge">
          <View style={styles.sectionHeader}>
            <Scale size={15} color={COLORS.primary} />
            <Text style={styles.sectionTitle}>Body Weight</Text>
            <Text style={styles.highlightText}>{weight_kg} kg</Text>
          </View>
        </View>
      )}

      {/* Recovery Badge */}
      {recovery && (
        <View style={styles.section} testID="recovery-badge">
          <View style={styles.sectionHeader}>
            <Moon size={15} color="#A78BFA" />
            <Text style={styles.sectionTitle}>Recovery</Text>
          </View>
          <Text style={styles.detailText}>{recovery.wind_down}</Text>
        </View>
      )}

      {/* Progress Vault Badge */}
      {is_progress_photo && (
        <View style={styles.section} testID="progress-vault-badge">
          <View style={styles.sectionHeader}>
            <Camera size={15} color={COLORS.primary} />
            <Text style={styles.detailText}>Saved to Progress Vault 🔒</Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    padding: 14,
    marginVertical: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  headerTitle: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '700',
  },
  section: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.04)',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  sectionTitle: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  mealTypePill: {
    backgroundColor: 'rgba(6, 182, 212, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 4,
  },
  mealTypeText: {
    color: COLORS.primary,
    fontSize: 11,
    fontWeight: '600',
  },
  caloriesText: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '700',
    marginLeft: 'auto',
  },
  macroRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  macroPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  macroPillText: {
    fontSize: 11,
    fontWeight: '600',
  },
  foodItemsText: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginTop: 6,
    fontStyle: 'italic',
  },
  durationPill: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 'auto',
  },
  durationText: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: '500',
  },
  highlightText: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '700',
    marginLeft: 'auto',
  },
  detailText: {
    color: COLORS.text,
    fontSize: 13,
    marginTop: 4,
  },
});
