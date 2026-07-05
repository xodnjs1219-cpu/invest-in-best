"""
Custom permissions for the application.
"""
from rest_framework import permissions


class IsAdminUser(permissions.BasePermission):
    """Allow access only to admin users."""

    message = "관리자만 이 기능을 사용할 수 있습니다"

    def has_permission(self, request, view):
        """Check if user is admin."""
        if not request.user or not request.user.is_authenticated:
            return False

        return hasattr(request.user, 'role') and request.user.role == 'admin'
