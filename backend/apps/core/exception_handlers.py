"""
Custom exception handlers for DRF.
"""
from rest_framework.views import exception_handler
from rest_framework.response import Response
from rest_framework import status


def custom_exception_handler(exc, context):
    """
    Custom exception handler that wraps DRF's exception handler.
    Ensures consistent error response format.
    """
    response = exception_handler(exc, context)

    if response is None:
        return None

    # Extract error details
    error_detail = response.data

    # Format error response
    error_response = {
        'error': True,
        'code': getattr(exc, 'default_code', 'INTERNAL_ERROR'),
        'message': str(error_detail) if isinstance(error_detail, str) else error_detail.get('detail', str(error_detail)),
    }

    return Response(error_response, status=response.status_code)
