"""
Repository layer for dashboard - Data access layer.
"""
from typing import List, Dict, Any, Optional
from django.db.models import Count, Avg, Sum, Q
from apps.data_upload.models import UploadedData


class DashboardRepository:
    """Repository for dashboard data queries."""
    
    def get_summary_statistics(
        self,
        year: Optional[int] = None,
        semester: Optional[str] = None,
        college: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        전체 요약 통계 조회.
        
        Args:
            year: 필터링할 연도
            semester: 필터링할 학기
            college: 필터링할 단과대학
            
        Returns:
            Dict: 요약 통계 정보
        """
        # Base queryset
        queryset = UploadedData.objects.all()
        
        # Apply filters
        if year:
            queryset = queryset.filter(year=year)
        if semester and semester != 'all':
            queryset = queryset.filter(semester=semester)
        if college and college != 'all':
            queryset = queryset.filter(college=college)
        
        # Get counts by data type
        student_count = queryset.filter(data_type='student').count()
        publication_count = queryset.filter(data_type='publication').count()
        
        # Debug: Log publication count
        print(f"[DEBUG] Total publications in DB: {publication_count}")
        print(f"[DEBUG] Filters - year: {year}, semester: {semester}, college: {college}")
        
        # Get research projects count (unique by 과제번호)
        research_data = queryset.filter(data_type='research')
        unique_projects = set()
        total_research_budget = 0
        
        for item in research_data:
            # Count unique projects by 과제번호
            project_number = item.metadata.get('과제번호')
            if project_number:
                unique_projects.add(project_number)
            
            # Sum total research budget (총연구비)
            budget = item.metadata.get('총연구비', 0)
            if budget:
                try:
                    total_research_budget += int(budget)
                except (ValueError, TypeError):
                    pass
        
        print(f"[DEBUG] Research projects: {len(unique_projects)}, Budget: {total_research_budget}")
        
        return {
            'total_students': student_count,
            'total_publications': publication_count,
            'total_research_projects': len(unique_projects),
            'total_research_budget': total_research_budget,
        }
    
    def get_kpi_data(
        self,
        year: Optional[int] = None,
        semester: Optional[str] = None,
        college: Optional[str] = None,
        department: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """
        KPI 데이터 조회.
        
        Returns:
            List[Dict]: KPI 데이터 리스트
        """
        queryset = UploadedData.objects.filter(data_type='kpi')
        
        if year:
            queryset = queryset.filter(year=year)
        if semester and semester != 'all':
            queryset = queryset.filter(semester=semester)
        if college and college != 'all':
            queryset = queryset.filter(college=college)
        if department:
            queryset = queryset.filter(department=department)
        
        data = []
        for item in queryset:
            data.append({
                'id': item.id,
                'year': item.year,
                'semester': item.semester,
                'college': item.college,
                'department': item.department,
                **item.metadata,  # Spread metadata fields
            })
        
        return data
    
    def get_publication_data(
        self,
        year: Optional[int] = None,
        college: Optional[str] = None,
        department: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """
        논문 데이터 조회.
        
        Returns:
            List[Dict]: 논문 데이터 리스트
        """
        queryset = UploadedData.objects.filter(data_type='publication')
        
        if year:
            queryset = queryset.filter(year=year)
        if college and college != 'all':
            queryset = queryset.filter(college=college)
        if department:
            queryset = queryset.filter(department=department)
        
        data = []
        for item in queryset:
            data.append({
                'id': item.id,
                'year': item.year,
                'college': item.college,
                'department': item.department,
                **item.metadata,
            })
        
        return data
    
    def get_publication_trends(
        self,
        college: Optional[str] = None,
        department: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """
        논문 게재 추이 데이터 (연도별 집계).
        
        Returns:
            List[Dict]: 연도별 논문 수
        """
        queryset = UploadedData.objects.filter(data_type='publication')
        
        if college and college != 'all':
            queryset = queryset.filter(college=college)
        if department:
            queryset = queryset.filter(department=department)
        
        # Group by year and count
        trends = (
            queryset
            .values('year')
            .annotate(count=Count('id'))
            .order_by('year')
        )
        
        return [
            {'year': item['year'], 'count': item['count']}
            for item in trends
        ]
    
    def get_research_data(
        self,
        year: Optional[int] = None,
        department: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """
        연구 프로젝트 데이터 조회.
        
        Returns:
            List[Dict]: 연구 프로젝트 데이터 리스트
        """
        queryset = UploadedData.objects.filter(data_type='research')
        
        if year:
            queryset = queryset.filter(year=year)
        if department:
            queryset = queryset.filter(department=department)
        
        data = []
        for item in queryset:
            data.append({
                'id': item.id,
                'year': item.year,
                'department': item.department,
                **item.metadata,
            })
        
        return data
    
    def get_research_by_department(
        self,
        year: Optional[int] = None,
    ) -> List[Dict[str, Any]]:
        """
        학과별 연구 프로젝트 집계.
        
        Returns:
            List[Dict]: 학과별 프로젝트 수와 총 연구비
        """
        queryset = UploadedData.objects.filter(data_type='research')
        
        if year:
            queryset = queryset.filter(year=year)
        
        # Group by department
        dept_data = {}
        for item in queryset:
            dept = item.department
            if dept not in dept_data:
                dept_data[dept] = {'count': 0, 'total_budget': 0}
            
            dept_data[dept]['count'] += 1
            
            budget = item.metadata.get('총연구비', 0)
            if budget:
                try:
                    dept_data[dept]['total_budget'] += int(budget)
                except (ValueError, TypeError):
                    pass
        
        return [
            {
                'department': dept,
                'project_count': data['count'],
                'total_budget': data['total_budget'],
            }
            for dept, data in dept_data.items()
        ]
    
    def get_student_data(
        self,
        year: Optional[int] = None,
        college: Optional[str] = None,
        department: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """
        학생 데이터 조회.
        
        Returns:
            List[Dict]: 학생 데이터 리스트
        """
        queryset = UploadedData.objects.filter(data_type='student')
        
        if year:
            queryset = queryset.filter(year=year)
        if college and college != 'all':
            queryset = queryset.filter(college=college)
        if department:
            queryset = queryset.filter(department=department)
        
        data = []
        for item in queryset:
            data.append({
                'id': item.id,
                'year': item.year,
                'college': item.college,
                'department': item.department,
                **item.metadata,
            })
        
        return data
    
    def get_student_statistics(
        self,
        year: Optional[int] = None,
        college: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        학생 통계 데이터.
        
        Returns:
            Dict: 학생 통계 (총학생수, 과정별 분포 등)
        """
        queryset = UploadedData.objects.filter(data_type='student')
        
        if year:
            queryset = queryset.filter(year=year)
        if college and college != 'all':
            queryset = queryset.filter(college=college)
        
        total_students = queryset.count()
        
        # Count by 과정구분
        program_counts = {}
        status_counts = {}
        
        for item in queryset:
            program = item.metadata.get('과정구분', 'Unknown')
            status = item.metadata.get('학적상태', 'Unknown')
            
            program_counts[program] = program_counts.get(program, 0) + 1
            status_counts[status] = status_counts.get(status, 0) + 1
        
        return {
            'total_students': total_students,
            'by_program': program_counts,
            'by_status': status_counts,
        }
    
    def get_available_filters(self) -> Dict[str, List[str]]:
        """
        사용 가능한 필터 옵션 조회.
        
        Returns:
            Dict: 필터 옵션 리스트
        """
        years = (
            UploadedData.objects
            .values_list('year', flat=True)
            .distinct()
            .order_by('-year')
        )
        
        colleges = (
            UploadedData.objects
            .exclude(college__isnull=True)
            .values_list('college', flat=True)
            .distinct()
            .order_by('college')
        )
        
        departments = (
            UploadedData.objects
            .exclude(department__isnull=True)
            .values_list('department', flat=True)
            .distinct()
            .order_by('department')
        )
        
        semesters = (
            UploadedData.objects
            .filter(data_type='kpi')
            .exclude(semester__isnull=True)
            .values_list('semester', flat=True)
            .distinct()
            .order_by('semester')
        )
        
        return {
            'years': [y for y in years if y],
            'colleges': [c for c in colleges if c],
            'departments': [d for d in departments if d],
            'semesters': [s for s in semesters if s],
        }
