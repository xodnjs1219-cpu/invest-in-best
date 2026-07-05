"""
Serializers for authentication.
"""
from rest_framework import serializers


class LoginSerializer(serializers.Serializer):
    """Login request DTO."""

    username = serializers.CharField(required=True, max_length=150)
    password = serializers.CharField(required=True, write_only=True)


class UserSerializer(serializers.Serializer):
    """User info serializer."""

    id = serializers.IntegerField()
    username = serializers.CharField(max_length=100)
    full_name = serializers.CharField(max_length=100, allow_blank=True)
    role = serializers.CharField(max_length=20)


class LoginResponseSerializer(serializers.Serializer):
    """Login response DTO."""

    access_token = serializers.CharField()
    refresh_token = serializers.CharField()
    user = UserSerializer()


class LogoutSerializer(serializers.Serializer):
    """Logout request DTO."""

    refresh_token = serializers.CharField(required=True, write_only=True)


class LogoutResponseSerializer(serializers.Serializer):
    """Logout response DTO."""

    message = serializers.CharField()
    status = serializers.CharField()
