"""
Repository layer for data upload - Data access layer.
"""
from typing import List, Dict, Any, Optional
from django.db import transaction
from .models import DataUploadLog, UploadedData


class DataUploadRepository:
    """Repository for data upload logs and uploaded data."""
    
    @transaction.atomic
    def create_upload_log(
        self,
        user_id: int,
        filename: str,
        file_size: int,
        status: str = 'pending',
    ) -> DataUploadLog:
        """
        Create a new upload log entry.
        
        Args:
            user_id: User ID
            filename: Uploaded filename
            file_size: File size in bytes
            status: Upload status (default: 'pending')
            
        Returns:
            DataUploadLog: Created log instance
        """
        log = DataUploadLog.objects.create(
            user_id=user_id,
            filename=filename,
            file_size=file_size,
            status=status,
        )
        return log
    
    @transaction.atomic
    def update_upload_log(
        self,
        log_id: int,
        status: str,
        error_message: Optional[str] = None,
        total_records: Optional[int] = None,
        processed_records: Optional[int] = None,
    ) -> DataUploadLog:
        """
        Update upload log status and metadata.
        
        Args:
            log_id: Upload log ID
            status: New status ('success' or 'failed')
            error_message: Error message if failed
            total_records: Total number of records
            processed_records: Number of successfully processed records
            
        Returns:
            DataUploadLog: Updated log instance
        """
        log = DataUploadLog.objects.get(id=log_id)
        log.status = status
        
        if error_message:
            log.error_message = error_message
        if total_records is not None:
            log.total_records = total_records
        if processed_records is not None:
            log.processed_records = processed_records
        
        log.save()
        return log
    
    @transaction.atomic
    def bulk_create_uploaded_data(
        self,
        upload_log_id: int,
        records: List[Dict[str, Any]],
    ) -> int:
        """
        Bulk insert uploaded data records.
        
        Args:
            upload_log_id: Upload log ID
            records: List of normalized record dictionaries
            
        Returns:
            int: Number of created records
        """
        instances = [
            UploadedData(
                upload_log_id=upload_log_id,
                data_type=record['data_type'],
                year=record.get('year'),
                semester=record.get('semester'),
                college=record.get('college'),
                department=record.get('department'),
                metadata=record.get('metadata', {}),
            )
            for record in records
        ]
        
        UploadedData.objects.bulk_create(instances, batch_size=500)
        return len(instances)
    
    def get_upload_logs_by_user(
        self,
        user_id: int,
        limit: int = 50,
        offset: int = 0,
    ) -> List[DataUploadLog]:
        """
        Get upload logs for a specific user.
        
        Args:
            user_id: User ID
            limit: Maximum number of logs to return
            offset: Offset for pagination
            
        Returns:
            List[DataUploadLog]: List of upload logs
        """
        return list(
            DataUploadLog.objects
            .filter(user_id=user_id)
            .order_by('-uploaded_at')
            [offset:offset + limit]
        )
    
    def get_all_upload_logs(
        self,
        limit: int = 50,
        offset: int = 0,
    ) -> List[DataUploadLog]:
        """
        Get all upload logs (admin only).
        
        Args:
            limit: Maximum number of logs to return
            offset: Offset for pagination
            
        Returns:
            List[DataUploadLog]: List of upload logs
        """
        return list(
            DataUploadLog.objects
            .all()
            .order_by('-uploaded_at')
            [offset:offset + limit]
        )
    
    def count_upload_logs_by_user(self, user_id: int) -> int:
        """Count upload logs for a user."""
        return DataUploadLog.objects.filter(user_id=user_id).count()
    
    def count_all_upload_logs(self) -> int:
        """Count all upload logs."""
        return DataUploadLog.objects.count()
    
    @transaction.atomic
    def delete_previous_data_by_type(self, data_type: str) -> int:
        """
        Delete all previous uploaded data of a specific type.
        Used when uploading new data to replace old data.
        
        Args:
            data_type: Data type to delete
            
        Returns:
            int: Number of deleted records
        """
        deleted_count, _ = UploadedData.objects.filter(data_type=data_type).delete()
        return deleted_count
    
    def get_uploaded_data(
        self,
        data_type: Optional[str] = None,
        year: Optional[int] = None,
        college: Optional[str] = None,
        department: Optional[str] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> List[UploadedData]:
        """
        Get uploaded data with filters.
        
        Args:
            data_type: Filter by data type
            year: Filter by year
            college: Filter by college
            department: Filter by department
            limit: Maximum number of records
            offset: Offset for pagination
            
        Returns:
            List[UploadedData]: List of uploaded data records
        """
        queryset = UploadedData.objects.all()
        
        if data_type:
            queryset = queryset.filter(data_type=data_type)
        if year:
            queryset = queryset.filter(year=year)
        if college:
            queryset = queryset.filter(college=college)
        if department:
            queryset = queryset.filter(department=department)
        
        return list(queryset.order_by('-created_at')[offset:offset + limit])
    
    def count_uploaded_data(
        self,
        data_type: Optional[str] = None,
        year: Optional[int] = None,
        college: Optional[str] = None,
        department: Optional[str] = None,
    ) -> int:
        """
        Count uploaded data with filters.
        """
        queryset = UploadedData.objects.all()
        
        if data_type:
            queryset = queryset.filter(data_type=data_type)
        if year:
            queryset = queryset.filter(year=year)
        if college:
            queryset = queryset.filter(college=college)
        if department:
            queryset = queryset.filter(department=department)
        
        return queryset.count()
    
    def get_upload_log_by_id(self, log_id: int) -> Optional[DataUploadLog]:
        """
        Get upload log by ID.
        
        Args:
            log_id: Upload log ID
            
        Returns:
            DataUploadLog or None
        """
        try:
            return DataUploadLog.objects.get(id=log_id)
        except DataUploadLog.DoesNotExist:
            return None
    
    @transaction.atomic
    def delete_uploaded_data_by_log(self, log_id: int) -> int:
        """
        Delete all uploaded data associated with a log ID.
        
        Args:
            log_id: Upload log ID
            
        Returns:
            int: Number of deleted records
        """
        deleted, _ = UploadedData.objects.filter(upload_log_id=log_id).delete()
        return deleted
    
    @transaction.atomic
    def delete_upload_log(self, log_id: int) -> None:
        """
        Delete upload log.
        
        Args:
            log_id: Upload log ID
        """
        DataUploadLog.objects.filter(id=log_id).delete()
