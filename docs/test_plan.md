## **AI 코딩 에이전트를 위한 최종 테스트 환경 구축 지침**

**ROLE**: 당신은 10년차 시니어 QA 자동화 엔지니어입니다. 당신의 임무는 아래 명세에 따라 Django와 React 프로젝트의 테스트 환경을 완벽하게 구축하는 것입니다. 모든 규칙은 **반드시(MUST)** 준수해야 합니다.

**OBJECTIVE**: 장기적인 유지보수성, 확장성, 안정성을 극대화하는 테스트 스위트를 구축합니다. 개발 속도 저하를 최소화하고 변경에 대한 자신감을 부여하는 것을 목표로 합니다.

---

### **1. Backend: Unit Test**

*   **TOOLING**: `pytest`, `pytest-django`. Django의 기본 `unittest.TestCase`는 사용하지 않습니다.
*   **KEY_RULES**:
    1.  **Fixtures Over SetUp**: `@pytest.fixture`를 사용하여 테스트 데이터와 Mock 객체를 생성하고 주입합니다. 반복적인 `setUp` 코드를 제거하고 재사용성을 높이세요.
    2.  **Simple Assertions**: `self.assertEqual` 대신 Python의 표준 `assert` 구문을 사용합니다. `assert response.status_code == 200`.
    3.  **No Inheritance**: 테스트 케이스는 클래스 상속 없이 평범한 Python 함수로 작성합니다.
*   **CODE_SPECIFICATION**: `DataUploadService`의 단위 테스트를 아래와 같이 리팩토링하세요.

    ```python
    # path: apps/data_upload/tests/test_services.py
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
    ```

---

### **2. Backend: E2E (API) Test**

*   **TOOLING**: `pytest`, `pytest-django`, `factory-boy`.
*   **KEY_RULES**:
    1.  **NO MOCKING**: API 테스트에서 Service, Repository 등 핵심 비즈니스 로직을 절대 Mock하지 마세요. 요청부터 DB 영속성까지 전체 흐름을 검증해야 합니다.
    2.  **Use Factories**: 테스트 데이터는 `factory-boy`를 사용하여 생성합니다. `User.objects.create()`와 같은 코드를 테스트 코드에서 직접 사용하지 마세요.
    3.  **Database Validation**: API 응답 검증 후, 실제 데이터베이스에 데이터가 의도대로 생성/수정되었는지 반드시 확인(assert)해야 합니다.
*   **CODE_SPECIFICATION**: `DataUpload` API E2E 테스트를 아래와 같이 수정하세요.

    ```python
    # path: apps/data_upload/tests/test_views.py
    import pytest
    from django.urls import reverse
    from rest_framework import status
    from django.core.files.uploadedfile import SimpleUploadedFile
    # from ..factories import UserFactory # 미리 정의된 factory 사용
    # from ..models import UploadedData

    # pytest가 DB에 접근할 수 있도록 مارک(mark)
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
    ```

---

### **3. Frontend: Unit Test**

*   **TOOLING**: `Vitest`, `@testing-library/react`, `@testing-library/user-event`, `msw`.
*   **KEY_RULES**:
    1.  **Network-level Mocking**: API 모킹은 반드시 `msw`를 사용합니다. `vi.mock`으로 custom hook이나 `axios` 모듈을 직접 모킹하는 것을 금지합니다.
    2.  **Test User Behavior**: `toBeInTheDocument`로 단순히 요소 존재 여부만 확인하지 마세요. `@testing-library/user-event`를 사용하여 "사용자가 버튼을 클릭하면, 특정 API가 호출되고, 로딩 스피너가 나타난 후, 성공 메시지가 표시된다"와 같은 상호작용 시나리오를 테스트하세요.
    3.  **Implementation-Free**: 컴포넌트의 내부 상태나 props를 테스트하지 말고, 오직 사용자에게 보이는 결과물(DOM)만을 검증합니다.
*   **CODE_SPECIFICATION**: `FileUploader` 컴포넌트 테스트를 아래와 같이 구현하세요.

    ```typescript
    // path: src/components/features/Upload/FileUploader.test.tsx
    import { render, screen, waitFor } from '@testing-library/react';
    import userEvent from '@testing-library/user-event';
    import { FileUploader } from './FileUploader';
    import { server } from '@/mocks/server'; // MSW 서버 임포트
    import { http, HttpResponse } from 'msw';

    test('파일 업로드 성공 시 성공 메시지를 보여준다', async () => {
      // Given: MSW로 특정 API 엔드포인트에 대한 응답을 설정
      server.use(
        http.post('/api/upload', () => {
          return HttpResponse.json({ success: true, total_records: 1 });
        })
      );

      render(<FileUploader />); // Provider 래핑 필요
      const file = new File(['test'], 'test.csv', { type: 'text/csv' });
      const input = screen.getByLabelText(/file-upload/i);
      const button = screen.getByRole('button', { name: /업로드/i });

      // When: 실제 사용자와 유사하게 상호작용
      await userEvent.upload(input, file);
      await userEvent.click(button);

      // Then: API 호출 후 UI에 나타나는 최종 결과를 검증
      expect(await screen.findByText(/업로드 성공/i)).toBeInTheDocument();
    });
    ```

---

### **4. Frontend: E2E Test**

*   **TOOLING**: `Playwright`.
*   **KEY_RULES**:
    1.  **Test ID Selectors**: `data-testid` 속성을 최우선 셀렉터로 사용합니다. `page.locator('.css-class')`나 `page.locator('div > span')`과 같은 불안정한 셀렉터 사용을 금지합니다.
    2.  **Programmatic Login**: UI를 통해 로그인하지 않습니다. `globalSetup`을 사용하여 테스트 실행 전 API 요청으로 로그인하고, 발급된 인증 상태(`storageState`)를 모든 테스트에서 재사용하세요.
    3.  **Page Object Model (POM)**: 페이지별 셀렉터와 액션을 별도의 클래스/객체로 분리(e.g., `DashboardPage.ts`)하여 테스트 코드의 가독성과 재사용성을 높이세요.
*   **CODE_SPECIFICATION**: 대시보드 페이지 테스트를 아래 명세에 따라 작성하세요.

    ```typescript
    // path: tests/dashboard.spec.ts
    import { test, expect } from '@playwright/test';

    // playwright.config.ts에 `storageState`가 설정되어 있다고 가정.
    // 로그인은 globalSetup.ts에서 API로 미리 처리됨.

    test('대시보드 페이지는 타이틀과 차트를 포함해야 한다', async ({ page }) => {
      // Given: 페이지로 바로 이동 (로그인 과정 없음)
      await page.goto('/dashboard');

      // When & Then: data-testid를 사용하여 안정적으로 요소 검증
      const title = page.getByTestId('dashboard-title');
      const chart = page.getByTestId('dashboard-chart-container');

      await expect(title).toContainText('대시보드');
      await expect(chart).toBeVisible();
    });
    ```

---

### **5. General Infrastructure & CI/CD**

*   **TOOLING**: `Docker`, `Docker Compose`, `GitHub Actions` (또는 유사 CI 툴).
*   **KEY_RULES**:
    1.  **Containerized Environment**: `docker-compose.yml`을 사용하여 DB, 백엔드, 프론트엔드를 포함한 전체 테스트 환경을 정의합니다. 모든 개발자와 CI 서버는 이 동일한 환경을 사용해야 합니다.
    2.  **Automated Execution**: Pull Request가 생성될 때마다 모든 테스트(Backend, Frontend)가 자동으로 실행되도록 CI 파이프라인을 구축합니다.
    3.  **Merge Guard**: 테스트가 하나라도 실패하면 Pull Request가 Merge될 수 없도록 브랜치 보호 규칙(Branch Protection Rule)을 설정합니다.