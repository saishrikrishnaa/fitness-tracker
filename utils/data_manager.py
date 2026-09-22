import pandas as pd
from pathlib import Path
import os
from utils.logger import get_logger

logger = get_logger(__name__)

COLUMNS = [
    "timestamp", "date", "meal_type", "calories", 
    "protein_g", "carbs_g", "fat_g", "weight_kg", 
    "workout_notes", "wind_down", "ai_feedback", "image_name", "progress_photo"
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

def save_entry(entry_dict: dict, file_path: str = "data/fitness_log.csv") -> None:
    path = Path(file_path)
    df_new = pd.DataFrame([entry_dict], columns=COLUMNS)
    
    if not path.exists():
        path.parent.mkdir(parents=True, exist_ok=True)
        df_new.to_csv(path, index=False)
        logger.info("Saved first entry and created file.")
    else:
        df_new.to_csv(path, mode='a', header=False, index=False)
        logger.info(f"Appended new entry for {entry_dict.get('date')}.")

def save_progress_photo(image_bytes: bytes, date_str: str, timestamp_str: str, base_dir: str = "data/progress_photos") -> str:
    path = Path(base_dir)
    path.mkdir(parents=True, exist_ok=True)
    safe_timestamp = timestamp_str.replace(":", "-")
    file_path = path / f"{date_str}_{safe_timestamp}.jpg"
    
    with open(file_path, "wb") as f:
        f.write(image_bytes)
        
    logger.info(f"Saved progress photo to {file_path}")
    return str(file_path)
