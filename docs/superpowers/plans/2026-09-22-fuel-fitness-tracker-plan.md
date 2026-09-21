# FUEL 🔥 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a premium, mobile-first Streamlit fitness and nutrition tracker with Gemini 2.5 vision AI and robust logging.

**Architecture:** A Streamlit front-end leveraging a custom CSS dark theme. The backend logic is separated into a `data_manager` for CSV persistence and a `gemini_analyzer` for structured AI vision output. A unified `logger` tracks all system events.

**Architecture Diagram:**

```mermaid
graph TD
    subgraph UI [Streamlit App]
        A[app.py - Main UI]
        B[Tab 1: Log Entry]
        C[Tab 2: Analytics]
        A --> B
        A --> C
    end
    
    subgraph Backend [Utils]
        D[logger.py]
        E[gemini_analyzer.py]
        F[data_manager.py]
    end
    
    subgraph Storage [Local File System]
        G[(data/fitness_log.csv)]
        H[(logs/fuel_app.log)]
    end
    
    B --> E
    B --> F
    C --> F
    A -.-> D
    E -.-> D
    F -.-> D
    F --> G
    D --> H
```

**Tech Stack:** Python 3.10+, Streamlit, Pandas, Plotly, google-genai (Pydantic for structured output), Pytest.

**Spec:** `docs/superpowers/specs/2026-09-22-fuel-fitness-tracker-design.md`

## Global Constraints
- Use `gemini-2.5-flash` by default, but make the model string easily configurable.
- All code must include type hints.
- No placeholders (`TODO`, `TBD`, "add error handling") — write the actual code.
- Write tests using `pytest`.

---

### Task 1: Setup, Logging, and Data Manager

**Files:**
- Create: `requirements.txt`
- Create: `utils/logger.py`
- Create: `utils/data_manager.py`
- Create: `tests/test_data_manager.py`

**Interfaces:**
- Produces: `utils.logger.get_logger(name)` -> `logging.Logger`
- Produces: `utils.data_manager.save_entry(entry_dict: dict, file_path: str = "data/fitness_log.csv")`
- Produces: `utils.data_manager.load_data(file_path: str = "data/fitness_log.csv") -> pd.DataFrame`

- [ ] **Step 1: Create requirements and setup logging**

Create `requirements.txt`:
```text
streamlit==1.32.0
pandas==2.2.1
plotly==5.20.0
google-genai==0.3.0
pydantic==2.6.4
pillow==10.2.0
pytest==8.1.1
```

Create `utils/logger.py`:
```python
import logging
import os
from pathlib import Path

def get_logger(name: str) -> logging.Logger:
    log_dir = Path("logs")
    log_dir.mkdir(exist_ok=True)
    
    logger = logging.getLogger(name)
    if not logger.handlers:
        logger.setLevel(logging.INFO)
        formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
        
        file_handler = logging.FileHandler(log_dir / "fuel_app.log")
        file_handler.setFormatter(formatter)
        logger.addHandler(file_handler)
        
        console_handler = logging.StreamHandler()
        console_handler.setFormatter(formatter)
        logger.addHandler(console_handler)
        
    return logger
```

- [ ] **Step 2: Write tests for data manager**

Create `tests/test_data_manager.py`:
```python
import pandas as pd
import pytest
from pathlib import Path
from utils.data_manager import save_entry, load_data

def test_save_and_load_entry(tmp_path: Path):
    test_file = tmp_path / "test_log.csv"
    entry = {
        "timestamp": "2026-09-22T10:00:00",
        "date": "2026-09-22",
        "meal_type": "Breakfast",
        "calories": 400.0,
        "protein_g": 30.0,
        "carbs_g": 40.0,
        "fat_g": 10.0,
        "weight_kg": 70.5,
        "workout_notes": "Leg day",
        "wind_down": "Reading",
        "ai_feedback": '["Good protein"]',
        "image_name": "none.jpg"
    }
    
    # Save entry
    save_entry(entry, str(test_file))
    
    # Load and verify
    df = load_data(str(test_file))
    assert len(df) == 1
    assert df.iloc[0]["calories"] == 400.0
    assert df.iloc[0]["meal_type"] == "Breakfast"

def test_load_empty_creates_file(tmp_path: Path):
    test_file = tmp_path / "empty_log.csv"
    df = load_data(str(test_file))
    assert len(df) == 0
    assert test_file.exists()
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pytest tests/test_data_manager.py -v`
Expected: FAIL (ModuleNotFoundError for `utils.data_manager`)

- [ ] **Step 4: Write data manager implementation**

Create `utils/data_manager.py`:
```python
import pandas as pd
from pathlib import Path
import os
from utils.logger import get_logger

logger = get_logger(__name__)

COLUMNS = [
    "timestamp", "date", "meal_type", "calories", 
    "protein_g", "carbs_g", "fat_g", "weight_kg", 
    "workout_notes", "wind_down", "ai_feedback", "image_name"
]

def load_data(file_path: str = "data/fitness_log.csv") -> pd.DataFrame:
    path = Path(file_path)
    if not path.exists():
        logger.info(f"Creating new database file at {file_path}")
        path.parent.mkdir(parents=True, exist_ok=True)
        df = pd.DataFrame(columns=COLUMNS)
        df.to_csv(path, index=False)
        return df
    
    try:
        df = pd.read_csv(path)
        logger.info(f"Loaded {len(df)} records from {file_path}")
        return df
    except Exception as e:
        logger.error(f"Error loading data: {e}")
        return pd.DataFrame(columns=COLUMNS)

def save_entry(entry_dict: dict, file_path: str = "data/fitness_log.csv"):
    path = Path(file_path)
    df_new = pd.DataFrame([entry_dict])
    
    if not path.exists():
        path.parent.mkdir(parents=True, exist_ok=True)
        df_new.to_csv(path, index=False)
        logger.info("Saved first entry and created file.")
    else:
        df_new.to_csv(path, mode='a', header=False, index=False)
        logger.info(f"Appended new entry for {entry_dict.get('date')}.")
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pytest tests/test_data_manager.py -v`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add requirements.txt utils/logger.py utils/data_manager.py tests/test_data_manager.py
git commit -m "feat: setup logging and data manager"
```

---

### Task 2: Gemini Vision Analyzer

**Files:**
- Create: `utils/gemini_analyzer.py`
- Create: `tests/test_gemini_analyzer.py`

**Interfaces:**
- Consumes: `utils.logger.get_logger`
- Produces: `utils.gemini_analyzer.analyze_meal_image(image_bytes: bytes, meal_type: str, workout_notes: str) -> dict | None`

- [ ] **Step 1: Write test for Gemini analyzer**

Create `tests/test_gemini_analyzer.py`:
```python
import pytest
from unittest.mock import patch, MagicMock
from utils.gemini_analyzer import analyze_meal_image, ImageAnalysis

@patch('utils.gemini_analyzer.genai.Client')
def test_analyze_meal_image_success(mock_client_class):
    # Setup mock
    mock_client = MagicMock()
    mock_client_class.return_value = mock_client
    
    # Mock the parsed response
    mock_response = MagicMock()
    mock_response.parsed = ImageAnalysis(
        calories=500.0,
        protein_g=40.0,
        carbs_g=30.0,
        fat_g=20.0,
        feedback=["Looks good", "High protein"]
    )
    mock_client.models.generate_content.return_value = mock_response

    # Call function
    result = analyze_meal_image(b"fake_image_bytes", "Lunch", "Leg day")
    
    # Assertions
    assert result is not None
    assert result["calories"] == 500.0
    assert result["protein_g"] == 40.0
    assert len(result["feedback"]) == 2
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_gemini_analyzer.py -v`
Expected: FAIL (ModuleNotFoundError for `utils.gemini_analyzer`)

- [ ] **Step 3: Write Gemini Analyzer implementation**

Create `utils/gemini_analyzer.py`:
```python
import os
import io
from PIL import Image
from pydantic import BaseModel, Field
from google import genai
from utils.logger import get_logger

logger = get_logger(__name__)

# Model config - easily changeable to gemini-2.5-pro for maximum reasoning
MODEL_NAME = "gemini-2.5-flash"

class ImageAnalysis(BaseModel):
    calories: float = Field(description="Estimated total calories of the meal.")
    protein_g: float = Field(description="Estimated protein in grams.")
    carbs_g: float = Field(description="Estimated carbohydrates in grams.")
    fat_g: float = Field(description="Estimated fat in grams.")
    feedback: list[str] = Field(description="3 brief actionable feedback bullet points about the meal composition (use emojis ✅, ⚠️, 💡).")

def analyze_meal_image(image_bytes: bytes, meal_type: str, workout_notes: str) -> dict | None:
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        logger.error("GEMINI_API_KEY environment variable not set.")
        return None
        
    try:
        logger.info(f"Initializing Gemini Client. Model: {MODEL_NAME}")
        client = genai.Client(api_key=api_key)
        
        image = Image.open(io.BytesIO(image_bytes))
        
        prompt = f"""
        Analyze this food image. Provide estimated macros.
        Context: Meal type is {meal_type}. 
        Workout context: {workout_notes if workout_notes else 'None'}.
        
        Rules:
        - If Dinner and high fat, warn.
        - If workout context exists, check protein/carb replenishment.
        - Keep feedback concise and actionable.
        """
        
        logger.info("Sending request to Gemini Vision API.")
        response = client.models.generate_content(
            model=MODEL_NAME,
            contents=[prompt, image],
            config={
                "response_mime_type": "application/json",
                "response_schema": ImageAnalysis,
            },
        )
        
        result: ImageAnalysis = response.parsed
        logger.info("Successfully parsed Gemini structured output.")
        return result.model_dump()
        
    except Exception as e:
        logger.error(f"Failed to analyze image with Gemini: {e}")
        return None
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/test_gemini_analyzer.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add utils/gemini_analyzer.py tests/test_gemini_analyzer.py
git commit -m "feat: add gemini vision analyzer with structured output"
```

---

### Task 3: Streamlit UI Shell & Theming

**Files:**
- Create: `app.py`
- Create: `.streamlit/config.toml`

**Interfaces:**
- Produces: The main application entry point (`app.py`)

- [ ] **Step 1: Create Streamlit configuration**

Create `.streamlit/config.toml`:
```toml
[theme]
primaryColor = "#06B6D4"
backgroundColor = "#0D0D0D"
secondaryBackgroundColor = "#1A1A1A"
textColor = "#F3F4F6"
font = "sans serif"

[server]
runOnSave = true
```

- [ ] **Step 2: Create Main App Shell**

Create `app.py`:
```python
import streamlit as st
import pandas as pd
from utils.logger import get_logger

logger = get_logger(__name__)

# --- PAGE CONFIG ---
st.set_page_config(
    page_title="FUEL 🔥",
    page_icon="🔥",
    layout="wide",
    initial_sidebar_state="collapsed"
)

# --- CUSTOM CSS ---
st.markdown("""
<style>
    /* Hide Streamlit Chrome */
    #MainMenu {visibility: hidden;}
    header {visibility: hidden;}
    footer {visibility: hidden;}
    
    /* Glassmorphic Cards */
    .glass-card {
        background: rgba(26, 26, 26, 0.6);
        backdrop-filter: blur(10px);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 16px;
        padding: 24px;
        margin-bottom: 16px;
    }
    
    /* Premium Headers */
    .fuel-title {
        font-size: 3rem;
        font-weight: 800;
        background: -webkit-linear-gradient(45deg, #4F46E5, #06B6D4);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        margin-bottom: 0px;
    }
    .fuel-subtitle {
        color: #9CA3AF;
        font-size: 1.1rem;
        margin-bottom: 32px;
    }
</style>
""", unsafe_allow_html=True)

def main():
    logger.info("App initialized")
    
    st.markdown('<h1 class="fuel-title">FUEL 🔥</h1>', unsafe_allow_html=True)
    st.markdown('<p class="fuel-subtitle">Track · Analyze · Transform</p>', unsafe_allow_html=True)
    
    tab1, tab2 = st.tabs(["📝 Log Entry", "📊 Analytics"])
    
    with tab1:
        st.write("Log Entry UI goes here")
        
    with tab2:
        st.write("Analytics UI goes here")

if __name__ == "__main__":
    main()
```

- [ ] **Step 3: Commit**

```bash
git add app.py .streamlit/config.toml
git commit -m "feat: setup premium dark theme streamlit shell"
```

---

### Task 4: Implement Log Entry Tab

**Files:**
- Modify: `app.py`

**Interfaces:**
- Consumes: `utils.gemini_analyzer.analyze_meal_image`, `utils.data_manager.save_entry`

- [ ] **Step 1: Add Log Entry logic to app.py**

Modify `app.py` to import required modules and implement the Log Entry tab logic. Replace the `with tab1:` block and add imports.

```diff
--- app.py
+++ app.py
@@ -1,5 +1,8 @@
 import streamlit as st
 import pandas as pd
+from datetime import datetime
+import json
+from utils.gemini_analyzer import analyze_meal_image
+from utils.data_manager import save_entry
 from utils.logger import get_logger
 
 logger = get_logger(__name__)
@@ -53,7 +56,66 @@
     tab1, tab2 = st.tabs(["📝 Log Entry", "📊 Analytics"])
     
     with tab1:
-        st.write("Log Entry UI goes here")
+        st.markdown('<div class="glass-card">', unsafe_allow_html=True)
+        
+        meal_image = st.camera_input("📸 Scan your meal")
+        
+        col1, col2 = st.columns(2)
+        with col1:
+            meal_type = st.radio("Meal Type", ["Breakfast", "Lunch", "Dinner", "Snack"], horizontal=True)
+            weight_kg = st.number_input("Today's Weight (kg)", min_value=30.0, max_value=200.0, value=70.0, step=0.1)
+        
+        with col2:
+            workout_notes = st.text_input("🏋️ Workout Notes")
+            wind_down = st.text_input("🌙 Wind-down")
+            
+        if st.button("✨ Analyze & Log", use_container_width=True, type="primary"):
+            if meal_image is None:
+                st.warning("Please snap a photo of your meal first!")
+            else:
+                with st.spinner("Analyzing with Gemini..."):
+                    img_bytes = meal_image.getvalue()
+                    ai_results = analyze_meal_image(img_bytes, meal_type, workout_notes)
+                    
+                    entry = {
+                        "timestamp": datetime.now().isoformat(),
+                        "date": datetime.now().strftime("%Y-%m-%d"),
+                        "meal_type": meal_type,
+                        "calories": ai_results["calories"] if ai_results else 0.0,
+                        "protein_g": ai_results["protein_g"] if ai_results else 0.0,
+                        "carbs_g": ai_results["carbs_g"] if ai_results else 0.0,
+                        "fat_g": ai_results["fat_g"] if ai_results else 0.0,
+                        "weight_kg": weight_kg,
+                        "workout_notes": workout_notes,
+                        "wind_down": wind_down,
+                        "ai_feedback": json.dumps(ai_results["feedback"]) if ai_results else '[]',
+                        "image_name": "logged_image.jpg"
+                    }
+                    
+                    save_entry(entry)
+                    st.success("Entry Logged Successfully!")
+                    
+                    if ai_results:
+                        st.subheader(f"Estimated: {ai_results['calories']} cal")
+                        st.progress(min(ai_results['protein_g'] / 100, 1.0), text=f"Protein: {ai_results['protein_g']}g")
+                        st.progress(min(ai_results['carbs_g'] / 300, 1.0), text=f"Carbs: {ai_results['carbs_g']}g")
+                        st.progress(min(ai_results['fat_g'] / 100, 1.0), text=f"Fat: {ai_results['fat_g']}g")
+                        
+                        st.markdown("### 💡 AI Insights")
+                        for point in ai_results['feedback']:
+                            st.write(point)
+                            
+        st.markdown('</div>', unsafe_allow_html=True)
         
     with tab2:
         st.write("Analytics UI goes here")
```

- [ ] **Step 2: Commit**

```bash
git add app.py
git commit -m "feat: implement log entry UI and gemini integration"
```

---

### Task 5: Implement Analytics Tab

**Files:**
- Modify: `app.py`

**Interfaces:**
- Consumes: `utils.data_manager.load_data`

- [ ] **Step 1: Add Plotly charting logic to app.py**

Modify `app.py` to import `plotly.express` and implement the Analytics tab.

```diff
--- app.py
+++ app.py
@@ -1,6 +1,7 @@
 import streamlit as st
 import pandas as pd
 from datetime import datetime
 import json
+import plotly.express as px
 from utils.gemini_analyzer import analyze_meal_image
-from utils.data_manager import save_entry
+from utils.data_manager import save_entry, load_data
 from utils.logger import get_logger
@@ -107,7 +108,44 @@
         st.markdown('</div>', unsafe_allow_html=True)
         
     with tab2:
-        st.write("Analytics UI goes here")
+        df = load_data()
+        if df.empty:
+            st.info("No data yet. Log some meals to see analytics!")
+            return
+            
+        # Pre-process
+        df['date'] = pd.to_datetime(df['date'])
+        daily_summary = df.groupby('date').agg({
+            'calories': 'sum',
+            'protein_g': 'sum',
+            'carbs_g': 'sum',
+            'fat_g': 'sum',
+            'weight_kg': 'first' # Take morning weight
+        }).reset_index()
+        
+        st.markdown('<div class="glass-card">', unsafe_allow_html=True)
+        st.subheader("Your Progress")
+        
+        latest_weight = daily_summary['weight_kg'].dropna().iloc[-1] if not daily_summary['weight_kg'].dropna().empty else 0
+        st.metric("Current Weight", f"{latest_weight:.1f} kg")
+        
+        # Weight Chart
+        fig_weight = px.line(daily_summary, x='date', y='weight_kg', title='Weight Trend', markers=True)
+        fig_weight.update_layout(template="plotly_dark", paper_bgcolor="rgba(0,0,0,0)", plot_bgcolor="rgba(0,0,0,0)")
+        st.plotly_chart(fig_weight, use_container_width=True)
+        st.markdown('</div>', unsafe_allow_html=True)
+        
+        st.markdown('<div class="glass-card">', unsafe_allow_html=True)
+        # Calories Chart
+        fig_cal = px.bar(daily_summary, x='date', y='calories', title='Daily Calories vs Target')
+        fig_cal.add_hline(y=2000, line_dash="dash", line_color="red", annotation_text="Target")
+        fig_cal.update_layout(template="plotly_dark", paper_bgcolor="rgba(0,0,0,0)", plot_bgcolor="rgba(0,0,0,0)")
+        st.plotly_chart(fig_cal, use_container_width=True)
+        
+        # Macros Area Chart
+        fig_macro = px.area(daily_summary, x='date', y=['protein_g', 'carbs_g', 'fat_g'], title='Macro Distribution')
+        fig_macro.update_layout(template="plotly_dark", paper_bgcolor="rgba(0,0,0,0)", plot_bgcolor="rgba(0,0,0,0)")
+        st.plotly_chart(fig_macro, use_container_width=True)
+        st.markdown('</div>', unsafe_allow_html=True)
 
 if __name__ == "__main__":
```

- [ ] **Step 2: Commit**

```bash
git add app.py
git commit -m "feat: implement analytics dashboards using plotly"
```
