import * as FileSystem from 'expo-file-system';
import { getApiKey } from './secureStore';
import { ChatExtractedData, CoachAnalysisResponse, DailyFitnessSummary } from '../types/fitness';

export interface MealAnalysisResult {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  feedback: string[];
}

export function getMimeType(uri: string): string {
  const clean = uri.toLowerCase();
  if (clean.endsWith('.png')) return 'image/png';
  if (clean.endsWith('.webp')) return 'image/webp';
  if (clean.endsWith('.heic')) return 'image/heic';
  return 'image/jpeg';
}

export function parseGeminiResponse(jsonText: string): MealAnalysisResult | null {
  try {
    const cleanText = jsonText.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleanText);
    return {
      calories: Number(parsed.calories) || 0,
      protein_g: Number(parsed.protein_g) || 0,
      carbs_g: Number(parsed.carbs_g) || 0,
      fat_g: Number(parsed.fat_g) || 0,
      feedback: Array.isArray(parsed.feedback) ? parsed.feedback : [],
    };
  } catch {
    return null;
  }
}

export function parseCoachResponse(jsonText: string): CoachAnalysisResponse | null {
  if (!jsonText || typeof jsonText !== 'string') {
    return null;
  }
  const cleanText = jsonText.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim();
  try {
    const parsed = JSON.parse(cleanText);
    const coach_response = typeof parsed.coach_response === 'string' ? parsed.coach_response : cleanText;
    const rawExtracted = parsed.extracted_data;

    if (!rawExtracted || typeof rawExtracted !== 'object') {
      return {
        coach_response,
        extracted_data: { has_data: false },
      };
    }

    const extracted_data: ChatExtractedData = {
      has_data: Boolean(rawExtracted.has_data),
      action: rawExtracted.action || (rawExtracted.has_data ? 'update' : 'none'),
      is_new_log: rawExtracted.is_new_log !== undefined ? Boolean(rawExtracted.is_new_log) : Boolean(rawExtracted.has_data),
    };

    if (rawExtracted.nutrition && typeof rawExtracted.nutrition === 'object') {
      extracted_data.nutrition = {
        meal_type: rawExtracted.nutrition.meal_type || 'Lunch',
        calories: Number(rawExtracted.nutrition.calories) || 0,
        protein_g: Number(rawExtracted.nutrition.protein_g) || 0,
        carbs_g: Number(rawExtracted.nutrition.carbs_g) || 0,
        fat_g: Number(rawExtracted.nutrition.fat_g) || 0,
        food_items: Array.isArray(rawExtracted.nutrition.food_items)
          ? rawExtracted.nutrition.food_items.map(String)
          : undefined,
      };
    } else {
      extracted_data.nutrition = null;
    }

    if (rawExtracted.workout && typeof rawExtracted.workout === 'object') {
      extracted_data.workout = {
        workout_notes: String(rawExtracted.workout.workout_notes || ''),
        duration_mins:
          rawExtracted.workout.duration_mins != null && !isNaN(Number(rawExtracted.workout.duration_mins))
            ? Number(rawExtracted.workout.duration_mins)
            : null,
      };
    } else {
      extracted_data.workout = null;
    }

    if (rawExtracted.weight_kg != null && !isNaN(Number(rawExtracted.weight_kg))) {
      extracted_data.weight_kg = Number(rawExtracted.weight_kg);
    } else {
      extracted_data.weight_kg = null;
    }

    if (rawExtracted.recovery && typeof rawExtracted.recovery === 'object') {
      extracted_data.recovery = {
        wind_down: String(rawExtracted.recovery.wind_down || ''),
      };
    } else {
      extracted_data.recovery = null;
    }

    extracted_data.is_progress_photo = Boolean(rawExtracted.is_progress_photo);

    if (rawExtracted.daily_totals && typeof rawExtracted.daily_totals === 'object') {
      extracted_data.daily_totals = {
        total_calories: Number(rawExtracted.daily_totals.total_calories) || 0,
        total_protein: Number(rawExtracted.daily_totals.total_protein) || 0,
        total_carbs: Number(rawExtracted.daily_totals.total_carbs) || 0,
        total_fat: Number(rawExtracted.daily_totals.total_fat) || 0,
      };
    }

    return {
      coach_response,
      extracted_data,
    };
  } catch {
    return {
      coach_response: cleanText,
      extracted_data: { has_data: false },
    };
  }
}

export const VISION_MODELS = [
  'gemini-1.5-flash',
  'gemini-1.5-flash-latest',
  'gemini-1.5-pro',
  'gemini-2.0-flash',
  'gemini-1.5-flash-8b',
];

export const TEXT_MODELS = [
  'gemini-1.5-flash',
  'gemini-1.5-flash-latest',
  'gemini-1.5-pro',
  'gemini-2.0-flash',
  'gemini-pro',
];

export const FALLBACK_MODELS = VISION_MODELS;

export async function getAvailableGeminiModels(
  apiKey: string,
  requiresImage: boolean = false
): Promise<string[]> {
  try {
    const signal = typeof AbortSignal?.timeout === 'function' ? AbortSignal.timeout(8000) : undefined;
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`, { signal });
    if (!res.ok) return requiresImage ? VISION_MODELS : TEXT_MODELS;

    const data = await res.json();
    if (!Array.isArray(data.models)) return requiresImage ? VISION_MODELS : TEXT_MODELS;

    const available = data.models
      .filter((m: any) => Array.isArray(m.supportedGenerationMethods) && m.supportedGenerationMethods.includes('generateContent'))
      .map((m: any) => m.name.replace(/^models\//, ''))
      .filter((name: string) => {
        const lower = name.toLowerCase();
        if (!lower.includes('gemini') || lower.includes('embedding') || lower.includes('2.5')) {
          return false;
        }
        if (requiresImage) {
          // gemini-pro and gemini-1.0-pro are text-only models
          if (lower === 'gemini-pro' || lower.includes('1.0-pro') || lower.includes('ultra')) {
            return false;
          }
        }
        return true;
      });

    // Sort to prioritize stable 1.5-flash, then 2.0-flash, then 1.5-pro, then gemini-pro
    available.sort((a: string, b: string) => {
      const getRank = (name: string) => {
        if (name === 'gemini-1.5-flash' || name === 'gemini-1.5-flash-latest') return 10;
        if (name.includes('1.5-flash')) return 9;
        if (name === 'gemini-2.0-flash' || name.includes('2.0-flash')) return 8;
        if (name.includes('1.5-pro')) return 7;
        if (name === 'gemini-pro') return 6;
        return 1;
      };
      return getRank(b) - getRank(a);
    });

    if (available.length > 0) return available;
    return requiresImage ? VISION_MODELS : TEXT_MODELS;
  } catch {
    return requiresImage ? VISION_MODELS : TEXT_MODELS;
  }
}

export interface AnalyzeMealParams {
  imageUri?: string | null;
  mealDescription?: string | null;
  mealType: string;
  workoutNotes?: string | null;
}

export async function analyzeMeal(
  params: AnalyzeMealParams
): Promise<MealAnalysisResult | null> {
  const { imageUri, mealDescription, mealType, workoutNotes } = params;
  const apiKey = await getApiKey();
  if (!apiKey) {
    throw new Error('Missing Gemini API Key. Please configure it in Settings.');
  }

  const hasPhoto = Boolean(imageUri);
  const hasDescription = Boolean(mealDescription && mealDescription.trim().length > 0);

  if (!hasPhoto && !hasDescription) {
    throw new Error('Please take a photo or enter a meal description to analyze.');
  }

  let base64Image: string | null = null;
  let mimeType = 'image/jpeg';

  if (imageUri) {
    base64Image = await FileSystem.readAsStringAsync(imageUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    mimeType = getMimeType(imageUri);
  }

  const prompt = `
  You are an expert sports nutritionist and physique coach.
  Analyze the nutritional value of this meal.
  - Meal Type: ${mealType}
  ${hasDescription ? `- Meal Description & Ingredients: "${mealDescription?.trim()}"` : ''}
  - Workout & Activity Context: ${workoutNotes || 'None specified'}

  Provide estimated total calories and macronutrients (protein, carbs, fat in grams).
  Provide 3 brief, actionable fitness coaching bullet points starting with emojis:
  - First point (✅): positive nutrition highlight
  - Second point (⚠️): macro balance or ingredient caution
  - Third point (💡): optimization or timing tip

  Return strict JSON with this exact schema:
  {
    "calories": number (estimated total calories),
    "protein_g": number (grams of protein),
    "carbs_g": number (grams of carbs),
    "fat_g": number (grams of fat),
    "feedback": [string, string, string]
  }
  `;

  const modelsToTry = await getAvailableGeminiModels(apiKey, hasPhoto);
  let lastError: Error | null = null;

  for (const model of modelsToTry) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const signal = typeof AbortSignal?.timeout === 'function' ? AbortSignal.timeout(30000) : undefined;

    try {
      const parts: any[] = [{ text: prompt }];
      if (base64Image) {
        parts.push({
          inline_data: {
            mime_type: mimeType,
            data: base64Image,
          },
        });
      }

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal,
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: {
            response_mime_type: 'application/json',
          },
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        if (errText.includes('API_KEY_INVALID') || response.status === 401) {
          throw new Error('Invalid Gemini API Key. Please verify your API key in Settings.');
        }

        // Catch image modality errors or model 404/400 and cascade
        lastError = new Error(`Gemini ${model} error (${response.status}): ${errText}`);
        continue;
      }

      const data = await response.json();
      const textContent = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!textContent) return null;

      return parseGeminiResponse(textContent);
    } catch (err: any) {
      lastError = err;
      if (err.message?.includes('Invalid Gemini API Key')) {
        throw err;
      }
      continue;
    }
  }

  throw lastError || new Error('All Gemini model candidates failed. Please verify your API key in Settings.');
}

export async function analyzeMealImageOnDevice(
  imageUri: string,
  mealType: string,
  workoutNotes?: string | null
): Promise<MealAnalysisResult | null> {
  return analyzeMeal({
    imageUri,
    mealType,
    workoutNotes,
  });
}

export function buildCoachSystemPrompt(summary?: DailyFitnessSummary | null): string {
  let dailyContext = '';
  if (summary) {
    dailyContext = `
CURRENT LIVE LOGGED STATUS FOR TODAY (${summary.date}):
- Breakfast Slot: ${summary.breakfast ? `${summary.breakfast.calories} kcal (Protein: ${summary.breakfast.protein_g}g, Carbs: ${summary.breakfast.carbs_g}g, Fat: ${summary.breakfast.fat_g}g)` : 'Not logged yet'}
- Lunch Slot: ${summary.lunch ? `${summary.lunch.calories} kcal (Protein: ${summary.lunch.protein_g}g, Carbs: ${summary.lunch.carbs_g}g, Fat: ${summary.lunch.fat_g}g)` : 'Not logged yet'}
- Dinner Slot: ${summary.dinner ? `${summary.dinner.calories} kcal (Protein: ${summary.dinner.protein_g}g, Carbs: ${summary.dinner.carbs_g}g, Fat: ${summary.dinner.fat_g}g)` : 'Not logged yet'}
- Snack Slot: ${summary.snack ? `${summary.snack.calories} kcal (Protein: ${summary.snack.protein_g}g, Carbs: ${summary.snack.carbs_g}g, Fat: ${summary.snack.fat_g}g)` : 'None'}
- Today's Total Macros: ${summary.totalCalories} kcal (Protein: ${summary.totalProtein}g, Carbs: ${summary.totalCarbs}g, Fat: ${summary.totalFat}g)
- Recorded Weight: ${summary.weight_kg !== null && summary.weight_kg !== undefined ? `${summary.weight_kg} kg` : 'None'}
- Recorded Workout: ${summary.workout_notes || 'None'}
`;
  }

  return `You are "Fuel Coach", an expert sports nutritionist, elite fitness trainer, and encouraging physique coach.
You have direct read and write access to the user's daily fitness logs dashboard.
${dailyContext}
3-Meal Slots Architecture:
Each day has exactly 3 primary meal slots: 'Breakfast', 'Lunch', 'Dinner' (and an optional 'Snack').
When the user reports food, workout, or weight:
1. If the user tells you about food for a meal slot (e.g. Breakfast), extract the full updated calories and macros for that slot. If they had previous items in that slot today (see CURRENT LIVE LOGGED STATUS) and are adding items or revising it, compute the cumulative total for that meal slot.
2. In your coach_response, confirm what was logged/updated and explicitly tell the user their new daily total calories and remaining target.
3. If the user is just asking a question (e.g. "how many calories in eggs?", "what recipe can I make?"), discussing past context, or general chatting without logging, set has_data: false and is_new_log: false.

Return ONLY a valid JSON object matching this schema:
{
  "coach_response": string,
  "extracted_data": {
    "has_data": boolean,
    "action": "create" | "update" | "none",
    "is_new_log": boolean,
    "nutrition": {
      "meal_type": "Breakfast" | "Lunch" | "Dinner" | "Snack",
      "calories": number,
      "protein_g": number,
      "carbs_g": number,
      "fat_g": number,
      "food_items": string[]
    } | null,
    "workout": {
      "workout_notes": string,
      "duration_mins": number | null
    } | null,
    "weight_kg": number | null,
    "recovery": {
      "wind_down": string
    } | null,
    "is_progress_photo": boolean,
    "daily_totals": {
      "total_calories": number,
      "total_protein": number,
      "total_carbs": number,
      "total_fat": number
    } | null
  }
}`;
}

export const COACH_SYSTEM_PROMPT = buildCoachSystemPrompt(null);

export async function sendChatMessageToCoach(
  message: string,
  imageUris?: string[] | string | null,
  history?: { role: 'user' | 'model'; text: string }[],
  dailySummary?: DailyFitnessSummary | null
): Promise<CoachAnalysisResponse> {
  const apiKey = await getApiKey();
  if (!apiKey) {
    throw new Error('Missing Gemini API Key. Please configure it in Settings.');
  }

  const normalizedUris: string[] = Array.isArray(imageUris)
    ? imageUris.filter((u) => Boolean(u && typeof u === 'string'))
    : imageUris
    ? [imageUris]
    : [];

  const hasPhotos = normalizedUris.length > 0;
  const hasMessage = Boolean(message && message.trim().length > 0);

  if (!hasPhotos && !hasMessage) {
    throw new Error('Please provide a message or photo to send to Fuel Coach.');
  }

  const currentParts: any[] = [];

  for (const uri of normalizedUris) {
    const base64Image = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    const mimeType = getMimeType(uri);
    currentParts.push({
      inline_data: {
        mime_type: mimeType,
        data: base64Image,
      },
    });
  }

  if (hasMessage) {
    currentParts.push({ text: message });
  } else if (hasPhotos) {
    currentParts.push({ text: 'Analyze the attached photos and provide fitness coaching advice.' });
  }

  const contents: any[] = [];
  if (history && history.length > 0) {
    for (const h of history) {
      if (h.text && h.text.trim().length > 0) {
        contents.push({
          role: h.role,
          parts: [{ text: h.text }],
        });
      }
    }
  }

  contents.push({
    role: 'user',
    parts: currentParts,
  });

  const modelsToTry = await getAvailableGeminiModels(apiKey, hasPhotos);
  let lastError: Error | null = null;
  const promptText = buildCoachSystemPrompt(dailySummary);

  for (const model of modelsToTry) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const signal = typeof AbortSignal?.timeout === 'function' ? AbortSignal.timeout(30000) : undefined;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal,
        body: JSON.stringify({
          system_instruction: {
            parts: [{ text: promptText }],
          },
          contents,
          generationConfig: {
            response_mime_type: 'application/json',
          },
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        if (errText.includes('API_KEY_INVALID') || response.status === 401) {
          throw new Error('Invalid Gemini API Key. Please verify your API key in Settings.');
        }

        lastError = new Error(`Gemini ${model} error (${response.status}): ${errText}`);
        continue;
      }

      const data = await response.json();
      const textContent = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!textContent) {
        lastError = new Error(`Gemini ${model} returned empty response`);
        continue;
      }

      const parsed = parseCoachResponse(textContent);
      if (parsed) {
        return parsed;
      }
      return {
        coach_response: textContent,
        extracted_data: { has_data: false },
      };
    } catch (err: any) {
      lastError = err;
      if (err.message?.includes('Invalid Gemini API Key')) {
        throw err;
      }
      continue;
    }
  }

  throw lastError || new Error('All Gemini model candidates failed. Please verify your API key in Settings.');
}
