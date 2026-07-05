"""
Views for dashboard.
"""
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from .services import DashboardService


class SummaryView(APIView):
    """
    GET /api/dashboard/summary/
    
    대시보드 요약 정보 조회
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        """Get dashboard summary."""
        # Query parameters
        year = request.query_params.get('year')
        semester = request.query_params.get('semester', 'all')
        college = request.query_params.get('college', 'all')
        
        # Convert year to int if provided
        if year:
            try:
                year = int(year)
            except ValueError:
                return Response(
                    {'error': 'Invalid year parameter'},
                    status=status.HTTP_400_BAD_REQUEST
                )
        
        # Call service
        service = DashboardService()
        result = service.get_summary(
            year=year,
            semester=semester if semester != 'all' else None,
            college=college if college != 'all' else None,
        )
        
        return Response(result, status=status.HTTP_200_OK)


class KPIView(APIView):
    """
    GET /api/dashboard/kpi/
    
    KPI 데이터 조회
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        """Get KPI data."""
        # Query parameters
        year = request.query_params.get('year')
        semester = request.query_params.get('semester', 'all')
        college = request.query_params.get('college', 'all')
        department = request.query_params.get('department')
        
        if year:
            try:
                year = int(year)
            except ValueError:
                year = None
        
        # Call service
        service = DashboardService()
        result = service.get_kpi_data(
            year=year,
            semester=semester if semester != 'all' else None,
            college=college if college != 'all' else None,
            department=department,
        )
        
        return Response(result, status=status.HTTP_200_OK)


class PublicationsView(APIView):
    """
    GET /api/dashboard/publications/
    
    논문 데이터 조회
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        """Get publications data."""
        # Query parameters
        year = request.query_params.get('year')
        college = request.query_params.get('college', 'all')
        department = request.query_params.get('department')
        
        if year:
            try:
                year = int(year)
            except ValueError:
                year = None
        
        # Call service
        service = DashboardService()
        result = service.get_publication_data(
            year=year,
            college=college if college != 'all' else None,
            department=department,
        )
        
        return Response(result, status=status.HTTP_200_OK)


class ResearchView(APIView):
    """
    GET /api/dashboard/research/
    
    연구 프로젝트 데이터 조회
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        """Get research data."""
        # Query parameters
        year = request.query_params.get('year')
        department = request.query_params.get('department')
        
        if year:
            try:
                year = int(year)
            except ValueError:
                year = None
        
        # Call service
        service = DashboardService()
        result = service.get_research_data(
            year=year,
            department=department,
        )
        
        return Response(result, status=status.HTTP_200_OK)


class StudentsView(APIView):
    """
    GET /api/dashboard/students/
    
    학생 데이터 조회
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        """Get students data."""
        # Query parameters
        year = request.query_params.get('year')
        college = request.query_params.get('college', 'all')
        department = request.query_params.get('department')
        
        if year:
            try:
                year = int(year)
            except ValueError:
                year = None
        
        # Call service
        service = DashboardService()
        result = service.get_student_data(
            year=year,
            college=college if college != 'all' else None,
            department=department,
        )
        
        return Response(result, status=status.HTTP_200_OK)


class FiltersView(APIView):
    """
    GET /api/dashboard/filters/
    
    사용 가능한 필터 옵션 조회
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        """Get available filter options."""
        service = DashboardService()
        filters = service.get_available_filters()
        
        return Response(filters, status=status.HTTP_200_OK)


class ReportsView(APIView):
    """
    GET /api/dashboard/reports/{report_type}/
    
    상세 리포트 데이터 조회
    """

    permission_classes = [IsAuthenticated]

    def get(self, request, report_type):
        """Get detailed report data."""
        # Query parameters
        year = request.query_params.get('year')
        college = request.query_params.get('college', 'all')
        department = request.query_params.get('department')
        page = int(request.query_params.get('page', 1))
        limit = int(request.query_params.get('limit', 20))
        
        if year:
            try:
                year = int(year)
            except ValueError:
                year = None
        
        try:
            # Call service
            service = DashboardService()
            result = service.get_report_data(
                report_type=report_type,
                year=year,
                college=college if college != 'all' else None,
                department=department,
                page=page,
                limit=limit,
            )
            
            return Response(result, status=status.HTTP_200_OK)
            
        except ValueError as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )
