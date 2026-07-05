"""
Unit tests for AuthService (RED phase - Tests come first)
"""
import pytest
from unittest.mock import MagicMock, patch
from django.contrib.auth.hashers import make_password

from apps.authentication.services import AuthService
from apps.authentication.exceptions import (
    AuthenticationFailed,
    AccountInactive,
    AccountLocked,
)


@pytest.fixture
def mock_user_repository():
    """Mock UserRepository fixture"""
    return MagicMock()


@pytest.fixture
def mock_jwt_encoder():
    """Mock JWTEncoder fixture"""
    encoder = MagicMock()
    encoder.generate_tokens.return_value = {
        'access': 'fake_access_token',
        'refresh': 'fake_refresh_token'
    }
    return encoder


@pytest.fixture
def auth_service(mock_user_repository, mock_jwt_encoder):
    """AuthService with injected mocks"""
    service = AuthService()
    service.repository = mock_user_repository
    service.jwt_encoder = mock_jwt_encoder
    return service


@pytest.mark.unit
class TestAuthServiceLogin:
    """AuthService.login() unit tests"""

    def test_login_success_returns_tokens_and_user_info(self, auth_service, mock_user_repository):
        """
        Given: Valid user account with correct password
        When: User calls login with username and password
        Then: Should return access_token, refresh_token, and user info
        """
        # Arrange
        mock_user = MagicMock()
        mock_user.id = 1
        mock_user.username = 'admin_user'
        mock_user.full_name = 'Admin User'
        mock_user.role = 'admin'
        mock_user.is_active = True
        mock_user.is_locked = False
        mock_user.check_password.return_value = True

        mock_user_repository.get_by_username.return_value = mock_user

        # Act
        result = auth_service.login(username='admin_user', password='SecurePassword123!')

        # Assert
        assert result['access_token'] == 'fake_access_token'
        assert result['refresh_token'] == 'fake_refresh_token'
        assert result['user']['id'] == 1
        assert result['user']['username'] == 'admin_user'
        assert result['user']['full_name'] == 'Admin User'
        assert result['user']['role'] == 'admin'
        mock_user_repository.get_by_username.assert_called_once_with('admin_user')
        mock_user.check_password.assert_called_once_with('SecurePassword123!')

    def test_login_user_not_found_raises_authentication_failed(self, auth_service, mock_user_repository):
        """
        Given: User does not exist in database
        When: User calls login with non-existent username
        Then: Should raise AuthenticationFailed exception
        """
        # Arrange
        mock_user_repository.get_by_username.return_value = None

        # Act & Assert
        with pytest.raises(AuthenticationFailed) as exc_info:
            auth_service.login(username='nonexistent', password='password')

        assert str(exc_info.value.detail) == '아이디 또는 비밀번호가 일치하지 않습니다'

    def test_login_invalid_password_raises_authentication_failed(self, auth_service, mock_user_repository):
        """
        Given: Valid user with correct username but wrong password
        When: User calls login with incorrect password
        Then: Should raise AuthenticationFailed exception
        """
        # Arrange
        mock_user = MagicMock()
        mock_user.is_active = True
        mock_user.is_locked = False
        mock_user.check_password.return_value = False

        mock_user_repository.get_by_username.return_value = mock_user

        # Act & Assert
        with pytest.raises(AuthenticationFailed) as exc_info:
            auth_service.login(username='user', password='WrongPassword')

        assert str(exc_info.value.detail) == '아이디 또는 비밀번호가 일치하지 않습니다'

    def test_login_inactive_account_raises_account_inactive(self, auth_service, mock_user_repository):
        """
        Given: Valid user account but inactive (is_active=False)
        When: User calls login with correct credentials
        Then: Should raise AccountInactive exception
        """
        # Arrange
        mock_user = MagicMock()
        mock_user.is_active = False
        mock_user.is_locked = False

        mock_user_repository.get_by_username.return_value = mock_user

        # Act & Assert
        with pytest.raises(AccountInactive) as exc_info:
            auth_service.login(username='user', password='password')

        assert str(exc_info.value.detail) == '비활성된 계정입니다'

    def test_login_locked_account_raises_account_locked(self, auth_service, mock_user_repository):
        """
        Given: Valid user account but locked (is_locked=True)
        When: User calls login with correct credentials
        Then: Should raise AccountLocked exception
        """
        # Arrange
        mock_user = MagicMock()
        mock_user.is_active = True
        mock_user.is_locked = True

        mock_user_repository.get_by_username.return_value = mock_user

        # Act & Assert
        with pytest.raises(AccountLocked) as exc_info:
            auth_service.login(username='user', password='password')

        assert str(exc_info.value.detail) == '계정이 잠겨있습니다'

    def test_login_calls_jwt_encoder_with_user(self, auth_service, mock_user_repository):
        """
        Given: Valid and active user account
        When: User successfully logs in
        Then: JWTEncoder should be called with the user object
        """
        # Arrange
        mock_user = MagicMock()
        mock_user.id = 1
        mock_user.username = 'admin_user'
        mock_user.full_name = 'Admin User'
        mock_user.role = 'admin'
        mock_user.is_active = True
        mock_user.is_locked = False
        mock_user.check_password.return_value = True

        mock_user_repository.get_by_username.return_value = mock_user

        # Act
        auth_service.login(username='admin_user', password='SecurePassword123!')

        # Assert
        auth_service.jwt_encoder.generate_tokens.assert_called_once_with(mock_user)
