"""
Service layer for data upload - Business logic orchestration.
"""
from typing import Dict, Any, Tuple
from django.db import transaction
from .parsers import ExcelParser
from .validators import DataValidator
from .repositories import DataUploadRepository
from .exceptions import DataUploadError


class DataUploadService:
    """Service for handling data upload business logic."""
    
    def __init__(self):
        self.parser = ExcelParser()
        self.validator = DataValidator()
        self.repository = DataUploadRepository()
    
    @transaction.atomic
    def upload_and_process(
        self,
        file_content: bytes,
        filename: str,
        file_size: int,
        user_id: int,
        content_type: str = None,
        replace_existing: bool = True,
    ) -> Dict[str, Any]:
        """
        파일 업로드 및 데이터 처리의 전체 플로우.
        
        Args:
            file_content: 파일 바이너리 내용
            filename: 파일명
            file_size: 파일 크기 (bytes)
            user_id: 업로드한 사용자 ID
            content_type: MIME 타입 (optional)
            replace_existing: 기존 데이터 대체 여부 (default: True)
            
        Returns:
            Dict: 업로드 결과 정보
            {
                'upload_log_id': int,
                'status': str,
                'data_type': str,
                'total_records': int,
                'processed_records': int,
                'message': str,
            }
            
        Raises:
            DataUploadError: 업로드 실패 시
        """
        upload_log = None
        
        try:
            # 1. Create upload log (pending state)
            upload_log = self.repository.create_upload_log(
                user_id=user_id,
                filename=filename,
                file_size=file_size,
                status='pending',
            )
            
            # 2. Validate file
            self.validator.validate_all(filename, file_size, content_type)
            
            # 3. Parse and normalize data
            data_type, normalized_records, total_records = self.parser.parse_and_normalize(
                file_content, filename
            )
            
            # 4. Replace existing data if requested
            if replace_existing:
                deleted_count = self.repository.delete_previous_data_by_type(data_type)
                print(f"Deleted {deleted_count} existing {data_type} records")
            
            # 5. Bulk insert data
            processed_records = self.repository.bulk_create_uploaded_data(
                upload_log_id=upload_log.id,
                records=normalized_records,
            )
            
            # 6. Update upload log to success
            self.repository.update_upload_log(
                log_id=upload_log.id,
                status='success',
                total_records=total_records,
                processed_records=processed_records,
            )
            
            return {
                'upload_log_id': upload_log.id,
                'status': 'success',
                'data_type': data_type,
                'total_records': total_records,
                'processed_records': processed_records,
                'message': f'{total_records}개의 {data_type} 데이터가 성공적으로 업로드되었습니다',
            }
            
        except Exception as e:
            # Update log to failed state
            if upload_log:
                self.repository.update_upload_log(
                    log_id=upload_log.id,
                    status='failed',
                    error_message=str(e),
                )
            
            # Re-raise as DataUploadError
            raise DataUploadError(str(e))
    
    def get_upload_logs(
        self,
        user_id: int = None,
        is_admin: bool = False,
        page: int = 1,
        limit: int = 20,
    ) -> Dict[str, Any]:
        """
        업로드 이력 조회.
        
        Args:
            user_id: 사용자 ID (관리자가 아닌 경우 필수)
            is_admin: 관리자 여부
            page: 페이지 번호 (1부터 시작)
            limit: 페이지당 항목 수
            
        Returns:
            Dict: 페이지네이션된 업로드 이력
            {
                'logs': List[DataUploadLog],
                'total': int,
                'page': int,
                'limit': int,
            }
        """
        offset = (page - 1) * limit
        
        if is_admin:
            logs = self.repository.get_all_upload_logs(limit=limit, offset=offset)
            total = self.repository.count_all_upload_logs()
        else:
            if not user_id:
                raise ValueError("user_id is required for non-admin users")
            logs = self.repository.get_upload_logs_by_user(
                user_id=user_id, 
                limit=limit, 
                offset=offset
            )
            total = self.repository.count_upload_logs_by_user(user_id)
        
        return {
            'logs': logs,
            'total': total,
            'page': page,
            'limit': limit,
        }
    
    def get_data_statistics(self) -> Dict[str, Any]:
        """
        업로드된 데이터 통계 조회.
        
        Returns:
            Dict: 데이터 타입별 통계
        """
        data_types = ['kpi', 'publication', 'research', 'student']
        statistics = {}
        
        for data_type in data_types:
            count = self.repository.count_uploaded_data(data_type=data_type)
            statistics[data_type] = {
                'count': count,
                'type': data_type,
            }
        
        return statistics
    
    @transaction.atomic
    def delete_upload_data(self, log_id: int, user_id: int) -> Dict[str, Any]:
        """
        업로드 데이터 삭제.
        
        Args:
            log_id: 업로드 로그 ID
            user_id: 삭제 요청한 사용자 ID
            
        Returns:
            Dict: 삭제 결과
            
        Raises:
            DataUploadError: 로그를 찾을 수 없거나 삭제 권한이 없는 경우
        """
        # Get upload log
        upload_log = self.repository.get_upload_log_by_id(log_id)
        if not upload_log:
            raise DataUploadError(f'업로드 로그를 찾을 수 없습니다. (ID: {log_id})')
        
        # Delete associated data
        deleted_count = self.repository.delete_uploaded_data_by_log(log_id)
        
        # Delete upload log
        self.repository.delete_upload_log(log_id)
        
        return {
            'message': '데이터가 성공적으로 삭제되었습니다.',
            'deleted_records': deleted_count,
            'log_id': log_id,
        }
