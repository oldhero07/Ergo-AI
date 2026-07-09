import os
import sys

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import app as app_module  # noqa: E402


@pytest.fixture(autouse=True)
def _fresh_rate_table():
    """Each test starts with clean rate-limit bookkeeping, so suites that make
    many requests (golden/determinism runs) never trip the per-IP limits."""
    app_module._rate_table.clear()
    yield
    app_module._rate_table.clear()
