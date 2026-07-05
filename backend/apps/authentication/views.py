"""
Views for authentication.
"""
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated

from .serializers import LoginSerializer, LoginResponseSerializer, UserSerializer
from .services import AuthService


class LoginView(APIView):
    """
    POST /api/auth/login/

    User login API - generates JWT tokens
    """

    permission_classes = [AllowAny]

    def post(self, request):
        """Login with username and password."""
        # 1. Validate input
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        # 2. Call service layer
        service = AuthService()
        result = service.login(
            username=serializer.validated_data['username'],
            password=serializer.validated_data['password'],
        )

        # 3. Return response
        response_serializer = LoginResponseSerializer(result)
        return Response(response_serializer.data, status=status.HTTP_200_OK)


class LogoutView(APIView):
    """
    POST /api/auth/logout/

    User logout API - invalidates refresh token
    """

    def post(self, request):
        """Logout and blacklist refresh token."""
        from .serializers import LogoutSerializer, LogoutResponseSerializer

        # 1. Validate input
        serializer = LogoutSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        # 2. Call service layer
        service = AuthService()
        result = service.logout(
            refresh_token=serializer.validated_data['refresh_token'],
            user_id=getattr(request.user, 'id', None) or 0,
        )

        # 3. Return response
        response_serializer = LogoutResponseSerializer(result)
        return Response(response_serializer.data, status=status.HTTP_200_OK)


class CurrentUserView(APIView):
    """
    GET /api/auth/me/

    Get current user information - requires authentication
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        """Get current user info from JWT token."""
        user = request.user
        serializer = UserSerializer({
            'id': user.id,
            'username': user.username,
            'full_name': user.full_name,
            'role': user.role,
        })
        return Response(serializer.data, status=status.HTTP_200_OK)
