import React, { useState } from 'react';
import {
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  TextInput,
  Image,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { Camera, ImagePlus, Zap, Image as ImageIcon } from 'lucide-react-native';
import { GlassCard } from '../../components/GlassCard';
import { MacroBar } from '../../components/MacroBar';
import { COLORS } from '../../constants/theme';
import { MealType } from '../../types/fitness';
import { analyzeMeal, analyzeMealImageOnDevice, MealAnalysisResult } from '../../services/gemini';
import { savePhotoLocally } from '../../services/storage';
import { saveLogEntry } from '../../db/database';

export const MEAL_TYPES: MealType[] = ['Breakfast', 'Lunch', 'Dinner', 'Snack'];

export default function LogScreen(): JSX.Element {
  const insets = useSafeAreaInsets();
  const [mealPhoto, setMealPhoto] = useState<string | null>(null);
  const [mealDescription, setMealDescription] = useState('');
  const [progressPhoto, setProgressPhoto] = useState<string | null>(null);
  const [mealType, setMealType] = useState<MealType>('Lunch');
  const [weight, setWeight] = useState('70.0');
  const [workout, setWorkout] = useState('');
  const [windDown, setWindDown] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [aiResult, setAiResult] = useState<MealAnalysisResult | null>(null);

  const takeMealPhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        const pickRes = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          quality: 0.8,
        });
        if (!pickRes.canceled && pickRes.assets[0]) {
          setMealPhoto(pickRes.assets[0].uri);
        }
        return;
      }
      const res = await ImagePicker.launchCameraAsync({ quality: 0.8 });
      if (!res.canceled && res.assets[0]) {
        setMealPhoto(res.assets[0].uri);
      }
    } catch {
      const pickRes = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
      });
      if (!pickRes.canceled && pickRes.assets[0]) {
        setMealPhoto(pickRes.assets[0].uri);
      }
    }
  };

  const pickMealFromGallery = async () => {
    try {
      const pickRes = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
      });
      if (!pickRes.canceled && pickRes.assets[0]) {
        setMealPhoto(pickRes.assets[0].uri);
      }
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to select image from gallery.');
    }
  };

  const takeProgressPhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        const pickRes = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          quality: 0.8,
        });
        if (!pickRes.canceled && pickRes.assets[0]) {
          setProgressPhoto(pickRes.assets[0].uri);
        }
        return;
      }
      const res = await ImagePicker.launchCameraAsync({ quality: 0.8 });
      if (!res.canceled && res.assets[0]) {
        setProgressPhoto(res.assets[0].uri);
      }
    } catch {
      const pickRes = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
      });
      if (!pickRes.canceled && pickRes.assets[0]) {
        setProgressPhoto(pickRes.assets[0].uri);
      }
    }
  };

  const handleAnalyzeAndLog = async () => {
    const hasPhoto = Boolean(mealPhoto);
    const hasDesc = Boolean(mealDescription && mealDescription.trim().length > 0);

    if (!hasPhoto && !hasDesc) {
      Alert.alert('Meal Info Required', 'Please snap a photo or describe your meal to analyze!');
      return;
    }

    try {
      setAnalyzing(true);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});

      const analysis = await analyzeMeal({
        imageUri: mealPhoto,
        mealDescription: mealDescription.trim(),
        mealType,
        workoutNotes: workout,
      });

      if (!analysis) {
        Alert.alert('Analysis Failed', 'Could not parse meal nutrients.');
        setAnalyzing(false);
        return;
      }

      setAiResult(analysis);

      // Save photos locally if available
      const savedMealUri = mealPhoto ? await savePhotoLocally(mealPhoto, 'meals') : null;
      const savedProgressUri = progressPhoto
        ? await savePhotoLocally(progressPhoto, 'progress')
        : null;

      // Validate weight parsing to avoid NaN
      const parsedWeight = weight ? parseFloat(weight) : null;
      const validWeight = parsedWeight !== null && !isNaN(parsedWeight) ? parsedWeight : null;

      // Save to SQLite
      const dateStr = new Date().toISOString().split('T')[0];
      await saveLogEntry({
        timestamp: new Date().toISOString(),
        date: dateStr,
        meal_type: mealType,
        calories: analysis.calories,
        protein_g: analysis.protein_g,
        carbs_g: analysis.carbs_g,
        fat_g: analysis.fat_g,
        weight_kg: validWeight,
        workout_notes: workout || null,
        wind_down: windDown || null,
        ai_feedback: analysis.feedback,
        meal_photo_uri: savedMealUri,
        progress_photo_uri: savedProgressUri,
      });

      // Reset form fields on success
      setMealPhoto(null);
      setMealDescription('');
      setProgressPhoto(null);
      setWorkout('');
      setWindDown('');

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      Alert.alert('Logged Successfully! 🔥', `Estimated ${analysis.calories} calories saved.`);
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to log entry.');
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 10 }]}
      testID="log-screen-scroll"
    >
      <Text style={styles.brandTitle}>FUEL 🔥</Text>
      <Text style={styles.brandSubtitle}>Scan · Describe · Analyze · Transform</Text>

      {/* Photo Capture Slots */}
      <View style={styles.photoRow}>
        <TouchableOpacity
          style={styles.photoBox}
          onPress={takeMealPhoto}
          testID="scan-meal-button"
        >
          {mealPhoto ? (
            <Image source={{ uri: mealPhoto }} style={styles.photoPreview} testID="meal-photo-preview" />
          ) : (
            <View style={styles.photoPlaceholder}>
              <Camera color={COLORS.primary} size={32} />
              <Text style={styles.photoText}>Scan Meal</Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.photoBox}
          onPress={takeProgressPhoto}
          testID="progress-selfie-button"
        >
          {progressPhoto ? (
            <Image source={{ uri: progressPhoto }} style={styles.photoPreview} testID="progress-photo-preview" />
          ) : (
            <View style={styles.photoPlaceholder}>
              <ImagePlus color={COLORS.secondary} size={32} />
              <Text style={styles.photoText}>Progress Selfie</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Gallery Fallback Action */}
      <View style={styles.galleryRow}>
        <TouchableOpacity
          style={styles.galleryButton}
          onPress={pickMealFromGallery}
          testID="gallery-picker-button"
        >
          <ImageIcon color={COLORS.textSecondary} size={16} />
          <Text style={styles.galleryButtonText}>Choose Meal from Gallery</Text>
        </TouchableOpacity>
      </View>

      {/* Meal Type & Details Card */}
      <GlassCard>
        <Text style={styles.sectionHeader}>Meal Type</Text>
        <View style={styles.pillsRow}>
          {MEAL_TYPES.map((t) => (
            <TouchableOpacity
              key={t}
              style={[styles.pill, mealType === t && styles.pillActive]}
              onPress={() => setMealType(t)}
              testID={`meal-type-${t.toLowerCase()}`}
            >
              <Text style={[styles.pillText, mealType === t && styles.pillTextActive]}>{t}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Meal Description Input */}
        <Text style={styles.inputLabel}>Describe Meal / Food Items</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={mealDescription}
          onChangeText={setMealDescription}
          placeholder="e.g. 2 eggs, 1 slice sourdough toast, avocado, black coffee..."
          placeholderTextColor={COLORS.textMuted}
          multiline
          numberOfLines={3}
          testID="meal-description-input"
        />

        {/* Inputs */}
        <Text style={styles.inputLabel}>Body Weight (kg)</Text>
        <TextInput
          style={styles.input}
          value={weight}
          onChangeText={setWeight}
          keyboardType="numeric"
          placeholder="70.0"
          placeholderTextColor={COLORS.textMuted}
          testID="weight-input"
        />

        <Text style={styles.inputLabel}>Workout Notes</Text>
        <TextInput
          style={styles.input}
          value={workout}
          onChangeText={setWorkout}
          placeholder="Leg day, 5km run..."
          placeholderTextColor={COLORS.textMuted}
          testID="workout-input"
        />

        <Text style={styles.inputLabel}>Wind-Down / Recovery Notes</Text>
        <TextInput
          style={styles.input}
          value={windDown}
          onChangeText={setWindDown}
          placeholder="Meditation, sauna, 8h sleep..."
          placeholderTextColor={COLORS.textMuted}
          testID="wind-down-input"
        />
      </GlassCard>

      {/* Action Button */}
      <TouchableOpacity
        style={[styles.actionBtn, analyzing && styles.actionBtnDisabled]}
        onPress={handleAnalyzeAndLog}
        disabled={analyzing}
        testID="analyze-log-button"
      >
        {analyzing ? (
          <ActivityIndicator color="#FFF" testID="loading-indicator" />
        ) : (
          <View style={styles.btnContent}>
            <Zap color="#FFF" size={20} />
            <Text style={styles.actionBtnText}>Analyze & Log with Gemini</Text>
          </View>
        )}
      </TouchableOpacity>

      {/* AI Results */}
      {aiResult && (
        <GlassCard style={styles.resultCard} testID="ai-result-card">
          <Text style={styles.calorieResult} testID="calorie-result-text">{aiResult.calories} kcal</Text>
          <MacroBar label="Protein" value={aiResult.protein_g} max={160} color="#10B981" />
          <MacroBar label="Carbohydrates" value={aiResult.carbs_g} max={250} color="#06B6D4" />
          <MacroBar label="Fat" value={aiResult.fat_g} max={70} color="#F59E0B" />

          <Text style={styles.insightsTitle}>💡 Gemini Insights</Text>
          {aiResult.feedback.map((point, idx) => (
            <Text key={idx} style={styles.feedbackPoint} testID={`feedback-item-${idx}`}>
              {point}
            </Text>
          ))}
        </GlassCard>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: 20, paddingBottom: 60 },
  brandTitle: { fontSize: 32, fontWeight: '800', color: COLORS.text, marginBottom: 2 },
  brandSubtitle: { fontSize: 14, color: COLORS.textSecondary, marginBottom: 20 },
  photoRow: { flexDirection: 'row', gap: 12, marginBottom: 10 },
  photoBox: {
    flex: 1,
    height: 140,
    backgroundColor: COLORS.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    overflow: 'hidden',
  },
  photoPreview: { width: '100%', height: '100%' },
  photoPlaceholder: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8 },
  photoText: { color: COLORS.textSecondary, fontSize: 12, fontWeight: '600' },
  galleryRow: { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 14 },
  galleryButton: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4 },
  galleryButtonText: { color: COLORS.textSecondary, fontSize: 12, fontWeight: '500' },
  sectionHeader: { color: COLORS.text, fontSize: 14, fontWeight: '700', marginBottom: 10 },
  pillsRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  pill: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
  },
  pillActive: { backgroundColor: COLORS.primary },
  pillText: { color: COLORS.textSecondary, fontSize: 12, fontWeight: '600' },
  pillTextActive: { color: '#000', fontWeight: '800' },
  inputLabel: { color: COLORS.textSecondary, fontSize: 12, fontWeight: '600', marginTop: 10, marginBottom: 4 },
  input: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    color: COLORS.text,
    padding: 12,
    fontSize: 14,
  },
  textArea: {
    minHeight: 70,
    textAlignVertical: 'top',
  },
  actionBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 20,
  },
  actionBtnDisabled: { opacity: 0.6 },
  btnContent: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  actionBtnText: { color: '#000', fontSize: 16, fontWeight: '800' },
  resultCard: { borderLeftWidth: 4, borderLeftColor: COLORS.primary },
  calorieResult: { color: COLORS.primary, fontSize: 28, fontWeight: '800', marginBottom: 8 },
  insightsTitle: { color: COLORS.text, fontSize: 15, fontWeight: '700', marginTop: 16, marginBottom: 8 },
  feedbackPoint: { color: COLORS.textSecondary, fontSize: 13, lineHeight: 20, marginVertical: 2 },
});
