"""
Custom exceptions for users app.
"""
from rest_framework.exceptions import APIException
from rest_framework import status


class UserCreationError(APIException):
    """Base exception for user creation errors."""

    status_code = status.HTTP_500_INTERNAL_SERVER_ERROR
    default_detail = "사용자 생성 중 오류가 발생했습니다"


class ValidationError(APIException):
    """Validation error."""

    status_code = status.HTTP_400_BAD_REQUEST
    default_detail = "입력값이 유효하지 않습니다"


class DuplicateUsernameError(APIException):
    """Username already exists."""

    status_code = status.HTTP_409_CONFLICT
    default_detail = "이미 사용 중인 아이디입니다"


class PasswordPolicyError(APIException):
    """Password does not meet policy."""

    status_code = status.HTTP_400_BAD_REQUEST
    default_detail = "비밀번호가 정책을 만족하지 않습니다"
