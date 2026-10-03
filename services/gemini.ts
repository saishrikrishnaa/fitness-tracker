import * as FileSystem from 'expo-file-system';
import { getApiKey } from './secureStore';
import { ChatExtractedData, CoachAnalysisResponse } from '../types/fitness';

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
    };

    if (rawExtracted.nutrition && typeof rawExtracted.nutrition === 'object') {
      extracted_data.nutrition = {
        meal_type: rawExtracted.nutrition.meal_type || 'Snack',
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

export const COACH_SYSTEM_PROMPT = `You are "Fuel Coach", an expert sports nutritionist, elite fitness trainer, and encouraging physique coach.
Your job is to:
1. Give warm, actionable, concise, motivating fitness advice or answer questions.
2. Extract any fitness/nutrition data mentioned by the user or visible in the image into structured JSON buckets.

Rules for extraction:
- Nutrition: If the user ate or shows food, estimate meal_type ('Breakfast'|'Lunch'|'Dinner'|'Snack'), total calories, protein_g, carbs_g, fat_g, and list of food_items.
- Workout: If the user describes an exercise, workout, or training session, extract workout_notes and optional duration_mins.
- Weight: If body weight is mentioned (e.g. "78.5 kg" or "175 lbs" converted to kg), extract weight_kg (as a number in kg).
- Recovery: If wind-down, sleep, sauna, meditation or soreness is mentioned, extract recovery.wind_down.
- Progress Photo: If the user provides a physique selfie / progress photo (or asks to save progress), set is_progress_photo: true.
- If no fitness data is present (e.g. general chit-chat or question), set has_data: false and nutrition/workout/etc to null.

Return ONLY a valid JSON object matching this schema:
{
  "coach_response": string,
  "extracted_data": {
    "has_data": boolean,
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
    "is_progress_photo": boolean
  }
}`;

export async function sendChatMessageToCoach(
  message: string,
  imageUri?: string | null,
  history?: { role: 'user' | 'model'; text: string }[]
): Promise<CoachAnalysisResponse> {
  const apiKey = await getApiKey();
  if (!apiKey) {
    throw new Error('Missing Gemini API Key. Please configure it in Settings.');
  }

  const hasPhoto = Boolean(imageUri);
  const hasMessage = Boolean(message && message.trim().length > 0);

  if (!hasPhoto && !hasMessage) {
    throw new Error('Please provide a message or photo to send to Fuel Coach.');
  }

  let base64Image: string | null = null;
  let mimeType = 'image/jpeg';

  if (imageUri) {
    base64Image = await FileSystem.readAsStringAsync(imageUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    mimeType = getMimeType(imageUri);
  }

  const contents: any[] = [];
  if (history && history.length > 0) {
    for (const h of history) {
      contents.push({
        role: h.role,
        parts: [{ text: h.text }],
      });
    }
  }

  const currentParts: any[] = [];
  if (base64Image) {
    currentParts.push({
      inline_data: {
        mime_type: mimeType,
        data: base64Image,
      },
    });
  }
  if (hasMessage) {
    currentParts.push({ text: message });
  } else if (base64Image) {
    currentParts.push({ text: 'Analyze this photo and provide fitness coaching advice.' });
  }

  contents.push({
    role: 'user',
    parts: currentParts,
  });

  const modelsToTry = await getAvailableGeminiModels(apiKey, hasPhoto);
  let lastError: Error | null = null;

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
            parts: [{ text: COACH_SYSTEM_PROMPT }],
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
