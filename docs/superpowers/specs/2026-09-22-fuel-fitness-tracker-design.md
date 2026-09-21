# FUEL 🔥 — Fitness & Nutrition Tracker Design Spec

## Purpose

A premium, mobile-first Streamlit fitness and nutrition tracker that uses Gemini 2.5 Flash vision AI to analyze meal photos. Users snap a meal photo from their phone, receive instant macro estimates and dietary feedback, and track weight + nutrition over time with rich visual analytics.

## Design Language

- **Theme:** Dark (#0D0D0D background), glassmorphic cards with frosted borders
- **Accent palette:** Electric blue (#4F46E5) → Cyan (#06B6D4) gradient; Orange (#F97316) for streaks/warnings; Green (#10B981) for success
- **Typography:** Bold headings, muted gray subtitles, generous spacing
- **UX Philosophy:** Every screen feels like a $10/month premium fitness app. No default Streamlit chrome — fully custom CSS.

## Architecture

```
fitness-tracker/
├── app.py                          # Main Streamlit dashboard
├── requirements.txt                # streamlit, pandas, plotly, google-genai, pillow
├── .streamlit/
│   ├── config.toml                 # Dark theme config
│   └── secrets.toml.example        # GEMINI_API_KEY template
├── utils/
│   ├── __init__.py
│   ├── gemini_analyzer.py          # Gemini 2.5 Flash vision calls
│   └── data_manager.py            # CSV CRUD + aggregations
└── data/
    └── fitness_log.csv             # Auto-created on first run
```

## Feature Specifications

### 1. Daily Log Entry Tab

**Progress Photo:**
- `st.camera_input("?? Today's Progress Photo (Optional)")` to capture a daily physique update.



**Camera Input:**
- `st.camera_input("📸 Scan your meal")` with custom CSS to style the capture area
- Image is passed to Gemini for analysis before logging

**Form Fields:**
- Meal type: 4 pill-shaped selectors (🌅 Breakfast, ☀️ Lunch, 🌙 Dinner, 🍿 Snack) using `st.radio` with horizontal layout
- Morning weight (kg): `st.number_input` with 0.1 step, scale icon
- Workout notes: `st.text_area` with dumbbell icon
- Wind-down activities: `st.text_area` with moon icon

**Submit Button:**
- Gradient blue-to-cyan "✨ Analyze & Log" button
- On click: sends image to Gemini → displays AI results card → saves to CSV

### 2. Vision AI Analysis (gemini_analyzer.py)

**Model:** `gemini-2.5-flash`
**SDK:** `google-genai` (new unified SDK)

**Prompt Engineering:**
The prompt asks the model to analyze the food image and return structured JSON:
```json
{
  "calories": 485,
  "protein_g": 38,
  "carbs_g": 42,
  "fat_g": 16,
  "feedback": [
    "✅ Great protein-to-calorie ratio for muscle recovery",
    "⚠️ Consider adding more fiber-rich vegetables",
    "💡 Ideal post-workout recovery meal"
  ]
}
```

**Feedback Rules (encoded in prompt):**
- If meal_type is "Dinner" and time is after 9 PM: check for heavy fats and warn
- If workout_notes is non-empty: check for adequate protein/carb replenishment
- If fruits are detected: advise on sequencing (eat fruit at start, not end)
- General composition feedback (macro balance, calorie density)

**Error Handling:**
- If no API key: show info message with setup instructions
- If API call fails: show error, allow logging without AI analysis
- JSON parsing fallback: extract values with regex if structured output fails

### 3. Local Database (data_manager.py)

**CSV Schema — `data/fitness_log.csv`:**
| Column | Type | Description |
|--------|------|-------------|
| timestamp | datetime | ISO format entry time |
| date | date | YYYY-MM-DD for grouping |
| meal_type | string | Breakfast/Lunch/Dinner/Snack |
| calories | float | Estimated calories |
| protein_g | float | Protein in grams |
| carbs_g | float | Carbs in grams |
| fat_g | float | Fat in grams |
| weight_kg | float | Morning weight (nullable) |
| workout_notes | string | Free text |
| wind_down | string | Free text |
| ai_feedback | string | JSON-encoded feedback list |

**Operations:**
- `load_data()` → Returns DataFrame, creates file with headers if not exists
- `save_entry(entry_dict)` → Appends row to CSV
- `get_daily_summary(df)` → Groups by date, sums calories/macros, takes first non-null weight
- `get_streak(df)` → Counts consecutive days with at least one entry

### 4. Visual Analytics Tab

**Hero Weight Card:**
- Large current weight display with delta indicator (↓ green for loss, ↑ red for gain)
- Embedded sparkline (last 14 days) using Plotly
- "X.X kg this week" subtitle

**Calorie Ring + Macro Rings:**
- Large donut chart: today's calories vs 2000 cal target
- 3 smaller donut charts: Protein, Carbs, Fat progress rings
- Colors: Blue (protein), Orange (carbs), Green (fat)

**Weekly Trends:**
- Area chart with gradient fill showing daily calorie intake over last 7 days
- Smooth curves, data point markers
- Target line at 2000 cal

**Streak Badge:**
- "🔥 N Day Streak" glowing orange badge in header

### 5. Custom CSS Theme

All Streamlit default styling is overridden via `st.markdown(unsafe_allow_html=True)`:
- Dark background (#0D0D0D)
- Glassmorphic cards: `backdrop-filter: blur(10px)`, semi-transparent borders
- Custom button gradient (blue → cyan)
- Pill-shaped radio buttons
- Hide Streamlit header/footer/hamburger menu
- Full-width mobile layout

### 6. Progress Gallery Tab

**Visual Timeline:**
- A dedicated 3rd tab showing a chronological grid/timeline of progress photos.
- Displays the date and weight under each photo.
- Images are loaded locally from `data/progress_photos/`.

## Mobile Optimization

- `st.set_page_config(layout="wide", page_title="FUEL 🔥")`
- No sidebar — tabs only
- Touch-friendly input sizes
- Camera input works natively on mobile browsers
- Charts responsive via Plotly `config={'responsive': True}`

## Error Resilience

- CSV auto-created with headers on first run
- Empty data states show friendly messages ("No entries yet — start tracking!")
- Gemini API failure doesn't block logging
- Weight field is optional (not every meal entry needs a weight)
- Graceful handling of missing/corrupt CSV data

