"""Pytest configuration for VibeDev tests.

Handles async test cleanup to avoid Windows SQLite file locking issues.
"""

import asyncio
import gc
import pytest


@pytest.fixture(scope="function")
def event_loop():
    """Create an event loop for each test function."""
    loop = asyncio.new_event_loop()
    yield loop
    # Force close all connections before loop closes
    loop.run_until_complete(asyncio.sleep(0.1))
    gc.collect()
    loop.close()


def pytest_configure(config):
    """Configure pytest-asyncio mode."""
    config.addinivalue_line(
        "markers", "asyncio: mark test as an asyncio test."
    )


# Force pytest-asyncio to use function scope
pytest_plugins = ("pytest_asyncio",)
