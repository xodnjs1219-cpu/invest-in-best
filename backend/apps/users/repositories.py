"""
Repository layer for users.
"""
from typing import Optional
from apps.authentication.models import User
from .exceptions import DuplicateUsernameError


class UserRepository:
    """Repository for User model."""

    @staticmethod
    def get_by_id(user_id: int) -> Optional[User]:
        """Get user by ID."""
        try:
            return User.objects.get(id=user_id)
        except User.DoesNotExist:
            return None

    @staticmethod
    def get_by_username(username: str) -> Optional[User]:
        """Get user by username."""
        try:
            return User.objects.get(username=username)
        except User.DoesNotExist:
            return None

    @staticmethod
    def username_exists(username: str) -> bool:
        """Check if username already exists."""
        return User.objects.filter(username=username).exists()

    @staticmethod
    def create(username: str, password: str, full_name: str = '', role: str = 'user') -> User:
        """
        Create a new user.

        Args:
            username: Username (must be unique)
            password: Raw password (will be hashed)
            full_name: User's full name
            role: User role ('admin' or 'user')

        Returns:
            Created User object

        Raises:
            DuplicateUsernameError: If username already exists
        """
        # Check if username already exists
        if UserRepository.username_exists(username):
            raise DuplicateUsernameError()

        # Create user
        user = User(
            username=username,
            full_name=full_name,
            role=role,
            is_active=True,
            is_locked=False
        )
        user.set_password(password)
        user.save()

        return user

    @staticmethod
    def list_users(limit: int = 100, offset: int = 0) -> tuple:
        """
        List all users with pagination.

        Returns:
            Tuple of (users, total_count)
        """
        queryset = User.objects.all()
        total_count = queryset.count()
        users = queryset[offset:offset + limit]
        return list(users), total_count
