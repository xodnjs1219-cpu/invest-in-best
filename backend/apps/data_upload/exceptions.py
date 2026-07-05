"""
Custom exceptions for data upload app.
"""


class DataUploadError(Exception):
    """Base exception for data upload errors."""
    pass


class FileValidationError(DataUploadError):
    """Exception for file validation failures."""
    pass


class DataParsingError(DataUploadError):
    """Exception for data parsing failures."""
    pass


class DataStorageError(DataUploadError):
    """Exception for data storage failures."""
    pass
