"""
URL routing for data upload.
"""
from django.urls import path
from .views import DataUploadView, DataUploadListView, DataStatisticsView, DataDeleteView

app_name = 'data_upload'

urlpatterns = [
    path('upload/', DataUploadView.as_view(), name='upload'),
    path('logs/', DataUploadListView.as_view(), name='logs'),
    path('statistics/', DataStatisticsView.as_view(), name='statistics'),
    path('delete/<int:log_id>/', DataDeleteView.as_view(), name='delete'),
]
