"""
Pytest configuration and fixtures
"""
import os
import django
from django.conf import settings

# Configure Django settings
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.development')
django.setup()

import pytest
from rest_framework.test import APIClient


@pytest.fixture
def api_client():
    """DRF API client for testing"""
    return APIClient()


@pytest.fixture
def db_setup(db):
    """Setup test database"""
    # This fixture ensures database is available for tests
    return db
