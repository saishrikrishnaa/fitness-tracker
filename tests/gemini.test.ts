import {
  parseGeminiResponse,
  parseCoachResponse,
  analyzeMeal,
  analyzeMealImageOnDevice,
  sendChatMessageToCoach,
  getMimeType,
  getAvailableGeminiModels,
} from '../services/gemini';
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

describe('Coach Response Parser (parseCoachResponse)', () => {
  it('parses complete structured JSON with all buckets correctly', () => {
    const rawJson = JSON.stringify({
      coach_response: 'Great high-protein lunch and solid bench workout!',
      extracted_data: {
        has_data: true,
        nutrition: {
          meal_type: 'Lunch',
          calories: 650,
          protein_g: 50,
          carbs_g: 45,
          fat_g: 20,
          food_items: ['Chicken breast', 'Rice', 'Broccoli'],
        },
        workout: {
          workout_notes: 'Chest & Triceps: 4x8 Bench Press, 3x12 Dips',
          duration_mins: 45,
        },
        weight_kg: 82.5,
        recovery: {
          wind_down: '15 mins sauna and stretching',
        },
        is_progress_photo: false,
      },
    });

    const parsed = parseCoachResponse(rawJson);
    expect(parsed).toEqual({
      coach_response: 'Great high-protein lunch and solid bench workout!',
      extracted_data: {
        has_data: true,
        nutrition: {
          meal_type: 'Lunch',
          calories: 650,
          protein_g: 50,
          carbs_g: 45,
          fat_g: 20,
          food_items: ['Chicken breast', 'Rice', 'Broccoli'],
        },
        workout: {
          workout_notes: 'Chest & Triceps: 4x8 Bench Press, 3x12 Dips',
          duration_mins: 45,
        },
        weight_kg: 82.5,
        recovery: {
          wind_down: '15 mins sauna and stretching',
        },
        is_progress_photo: false,
      },
    });
  });

  it('parses coach response enclosed in markdown code block', () => {
    const rawText = '```json\n{"coach_response": "Looking lean!", "extracted_data": {"has_data": true, "is_progress_photo": true, "weight_kg": 75}}\n```';
    const parsed = parseCoachResponse(rawText);
    expect(parsed).toEqual({
      coach_response: 'Looking lean!',
      extracted_data: {
        has_data: true,
        nutrition: null,
        workout: null,
        weight_kg: 75,
        recovery: null,
        is_progress_photo: true,
      },
    });
  });

  it('parses general chat response with has_data: false', () => {
    const rawJson = JSON.stringify({
      coach_response: 'To build muscle effectively, aim for 1.6-2.2g of protein per kg of bodyweight.',
      extracted_data: {
        has_data: false,
        nutrition: null,
        workout: null,
        weight_kg: null,
        recovery: null,
        is_progress_photo: false,
      },
    });

    const parsed = parseCoachResponse(rawJson);
    expect(parsed).toEqual({
      coach_response: 'To build muscle effectively, aim for 1.6-2.2g of protein per kg of bodyweight.',
      extracted_data: {
        has_data: false,
        nutrition: null,
        workout: null,
        weight_kg: null,
        recovery: null,
        is_progress_photo: false,
      },
    });
  });

  it('falls back gracefully to plain coach response on malformed non-JSON text', () => {
    const rawText = 'Keep pushing hard in the gym today! Remember to hydrate.';
    const parsed = parseCoachResponse(rawText);
    expect(parsed).toEqual({
      coach_response: 'Keep pushing hard in the gym today! Remember to hydrate.',
      extracted_data: {
        has_data: false,
      },
    });
  });

  it('returns null for empty or non-string inputs', () => {
    expect(parseCoachResponse('')).toBeNull();
    expect(parseCoachResponse(null as any)).toBeNull();
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

describe('sendChatMessageToCoach', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    (SecureStore as any).__store.clear();
    jest.clearAllMocks();
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  it('throws error when API key is missing', async () => {
    await expect(sendChatMessageToCoach('Hello coach')).rejects.toThrow(
      'Missing Gemini API Key. Please configure it in Settings.'
    );
  });

  it('throws error when neither message nor photo is provided', async () => {
    await setApiKey('test-key');
    await expect(sendChatMessageToCoach('')).rejects.toThrow(
      'Please provide a message or photo to send to Fuel Coach.'
    );
  });

  it('sends text-only message with history and returns parsed coach response with extracted data', async () => {
    await setApiKey('test-key');

    const mockResponsePayload = {
      candidates: [
        {
          content: {
            parts: [
              {
                text: JSON.stringify({
                  coach_response: 'Awesome chest workout and nutritious lunch!',
                  extracted_data: {
                    has_data: true,
                    nutrition: {
                      meal_type: 'Lunch',
                      calories: 600,
                      protein_g: 45,
                      carbs_g: 55,
                      fat_g: 15,
                      food_items: ['Turkey sandwich', 'Apple'],
                    },
                    workout: {
                      workout_notes: 'Bench press 5x5, incline DB press 3x10',
                      duration_mins: 50,
                    },
                    weight_kg: 80,
                    recovery: null,
                    is_progress_photo: false,
                  },
                }),
              },
            ],
          },
        },
      ],
    };

    global.fetch = jest.fn().mockImplementation(async (url: string) => {
      if (url.includes('/models?')) return { ok: false };
      return {
        ok: true,
        json: async () => mockResponsePayload,
      };
    });

    const history = [
      { role: 'user' as const, text: 'Hi coach, starting my cut today.' },
      { role: 'model' as const, text: 'Welcome! Keep protein high and let me know your meals and workouts.' },
    ];

    const result = await sendChatMessageToCoach(
      'Had turkey sandwich and apple for lunch, then hit bench press 5x5 for 50 mins. Weight is 80kg.',
      null,
      history
    );

    expect(result).toEqual({
      coach_response: 'Awesome chest workout and nutritious lunch!',
      extracted_data: {
        has_data: true,
        nutrition: {
          meal_type: 'Lunch',
          calories: 600,
          protein_g: 45,
          carbs_g: 55,
          fat_g: 15,
          food_items: ['Turkey sandwich', 'Apple'],
        },
        workout: {
          workout_notes: 'Bench press 5x5, incline DB press 3x10',
          duration_mins: 50,
        },
        weight_kg: 80,
        recovery: null,
        is_progress_photo: false,
      },
    });

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('gemini-1.5-flash:generateContent?key=test-key'),
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('Hi coach, starting my cut today.'),
      })
    );
  });

  it('filters out empty or whitespace history entries before sending to Gemini', async () => {
    await setApiKey('test-key');

    const mockResponsePayload = {
      candidates: [
        {
          content: {
            parts: [{ text: JSON.stringify({ coach_response: 'Got it!', extracted_data: { has_data: false } }) }],
          },
        },
      ],
    };

    global.fetch = jest.fn().mockImplementation(async (url: string) => {
      if (url.includes('/models?')) return { ok: false };
      return {
        ok: true,
        json: async () => mockResponsePayload,
      };
    });

    const historyWithEmpty = [
      { role: 'user' as const, text: '' },
      { role: 'model' as const, text: '   ' },
      { role: 'user' as const, text: 'Leg day yesterday' },
    ];

    const result = await sendChatMessageToCoach('How much rest between sets?', null, historyWithEmpty);
    expect(result.coach_response).toBe('Got it!');

    const fetchCall = (global.fetch as jest.Mock).mock.calls.find((c) =>
      c[0].includes('gemini-1.5-flash:generateContent')
    );
    expect(fetchCall).toBeDefined();
    const requestBody = JSON.parse(fetchCall[1].body);
    // requestBody.contents should contain the valid history entry and the current user query, but not empty ones
    expect(requestBody.contents).toHaveLength(2);
    expect(requestBody.contents[0].parts[0].text).toBe('Leg day yesterday');
    expect(requestBody.contents[1].parts[0].text).toBe('How much rest between sets?');
  });

  it('sends photo and message and returns extracted progress photo and nutrition data', async () => {
    await setApiKey('test-key');

    const mockResponsePayload = {
      candidates: [
        {
          content: {
            parts: [
              {
                text: JSON.stringify({
                  coach_response: 'Physique looks solid! Definite delt and upper chest definition improvement.',
                  extracted_data: {
                    has_data: true,
                    nutrition: null,
                    workout: null,
                    weight_kg: 76.5,
                    recovery: {
                      wind_down: 'Sauna 20 min',
                    },
                    is_progress_photo: true,
                  },
                }),
              },
            ],
          },
        },
      ],
    };

    global.fetch = jest.fn().mockImplementation(async (url: string) => {
      if (url.includes('/models?')) return { ok: false };
      return {
        ok: true,
        json: async () => mockResponsePayload,
      };
    });

    const result = await sendChatMessageToCoach(
      'Weekly physique check-in! Current weight 76.5kg, did 20 min sauna after training.',
      'file:///progress_pic.png'
    );

    expect(result.extracted_data.is_progress_photo).toBe(true);
    expect(result.extracted_data.weight_kg).toBe(76.5);
    expect(result.extracted_data.recovery?.wind_down).toBe('Sauna 20 min');
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('gemini-1.5-flash:generateContent?key=test-key'),
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"mime_type":"image/png"'),
      })
    );
  });

  it('handles general questions with has_data: false', async () => {
    await setApiKey('test-key');

    const mockResponsePayload = {
      candidates: [
        {
          content: {
            parts: [
              {
                text: JSON.stringify({
                  coach_response: 'Creatine monohydrate is safe and effective when taken 3-5g daily.',
                  extracted_data: {
                    has_data: false,
                    nutrition: null,
                    workout: null,
                    weight_kg: null,
                    recovery: null,
                    is_progress_photo: false,
                  },
                }),
              },
            ],
          },
        },
      ],
    };

    global.fetch = jest.fn().mockImplementation(async (url: string) => {
      if (url.includes('/models?')) return { ok: false };
      return {
        ok: true,
        json: async () => mockResponsePayload,
      };
    });

    const result = await sendChatMessageToCoach('How much creatine should I take daily?');
    expect(result.coach_response).toContain('Creatine monohydrate');
    expect(result.extracted_data.has_data).toBe(false);
  });

  it('cascades to next available model when a model returns error', async () => {
    await setApiKey('test-key');

    const mockResponsePayload = {
      candidates: [
        {
          content: {
            parts: [
              {
                text: JSON.stringify({
                  coach_response: 'Looking great!',
                  extracted_data: { has_data: false },
                }),
              },
            ],
          },
        },
      ],
    };

    global.fetch = jest.fn().mockImplementation(async (url: string) => {
      if (url.includes('/models?')) return { ok: false };
      if (url.includes('gemini-1.5-flash:generateContent')) {
        return {
          ok: false,
          status: 503,
          text: async () => 'Service Unavailable',
        };
      }
      return {
        ok: true,
        json: async () => mockResponsePayload,
      };
    });

    const result = await sendChatMessageToCoach('Check in');
    expect(result.coach_response).toBe('Looking great!');
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

    await expect(sendChatMessageToCoach('Hello')).rejects.toThrow(
      'Invalid Gemini API Key. Please verify your API key in Settings.'
    );
  });
});
