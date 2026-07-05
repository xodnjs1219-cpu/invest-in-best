"""
Root URL configuration for the project.
"""
from django.contrib import admin
from django.urls import path, include
from rest_framework import routers

# API routers
router = routers.DefaultRouter()

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include(router.urls)),
    path('api/auth/', include('apps.authentication.urls')),
    path('api/users/', include('apps.users.urls')),
    path('api/data-upload/', include('apps.data_upload.urls')),
    path('api/dashboard/', include('apps.dashboard.urls')),
]
