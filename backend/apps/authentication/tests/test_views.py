"""
E2E API tests for LoginView (RED phase - Tests come first)
"""
import pytest
from django.contrib.auth.hashers import make_password
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from apps.authentication.models import User


@pytest.fixture
def api_client():
    """DRF API client fixture"""
    return APIClient()


@pytest.fixture
def admin_user(db):
    """Create admin user in database"""
    user = User.objects.create(
        username='admin_user',
        full_name='Admin User',
        role='admin',
        is_active=True,
        is_locked=False,
    )
    user.set_password('SecurePassword123!')
    user.save()
    return user


@pytest.fixture
def inactive_user(db):
    """Create inactive user in database"""
    user = User.objects.create(
        username='inactive_user',
        full_name='Inactive User',
        role='user',
        is_active=False,
        is_locked=False,
    )
    user.set_password('password')
    user.save()
    return user


@pytest.fixture
def locked_user(db):
    """Create locked user in database"""
    user = User.objects.create(
        username='locked_user',
        full_name='Locked User',
        role='user',
        is_active=True,
        is_locked=True,
    )
    user.set_password('password')
    user.save()
    return user


@pytest.mark.integration
class TestLoginViewAPI:
    """LoginView API E2E tests (NO MOCKING)"""

    def test_login_success_returns_tokens_and_user_data(self, api_client, admin_user):
        """
        Given: Valid admin user exists in database
        When: POST request to /api/auth/login/ with correct credentials
        Then: Should return 200 with access_token, refresh_token, and user data
        """
        # Arrange
        url = reverse('authentication:login')
        payload = {
            'username': 'admin_user',
            'password': 'SecurePassword123!',
        }

        # Act
        response = api_client.post(url, payload, format='json')

        # Assert
        assert response.status_code == status.HTTP_200_OK
        assert 'access_token' in response.data
        assert 'refresh_token' in response.data
        assert 'user' in response.data

        user_data = response.data['user']
        assert user_data['id'] == admin_user.id
        assert user_data['username'] == 'admin_user'
        assert user_data['full_name'] == 'Admin User'
        assert user_data['role'] == 'admin'

    def test_login_invalid_credentials_returns_401(self, api_client, admin_user):
        """
        Given: Valid user exists but wrong password provided
        When: POST request with incorrect password
        Then: Should return 401 Unauthorized
        """
        # Arrange
        url = reverse('authentication:login')
        payload = {
            'username': 'admin_user',
            'password': 'WrongPassword',
        }

        # Act
        response = api_client.post(url, payload, format='json')

        # Assert
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_login_nonexistent_user_returns_401(self, api_client):
        """
        Given: User does not exist in database
        When: POST request with non-existent username
        Then: Should return 401 Unauthorized
        """
        # Arrange
        url = reverse('authentication:login')
        payload = {
            'username': 'nonexistent_user',
            'password': 'password',
        }

        # Act
        response = api_client.post(url, payload, format='json')

        # Assert
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_login_inactive_account_returns_400(self, api_client, inactive_user):
        """
        Given: User account exists but is inactive
        When: POST request with correct credentials for inactive user
        Then: Should return 400 Bad Request
        """
        # Arrange
        url = reverse('authentication:login')
        payload = {
            'username': 'inactive_user',
            'password': 'password',
        }

        # Act
        response = api_client.post(url, payload, format='json')

        # Assert
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_login_locked_account_returns_423(self, api_client, locked_user):
        """
        Given: User account exists but is locked
        When: POST request with correct credentials for locked user
        Then: Should return 423 Locked
        """
        # Arrange
        url = reverse('authentication:login')
        payload = {
            'username': 'locked_user',
            'password': 'password',
        }

        # Act
        response = api_client.post(url, payload, format='json')

        # Assert
        assert response.status_code == status.HTTP_423_LOCKED

    def test_login_missing_username_returns_400(self, api_client):
        """
        Given: Missing username in request
        When: POST request without username field
        Then: Should return 400 Bad Request with validation error
        """
        # Arrange
        url = reverse('authentication:login')
        payload = {
            'password': 'password',
        }

        # Act
        response = api_client.post(url, payload, format='json')

        # Assert
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert 'username' in response.data

    def test_login_missing_password_returns_400(self, api_client):
        """
        Given: Missing password in request
        When: POST request without password field
        Then: Should return 400 Bad Request with validation error
        """
        # Arrange
        url = reverse('authentication:login')
        payload = {
            'username': 'admin_user',
        }

        # Act
        response = api_client.post(url, payload, format='json')

        # Assert
        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert 'password' in response.data

    def test_login_empty_payload_returns_400(self, api_client):
        """
        Given: Empty request body
        When: POST request with empty payload
        Then: Should return 400 Bad Request
        """
        # Arrange
        url = reverse('authentication:login')
        payload = {}

        # Act
        response = api_client.post(url, payload, format='json')

        # Assert
        assert response.status_code == status.HTTP_400_BAD_REQUEST
