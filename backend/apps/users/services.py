"""
Business logic layer for users.
"""
from typing import Dict, Any
from .repositories import UserRepository
from .validators import PasswordValidator, UsernameValidator
from .exceptions import ValidationError, PasswordPolicyError, DuplicateUsernameError


class UserService:
    """User management service."""

    def __init__(self):
        self.repository = UserRepository()
        self.password_validator = PasswordValidator()
        self.username_validator = UsernameValidator()

    def create_user(self, username: str, password: str, full_name: str, role: str = 'user') -> Dict[str, Any]:
        """
        Create a new user with validation.

        Args:
            username: Username
            password: Raw password
            full_name: User's full name
            role: User role ('admin' or 'user')

        Returns:
            Dictionary with created user info

        Raises:
            ValidationError: If input is invalid
            PasswordPolicyError: If password doesn't meet policy
            DuplicateUsernameError: If username already exists
        """
        # 1. Validate username
        is_valid, error_msg = self.username_validator.validate(username)
        if not is_valid:
            raise ValidationError(detail=error_msg)

        # 2. Validate password
        is_valid, error_msg = self.password_validator.validate(password)
        if not is_valid:
            raise PasswordPolicyError(detail=error_msg)

        # 3. Validate full_name
        if not full_name or len(full_name) == 0:
            raise ValidationError(detail="이름을 입력해주세요")

        # 4. Create user (will check for duplicate username)
        user = self.repository.create(
            username=username,
            password=password,
            full_name=full_name,
            role=role
        )

        # 5. Return user info
        return {
            'id': user.id,
            'username': user.username,
            'full_name': user.full_name,
            'role': user.role,
            'is_active': user.is_active,
            'created_at': user.created_at.isoformat() if user.created_at else None
        }

    def list_users(self) -> Dict[str, Any]:
        """List all users."""
        users, total_count = self.repository.list_users()
        return {
            'users': [
                {
                    'id': user.id,
                    'username': user.username,
                    'full_name': user.full_name,
                    'role': user.role,
                    'is_active': user.is_active,
                }
                for user in users
            ],
            'total': total_count
        }
