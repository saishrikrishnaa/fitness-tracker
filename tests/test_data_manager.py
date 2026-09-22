import pandas as pd
import pytest
from pathlib import Path
from utils.data_manager import save_entry, load_data, save_progress_photo
import os

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
        "image_name": "none.jpg",
        "progress_photo": "data/progress_photos/2026-09-22.jpg"
    }
    
    save_entry(entry, str(test_file))
    df = load_data(str(test_file))
    assert len(df) == 1
    assert df.iloc[0]["calories"] == 400.0
    assert df.iloc[0]["progress_photo"] == "data/progress_photos/2026-09-22.jpg"

def test_save_progress_photo(tmp_path: Path):
    test_dir = tmp_path / "progress_photos"
    image_bytes = b"fake_image_data"
    
    saved_path = save_progress_photo(
        image_bytes, 
        "2026-09-22", 
        "100000", 
        str(test_dir)
    )
    
    assert Path(saved_path).exists()
    assert Path(saved_path).read_bytes() == b"fake_image_data"
