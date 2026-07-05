"""
URL routing for dashboard.
"""
from django.urls import path
from .views import (
    SummaryView,
    KPIView,
    PublicationsView,
    ResearchView,
    StudentsView,
    FiltersView,
    ReportsView,
)

app_name = 'dashboard'

urlpatterns = [
    path('summary/', SummaryView.as_view(), name='summary'),
    path('kpi/', KPIView.as_view(), name='kpi'),
    path('publications/', PublicationsView.as_view(), name='publications'),
    path('research/', ResearchView.as_view(), name='research'),
    path('students/', StudentsView.as_view(), name='students'),
    path('filters/', FiltersView.as_view(), name='filters'),
    path('reports/<str:report_type>/', ReportsView.as_view(), name='reports'),
]
