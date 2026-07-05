import pytest
from django.urls import reverse
from rest_framework import status
from django.core.files.uploadedfile import SimpleUploadedFile
# from ..factories import UserFactory # 미리 정의된 factory 사용
# from ..models import UploadedData

@pytest.mark.django_db
def test_file_upload_api_success(api_client, user): # api_client와 user는 fixture로 주입
    # Given
    # user = UserFactory() # fixture에서 factory-boy로 유저 생성
    api_client.force_authenticate(user=user)
    url = reverse('data-upload')
    file_content = b"header1,header2\nvalue1,value2"
    test_file = SimpleUploadedFile("test.csv", file_content, content_type="text/csv")

    # When: Mock 없이 실제 API 호출
    response = api_client.post(url, {'file': test_file}, format='multipart')

    # Then: 응답 코드 및 데이터 검증
    assert response.status_code == status.HTTP_201_CREATED
    assert response.data['success'] is True
    # Then: DB 상태까지 반드시 검증
    # assert UploadedData.objects.filter(user=user).count() == 1
