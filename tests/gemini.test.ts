import { parseGeminiResponse, analyzeMeal, analyzeMealImageOnDevice, getMimeType, getAvailableGeminiModels } from '../services/gemini';
import { getApiKey, setApiKey, getVaultPin, setVaultPin } from '../services/secureStore';
import * as SecureStore from 'expo-secure-store';
import * as FileSystem from 'expo-file-system';

jest.mock('expo-secure-store', () => {
  const store = new Map<string, string>();
  return {
    getItemAsync: jest.fn(async (key: string) => store.get(key) || null),
    setItemAsync: jest.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
    deleteItemAsync: jest.fn(async (key: string) => {
      store.delete(key);
    }),
    __store: store,
  };
});

jest.mock('expo-file-system', () => ({
  readAsStringAsync: jest.fn(async () => 'base64sampledata'),
  EncodingType: {
    Base64: 'base64',
  },
}));

describe('Gemini Response Parser', () => {
  it('parses valid structured JSON output correctly', () => {
    const rawJson = JSON.stringify({
      calories: 620,
      protein_g: 48,
      carbs_g: 60,
      fat_g: 18,
      feedback: ['✅ Great post-workout protein source', '⚠️ High in sodium', '💡 Drink extra water'],
    });

    const parsed = parseGeminiResponse(rawJson);
    expect(parsed).toEqual({
      calories: 620,
      protein_g: 48,
      carbs_g: 60,
      fat_g: 18,
      feedback: ['✅ Great post-workout protein source', '⚠️ High in sodium', '💡 Drink extra water'],
    });
  });

  it('handles markdown codeblocks wrapping json (case-insensitive)', () => {
    const rawJson = '```JSON\n{"calories": 400, "protein_g": 30, "carbs_g": 40, "fat_g": 10, "feedback": ["✅ Good balance"]}\n```';
    const parsed = parseGeminiResponse(rawJson);
    expect(parsed).toEqual({
      calories: 400,
      protein_g: 30,
      carbs_g: 40,
      fat_g: 10,
      feedback: ['✅ Good balance'],
    });
  });

  it('falls back gracefully on invalid JSON', () => {
    const parsed = parseGeminiResponse('invalid non-json response');
    expect(parsed).toBeNull();
  });
});

describe('MIME type resolution', () => {
  it('resolves image mime types correctly based on file extension', () => {
    expect(getMimeType('file:///path/meal.png')).toBe('image/png');
    expect(getMimeType('file:///path/meal.WEBP')).toBe('image/webp');
    expect(getMimeType('file:///path/meal.heic')).toBe('image/heic');
    expect(getMimeType('file:///path/meal.jpg')).toBe('image/jpeg');
    expect(getMimeType('file:///path/meal.jpeg')).toBe('image/jpeg');
  });
});

describe('Secure Store Service', () => {
  beforeEach(() => {
    (SecureStore as any).__store.clear();
    jest.clearAllMocks();
  });

  it('gets and sets API key', async () => {
    expect(await getApiKey()).toBeNull();
    await setApiKey('test-gemini-key-123');
    expect(await getApiKey()).toBe('test-gemini-key-123');
  });

  it('gets default vault pin and updates pin', async () => {
    expect(await getVaultPin()).toBe('1234');
    await setVaultPin('9876');
    expect(await getVaultPin()).toBe('9876');
  });
});

describe('analyzeMeal & analyzeMealImageOnDevice', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    (SecureStore as any).__store.clear();
    jest.clearAllMocks();
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  it('throws error when API key is missing', async () => {
    await expect(analyzeMealImageOnDevice('file:///image.jpg', 'Breakfast')).rejects.toThrow(
      'Missing Gemini API Key. Please configure it in Settings.'
    );
  });

  it('throws error when neither photo nor description is provided', async () => {
    await setApiKey('test-key');
    await expect(analyzeMeal({ mealType: 'Lunch' })).rejects.toThrow(
      'Please take a photo or enter a meal description to analyze.'
    );
  });

  it('analyzes text-only meal description without requiring an image', async () => {
    await setApiKey('test-key');

    const mockResponsePayload = {
      candidates: [
        {
          content: {
            parts: [
              {
                text: JSON.stringify({
                  calories: 450,
                  protein_g: 32,
                  carbs_g: 40,
                  fat_g: 14,
                  feedback: ['✅ High quality protein', '⚠️ Light on veggies', '💡 Add a side salad'],
                }),
              },
            ],
          },
        },
      ],
    };

    global.fetch = jest.fn().mockImplementation(async (url: string) => {
      if (url.includes('/models?')) {
        return { ok: false };
      }
      return {
        ok: true,
        json: async () => mockResponsePayload,
      };
    });

    const result = await analyzeMeal({
      mealDescription: '3 scrambled eggs, 2 slices whole wheat toast, black coffee',
      mealType: 'Breakfast',
      workoutNotes: 'Morning 5k run',
    });

    expect(result).toEqual({
      calories: 450,
      protein_g: 32,
      carbs_g: 40,
      fat_g: 14,
      feedback: ['✅ High quality protein', '⚠️ Light on veggies', '💡 Add a side salad'],
    });

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('gemini-1.5-flash:generateContent?key=test-key'),
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('3 scrambled eggs'),
      })
    );
  });

  it('calls Gemini API with image and returns parsed meal analysis', async () => {
    await setApiKey('test-key');

    const mockModelsPayload = {
      models: [
        {
          name: 'models/gemini-1.5-flash',
          supportedGenerationMethods: ['generateContent'],
        },
      ],
    };

    const mockResponsePayload = {
      candidates: [
        {
          content: {
            parts: [
              {
                text: JSON.stringify({
                  calories: 550,
                  protein_g: 35,
                  carbs_g: 50,
                  fat_g: 15,
                  feedback: ['✅ High protein', '⚠️ Moderate carbs', '💡 Hydrate'],
                }),
              },
            ],
          },
        },
      ],
    };

    global.fetch = jest.fn().mockImplementation(async (url: string) => {
      if (url.includes('/models?')) {
        return {
          ok: true,
          json: async () => mockModelsPayload,
        };
      }
      return {
        ok: true,
        json: async () => mockResponsePayload,
      };
    });

    const result = await analyzeMealImageOnDevice('file:///image.png', 'Lunch', 'Upper body workout');
    expect(result).toEqual({
      calories: 550,
      protein_g: 35,
      carbs_g: 50,
      fat_g: 15,
      feedback: ['✅ High protein', '⚠️ Moderate carbs', '💡 Hydrate'],
    });

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('gemini-1.5-flash:generateContent?key=test-key'),
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"mime_type":"image/png"'),
      })
    );
  });

  it('cascades to next available vision model when a model returns error', async () => {
    await setApiKey('test-key');

    const mockResponsePayload = {
      candidates: [
        {
          content: {
            parts: [
              {
                text: JSON.stringify({
                  calories: 400,
                  protein_g: 30,
                  carbs_g: 45,
                  fat_g: 12,
                  feedback: ['✅ Great meal', '⚠️ Keep going', '💡 Good hydration'],
                }),
              },
            ],
          },
        },
      ],
    };

    global.fetch = jest.fn().mockImplementation(async (url: string) => {
      if (url.includes('/models?')) {
        return { ok: false }; // fallback to default candidate list
      }
      if (url.includes('gemini-1.5-flash:generateContent')) {
        return {
          ok: false,
          status: 400,
          text: async () => 'Image input modality is not enabled for models/gemini-1.5-flash',
        };
      }
      return {
        ok: true,
        json: async () => mockResponsePayload,
      };
    });

    const result = await analyzeMealImageOnDevice('file:///image.jpg', 'Dinner');
    expect(result?.calories).toBe(400);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('gemini-1.5-flash-latest:generateContent?key=test-key'),
      expect.anything()
    );
  });

  it('throws error when API key is invalid', async () => {
    await setApiKey('bad-key');

    global.fetch = jest.fn().mockImplementation(async (url: string) => {
      if (url.includes('/models?')) return { ok: false };
      return {
        ok: false,
        status: 400,
        text: async () => 'API_KEY_INVALID: Key not valid',
      };
    });

    await expect(analyzeMealImageOnDevice('file:///image.jpg', 'Dinner')).rejects.toThrow(
      'Invalid Gemini API Key. Please verify your API key in Settings.'
    );
  });
});
