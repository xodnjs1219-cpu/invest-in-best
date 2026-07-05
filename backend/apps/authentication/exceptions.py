"""
Custom exceptions for authentication app.
"""
from rest_framework.exceptions import APIException
from rest_framework import status


class AuthenticationFailed(APIException):
    status_code = status.HTTP_401_UNAUTHORIZED
    default_detail = '아이디 또는 비밀번호가 일치하지 않습니다'
    default_code = 'AUTH_FAILED'


class AccountInactive(APIException):
    status_code = status.HTTP_400_BAD_REQUEST
    default_detail = '비활성된 계정입니다'
    default_code = 'ACCOUNT_INACTIVE'


class AccountLocked(APIException):
    status_code = status.HTTP_423_LOCKED
    default_detail = '계정이 잠겨있습니다'
    default_code = 'ACCOUNT_LOCKED'
