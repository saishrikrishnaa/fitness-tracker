import streamlit as st
import pandas as pd
import os
from utils.logger import get_logger

logger = get_logger(__name__)

st.set_page_config(
    page_title="FUEL 🔥",
    page_icon="🔥",
    layout="wide",
    initial_sidebar_state="collapsed"
)

st.markdown("""
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
""", unsafe_allow_html=True)

def main() -> None:
    logger.info("App initialized")
    
    st.markdown('<h1 class="fuel-title">FUEL 🔥</h1>', unsafe_allow_html=True)
    st.markdown('<p class="fuel-subtitle">Track · Analyze · Transform</p>', unsafe_allow_html=True)
    
    tab1, tab2, tab3 = st.tabs(["📝 Log Entry", "📊 Analytics", "🖼️ Progress Gallery"])
    
    with tab1:
        st.write("Log Entry UI goes here")
        
    with tab2:
        st.write("Analytics UI goes here")
        
    with tab3:
        st.write("Progress Gallery UI goes here")

if __name__ == "__main__":
    main()
