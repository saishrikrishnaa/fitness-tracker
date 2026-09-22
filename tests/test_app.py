
import pytest
from streamlit.testing.v1 import AppTest
import os
import sys
from unittest.mock import patch, MagicMock

# Add the parent directory to the path so utils can be imported by app.py
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

def test_app_runs() -> None:
    # Use Streamlit's official testing framework to run the app
    at = AppTest.from_file("app.py").run(timeout=15)
    
    # Assert that there are no exceptions during the run
    assert not at.exception

def test_log_entry_missing_image() -> None:
    at = AppTest.from_file("app.py").run(timeout=15)
    
    # Click the Analyze & Log button without setting the meal image
    at.button[0].click().run(timeout=15)
    
    assert at.warning[0].value == "Please snap a photo of your meal first!"

@patch("utils.gemini_analyzer.analyze_meal_image")
@patch("utils.data_manager.save_entry")
@patch("streamlit.camera_input")
def test_log_entry_success(mock_camera_input, mock_save_entry, mock_analyze_meal_image) -> None:
    # Set up mock camera input
    class MockUploadedFile:
        def getvalue(self):
            return b"fake_image_bytes"
            
    mock_camera_input.return_value = MockUploadedFile()
    
    mock_analyze_meal_image.return_value = {
        "calories": 500.0,
        "protein_g": 30.0,
        "carbs_g": 40.0,
        "fat_g": 20.0,
        "feedback": ["Great meal!"]
    }
    
    at = AppTest.from_file("app.py").run(timeout=15)
    
    # Set other inputs
    at.radio[0].set_value("Dinner").run(timeout=15)
    at.number_input[0].set_value(75.5).run(timeout=15)
    at.text_input[0].set_value("Heavy lifting").run(timeout=15)
    at.text_input[1].set_value("Reading a book").run(timeout=15)
    
    # Click the Analyze & Log button
    at.button[0].click().run(timeout=15)
    
    # Check for success message
    assert at.success[0].value == "Entry Logged Successfully!"
    
    # Verify save_entry was called
    mock_save_entry.assert_called_once()
    mock_analyze_meal_image.assert_called_once()
