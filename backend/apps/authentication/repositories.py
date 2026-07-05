"""
Repository layer for authentication.
"""

from typing import Optional
from .models import User, TokenBlacklist
from datetime import datetime


class UserRepository:
    """Repository for User model."""

    @staticmethod
    def get_by_username(username: str) -> Optional[User]:
        """Get user by username."""
        try:
            return User.objects.get(username=username)
        except User.DoesNotExist:
            return None

    @staticmethod
    def get_by_id(user_id: int) -> Optional[User]:
        """Get user by id."""
        try:
            return User.objects.get(id=user_id)
        except User.DoesNotExist:
            return None

    @staticmethod
    def create(username: str, password: str, full_name: str = '', role: str = 'user') -> User:
        """Create a new user."""
        user = User(username=username, full_name=full_name, role=role)
        user.set_password(password)
        user.save()
        return user

    @staticmethod
    def update(user: User, **kwargs) -> User:
        """Update user."""
        for key, value in kwargs.items():
            if key == 'password':
                user.set_password(value)
            else:
                setattr(user, key, value)
        user.save()
        return user


class TokenBlacklistRepository:
    """Repository for TokenBlacklist model."""

    @staticmethod
    def add_to_blacklist(token: str, user_id: int, expires_at: Optional[datetime] = None) -> bool:
        """Add refresh token to blacklist."""
        try:
            TokenBlacklist.objects.create(
                token=token,
                user_id=user_id,
                expires_at=expires_at
            )
            return True
        except Exception:
            return False

    @staticmethod
    def is_blacklisted(token: str) -> bool:
        """Check if token is blacklisted."""
        return TokenBlacklist.objects.filter(token=token).exists()

    @staticmethod
    def get_blacklist_entry(token: str) -> Optional[TokenBlacklist]:
        """Get blacklist entry for token."""
        try:
            return TokenBlacklist.objects.get(token=token)
        except TokenBlacklist.DoesNotExist:
            return None
