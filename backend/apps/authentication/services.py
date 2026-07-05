"""
Business logic layer for authentication.
"""
from typing import Dict, Any
from .repositories import UserRepository
from .jwt import JWTEncoder
from .exceptions import AuthenticationFailed, AccountInactive, AccountLocked


class AuthService:
    """Authentication service."""

    def __init__(self):
        self.repository = UserRepository()
        self.jwt_encoder = JWTEncoder()

    def login(self, username: str, password: str) -> Dict[str, Any]:
        """
        Authenticate user and generate tokens.

        Args:
            username: Username
            password: Raw password

        Returns:
            Dictionary with tokens and user info

        Raises:
            AuthenticationFailed: If credentials are invalid
            AccountInactive: If account is inactive
            AccountLocked: If account is locked
        """
        # 1. Retrieve user by username
        user = self.repository.get_by_username(username)
        if user is None:
            raise AuthenticationFailed("아이디 또는 비밀번호가 일치하지 않습니다")

        # 2. Check account status
        if not user.is_active:
            raise AccountInactive("비활성된 계정입니다")

        if user.is_locked:
            raise AccountLocked("계정이 잠겨있습니다")

        # 3. Validate password
        if not user.check_password(password):
            raise AuthenticationFailed("아이디 또는 비밀번호가 일치하지 않습니다")

        # 4. Generate JWT tokens
        tokens = self.jwt_encoder.generate_tokens(user)

        # 5. Return response
        return {
            'access_token': tokens['access'],
            'refresh_token': tokens['refresh'],
            'user': {
                'id': user.id,
                'username': user.username,
                'full_name': user.full_name,
                'role': user.role,
            },
        }

    def logout(self, refresh_token: str, user_id: int) -> Dict[str, Any]:
        """
        Logout user and blacklist refresh token.

        Args:
            refresh_token: Refresh token to invalidate
            user_id: User ID for context

        Returns:
            Dictionary with success message
        """
        from .repositories import TokenBlacklistRepository
        
        blacklist_repo = TokenBlacklistRepository()
        success = blacklist_repo.add_to_blacklist(refresh_token, user_id)
        
        if success:
            return {
                'message': '로그아웃되었습니다',
                'status': 'success'
            }
        else:
            return {
                'message': '로그아웃 처리 중 오류가 발생했습니다',
                'status': 'error'
            }
