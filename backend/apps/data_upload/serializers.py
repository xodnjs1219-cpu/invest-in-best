"""
Serializers for data upload.
"""
from rest_framework import serializers


class DataUploadLogSerializer(serializers.Serializer):
    """Data upload log serializer."""

    id = serializers.IntegerField()
    filename = serializers.CharField(max_length=255)
    file_size = serializers.IntegerField(required=False, allow_null=True)
    status = serializers.CharField(max_length=20)
    error_message = serializers.CharField(required=False, allow_null=True)
    total_records = serializers.IntegerField(required=False, allow_null=True)
    processed_records = serializers.IntegerField(required=False, allow_null=True)
    uploaded_at = serializers.DateTimeField()
    updated_at = serializers.DateTimeField()


class UploadFileRequestSerializer(serializers.Serializer):
    """Request serializer for file upload."""
    
    file = serializers.FileField(
        required=True,
        help_text="CSV or XLSX file to upload"
    )
    replace_existing = serializers.BooleanField(
        required=False,
        default=True,
        help_text="Replace existing data of the same type"
    )


class UploadFileResponseSerializer(serializers.Serializer):
    """Response serializer for file upload."""
    
    upload_log_id = serializers.IntegerField()
    status = serializers.CharField()
    data_type = serializers.CharField()
    total_records = serializers.IntegerField()
    processed_records = serializers.IntegerField()
    message = serializers.CharField()
