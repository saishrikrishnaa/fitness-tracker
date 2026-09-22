import pytest
import sys
import os
from unittest.mock import patch, MagicMock

# Add the parent directory to the path so we can import app
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

@patch("streamlit.set_page_config")
@patch("streamlit.markdown")
@patch("streamlit.tabs")
@patch("streamlit.write")
def test_app_imports_and_runs(mock_write: MagicMock, mock_tabs: MagicMock, mock_markdown: MagicMock, mock_set_page_config: MagicMock) -> None:
    # Setup mock for tabs
    mock_tab1 = MagicMock()
    mock_tab2 = MagicMock()
    mock_tab3 = MagicMock()
    mock_tabs.return_value = (mock_tab1, mock_tab2, mock_tab3)
    
    # We can import app.py now. We do it inside the test so mocks are active before import if it executed on import,
    # but app.py only executes `main()` on `if __name__ == "__main__"`. Wait, it calls `st.set_page_config` 
    # and `st.markdown` directly on import. So we need the patches active during import.
    import app
    
    # Call main function
    app.main()
    
    # Assertions
    mock_set_page_config.assert_called_once()
    mock_tabs.assert_called_once_with(["📝 Log Entry", "📊 Analytics", "🖼️ Progress Gallery"])
