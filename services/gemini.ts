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

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
  const mimeType = getMimeType(imageUri);
  const signal = typeof AbortSignal?.timeout === 'function' ? AbortSignal.timeout(30000) : undefined;

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
    throw new Error(`Gemini API Error: ${response.status} - ${errText}`);
  }

  const data = await response.json();
  const textContent = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!textContent) return null;

  return parseGeminiResponse(textContent);
}
