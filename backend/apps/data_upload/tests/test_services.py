import pytest
from unittest.mock import MagicMock, patch

from ..services import DataUploadService

@pytest.fixture
def mock_dependencies():
    # patch를 fixture로 분리하여 재사용
    with patch('apps.data_upload.services.DataRepository') as MockRepo, \
         patch('apps.data_upload.services.ExcelParser') as MockParser, \
         patch('apps.data_upload.services.DataValidator') as MockValidator:
        yield {
            "parser": MockParser.return_value,
            "validator": MockValidator.return_value,
            "repository": MockRepo.return_value
        }

def test_upload_and_process_success(mock_dependencies):
    # Given: Fixture로부터 mock 객체 주입
    mock_file = MagicMock()
    mock_dependencies["parser"].parse.return_value = [{'data': 1}]
    mock_dependencies["validator"].validate.return_value = [{'data': 1, 'validated': True}]
    mock_dependencies["repository"].bulk_create.return_value = [MagicMock()]

    # When
    service = DataUploadService()
    result = service.upload_and_process(file=mock_file, user_id=1)

    # Then: 간결한 assert 구문 사용
    assert result['success'] is True
    assert result['total_records'] == 1
    mock_dependencies["parser"].parse.assert_called_once()
