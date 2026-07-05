"""
JWT token generation and validation.
"""
from typing import Dict, Any
from rest_framework_simplejwt.tokens import RefreshToken
from .models import User


class JWTEncoder:
    """JWT token encoder using djangorestframework-simplejwt."""

    @staticmethod
    def generate_tokens(user: User) -> Dict[str, str]:
        """
        Generate access and refresh tokens for a user.

        Args:
            user: User instance

        Returns:
            Dictionary with 'access' and 'refresh' tokens
        """
        refresh = RefreshToken()
        refresh['user_id'] = user.id
        refresh['username'] = user.username
        refresh['role'] = user.role

        return {
            'access': str(refresh.access_token),
            'refresh': str(refresh),
        }

    @staticmethod
    def refresh_access_token(refresh_token: str) -> str:
        """
        Generate new access token from refresh token.

        Args:
            refresh_token: Refresh token string

        Returns:
            New access token string
        """
        try:
            refresh = RefreshToken(refresh_token)
            return str(refresh.access_token)
        except Exception:
            return None
