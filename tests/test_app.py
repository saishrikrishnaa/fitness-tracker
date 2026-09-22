# -*- coding: utf-8 -*-
import pytest
from streamlit.testing.v1 import AppTest
import os
import sys

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
