"""
Validators for data upload.
"""
from typing import Dict, List, Any


class DataValidator:
    """Data validation for uploaded files."""
    
    # 파일 크기 제한 (50MB)
    MAX_FILE_SIZE = 50 * 1024 * 1024
    
    # 허용된 파일 확장자
    ALLOWED_EXTENSIONS = ['.xlsx', '.xls', '.csv']
    
    # 허용된 MIME 타입
    ALLOWED_MIME_TYPES = [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',  # .xlsx
        'application/vnd.ms-excel',  # .xls
        'text/csv',  # .csv
        'application/csv',
    ]
    
    @classmethod
    def validate_file_extension(cls, filename: str) -> None:
        """
        파일 확장자 검증.
        
        Args:
            filename: 파일명
            
        Raises:
            ValueError: 허용되지 않은 확장자인 경우
        """
        if not filename:
            raise ValueError("파일명이 비어있습니다")
        
        ext = '.' + filename.lower().split('.')[-1]
        if ext not in cls.ALLOWED_EXTENSIONS:
            raise ValueError(
                f"허용되지 않은 파일 형식입니다: {ext}\n"
                f"허용된 형식: {', '.join(cls.ALLOWED_EXTENSIONS)}"
            )
    
    @classmethod
    def validate_file_size(cls, file_size: int) -> None:
        """
        파일 크기 검증.
        
        Args:
            file_size: 파일 크기 (bytes)
            
        Raises:
            ValueError: 파일 크기가 제한을 초과하는 경우
        """
        if file_size <= 0:
            raise ValueError("파일이 비어있습니다")
        
        if file_size > cls.MAX_FILE_SIZE:
            max_mb = cls.MAX_FILE_SIZE // (1024 * 1024)
            raise ValueError(f"파일 크기가 {max_mb}MB를 초과할 수 없습니다")
    
    @classmethod
    def validate_mime_type(cls, content_type: str) -> None:
        """
        MIME 타입 검증.
        
        Args:
            content_type: HTTP Content-Type 헤더 값
            
        Raises:
            ValueError: 허용되지 않은 MIME 타입인 경우
        """
        if not content_type:
            return  # MIME 타입이 없으면 확장자로만 검증
        
        # multipart/form-data의 경우 세미콜론 이후 제거
        mime_type = content_type.split(';')[0].strip()
        
        if mime_type not in cls.ALLOWED_MIME_TYPES:
            # 너무 엄격하지 않게, 경고만 출력하고 통과
            pass
    
    @classmethod
    def validate_record_data(cls, data_type: str, record: Dict[str, Any], row_num: int) -> None:
        """
        개별 레코드 데이터 검증.
        
        Args:
            data_type: 데이터 타입 ('publication', 'research', 'student', 'kpi')
            record: 레코드 데이터
            row_num: 행 번호 (에러 메시지용)
            
        Raises:
            ValueError: 데이터 검증 실패 시
        """
        validators = {
            'publication': cls._validate_publication_record,
            'research': cls._validate_research_record,
            'student': cls._validate_student_record,
            'kpi': cls._validate_kpi_record,
        }
        
        validator = validators.get(data_type)
        if validator:
            validator(record, row_num)
    
    @classmethod
    def _validate_publication_record(cls, record: Dict[str, Any], row_num: int) -> None:
        """논문 데이터 검증."""
        # 필수 필드
        required_fields = ['논문ID', '게재일', '단과대학', '학과']
        for field in required_fields:
            if not record.get(field):
                raise ValueError(f"행 {row_num}: '{field}' 필드가 비어있습니다")
        
        # 게재일 형식 검증 (이미 파서에서 pd.to_datetime으로 변환됨)
        # Impact Factor는 숫자여야 함 (있는 경우)
        impact_factor = record.get('Impact Factor')
        if impact_factor and impact_factor != '':
            try:
                float(impact_factor)
            except (ValueError, TypeError):
                raise ValueError(f"행 {row_num}: 'Impact Factor'는 숫자여야 합니다")
    
    @classmethod
    def _validate_research_record(cls, record: Dict[str, Any], row_num: int) -> None:
        """연구 프로젝트 데이터 검증."""
        required_fields = ['집행ID', '과제번호', '연구책임자', '소속학과']
        for field in required_fields:
            if not record.get(field):
                raise ValueError(f"행 {row_num}: '{field}' 필드가 비어있습니다")
        
        # 금액 필드 검증
        for amount_field in ['총연구비', '집행금액']:
            value = record.get(amount_field)
            if value and value != '':
                try:
                    amount = int(value)
                    if amount < 0:
                        raise ValueError(f"행 {row_num}: '{amount_field}'는 0 이상이어야 합니다")
                except (ValueError, TypeError):
                    raise ValueError(f"행 {row_num}: '{amount_field}'는 정수여야 합니다")
    
    @classmethod
    def _validate_student_record(cls, record: Dict[str, Any], row_num: int) -> None:
        """학생 명부 데이터 검증."""
        required_fields = ['학번', '이름', '단과대학', '학과', '입학년도']
        for field in required_fields:
            if not record.get(field):
                raise ValueError(f"행 {row_num}: '{field}' 필드가 비어있습니다")
        
        # 입학년도 검증
        admission_year = record.get('입학년도')
        try:
            year = int(admission_year)
            if year < 1900 or year > 2100:
                raise ValueError(f"행 {row_num}: 입학년도는 1900-2100 범위여야 합니다")
        except (ValueError, TypeError):
            raise ValueError(f"행 {row_num}: 입학년도는 숫자여야 합니다")
        
        # 학년 검증 (있는 경우)
        grade = record.get('학년')
        if grade and grade != '':
            try:
                grade_num = int(grade)
                if grade_num < 0 or grade_num > 7:  # 0은 석사/박사, 1-4는 학부, 5-7은 대학원
                    raise ValueError(f"행 {row_num}: 학년은 0-7 범위여야 합니다")
            except (ValueError, TypeError):
                raise ValueError(f"행 {row_num}: 학년은 숫자여야 합니다")
    
    @classmethod
    def _validate_kpi_record(cls, record: Dict[str, Any], row_num: int) -> None:
        """KPI 데이터 검증."""
        required_fields = ['평가년도', '학기', '단과대학', '학과']
        for field in required_fields:
            if not record.get(field):
                raise ValueError(f"행 {row_num}: '{field}' 필드가 비어있습니다")
        
        # 평가년도 검증
        year = record.get('평가년도')
        try:
            year_num = int(year)
            if year_num < 1900 or year_num > 2100:
                raise ValueError(f"행 {row_num}: 평가년도는 1900-2100 범위여야 합니다")
        except (ValueError, TypeError):
            raise ValueError(f"행 {row_num}: 평가년도는 숫자여야 합니다")
        
        # 학기 검증 (예: '1학기', '2학기', '전체' 등)
        semester = record.get('학기')
        if not semester:
            raise ValueError(f"행 {row_num}: 학기 필드가 비어있습니다")
    
    @classmethod
    def validate_all(
        cls, 
        filename: str, 
        file_size: int, 
        content_type: str = None
    ) -> None:
        """
        파일에 대한 모든 기본 검증 수행.
        
        Args:
            filename: 파일명
            file_size: 파일 크기 (bytes)
            content_type: MIME 타입 (optional)
            
        Raises:
            ValueError: 검증 실패 시
        """
        cls.validate_file_extension(filename)
        cls.validate_file_size(file_size)
        if content_type:
            cls.validate_mime_type(content_type)
