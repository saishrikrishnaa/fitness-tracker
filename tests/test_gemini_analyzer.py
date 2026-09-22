import os
import pytest
from unittest.mock import patch, MagicMock
from utils.gemini_analyzer import analyze_meal_image, ImageAnalysis

@pytest.fixture
def mock_env():
    with patch.dict(os.environ, {"GEMINI_API_KEY": "fake_key"}):
        yield

def test_analyze_meal_image_no_api_key():
    with patch.dict(os.environ, clear=True):
        if "GEMINI_API_KEY" in os.environ:
            del os.environ["GEMINI_API_KEY"]
        result = analyze_meal_image(b"fake_image_bytes", "Dinner", "None")
        assert result is None

@patch("utils.gemini_analyzer.genai.Client")
@patch("utils.gemini_analyzer.Image.open")
def test_analyze_meal_image_success(mock_image_open, mock_genai_client, mock_env):
    mock_client_instance = MagicMock()
    mock_genai_client.return_value = mock_client_instance
    
    mock_response = MagicMock()
    mock_parsed = ImageAnalysis(
        calories=500.0,
        protein_g=30.0,
        carbs_g=40.0,
        fat_g=20.0,
        feedback=["✅ Good protein", "⚠️ High fat", "💡 More veggies"]
    )
    mock_response.parsed = mock_parsed
    mock_client_instance.models.generate_content.return_value = mock_response
    
    result = analyze_meal_image(b"fake_bytes", "Dinner", "Leg day")
    
    assert result is not None
    assert result["calories"] == 500.0
    assert result["protein_g"] == 30.0
    assert result["carbs_g"] == 40.0
    assert result["fat_g"] == 20.0
    assert len(result["feedback"]) == 3
    
    mock_client_instance.models.generate_content.assert_called_once()
    mock_image_open.assert_called_once()

@patch("utils.gemini_analyzer.genai.Client")
def test_analyze_meal_image_exception(mock_genai_client, mock_env):
    mock_genai_client.side_effect = Exception("API Error")
    
    result = analyze_meal_image(b"fake_bytes", "Dinner", "None")
    
    assert result is None
