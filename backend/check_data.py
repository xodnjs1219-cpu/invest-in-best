"""
Check database statistics
"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.development')
django.setup()

from apps.data_upload.models import UploadedData

# Get counts by data type
publication_count = UploadedData.objects.filter(data_type='publication').count()
student_count = UploadedData.objects.filter(data_type='student').count()
research_count = UploadedData.objects.filter(data_type='research').count()
kpi_count = UploadedData.objects.filter(data_type='kpi').count()

print(f"=== 데이터베이스 통계 ===")
print(f"논문(publication): {publication_count}")
print(f"학생(student): {student_count}")
print(f"연구(research): {research_count}")
print(f"KPI: {kpi_count}")
print(f"전체: {UploadedData.objects.count()}")

# Check publication details
print("\n=== 논문 데이터 샘플 ===")
publications = UploadedData.objects.filter(data_type='publication')[:5]
for pub in publications:
    print(f"ID: {pub.id}, Metadata: {pub.metadata}")
