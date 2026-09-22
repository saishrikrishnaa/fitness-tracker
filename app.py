import streamlit as st
import pandas as pd
import os
from datetime import datetime
import json
from utils.gemini_analyzer import analyze_meal_image
from utils.data_manager import save_entry, load_data, save_progress_photo
from utils.logger import get_logger

logger = get_logger(__name__)

st.set_page_config(
    page_title="FUEL 🔥",
    page_icon="🔥",
    layout="wide",
    initial_sidebar_state="collapsed"
)

st.markdown('''
<style>
    #MainMenu {visibility: hidden;}
    header {visibility: hidden;}
    footer {visibility: hidden;}
    
    .glass-card {
        background: rgba(26, 26, 26, 0.6);
        backdrop-filter: blur(10px);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 16px;
        padding: 24px;
        margin-bottom: 16px;
    }
    
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
''', unsafe_allow_html=True)

def main() -> None:
    logger.info("App initialized")
    
    st.markdown('<h1 class="fuel-title">FUEL 🔥</h1>', unsafe_allow_html=True)
    st.markdown('<p class="fuel-subtitle">Track · Analyze · Transform</p>', unsafe_allow_html=True)
    
    tab1, tab2, tab3 = st.tabs(["📝 Log Entry", "📊 Analytics", "🖼️ Progress Gallery"])
    
    with tab1:
        st.markdown('<div class="glass-card">', unsafe_allow_html=True)
        
        col_a, col_b = st.columns(2)
        with col_a:
            meal_image = st.camera_input("📸 Scan your meal (Required)")
        with col_b:
            progress_photo = st.camera_input("🤳 Today\'s Progress Photo (Optional)")
        
        col1, col2 = st.columns(2)
        with col1:
            meal_type = st.radio("Meal Type", ["Breakfast", "Lunch", "Dinner", "Snack"], horizontal=True)
            weight_kg = st.number_input("Today\'s Weight (kg)", min_value=30.0, max_value=200.0, value=70.0, step=0.1)
        
        with col2:
            workout_notes = st.text_input("🏋️ Workout Notes")
            wind_down = st.text_input("🌙 Wind-down")
            
        if st.button("✨ Analyze & Log", use_container_width=True, type="primary"):
            if meal_image is None:
                st.warning("Please snap a photo of your meal first!")
            else:
                with st.spinner("Analyzing with Gemini..."):
                    img_bytes = meal_image.getvalue()
                    ai_results = analyze_meal_image(img_bytes, meal_type, workout_notes)
                    
                    if not ai_results:
                        st.error("Failed to analyze meal.")
                    else:
                        date_str = datetime.now().strftime("%Y-%m-%d")
                        time_str = datetime.now().strftime("%H%M%S")
                        
                        photo_path = None
                        if progress_photo is not None:
                            photo_bytes = progress_photo.getvalue()
                            photo_path = save_progress_photo(photo_bytes, date_str, time_str)
                        
                        entry = {
                            "timestamp": datetime.now().isoformat(),
                            "date": date_str,
                            "meal_type": meal_type,
                            "calories": ai_results["calories"],
                            "protein_g": ai_results["protein_g"],
                            "carbs_g": ai_results["carbs_g"],
                            "fat_g": ai_results["fat_g"],
                            "weight_kg": weight_kg,
                            "workout_notes": workout_notes,
                            "wind_down": wind_down,
                            "ai_feedback": json.dumps(ai_results["feedback"]),
                            "image_name": "logged_image.jpg",
                            "progress_photo": photo_path
                        }
                        
                        save_entry(entry)
                        st.success("Entry Logged Successfully!")
                        
                        st.subheader(f"Estimated: {ai_results['calories']} cal")
                        st.progress(min(ai_results['protein_g'] / 100, 1.0), text=f"Protein: {ai_results['protein_g']}g")
                        st.progress(min(ai_results['carbs_g'] / 300, 1.0), text=f"Carbs: {ai_results['carbs_g']}g")
                        st.progress(min(ai_results['fat_g'] / 100, 1.0), text=f"Fat: {ai_results['fat_g']}g")
                        
                        st.markdown("### 💡 AI Insights")
                        for point in ai_results['feedback']:
                            st.write(point)
                            
        st.markdown('</div>', unsafe_allow_html=True)
        
    with tab2:
        df = load_data()
        if df.empty:
            st.info("No data logged yet. Head to Log Entry to get started!")
        else:
            st.markdown('<div class="glass-card">', unsafe_allow_html=True)
            col1, col2, col3 = st.columns(3)
            with col1:
                st.metric("Total Meals Logged", len(df))
            with col2:
                if 'calories' in df.columns and 'date' in df.columns:
                    avg_daily = df.groupby('date')['calories'].sum().mean()
                    st.metric("Avg Daily Calories", f"{avg_daily:.0f} kcal")
                else:
                    st.metric("Avg Daily Calories", "N/A")
            with col3:
                if 'weight_kg' in df.columns and not df['weight_kg'].isnull().all():
                    last_weight = df['weight_kg'].dropna().iloc[-1]
                    st.metric("Current Weight", f"{last_weight:.1f} kg")
                else:
                    st.metric("Current Weight", "N/A")
                
            st.markdown("### Calorie Trend")
            if 'date' in df.columns and 'calories' in df.columns:
                trend_df = df.groupby('date')['calories'].sum().reset_index()
                st.line_chart(trend_df.set_index('date'))
            st.markdown('</div>', unsafe_allow_html=True)
        
    with tab3:
        df = load_data()
        if df.empty:
            st.info("No photos yet.")
        else:
            st.markdown('<div class="glass-card">', unsafe_allow_html=True)
            st.markdown("### 📸 Progress Gallery")
            
            if 'progress_photo' not in df.columns:
                st.write("No progress photos found in logs.")
            else:
                # Filter rows that have a valid progress photo
                photo_df = df.dropna(subset=['progress_photo']).copy()
                photo_df = photo_df[photo_df['progress_photo'] != ""]
                
                if photo_df.empty:
                    st.write("No progress photos found in logs.")
                else:
                    cols = st.columns(3)
                    for idx, (_, row) in enumerate(photo_df.iterrows()):
                        col_idx = idx % 3
                        with cols[col_idx]:
                            date_str = row['date'] if 'date' in row else "Unknown"
                            weight_str = f"{row['weight_kg']}kg" if 'weight_kg' in row else ""
                            caption = f"{date_str} - {weight_str}".strip(' -')
                            if isinstance(row['progress_photo'], str) and os.path.exists(row['progress_photo']):
                                st.image(row['progress_photo'], caption=caption, use_column_width=True)
                            else:
                                st.write(f"Photo missing: {row['progress_photo']}")
            st.markdown('</div>', unsafe_allow_html=True)

if __name__ == "__main__":
    main()
