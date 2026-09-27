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

export const FALLBACK_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-1.5-flash',
  'gemini-1.5-flash-latest',
  'gemini-1.5-pro',
  'gemini-pro',
];

export async function getAvailableGeminiModels(apiKey: string): Promise<string[]> {
  try {
    const signal = typeof AbortSignal?.timeout === 'function' ? AbortSignal.timeout(10000) : undefined;
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`, { signal });
    if (!res.ok) return FALLBACK_MODELS;
    
    const data = await res.json();
    if (!Array.isArray(data.models)) return FALLBACK_MODELS;

    const available = data.models
      .filter((m: any) => Array.isArray(m.supportedGenerationMethods) && m.supportedGenerationMethods.includes('generateContent'))
      .map((m: any) => m.name.replace(/^models\//, ''))
      .filter((name: string) => name.toLowerCase().includes('gemini'));

    // Sort to prioritize flash models first, then pro models
    available.sort((a: string, b: string) => {
      const aScore = a.includes('flash') ? 2 : a.includes('pro') ? 1 : 0;
      const bScore = b.includes('flash') ? 2 : b.includes('pro') ? 1 : 0;
      return bScore - aScore;
    });

    return available.length > 0 ? available : FALLBACK_MODELS;
  } catch {
    return FALLBACK_MODELS;
  }
}

export async function analyzeMealImageOnDevice(
  imageUri: string,
  mealType: string,
  workoutNotes?: string | null
): Promise<MealAnalysisResult | null> {
  const apiKey = await getApiKey();
  if (!apiKey) {
    throw new Error('Missing Gemini API Key. Please configure it in Settings.');
  }

  const base64Image = await FileSystem.readAsStringAsync(imageUri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  const prompt = `
  Analyze this food image. Provide estimated macronutrients and calories.
  Context: Meal type is ${mealType}.
  Workout context: ${workoutNotes || 'None'}.
  
  Return strict JSON with this exact schema:
  {
    "calories": number (estimated total calories),
    "protein_g": number (grams of protein),
    "carbs_g": number (grams of carbs),
    "fat_g": number (grams of fat),
    "feedback": [string, string, string] (3 brief actionable feedback bullet points starting with emojis ✅, ⚠️, 💡)
  }
  `;

  const mimeType = getMimeType(imageUri);
  const modelsToTry = await getAvailableGeminiModels(apiKey);
  
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
          contents: [
            {
              parts: [
                { text: prompt },
                {
                  inline_data: {
                    mime_type: mimeType,
                    data: base64Image,
                  },
                },
              ],
            },
          ],
          generationConfig: {
            response_mime_type: 'application/json',
          },
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        // If model not found (404), continue to next available model in the list
        if (response.status === 404 || errText.toLowerCase().includes('not found') || errText.toLowerCase().includes('not supported')) {
          lastError = new Error(`Gemini Model ${model} not supported: ${errText}`);
          continue;
        }
        throw new Error(`Gemini API Error: ${response.status} - ${errText}`);
      }

      const data = await response.json();
      const textContent = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!textContent) return null;

      return parseGeminiResponse(textContent);
    } catch (err: any) {
      lastError = err;
      // Only retry if it's a model-not-found error, otherwise propagate
      if (err.message?.includes('not supported') || err.message?.includes('404')) {
        continue;
      }
      throw err;
    }
  }

  throw lastError || new Error('All Gemini model candidates failed. Please verify your API key.');
}
