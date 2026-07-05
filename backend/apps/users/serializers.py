"""
Serializers for users app.
"""
from rest_framework import serializers


class UserCreateSerializer(serializers.Serializer):
    """User creation request DTO."""

    username = serializers.CharField(required=True, max_length=100)
    password = serializers.CharField(required=True, write_only=True)
    full_name = serializers.CharField(required=True, max_length=100)
    role = serializers.ChoiceField(choices=['admin', 'user'], default='user')


class UserSerializer(serializers.Serializer):
    """User info serializer."""

    id = serializers.IntegerField()
    username = serializers.CharField(max_length=100)
    full_name = serializers.CharField(max_length=100)
    role = serializers.CharField(max_length=20)
    is_active = serializers.BooleanField()


class UserCreateResponseSerializer(serializers.Serializer):
    """User creation response DTO."""

    id = serializers.IntegerField()
    username = serializers.CharField()
    full_name = serializers.CharField()
    role = serializers.CharField()
    is_active = serializers.BooleanField()
    created_at = serializers.DateTimeField()


class UserListResponseSerializer(serializers.Serializer):
    """User list response DTO."""

    users = UserSerializer(many=True)
    total = serializers.IntegerField()
