"""
Views for data upload.
"""
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import MultiPartParser, FormParser
from apps.core.permissions import IsAdminUser
from .services import DataUploadService
from .serializers import (
    DataUploadLogSerializer,
    UploadFileRequestSerializer,
    UploadFileResponseSerializer,
)
from .exceptions import DataUploadError


class DataUploadView(APIView):
    """
    POST /api/data-upload/upload/
    
    파일 업로드 API (관리자 전용)
    """
    
    permission_classes = [IsAdminUser]
    parser_classes = [MultiPartParser, FormParser]
    
    def post(self, request):
        """Upload and process data file."""
        import logging
        logger = logging.getLogger(__name__)
        
        # Debug: Log received data
        logger.info(f"Received data keys: {request.data.keys()}")
        logger.info(f"Received FILES keys: {request.FILES.keys()}")
        
        # 1. Validate request
        serializer = UploadFileRequestSerializer(data=request.data)
        if not serializer.is_valid():
            logger.error(f"Validation errors: {serializer.errors}")
            return Response(
                {
                    'error': 'Invalid request',
                    'details': serializer.errors
                },
                status=status.HTTP_400_BAD_REQUEST
            )
        
        uploaded_file = serializer.validated_data['file']
        replace_existing = serializer.validated_data.get('replace_existing', True)
        
        try:
            # 2. Read file content
            file_content = uploaded_file.read()
            
            # 3. Call service layer
            service = DataUploadService()
            result = service.upload_and_process(
                file_content=file_content,
                filename=uploaded_file.name,
                file_size=uploaded_file.size,
                user_id=request.user.id,
                content_type=uploaded_file.content_type,
                replace_existing=replace_existing,
            )
            
            # 4. Return response
            response_serializer = UploadFileResponseSerializer(result)
            return Response(response_serializer.data, status=status.HTTP_201_CREATED)
            
        except DataUploadError as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )
        except Exception as e:
            return Response(
                {'error': f'서버 오류가 발생했습니다: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class DataUploadListView(APIView):
    """
    GET /api/data-upload/logs/
    
    업로드 이력 조회 API
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        """Get upload logs."""
        # Query parameters
        page = int(request.query_params.get('page', 1))
        limit = int(request.query_params.get('limit', 20))
        
        # Check if user is admin
        is_admin = request.user.role == 'admin'
        
        # Call service
        service = DataUploadService()
        result = service.get_upload_logs(
            user_id=request.user.id if not is_admin else None,
            is_admin=is_admin,
            page=page,
            limit=limit,
        )
        
        # Serialize logs
        logs_serializer = DataUploadLogSerializer(result['logs'], many=True)
        
        return Response({
            'logs': logs_serializer.data,
            'total': result['total'],
            'page': result['page'],
            'limit': result['limit'],
        }, status=status.HTTP_200_OK)


class DataStatisticsView(APIView):
    """
    GET /api/data-upload/statistics/
    
    업로드 데이터 통계 조회 API
    """
    
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        """Get data statistics."""
        service = DataUploadService()
        statistics = service.get_data_statistics()
        
        return Response(statistics, status=status.HTTP_200_OK)


class DataDeleteView(APIView):
    """
    DELETE /api/data-upload/delete/<log_id>/
    
    업로드 데이터 삭제 API (관리자 전용)
    """
    
    permission_classes = [IsAdminUser]
    
    def delete(self, request, log_id):
        """Delete uploaded data by log ID."""
        try:
            service = DataUploadService()
            result = service.delete_upload_data(
                log_id=log_id,
                user_id=request.user.id
            )
            
            return Response(result, status=status.HTTP_200_OK)
            
        except DataUploadError as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )
        except Exception as e:
            return Response(
                {'error': f'서버 오류가 발생했습니다: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
