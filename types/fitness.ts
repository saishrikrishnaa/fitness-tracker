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

export interface DailyFitnessSummary {
  date: string;
  breakfast: FitnessLogEntry | null;
  lunch: FitnessLogEntry | null;
  dinner: FitnessLogEntry | null;
  snack: FitnessLogEntry | null;
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
  weight_kg: number | null;
  workout_notes: string | null;
  wind_down: string | null;
}

export interface ChatSession {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface ChatExtractedData {
  has_data: boolean;
  action?: 'create' | 'update' | 'none';
  is_new_log?: boolean;
  nutrition?: {
    meal_type: MealType;
    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
    food_items?: string[];
  } | null;
  workout?: {
    workout_notes: string;
    duration_mins?: number | null;
  } | null;
  weight_kg?: number | null;
  recovery?: {
    wind_down: string;
  } | null;
  is_progress_photo?: boolean;
  daily_totals?: {
    total_calories: number;
    total_protein: number;
    total_carbs: number;
    total_fat: number;
  } | null;
}

export interface ChatMessage {
  id: number;
  session_id?: string;
  sender: 'user' | 'coach';
  text: string;
  image_uri: string | null;
  image_uris?: string[];
  extracted_data: ChatExtractedData | null;
  created_at: string;
}

export interface NewChatMessage {
  session_id?: string;
  sender: 'user' | 'coach';
  text: string;
  image_uri?: string | null;
  image_uris?: string[];
  extracted_data?: ChatExtractedData | null;
}

export interface CoachAnalysisResponse {
  coach_response: string;
  extracted_data: ChatExtractedData;
}
