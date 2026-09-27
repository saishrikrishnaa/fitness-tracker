import * as FileSystem from 'expo-file-system';
import { getApiKey } from './secureStore';

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
