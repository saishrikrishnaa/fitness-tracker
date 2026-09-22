import os
import io
from PIL import Image
from pydantic import BaseModel, Field
from google import genai
from utils.logger import get_logger

logger = get_logger(__name__)

# Using gemini-2.5-pro for rigorous dietary reasoning
MODEL_NAME = "gemini-2.5-pro"

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
