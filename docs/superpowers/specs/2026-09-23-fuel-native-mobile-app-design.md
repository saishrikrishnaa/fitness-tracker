# Design Document: FUEL Native Mobile Application

**Date:** 2026-09-23  
**Status:** Approved  
**Target Platforms:** iOS & Android (Native Mobile App)

---

## 1. Overview & Vision
FUEL is a mobile-first, privacy-focused fitness and nutrition tracker powered by Google Gemini 2.5 Pro Vision AI. The app runs completely on-device, storing fitness logs, weight records, and photos in an encrypted local database (SQLite), while leveraging Gemini Vision AI to estimate calories and macronutrients from meal photos.

Key Highlights:
- **Zero Server Dependency:** 100% standalone on-device application.
- **Top-Tier UI/UX:** Ultra-sleek dark theme (#0D0D0D) with glassmorphism cards, glowing cyan (#06B6D4) and indigo (#4F46E5) accents, smooth micro-animations, and haptic feedback.
- **Biometric & PIN Vault:** Secure private gallery for body progress photos with FaceID / TouchID / PIN protection.
- **AI Meal Analysis:** Deep dietary insights and macronutrient breakdown via `gemini-2.5-pro`.

---

## 2. Technology Stack & Architecture

| Layer | Technology | Purpose |
|---|---|---|
| **Framework** | React Native with Expo (SDK 52+), TypeScript | Cross-platform native app performance |
| **Navigation** | Expo Router | File-based native tab and stack navigation |
| **Styling** | NativeWind (Tailwind CSS) + React Native Reanimated | Responsive design, glassmorphism, fluid 60fps animations |
| **Database** | `expo-sqlite` | Local relational SQLite database for all fitness entries |
| **Photo Storage** | `expo-file-system` | Local filesystem storage for meal and progress photos |
| **Camera & Media** | `expo-camera` & `expo-image-picker` | Native camera capture and photo library access |
| **Security** | `expo-secure-store` & `expo-local-authentication` | Hardware-backed key encryption and biometric authentication |
| **Charts** | `react-native-gifted-charts` | High performance interactive calorie and weight graphs |
| **AI Client** | Direct HTTPS REST to Google Gemini 2.5 Pro | Structured JSON output for macro estimation |

---

## 3. UI/UX Design System

### Color Palette
- **Background Deep:** `#0D0D0D`
- **Surface / Card:** `rgba(26, 26, 26, 0.7)` with `1px border: rgba(255, 255, 255, 0.08)`
- **Primary Accent:** Cyan `#06B6D4`
- **Secondary Accent:** Indigo `#4F46E5`
- **Success / High Protein:** `#10B981` (Emerald)
- **Warning / High Fat:** `#F59E0B` (Amber)
- **Text Primary:** `#F9FAFB`
- **Text Secondary:** `#9CA3AF`

### Micro-Interactions & Haptics
- Tab navigation transitions with spring animations.
- Glowing radar/laser scan effect over food photos during AI analysis.
- Haptic tick upon logging meals and unlocking the vault.
- Macro progress rings with animated filling.

---

## 4. Local Database Schema (`expo-sqlite`)

### Table: `fitness_logs`
```sql
CREATE TABLE IF NOT EXISTS fitness_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT NOT NULL,
    date TEXT NOT NULL,
    meal_type TEXT NOT NULL,            -- 'Breakfast', 'Lunch', 'Dinner', 'Snack'
    calories REAL NOT NULL DEFAULT 0.0,
    protein_g REAL NOT NULL DEFAULT 0.0,
    carbs_g REAL NOT NULL DEFAULT 0.0,
    fat_g REAL NOT NULL DEFAULT 0.0,
    weight_kg REAL,
    workout_notes TEXT,
    wind_down TEXT,
    ai_feedback TEXT,                   -- JSON string of string array: '["✅ ...", "💡 ..."]'
    meal_photo_uri TEXT,                -- local file path
    progress_photo_uri TEXT,            -- local file path
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_logs_date ON fitness_logs(date);
```

### Table: `user_settings`
```sql
CREATE TABLE IF NOT EXISTS user_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
```

---

## 5. Gemini 2.5 Pro Vision Integration

### Prompt & Schema
```typescript
export interface MealAnalysisResult {
    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
    feedback: string[];
}
```

### Request Payload Structure
- Model: `gemini-2.5-pro`
- System Prompt: Rigorous dietary estimation and actionable feedback based on meal type and workout notes.
- Output Format: Enforced `application/json` with Pydantic/JSON schema.
- Image: Base64-encoded image bytes passed in `contents.parts.inline_data`.

---

## 6. Detailed Screen Specifications

### 1. Log Entry (`app/(tabs)/index.tsx`)
- **Header:** FUEL Logo + daily streak counter badge.
- **Food Scan Camera:** Live camera button or gallery selector with preview.
- **Optional Progress Photo:** Secondary camera slot for daily physique checks.
- **Inputs:**
  - Meal Type horizontal pill selector (`Breakfast`, `Lunch`, `Dinner`, `Snack`).
  - Weight input stepper/dial (kg).
  - Workout & Wind-down notes text inputs.
- **Action Button:** "⚡ Analyze & Log with AI" with pulsing gradient button.
- **Result Presentation:** Animated card unveiling estimated Calories, Protein, Carbs, and Fat with visual percentage goals and AI insights bullet points.

### 2. Analytics & Trends (`app/(tabs)/analytics.tsx`)
- **Metric Cards:** Total Meals Logged, 7-Day Average Calories, Current Body Weight.
- **Calorie Intake Trend:** Interactive bar/line chart grouped by date with daily target reference line.
- **Macro Ratio Breakdown:** Donut chart showing Protein / Carbs / Fat distribution over time.
- **Weight Trajectory:** Smooth trend curve tracking weight fluctuations over time.

### 3. Private Progress Vault (`app/(tabs)/vault.tsx`)
- **Lock Screen:**
  - Glass vault shield with FaceID / Fingerprint unlock button and fallback 4-digit PIN pad.
- **Unlocked Gallery:**
  - Chronological 2-column or 3-column photo grid.
  - Badges displaying Date, Weight, and Days Elapsed.
  - **Comparison Mode:** Select two photos to view side-by-side or with an interactive before/after slider.
  - One-tap "Lock Vault" button.

### 4. Settings (`app/(tabs)/settings.tsx`)
- **API Key Management:** Enter, test, and securely store Gemini API key in `expo-secure-store`.
- **Security Preferences:** Toggle Biometric Unlock and change Vault PIN.
- **Data Export & Import:** One-click export to CSV / JSON and database reset.

---

## 7. Testing & Quality Assurance Plan
- **Unit Tests (`jest`):** Testing SQLite CRUD operations, Gemini response parser, and data formatting utilities.
- **Component Tests (`@testing-library/react-native`):** Testing screen renders, input states, and mock API interactions.
- **End-to-End Verification:** Live device testing via Expo Go on Android and iOS.
