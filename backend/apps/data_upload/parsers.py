"""
Parsers for data upload - Excel and CSV file parsing.
"""
import pandas as pd
import math
from typing import Dict, List, Any, Tuple
from io import BytesIO


def sanitize_value(value: Any) -> Any:
    """
    NaN, Infinity 등의 JSON 비호환 값을 None으로 변환.
    
    Args:
        value: 변환할 값
        
    Returns:
        JSON 호환 값
    """
    if value is None:
        return None
    
    # pandas NaN 체크
    if pd.isna(value):
        return None
    
    # float 타입이면서 infinity이거나 NaN인 경우
    if isinstance(value, float):
        if math.isnan(value) or math.isinf(value):
            return None
    
    return value


class DataTypeDetector:
    """Detect data type based on file columns."""
    
    # 각 데이터 타입별 필수 컬럼 정의
    DATA_TYPE_SIGNATURES = {
        'publication': ['논문ID', '게재일', '단과대학', '학과'],
        'research': ['집행ID', '과제번호', '과제명', '연구책임자'],
        'student': ['학번', '이름', '단과대학', '학과'],
        'kpi': ['평가년도', '단과대학', '학과'],
    }
    
    @classmethod
    def detect(cls, columns: List[str]) -> str:
        """
        컬럼 리스트를 기반으로 데이터 타입 감지.
        
        Args:
            columns: DataFrame의 컬럼 리스트
            
        Returns:
            str: 'publication', 'research', 'student', 'kpi' 중 하나
            
        Raises:
            ValueError: 어떤 타입과도 매칭되지 않을 경우
        """
        for data_type, required_cols in cls.DATA_TYPE_SIGNATURES.items():
            if all(col in columns for col in required_cols):
                return data_type
        
        raise ValueError(
            f"알 수 없는 파일 형식입니다. 컬럼: {columns}\n"
            f"지원되는 형식: {list(cls.DATA_TYPE_SIGNATURES.keys())}"
        )


class ExcelParser:
    """Excel and CSV file parser."""
    
    MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB
    SUPPORTED_EXTENSIONS = ['.xlsx', '.xls', '.csv']
    
    def parse(self, file_content: bytes, filename: str) -> Tuple[str, List[Dict[str, Any]]]:
        """
        엑셀/CSV 파일을 파싱하여 데이터 타입과 레코드 리스트 반환.
        
        Args:
            file_content: 파일의 바이너리 내용
            filename: 파일명
            
        Returns:
            Tuple[str, List[Dict]]: (data_type, records)
            
        Raises:
            ValueError: 파일 형식 오류, 파싱 실패 등
        """
        # 1. 파일 크기 검증
        if len(file_content) > self.MAX_FILE_SIZE:
            raise ValueError(f"파일 크기가 {self.MAX_FILE_SIZE // (1024*1024)}MB를 초과할 수 없습니다")
        
        # 2. 파일 확장자 검증
        file_ext = filename.lower().split('.')[-1]
        if f'.{file_ext}' not in self.SUPPORTED_EXTENSIONS:
            raise ValueError(
                f"지원되지 않는 파일 형식입니다: .{file_ext}\n"
                f"지원 형식: {', '.join(self.SUPPORTED_EXTENSIONS)}"
            )
        
        # 3. 파일 파싱
        try:
            file_obj = BytesIO(file_content)
            
            if file_ext == 'csv':
                df = pd.read_csv(file_obj, encoding='utf-8')
            else:  # xlsx, xls
                df = pd.read_excel(file_obj)
                
        except Exception as e:
            raise ValueError(f"파일 파싱 중 오류가 발생했습니다: {str(e)}")
        
        # 4. 빈 파일 체크
        if df.empty:
            raise ValueError("파일에 데이터가 없습니다")
        
        # 5. 데이터 타입 감지
        columns = df.columns.tolist()
        data_type = DataTypeDetector.detect(columns)
        
        # 6. NaN 값을 None으로 변환하고 Dict 리스트로 변환
        df = df.where(pd.notna(df), None)
        records = df.to_dict('records')
        
        return data_type, records
    
    def parse_publication(self, records: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        논문 데이터 파싱 및 정규화.
        
        Example CSV columns:
        논문ID,게재일,단과대학,학과,논문제목,주저자,참여저자,학술지명,저널등급,Impact Factor,과제연계여부
        """
        parsed_records = []
        
        for idx, record in enumerate(records, start=2):  # Excel row starts at 2 (after header)
            try:
                # 필수 필드 검증
                required_fields = ['논문ID', '게재일', '단과대학', '학과']
                for field in required_fields:
                    if not record.get(field):
                        raise ValueError(f"행 {idx}: '{field}' 필드가 비어있습니다")
                
                # 날짜 파싱
                publication_date = pd.to_datetime(record['게재일'])
                
                # 메타데이터 구성
                impact_factor = record.get('Impact Factor')
                if impact_factor is not None and pd.notna(impact_factor):
                    try:
                        impact_factor = float(impact_factor)
                    except (ValueError, TypeError):
                        impact_factor = None
                else:
                    impact_factor = None
                
                metadata = {
                    '논문ID': str(record['논문ID']),
                    '논문제목': record.get('논문제목', ''),
                    '주저자': record.get('주저자', ''),
                    '참여저자': record.get('참여저자', ''),
                    '학술지명': record.get('학술지명', ''),
                    '저널등급': record.get('저널등급', ''),
                    'Impact_Factor': impact_factor,
                    '과제연계여부': record.get('과제연계여부', 'N'),
                }
                
                parsed_records.append({
                    'data_type': 'publication',
                    'year': publication_date.year,
                    'semester': None,
                    'college': record['단과대학'],
                    'department': record['학과'],
                    'metadata': metadata,
                })
                
            except ValueError as e:
                raise ValueError(f"행 {idx}: {str(e)}")
            except Exception as e:
                raise ValueError(f"행 {idx}: 데이터 파싱 오류 - {str(e)}")
        
        return parsed_records
    
    def parse_research(self, records: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        연구 프로젝트 데이터 파싱 및 정규화.
        
        Example CSV columns:
        집행ID,과제번호,과제명,연구책임자,소속학과,지원기관,총연구비,집행일자,집행항목,집행금액,상태,비고
        """
        parsed_records = []
        
        for idx, record in enumerate(records, start=2):
            try:
                required_fields = ['집행ID', '과제번호', '연구책임자', '소속학과']
                for field in required_fields:
                    if not record.get(field):
                        raise ValueError(f"'{field}' 필드가 비어있습니다")
                
                # 날짜 파싱
                execution_date = pd.to_datetime(record['집행일자'])
                
                # 숫자 필드 안전하게 변환
                total_budget = record.get('총연구비')
                if total_budget is not None and pd.notna(total_budget):
                    try:
                        total_budget = int(total_budget)
                    except (ValueError, TypeError):
                        total_budget = 0
                else:
                    total_budget = 0
                
                execution_amount = record.get('집행금액')
                if execution_amount is not None and pd.notna(execution_amount):
                    try:
                        execution_amount = int(execution_amount)
                    except (ValueError, TypeError):
                        execution_amount = 0
                else:
                    execution_amount = 0
                
                metadata = {
                    '집행ID': str(record['집행ID']),
                    '과제번호': str(record['과제번호']),
                    '과제명': record.get('과제명', ''),
                    '연구책임자': record.get('연구책임자', ''),
                    '지원기관': record.get('지원기관', ''),
                    '총연구비': total_budget,
                    '집행일자': record.get('집행일자', ''),
                    '집행항목': record.get('집행항목', ''),
                    '집행금액': execution_amount,
                    '상태': record.get('상태', ''),
                    '비고': record.get('비고', ''),
                }
                
                parsed_records.append({
                    'data_type': 'research',
                    'year': execution_date.year,
                    'semester': None,
                    'college': None,
                    'department': record['소속학과'],
                    'metadata': metadata,
                })
                
            except ValueError as e:
                raise ValueError(f"행 {idx}: {str(e)}")
            except Exception as e:
                raise ValueError(f"행 {idx}: 데이터 파싱 오류 - {str(e)}")
        
        return parsed_records
    
    def parse_student(self, records: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        학생 명부 데이터 파싱 및 정규화.
        
        Example CSV columns:
        학번,이름,단과대학,학과,학년,과정구분,학적상태,성별,입학년도,지도교수,이메일
        """
        parsed_records = []
        
        for idx, record in enumerate(records, start=2):
            try:
                required_fields = ['학번', '이름', '단과대학', '학과', '입학년도']
                for field in required_fields:
                    if not record.get(field):
                        raise ValueError(f"'{field}' 필드가 비어있습니다")
                
                # 학년 안전하게 변환
                grade = record.get('학년')
                if grade is not None and pd.notna(grade):
                    try:
                        grade = int(grade)
                    except (ValueError, TypeError):
                        grade = 0
                else:
                    grade = 0
                
                metadata = {
                    '학번': str(record['학번']),
                    '이름': record.get('이름', ''),
                    '학년': grade,
                    '과정구분': record.get('과정구분', ''),
                    '학적상태': record.get('학적상태', ''),
                    '성별': record.get('성별', ''),
                    '지도교수': record.get('지도교수', ''),
                    '이메일': record.get('이메일', ''),
                }
                
                # 입학년도로 year 설정
                admission_year = int(record['입학년도'])
                
                parsed_records.append({
                    'data_type': 'student',
                    'year': admission_year,
                    'semester': None,
                    'college': record['단과대학'],
                    'department': record['학과'],
                    'metadata': metadata,
                })
                
            except ValueError as e:
                raise ValueError(f"행 {idx}: {str(e)}")
            except Exception as e:
                raise ValueError(f"행 {idx}: 데이터 파싱 오류 - {str(e)}")
        
        return parsed_records
    
    def parse_kpi(self, records: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        KPI 데이터 파싱 및 정규화.
        
        Example Excel columns:
        평가년도,단과대학,학과,졸업생 취업률 (%),전임교원 수 (명) 등
        학기는 선택적 컬럼
        """
        parsed_records = []
        
        for idx, record in enumerate(records, start=2):
            try:
                required_fields = ['평가년도', '단과대학', '학과']
                for field in required_fields:
                    if not record.get(field):
                        raise ValueError(f"'{field}' 필드가 비어있습니다")
                
                year = int(record['평가년도'])
                
                # 년도 범위 검증
                if year < 1900 or year > 2100:
                    raise ValueError(f"평가년도는 1900-2100 범위여야 합니다: {year}")
                
                # 메타데이터: 컬럼 중 필수 필드를 제외한 모든 데이터
                # NaN 값을 None으로 변환
                metadata = {}
                for k, v in record.items():
                    if k not in ['평가년도', '학기', '단과대학', '학과']:
                        # NaN 체크 및 변환
                        if v is not None and pd.notna(v):
                            metadata[k] = v
                        else:
                            metadata[k] = None
                
                # 학기는 선택적 필드
                semester = record.get('학기')
                if semester is not None and pd.notna(semester):
                    semester = str(semester)
                else:
                    semester = None
                
                parsed_records.append({
                    'data_type': 'kpi',
                    'year': year,
                    'semester': semester,
                    'college': record['단과대학'],
                    'department': record['학과'],
                    'metadata': metadata,
                })
                
            except ValueError as e:
                raise ValueError(f"행 {idx}: {str(e)}")
            except Exception as e:
                raise ValueError(f"행 {idx}: 데이터 파싱 오류 - {str(e)}")
        
        return parsed_records
    
    def parse_and_normalize(
        self, 
        file_content: bytes, 
        filename: str
    ) -> Tuple[str, List[Dict[str, Any]], int]:
        """
        파일을 파싱하고 정규화된 데이터 반환.
        
        Args:
            file_content: 파일 바이너리
            filename: 파일명
            
        Returns:
            Tuple[str, List[Dict], int]: (data_type, normalized_records, total_count)
        """
        # 1. 기본 파싱
        data_type, raw_records = self.parse(file_content, filename)
        
        # 2. 데이터 타입별 정규화
        parsers = {
            'publication': self.parse_publication,
            'research': self.parse_research,
            'student': self.parse_student,
            'kpi': self.parse_kpi,
        }
        
        parser_func = parsers.get(data_type)
        if not parser_func:
            raise ValueError(f"지원되지 않는 데이터 타입: {data_type}")
        
        normalized_records = parser_func(raw_records)
        
        # 3. 모든 메타데이터 값에서 NaN/Infinity 제거
        for record in normalized_records:
            if 'metadata' in record and isinstance(record['metadata'], dict):
                record['metadata'] = {
                    k: sanitize_value(v) 
                    for k, v in record['metadata'].items()
                }
        
        return data_type, normalized_records, len(normalized_records)
