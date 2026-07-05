"""
Custom JWT authentication backend for custom User model.
"""
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import InvalidToken
from apps.authentication.models import User


class CustomJWTAuthentication(JWTAuthentication):
    """
    Custom JWT authentication that uses our custom User model.
    """

    def get_user(self, validated_token):
        """
        Get user from validated token using custom User model.
        """
        try:
            user_id = validated_token.get('user_id')
            if user_id is None:
                raise InvalidToken('Token contained no recognizable user identification')

            # Use custom User model
            user = User.objects.filter(id=user_id, is_active=True).first()
            if user is None:
                raise InvalidToken('User not found or inactive')

            return user

        except User.DoesNotExist:
            raise InvalidToken('User not found')
