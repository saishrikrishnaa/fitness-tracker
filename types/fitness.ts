export type MealType = 'Breakfast' | 'Lunch' | 'Dinner' | 'Snack';

export interface FitnessLogEntry {
  id: number;
  timestamp: string;
  date: string;
  meal_type: MealType;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  weight_kg: number | null;
  workout_notes: string | null;
  wind_down: string | null;
  ai_feedback: string[];
  meal_photo_uri: string | null;
  progress_photo_uri: string | null;
  created_at: string;
}

export interface NewFitnessLog {
  timestamp: string;
  date: string;
  meal_type: MealType;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  weight_kg?: number | null;
  workout_notes?: string | null;
  wind_down?: string | null;
  ai_feedback: string[];
  meal_photo_uri?: string | null;
  progress_photo_uri?: string | null;
}
