"""
Models for data upload app.
"""
from django.db import models
from apps.authentication.models import User


class DataUploadLog(models.Model):
    """Upload history log."""

    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('success', 'Success'),
        ('failed', 'Failed'),
    ]

    id = models.BigAutoField(primary_key=True)
    user_id = models.BigIntegerField()
    filename = models.CharField(max_length=255)
    file_size = models.IntegerField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    error_message = models.TextField(null=True, blank=True)
    total_records = models.IntegerField(null=True, blank=True)
    processed_records = models.IntegerField(null=True, blank=True)
    uploaded_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'data_upload_logs'
        managed = False
        indexes = [
            models.Index(fields=['user_id']),
            models.Index(fields=['status']),
            models.Index(fields=['-uploaded_at']),
        ]

    def __str__(self):
        return f"{self.filename} - {self.status}"


class UploadedData(models.Model):
    """Uploaded data storage."""

    DATA_TYPE_CHOICES = [
        ('kpi', 'KPI'),
        ('publication', 'Publication'),
        ('research', 'Research'),
        ('student', 'Student'),
    ]

    id = models.BigAutoField(primary_key=True)
    upload_log_id = models.BigIntegerField()
    data_type = models.CharField(max_length=50, choices=DATA_TYPE_CHOICES)
    year = models.IntegerField(null=True, blank=True)
    semester = models.CharField(max_length=10, null=True, blank=True)
    college = models.CharField(max_length=100, null=True, blank=True)
    department = models.CharField(max_length=100, null=True, blank=True)
    metadata = models.JSONField(default=dict)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'uploaded_data'
        managed = False
        indexes = [
            models.Index(fields=['upload_log_id']),
            models.Index(fields=['data_type']),
            models.Index(fields=['year']),
            models.Index(fields=['college', 'department']),
        ]

    def __str__(self):
        return f"{self.data_type} - {self.year}"
