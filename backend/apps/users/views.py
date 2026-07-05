"""
Views for users app.
"""
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from apps.core.permissions import IsAdminUser
from .serializers import UserCreateSerializer, UserCreateResponseSerializer, UserListResponseSerializer
from .services import UserService


class UserCreateView(APIView):
    """
    POST /api/users/

    Admin-only user creation API
    """

    permission_classes = [IsAdminUser]

    def post(self, request):
        """Create a new user."""
        # 1. Validate input
        serializer = UserCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        # 2. Call service layer
        service = UserService()
        result = service.create_user(
            username=serializer.validated_data['username'],
            password=serializer.validated_data['password'],
            full_name=serializer.validated_data['full_name'],
            role=serializer.validated_data.get('role', 'user'),
        )

        # 3. Return response
        response_serializer = UserCreateResponseSerializer(result)
        return Response(response_serializer.data, status=status.HTTP_201_CREATED)


class UserListView(APIView):
    """
    GET /api/users/

    List all users (admin only)
    """

    permission_classes = [IsAdminUser]

    def get(self, request):
        """Get list of users."""
        service = UserService()
        result = service.list_users()

        response_serializer = UserListResponseSerializer(result)
        return Response(response_serializer.data, status=status.HTTP_200_OK)
