# UC-006: Detailed Report - Implementation Plan (TDD)

## 개요

**목표**: Context + useReducer로 복잡한 필터/정렬/페이지네이션 관리, Pandas로 엑셀 내보내기
**방법론**: TDD (Red → Green → Refactor)
**핵심 기술**: Context API, useReducer, TanStack Query, Pandas, Django Pagination

---

## 1. Module Overview

### 1.1 Backend Modules

| 모듈 | 경로 | 역할 | 의존성 |
|------|------|------|--------|
| **ReportPerformanceView** | `apps/reports/views.py` | 성과 리포트 API | ReportService |
| **ReportPublicationsView** | `apps/reports/views.py` | 논문 리포트 API | ReportService |
| **ReportResearchView** | `apps/reports/views.py` | 연구 리포트 API | ReportService |
| **ReportStudentsView** | `apps/reports/views.py` | 학생 리포트 API | ReportService |
| **ReportExportView** | `apps/reports/views.py` | 엑셀 내보내기 API | ReportService, ExportService |
| **ReportService** | `apps/reports/services.py` | 리포트 데이터 조회 및 집계 | ReportRepository |
| **ExportService** | `apps/reports/services.py` | Pandas로 XLSX 생성 | Pandas |
| **ReportRepository** | `apps/reports/repositories.py` | DB 조회 (페이지네이션, 정렬) | Django ORM |

### 1.2 Frontend Modules

| 모듈 | 경로 | 역할 | 의존성 |
|------|------|------|--------|
| **ReportPage** | `components/pages/ReportPage.tsx` | 페이지 컨테이너 (ReportProvider) | ReportLayout |
| **ReportProvider** | `contexts/ReportContext.tsx` | Context + useReducer 상태 관리 | reportReducer |
| **ReportLayout** | `components/features/Report/ReportLayout.tsx` | 레이아웃 (필터 + 테이블 + 차트) | FilterPanel, DataTable, ChartView |
| **FilterPanel** | `components/features/Report/FilterPanel.tsx` | 필터 UI | useReportContext |
| **DataTable** | `components/features/Report/DataTable.tsx` | 데이터 테이블 (정렬, 페이지네이션) | useReportContext, useReportData |
| **Pagination** | `components/features/Report/Pagination.tsx` | 페이지네이션 컨트롤 | useReportContext |
| **ExportButton** | `components/features/Report/ExportButton.tsx` | 엑셀 다운로드 버튼 | useExportReport |
| **useReportData** | `hooks/queries/useReport.ts` | 리포트 데이터 조회 | TanStack Query, useReportContext |
| **useExportReport** | `hooks/queries/useReport.ts` | 엑셀 다운로드 | TanStack Query, useReportContext |

---

## 2. Dependency Diagram

```mermaid
flowchart TD
    User[User] --> ReportPage[ReportPage.tsx]
    ReportPage --> ReportProvider[ReportProvider<br/>Context + useReducer]
    ReportProvider --> ReportLayout[ReportLayout.tsx]

    ReportLayout --> FilterPanel[FilterPanel.tsx]
    ReportLayout --> DataTable[DataTable.tsx]
    ReportLayout --> Pagination[Pagination.tsx]
    ReportLayout --> ChartView[ChartView.tsx]
    ReportLayout --> ExportButton[ExportButton.tsx]

    FilterPanel -->|useReportContext| ReportProvider
    DataTable -->|useReportContext| ReportProvider
    Pagination -->|useReportContext| ReportProvider
    ExportButton -->|useReportContext| ReportProvider

    DataTable -->|useReportData| ReportAPI[GET /api/reports/{type}/]
    ExportButton -->|useExportReport| ExportAPI[GET /api/reports/export/]

    ReportAPI --> ReportService[ReportService]
    ExportAPI --> ExportService[ExportService]

    ReportService --> ReportRepository[ReportRepository]
    ExportService --> Pandas[Pandas DataFrame]

    ReportRepository -->|Django ORM<br/>Pagination| Database[(PostgreSQL)]
    Pandas -->|XLSX binary| ExportAPI

    style User fill:#e1f5ff
    style Database fill:#ffe1e1
    style Pandas fill:#fff4e1
```

---

## 3. TDD Implementation Order

### Phase 1: Backend - ReportRepository (페이지네이션, 정렬)
### Phase 2: Backend - ReportService (비즈니스 로직)
### Phase 3: Backend - ReportViews (4개 리포트 API)
### Phase 4: Backend - ExportService (Pandas XLSX)
### Phase 5: Frontend - reportReducer (상태 관리)
### Phase 6: Frontend - ReportContext (Context API)
### Phase 7: Frontend - useReport Hooks (TanStack Query)
### Phase 8: Frontend - Report Components (필터, 테이블, 페이지네이션)
### Phase 9: E2E Tests (Full Flow)

---

## 4. Phase 1: Backend - ReportRepository

### 4.1 Test Scenarios (Unit Tests)

```python
# path: backend/apps/reports/tests/test_repositories.py

import pytest
from apps.data_upload.models import UploadedData, DataUploadLog
from apps.core.tests.factories import UserFactory
from ..repositories import ReportRepository

@pytest.fixture
def sample_performance_data(db):
    """성과 리포트 테스트 데이터"""
    user = UserFactory()
    log = DataUploadLog.objects.create(user=user, filename='test.csv', status='success')

    UploadedData.objects.bulk_create([
        UploadedData(
            upload_log=log,
            data_type='kpi',
            year=2025,
            college='공과대학',
            department='컴퓨터공학과',
            metadata={'취업률': 88.5, '전임교원': 17}
        ),
        UploadedData(
            upload_log=log,
            data_type='kpi',
            year=2025,
            college='인문대학',
            department='철학과',
            metadata={'취업률': 65.0, '전임교원': 6}
        )
    ])
    return log

def test_get_paginated_performance_data(sample_performance_data):
    # Given
    repository = ReportRepository()
    filters = {'year': 2025, 'college': 'all'}

    # When
    result = repository.get_performance_report(
        filters=filters,
        page=1,
        limit=20,
        sort_by='department',
        sort_order='asc'
    )

    # Then
    assert result['count'] == 2
    assert result['page'] == 1
    assert len(result['data']) == 2
    assert result['data'][0]['department'] == '컴퓨터공학과'  # asc 정렬

def test_get_paginated_data_page_2(sample_performance_data):
    # Given: 총 30개 데이터, limit=20
    # (추가 데이터 생성 로직)
    repository = ReportRepository()

    # When
    result = repository.get_performance_report(
        filters={'year': 2025},
        page=2,
        limit=20,
        sort_by='created_at',
        sort_order='desc'
    )

    # Then
    assert result['page'] == 2
    assert len(result['data']) == 10  # 나머지 10개
```

### 4.2 Implementation (ReportRepository)

```python
# path: backend/apps/reports/repositories.py

from typing import Dict, List, Any
from django.core.paginator import Paginator

from apps.data_upload.models import UploadedData

class ReportRepository:
    """
    리포트 데이터 조회 (페이지네이션, 정렬)
    """

    def get_performance_report(
        self,
        filters: Dict[str, Any],
        page: int,
        limit: int,
        sort_by: str = 'created_at',
        sort_order: str = 'desc'
    ) -> Dict[str, Any]:
        """
        성과 리포트 조회

        Args:
            filters: 필터 조건 {'year': 2025, 'college': 'all', ...}
            page: 페이지 번호 (1부터 시작)
            limit: 페이지당 레코드 수
            sort_by: 정렬 필드
            sort_order: 정렬 방향 ('asc' | 'desc')

        Returns:
            {
                'count': int,
                'page': int,
                'limit': int,
                'data': List[Dict],
                'summary': Dict
            }
        """
        # 1. 기본 쿼리셋
        queryset = UploadedData.objects.filter(data_type='kpi')

        # 2. 필터 적용
        if filters.get('year'):
            queryset = queryset.filter(year=filters['year'])
        if filters.get('college') and filters['college'] != 'all':
            queryset = queryset.filter(college=filters['college'])
        if filters.get('department') and filters['department'] != 'all':
            queryset = queryset.filter(department=filters['department'])

        # 3. 정렬
        order_prefix = '-' if sort_order == 'desc' else ''
        queryset = queryset.order_by(f'{order_prefix}{sort_by}')

        # 4. 페이지네이션
        paginator = Paginator(queryset, limit)
        page_obj = paginator.get_page(page)

        # 5. 데이터 변환
        data = []
        for record in page_obj:
            data.append({
                'id': record.id,
                'year': record.year,
                'college': record.college,
                'department': record.department,
                'graduation_rate': record.metadata.get('취업률', 0),
                'tenured_faculty': record.metadata.get('전임교원', 0),
            })

        # 6. 요약 통계
        summary = self._calculate_summary(queryset)

        return {
            'count': paginator.count,
            'page': page,
            'limit': limit,
            'data': data,
            'summary': summary
        }

    def _calculate_summary(self, queryset) -> Dict[str, Any]:
        """요약 통계 계산"""
        # Django aggregation 로직
        pass
```

---

## 5. Phase 2: Backend - ExportService

### 5.1 Test Scenarios (Unit Tests)

```python
# path: backend/apps/reports/tests/test_export_service.py

import pytest
from io import BytesIO

from ..services import ExportService

def test_export_to_xlsx_success():
    # Given
    service = ExportService()
    data = [
        {'year': 2025, 'college': '공과대학', 'department': '컴퓨터공학과', 'graduation_rate': 88.5},
        {'year': 2025, 'college': '인문대학', 'department': '철학과', 'graduation_rate': 65.0}
    ]

    # When
    xlsx_file = service.export_to_xlsx(data, report_type='performance')

    # Then
    assert isinstance(xlsx_file, BytesIO)
    assert xlsx_file.getvalue()[:4] == b'PK\x03\x04'  # XLSX magic number
```

### 5.2 Implementation (ExportService)

```python
# path: backend/apps/reports/services.py

import pandas as pd
from io import BytesIO
from typing import List, Dict, Any

class ExportService:
    """
    Pandas로 엑셀 파일 생성
    """

    def export_to_xlsx(self, data: List[Dict[str, Any]], report_type: str) -> BytesIO:
        """
        데이터를 XLSX 파일로 변환

        Args:
            data: 리포트 데이터
            report_type: 리포트 타입 (performance, publications, etc.)

        Returns:
            BytesIO: XLSX 파일 (binary)
        """
        # 1. DataFrame 생성
        df = pd.DataFrame(data)

        # 2. 컬럼명 한글화
        column_mapping = self._get_column_mapping(report_type)
        df.rename(columns=column_mapping, inplace=True)

        # 3. XLSX 파일 생성
        output = BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            df.to_excel(writer, index=False, sheet_name='Report')

        output.seek(0)
        return output

    def _get_column_mapping(self, report_type: str) -> Dict[str, str]:
        """리포트 타입별 컬럼 매핑"""
        mappings = {
            'performance': {
                'year': '연도',
                'college': '단과대학',
                'department': '학과',
                'graduation_rate': '취업률',
                'tenured_faculty': '전임교원'
            },
            # 기타 리포트 타입 매핑
        }
        return mappings.get(report_type, {})
```

---

## 6. Phase 3: Backend - ReportViews (E2E)

### 6.1 Test Scenarios (E2E Tests)

```python
# path: backend/apps/reports/tests/test_views.py

import pytest
from django.urls import reverse
from rest_framework import status

from apps.core.tests.factories import UserFactory

@pytest.mark.django_db
class TestReportAPIs:
    """
    Report API E2E 테스트 (NO MOCKING)
    """

    def test_get_performance_report_paginated(self, api_client, sample_performance_data):
        # Given
        user = UserFactory(is_active=True)
        api_client.force_authenticate(user=user)

        url = reverse('report-performance')

        # When
        response = api_client.get(url, {
            'year': 2025,
            'college': 'all',
            'page': 1,
            'limit': 20
        })

        # Then
        assert response.status_code == status.HTTP_200_OK
        assert 'count' in response.data
        assert 'data' in response.data
        assert 'summary' in response.data
        assert len(response.data['data']) > 0

    def test_export_report_to_xlsx(self, api_client, sample_performance_data):
        # Given
        user = UserFactory()
        api_client.force_authenticate(user=user)

        url = reverse('report-export')

        # When
        response = api_client.get(url, {
            'type': 'performance',
            'year': 2025,
            'college': 'all'
        })

        # Then
        assert response.status_code == status.HTTP_200_OK
        assert response['Content-Type'] == 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        assert 'Content-Disposition' in response
        assert b'PK' in response.content[:4]  # XLSX magic number
```

### 6.2 Implementation (ReportExportView)

```python
# path: backend/apps/reports/views.py

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.http import FileResponse

from .services import ReportService, ExportService

class ReportExportView(APIView):
    """
    GET /api/reports/export/

    엑셀 다운로드 API
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        # 1. 파라미터 추출
        report_type = request.query_params.get('type', 'performance')
        filters = {
            'year': int(request.query_params.get('year', 2025)),
            'college': request.query_params.get('college', 'all'),
        }

        # 2. 전체 데이터 조회 (페이지네이션 없음)
        report_service = ReportService()
        all_data = report_service.get_all_data(report_type, filters)

        # 3. XLSX 생성
        export_service = ExportService()
        xlsx_file = export_service.export_to_xlsx(all_data, report_type)

        # 4. 파일 다운로드 응답
        filename = f"{report_type}_{filters['year']}_{datetime.now().strftime('%Y%m%d')}.xlsx"
        response = FileResponse(
            xlsx_file,
            content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        return response
```

---

## 7. Phase 5: Frontend - reportReducer

### 7.1 Test Scenarios (Unit Tests - 순수함수)

```typescript
// path: frontend/src/reducers/reportReducer.test.ts

import { describe, test, expect } from 'vitest';
import { reportReducer, initialState } from './reportReducer';

describe('reportReducer', () => {
  test('INIT_PAGE 액션으로 페이지 초기화', () => {
    const action = {
      type: 'INIT_PAGE' as const,
      payload: {
        reportType: 'publications' as const,
        filters: { year: 2024, college: '공과대학' }
      }
    };

    const newState = reportReducer(initialState, action);

    expect(newState.reportType).toBe('publications');
    expect(newState.filters.year).toBe(2024);
    expect(newState.pagination.page).toBe(1);
  });

  test('CHANGE_FILTER 액션으로 필터 변경 시 페이지 1로 리셋', () => {
    const stateWithPage2 = {
      ...initialState,
      pagination: { ...initialState.pagination, page: 2 }
    };

    const action = {
      type: 'CHANGE_FILTER' as const,
      payload: { key: 'college', value: '인문대학' }
    };

    const newState = reportReducer(stateWithPage2, action);

    expect(newState.filters.college).toBe('인문대학');
    expect(newState.pagination.page).toBe(1);  // 리셋
  });

  test('CHANGE_SORTING 액션으로 정렬 변경', () => {
    const action = {
      type: 'CHANGE_SORTING' as const,
      payload: { sortBy: 'department', sortOrder: 'asc' as const }
    };

    const newState = reportReducer(initialState, action);

    expect(newState.sorting.sortBy).toBe('department');
    expect(newState.sorting.sortOrder).toBe('asc');
  });

  test('SET_TOTAL_COUNT 액션으로 총 개수 업데이트', () => {
    const action = { type: 'SET_TOTAL_COUNT' as const, payload: 150 };

    const newState = reportReducer(initialState, action);

    expect(newState.pagination.totalCount).toBe(150);
  });
});
```

### 7.2 Implementation (reportReducer)

```typescript
// path: frontend/src/reducers/reportReducer.ts

export type ReportType = 'performance' | 'publications' | 'research' | 'students';
export type SortOrder = 'asc' | 'desc';

export interface ReportFilters {
  year: number;
  college: string;
  department?: string;
  status?: string;
}

export interface ReportState {
  reportType: ReportType;
  filters: ReportFilters;
  pagination: {
    page: number;
    limit: number;
    totalCount: number;
  };
  sorting: {
    sortBy: string;
    sortOrder: SortOrder;
  };
  isExporting: boolean;
}

export type ReportAction =
  | { type: 'INIT_PAGE'; payload: { reportType: ReportType; filters: ReportFilters } }
  | { type: 'CHANGE_FILTER'; payload: { key: string; value: any } }
  | { type: 'RESET_FILTERS' }
  | { type: 'CHANGE_SORTING'; payload: { sortBy: string; sortOrder: SortOrder } }
  | { type: 'CHANGE_PAGE'; payload: number }
  | { type: 'CHANGE_LIMIT'; payload: number }
  | { type: 'START_EXPORT' }
  | { type: 'FINISH_EXPORT' }
  | { type: 'SET_TOTAL_COUNT'; payload: number };

export const initialState: ReportState = {
  reportType: 'performance',
  filters: {
    year: new Date().getFullYear(),
    college: 'all',
  },
  pagination: {
    page: 1,
    limit: 20,
    totalCount: 0,
  },
  sorting: {
    sortBy: 'created_at',
    sortOrder: 'desc',
  },
  isExporting: false,
};

export function reportReducer(state: ReportState, action: ReportAction): ReportState {
  switch (action.type) {
    case 'INIT_PAGE':
      return {
        ...state,
        reportType: action.payload.reportType,
        filters: action.payload.filters,
        pagination: { ...state.pagination, page: 1 },
      };

    case 'CHANGE_FILTER':
      return {
        ...state,
        filters: { ...state.filters, [action.payload.key]: action.payload.value },
        pagination: { ...state.pagination, page: 1 }, // 필터 변경 시 페이지 리셋
      };

    case 'RESET_FILTERS':
      return { ...state, filters: initialState.filters, pagination: { ...state.pagination, page: 1 } };

    case 'CHANGE_SORTING':
      return { ...state, sorting: action.payload };

    case 'CHANGE_PAGE':
      return { ...state, pagination: { ...state.pagination, page: action.payload } };

    case 'CHANGE_LIMIT':
      return { ...state, pagination: { ...state.pagination, limit: action.payload, page: 1 } };

    case 'START_EXPORT':
      return { ...state, isExporting: true };

    case 'FINISH_EXPORT':
      return { ...state, isExporting: false };

    case 'SET_TOTAL_COUNT':
      return { ...state, pagination: { ...state.pagination, totalCount: action.payload } };

    default:
      return state;
  }
}
```

---

## 8. Phase 6: Frontend - ReportContext

### 8.1 Implementation (ReportContext)

```typescript
// path: frontend/src/contexts/ReportContext.tsx

import { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { reportReducer, initialState, ReportState, ReportAction } from '@/reducers/reportReducer';

interface ReportContextValue {
  state: ReportState;
  dispatch: React.Dispatch<ReportAction>;
}

const ReportContext = createContext<ReportContextValue | undefined>(undefined);

export function ReportProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reportReducer, initialState);
  const [searchParams, setSearchParams] = useSearchParams();

  // URL에서 초기 상태 복원
  useEffect(() => {
    const year = searchParams.get('year');
    const college = searchParams.get('college');
    const page = searchParams.get('page');

    if (year || college || page) {
      dispatch({
        type: 'INIT_PAGE',
        payload: {
          reportType: state.reportType,
          filters: {
            year: year ? parseInt(year) : new Date().getFullYear(),
            college: college || 'all',
          }
        }
      });

      if (page) {
        dispatch({ type: 'CHANGE_PAGE', payload: parseInt(page) });
      }
    }
  }, []);

  // 상태 변경 시 URL 동기화
  useEffect(() => {
    const params = new URLSearchParams({
      year: String(state.filters.year),
      college: state.filters.college,
      page: String(state.pagination.page),
      limit: String(state.pagination.limit),
      sortBy: state.sorting.sortBy,
      sortOrder: state.sorting.sortOrder,
    });

    setSearchParams(params, { replace: true });
  }, [state.filters, state.pagination, state.sorting, setSearchParams]);

  return (
    <ReportContext.Provider value={{ state, dispatch }}>
      {children}
    </ReportContext.Provider>
  );
}

export function useReportContext() {
  const context = useContext(ReportContext);
  if (!context) {
    throw new Error('useReportContext must be used within ReportProvider');
  }
  return context;
}
```

---

## 9. Phase 7: Frontend - useReport Hooks

### 9.1 Implementation (useReportData)

```typescript
// path: frontend/src/hooks/queries/useReport.ts

import { useQuery, useMutation } from '@tanstack/react-query';
import apiClient from '@/api/client';
import { useReportContext } from '@/contexts/ReportContext';

export const useReportData = () => {
  const { state, dispatch } = useReportContext();

  return useQuery({
    queryKey: ['report', state.reportType, state.filters, state.pagination, state.sorting],
    queryFn: async () => {
      const params = new URLSearchParams({
        year: String(state.filters.year),
        college: state.filters.college,
        page: String(state.pagination.page),
        limit: String(state.pagination.limit),
        sortBy: state.sorting.sortBy,
        sortOrder: state.sorting.sortOrder,
      });

      const response = await apiClient.get(`/api/reports/${state.reportType}/?${params}`);

      // 총 개수 업데이트
      dispatch({ type: 'SET_TOTAL_COUNT', payload: response.data.count });

      return response.data;
    },
    staleTime: 5 * 60 * 1000, // 5분
  });
};

export const useExportReport = () => {
  const { state, dispatch } = useReportContext();

  return useMutation({
    mutationFn: async () => {
      dispatch({ type: 'START_EXPORT' });

      const params = new URLSearchParams({
        type: state.reportType,
        year: String(state.filters.year),
        college: state.filters.college,
      });

      const response = await apiClient.get(`/api/reports/export/?${params}`, {
        responseType: 'blob'
      });

      const blob = response.data;
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${state.reportType}_${state.filters.year}_${new Date().toISOString().split('T')[0]}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);

      dispatch({ type: 'FINISH_EXPORT' });
    },
  });
};
```

---

## 10. Implementation Checklist

### Backend
- [ ] ReportRepository 단위 테스트 작성 (페이지네이션, 정렬)
- [ ] ReportRepository 구현 (4개 리포트 타입)
- [ ] ExportService 단위 테스트 작성
- [ ] ExportService 구현 (Pandas XLSX)
- [ ] ReportViews E2E 테스트 작성 (4개 리포트 + 1개 export API)
- [ ] ReportViews 구현
- [ ] URL 라우팅 설정

### Frontend
- [ ] reportReducer 단위 테스트 작성 (9개 액션 - 순수함수)
- [ ] reportReducer 구현
- [ ] ReportContext 구현 (Context + URL 동기화)
- [ ] useReportData, useExportReport hooks 구현 - 단위 테스트 없음
- [ ] FilterPanel integration 테스트 작성
- [ ] FilterPanel 컴포넌트 구현
- [ ] DataTable 컴포넌트 구현 (정렬 클릭)
- [ ] Pagination 컴포넌트 구현
- [ ] ExportButton 컴포넌트 구현
- [ ] ReportPage 구현 (ReportProvider 래핑)
- [ ] E2E 테스트 작성 (Playwright)

### Infrastructure
- [ ] MSW handlers 설정 (4개 report APIs + export)
- [ ] Sample report data factories

---

## 11. Test Coverage Goal

- **Backend Unit Tests**: 80%+ (Repository, ExportService - 순수 비즈니스 로직)
- **Backend E2E Tests**: 100% (4개 Report APIs + Export API)
- **Frontend Unit Tests**: reportReducer만 (순수함수)
- **Frontend Integration Tests**: 80%+ (FilterPanel, DataTable, Pagination - MSW 사용)
- **Frontend E2E Tests**: 100% (필터링/정렬/페이지네이션/엑셀 다운로드 플로우 - Playwright)

---

## 12. Notes

- **Context + useReducer**: 복잡한 상태 관리 (필터, 정렬, 페이지네이션)
- **URL 동기화**: useSearchParams로 북마크 가능, 페이지 새로 고침 시 상태 복원
- **Pandas**: XLSX 생성 시 `openpyxl` 엔진 사용
- **페이지네이션**: Django Paginator로 효율적인 DB 조회
- **TanStack Query**: queryKey에 모든 상태 포함하여 자동 재페칭
