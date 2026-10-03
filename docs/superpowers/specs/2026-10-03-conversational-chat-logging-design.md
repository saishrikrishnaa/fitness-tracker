# Conversational Chat Session & Smart Bucketing Logging Design

## 1. Overview
The primary goal of this feature is to transform the main "Log" screen from a static multi-field form into a dynamic, conversational AI Fitness Coach chat interface. Users can input any combination of text, images, and notes (e.g. food eaten, workouts completed, body weight, recovery notes, or questions). Gemini 1.5 Flash conversational intelligence extracts the entities into their respective structured buckets (Nutrition, Workout, Body Weight, Recovery, Progress Vault) and persists them to SQLite while providing real-time coaching dialogue and interactive logged activity cards.

---

## 2. Architecture & Data Flow

```
+-------------------------------------------------------------+
|                      User Chat Input                        |
|  - Natural Text ("Ate 3 eggs & toast, trained legs, 78kg")   |
|  - Attached Meal or Progress Photo                         |
+------------------------------+------------------------------+
                               |
                               v
+-------------------------------------------------------------+
|              Gemini 1.5 Flash Extractor Engine               |
|  - Resolves Vision vs Text models                           |
|  - Returns:                                                 |
|    1. coach_response (encouraging & actionable advice)      |
|    2. extracted_data JSON (Nutrition, Workout, Weight, etc.)|
+------------------------------+------------------------------+
                               |
               +---------------+---------------+
               |                               |
               v                               v
+-----------------------------+ +-----------------------------+
|     Chat Messages Table     | |     Fitness Logs Table      |
|  - sender ('user' | 'coach')| |  - calories, protein, carbs |
|  - message text             | |  - weight_kg, workout_notes |
|  - image_uri                | |  - progress_photo_uri       |
|  - extracted_data JSON      | |  - meal_photo_uri           |
+-----------------------------+ +-----------------------------+
               |                               |
               v                               v
+-----------------------------+ +-----------------------------+
|      Chat UI Log Screen     | |  Analytics & Vault Screens  |
|  - Bubble conversation      | |  - Macro breakdown charts   |
|  - Interactive Logged Cards | |  - Private photo timeline   |
+-----------------------------+ +-----------------------------+
```

---

## 3. Data Models & SQLite Schema

### 3.1 `chat_messages` Table
```sql
CREATE TABLE IF NOT EXISTS chat_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sender TEXT NOT NULL,           -- 'user' | 'coach'
  text TEXT NOT NULL,
  image_uri TEXT,
  extracted_data TEXT,            -- JSON stringified ChatExtractedData
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_chat_created_at ON chat_messages(created_at);
```

### 3.2 TypeScript Interfaces (`types/fitness.ts`)
```typescript
export interface ChatExtractedData {
  has_data: boolean;
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
}

export interface ChatMessage {
  id: number;
  sender: 'user' | 'coach';
  text: string;
  image_uri: string | null;
  extracted_data: ChatExtractedData | null;
  created_at: string;
}

export interface CoachAnalysisResponse {
  coach_response: string;
  extracted_data: ChatExtractedData;
}
```

---

## 4. Gemini AI Prompting & Extractor Engine (`services/gemini.ts`)

### 4.1 System & Prompt Formulation
Gemini is instructed with an expert fitness coach and nutritionist persona to parse natural user messages.
```typescript
export async function sendChatMessageToCoach(
  message: string,
  imageUri?: string | null,
  history?: { role: 'user' | 'model'; text: string }[]
): Promise<CoachAnalysisResponse>
```

The prompt enforces strict JSON output:
```json
{
  "coach_response": "Great workout and solid protein source! Make sure you drink at least 3L of water today to support muscle recovery. 💪",
  "extracted_data": {
    "has_data": true,
    "nutrition": {
      "meal_type": "Lunch",
      "calories": 520,
      "protein_g": 42,
      "carbs_g": 45,
      "fat_g": 16,
      "food_items": ["grilled chicken breast", "white rice", "broccoli"]
    },
    "workout": {
      "workout_notes": "Leg day: 4 sets squats, lunges"
    },
    "weight_kg": 78.5,
    "recovery": {
      "wind_down": "8 hours sleep"
    },
    "is_progress_photo": false
  }
}
```

### 4.2 Auto-Bucketing & Syncing
When `extracted_data.has_data === true`:
- If `nutrition` is present, or `workout`, `weight_kg`, `recovery`, or `is_progress_photo` are detected:
  - Save log entry in `fitness_logs` with all available fields.
  - If `is_progress_photo` is true and `imageUri` exists, save photo locally to `progress` directory and link `progress_photo_uri`.
  - If `nutrition` is present and `imageUri` exists and `!is_progress_photo`, save photo locally to `meals` directory and link `meal_photo_uri`.

---

## 5. Screen Implementation (`app/(tabs)/index.tsx`)

### 5.1 UI Layout
- **Header:**
  - Title: "Fuel Coach 🔥"
  - Subtitle: "AI Fitness & Nutrition Assistant"
  - Action button: Clear Chat history.
- **Message List:**
  - Auto-scrolling `FlatList` of `ChatMessage` items.
  - User messages on right (accent/dark bubble) with optional image preview thumbnail.
  - Coach messages on left (glass card) with markdown-friendly coach text.
  - **Embedded "Logged Activity" Card** on coach messages when `extracted_data.has_data` is true:
    - 🥗 **Nutrition Badge:** Meal type, calories, and mini protein/carbs/fat pill indicators.
    - 🏋️ **Workout Badge:** Notes / exercises recognized.
    - ⚖️ **Weight Badge:** E.g., `78.5 kg recorded`.
    - 🧘 **Recovery Badge:** Wind-down & sleep notes.
    - 📸 **Vault Badge:** "Saved to Progress Vault".
- **Input Bar:**
  - Camera button (`takePhoto`)
  - Gallery picker button (`pickImage`)
  - Attached image preview badge with remove (x) button.
  - Multiline text input: *"Tell Fuel Coach what you ate or trained..."*
  - Send button with loading spinner when waiting for Gemini.

---

## 6. Testing & Verification Strategy
1. **Gemini Service Tests (`tests/gemini.test.ts`):**
   - Test text-only chat message analysis and extraction.
   - Test multimodal image + message chat extraction.
   - Test general conversation questions without data extraction (`has_data: false`).
   - Test error handling when API key is missing.
2. **Database Chat Tests (`tests/database.test.ts`):**
   - Test `saveChatMessage`, `getChatMessages`, `clearChatMessages`.
   - Test auto-bucketing into `fitness_logs`.
3. **UI Component Tests (`tests/components.test.tsx`):**
   - Test chat message rendering, user bubble, coach bubble, and embedded logged activity cards.
