import pytest
from django.core.cache import cache


@pytest.fixture(autouse=True)
def clear_throttle_counts():
    """Throttle counts live in the cache; start every test with a clean one."""
    cache.clear()
