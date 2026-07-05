"""
Validators for user creation.
"""
import re
from typing import Tuple


class PasswordValidator:
    """Validate password against security policies."""

    @staticmethod
    def validate(password: str) -> Tuple[bool, str]:
        """
        Validate password against policy.

        Policy:
        - Minimum 8 characters
        - Must contain uppercase letter
        - Must contain lowercase letter
        - Must contain digit
        - Must contain special character

        Args:
            password: Raw password to validate

        Returns:
            Tuple of (is_valid, error_message)
        """
        if not password:
            return False, "비밀번호를 입력해주세요"

        if len(password) < 8:
            return False, "비밀번호는 최소 8자 이상이어야 합니다"

        if not re.search(r'[A-Z]', password):
            return False, "비밀번호는 영문 대문자를 포함해야 합니다"

        if not re.search(r'[a-z]', password):
            return False, "비밀번호는 영문 소문자를 포함해야 합니다"

        if not re.search(r'[0-9]', password):
            return False, "비밀번호는 숫자를 포함해야 합니다"

        if not re.search(r'[!@#$%^&*()_\-+=\[\]{};:\'",.<>?]', password):
            return False, "비밀번호는 특수문자를 포함해야 합니다"

        return True, ""


class UsernameValidator:
    """Validate username against policy."""

    @staticmethod
    def validate(username: str) -> Tuple[bool, str]:
        """
        Validate username against policy.

        Policy:
        - Minimum 3 characters, maximum 100
        - Only alphanumeric and underscore allowed

        Args:
            username: Username to validate

        Returns:
            Tuple of (is_valid, error_message)
        """
        if not username:
            return False, "아이디를 입력해주세요"

        if len(username) < 3 or len(username) > 100:
            return False, "아이디는 3-100자여야 합니다"

        if not re.match(r'^[a-zA-Z0-9_]+$', username):
            return False, "아이디는 영문, 숫자, 언더스코어만 사용 가능합니다"

        return True, ""
