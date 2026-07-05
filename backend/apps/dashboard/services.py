"""
Service layer for dashboard - Business logic.
"""
from typing import Dict, List, Any, Optional
from datetime import datetime
from .repositories import DashboardRepository


class DashboardService:
    """Service for dashboard business logic."""
    
    def __init__(self):
        self.repository = DashboardRepository()
    
    def get_summary(
        self,
        year: Optional[int] = None,
        semester: Optional[str] = None,
        college: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        대시보드 요약 정보 조회.
        
        Args:
            year: 연도 필터 (None이면 전체 연도)
            semester: 학기 필터
            college: 단과대학 필터
            
        Returns:
            Dict: 요약 정보
        """
        statistics = self.repository.get_summary_statistics(
            year=year,
            semester=semester,
            college=college,
        )
        
        return {
            'year': year or 'all',
            'semester': semester or 'all',
            'college': college or 'all',
            'summary': statistics,
        }
    
    def get_kpi_data(
        self,
        year: Optional[int] = None,
        semester: Optional[str] = None,
        college: Optional[str] = None,
        department: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        KPI 데이터 조회.
        
        Returns:
            Dict: KPI 데이터
        """
        data = self.repository.get_kpi_data(
            year=year,
            semester=semester,
            college=college,
            department=department,
        )
        
        return {
            'count': len(data),
            'data': data,
            'filters': {
                'year': year,
                'semester': semester,
                'college': college,
                'department': department,
            }
        }
    
    def get_publication_data(
        self,
        year: Optional[int] = None,
        college: Optional[str] = None,
        department: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        논문 데이터 조회.
        
        Returns:
            Dict: 논문 데이터 및 추이
        """
        # Get list data
        data = self.repository.get_publication_data(
            year=year,
            college=college,
            department=department,
        )
        
        # Get trends (yearly)
        trends = self.repository.get_publication_trends(
            college=college,
            department=department,
        )
        
        return {
            'count': len(data),
            'data': data,
            'trends': trends,
            'filters': {
                'year': year,
                'college': college,
                'department': department,
            }
        }
    
    def get_research_data(
        self,
        year: Optional[int] = None,
        department: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        연구 프로젝트 데이터 조회.
        
        Returns:
            Dict: 연구 데이터 및 학과별 통계
        """
        # Get list data
        data = self.repository.get_research_data(
            year=year,
            department=department,
        )
        
        # Get department statistics
        dept_stats = self.repository.get_research_by_department(
            year=year,
        )
        
        return {
            'count': len(data),
            'data': data,
            'by_department': dept_stats,
            'filters': {
                'year': year,
                'department': department,
            }
        }
    
    def get_student_data(
        self,
        year: Optional[int] = None,
        college: Optional[str] = None,
        department: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        학생 데이터 조회.
        
        Returns:
            Dict: 학생 데이터 및 통계
        """
        # Get list data
        data = self.repository.get_student_data(
            year=year,
            college=college,
            department=department,
        )
        
        # Get statistics
        statistics = self.repository.get_student_statistics(
            year=year,
            college=college,
        )
        
        return {
            'count': len(data),
            'data': data,
            'statistics': statistics,
            'filters': {
                'year': year,
                'college': college,
                'department': department,
            }
        }
    
    def get_available_filters(self) -> Dict[str, List[str]]:
        """
        사용 가능한 필터 옵션 조회.
        
        Returns:
            Dict: 필터 옵션 리스트
        """
        return self.repository.get_available_filters()
    
    def get_report_data(
        self,
        report_type: str,
        year: Optional[int] = None,
        college: Optional[str] = None,
        department: Optional[str] = None,
        page: int = 1,
        limit: int = 20,
    ) -> Dict[str, Any]:
        """
        상세 리포트 데이터 조회 (페이지네이션 포함).
        
        Args:
            report_type: 'performance', 'publications', 'research', 'students'
            year: 연도 필터
            college: 단과대학 필터
            department: 학과 필터
            page: 페이지 번호
            limit: 페이지당 항목 수
            
        Returns:
            Dict: 페이지네이션된 리포트 데이터
        """
        # Map report type to data type
        type_mapping = {
            'performance': 'kpi',
            'publications': 'publication',
            'research': 'research',
            'students': 'student',
        }
        
        data_type = type_mapping.get(report_type)
        if not data_type:
            raise ValueError(f"Invalid report type: {report_type}")
        
        # Get data based on type
        if data_type == 'kpi':
            result = self.get_kpi_data(year=year, college=college, department=department)
            data = result['data']
        elif data_type == 'publication':
            result = self.get_publication_data(year=year, college=college, department=department)
            data = result['data']
        elif data_type == 'research':
            result = self.get_research_data(year=year, department=department)
            data = result['data']
        elif data_type == 'student':
            result = self.get_student_data(year=year, college=college, department=department)
            data = result['data']
        else:
            data = []
        
        # Apply pagination
        total = len(data)
        start = (page - 1) * limit
        end = start + limit
        paginated_data = data[start:end]
        
        return {
            'report_type': report_type,
            'data': paginated_data,
            'pagination': {
                'page': page,
                'limit': limit,
                'total': total,
                'pages': (total + limit - 1) // limit,  # Ceiling division
            },
            'filters': {
                'year': year,
                'college': college,
                'department': department,
            }
        }
