# 상세 리포트 페이지 - 상태 관리 설계 (Level 3)

## 개요

**복잡도**: Very High (16점)
**레벨**: Level 3 (Context + useReducer)
**관련 유스케이스**: UC-006

---

## 1. 상태 데이터 식별

### 1.1 관리할 상태 (State)

| 상태명 | 타입 | 설명 |
|--------|------|------|
| `reportType` | `'performance' \| 'publications' \| 'research' \| 'students'` | 현재 리포트 타입 |
| `filters` | `ReportFilters` | 필터 조건 (year, college, department, status 등) |
| `pagination` | `{ page: number; limit: number; totalCount: number }` | 페이지네이션 상태 |
| `sorting` | `{ sortBy: string; sortOrder: 'asc' \| 'desc' }` | 정렬 상태 |
| `isExporting` | `boolean` | 엑셀 다운로드 진행 중 여부 |

### 1.2 파생/표시 전용 데이터 (Derived Data)

**TanStack Query로 관리** (상태 관리 불필요):
- `tableData`: 테이블 데이터 (서버에서 페칭)
- `chartData`: 차트 데이터 (tableData에서 변환)
- `summary`: 요약 통계 (서버에서 페칭)
- `isLoading`: 로딩 상태 (TanStack Query 자동 관리)
- `error`: 에러 상태 (TanStack Query 자동 관리)

---

## 2. 상태 전환 테이블

| 현재 상태 | 이벤트 (Action) | 다음 상태 | UI 업데이트 |
|----------|----------------|-----------|------------|
| 초기 상태 | INIT_PAGE | reportType, filters, pagination 설정 | 테이블/차트 로딩 |
| 필터 적용 | CHANGE_FILTER | filters 업데이트, page=1로 리셋 | 테이블 재로딩 |
| 정렬 변경 | CHANGE_SORTING | sorting 업데이트 | 테이블 재정렬 |
| 페이지 이동 | CHANGE_PAGE | page 업데이트 | 다음/이전 페이지 로딩 |
| 엑셀 다운로드 시작 | START_EXPORT | isExporting=true | 다운로드 버튼 비활성화 |
| 엑셀 다운로드 완료 | FINISH_EXPORT | isExporting=false | 다운로드 버튼 활성화 |

---

## 3. Flux 패턴 설계

### 3.1 Actions (사용자 트리거 이벤트)

```typescript
// Action Types
type ReportAction =
  | { type: 'INIT_PAGE'; payload: { reportType: ReportType; filters: ReportFilters } }
  | { type: 'CHANGE_FILTER'; payload: { key: string; value: any } }
  | { type: 'RESET_FILTERS' }
  | { type: 'CHANGE_SORTING'; payload: { sortBy: string; sortOrder: SortOrder } }
  | { type: 'CHANGE_PAGE'; payload: number }
  | { type: 'CHANGE_LIMIT'; payload: number }
  | { type: 'START_EXPORT' }
  | { type: 'FINISH_EXPORT' }
  | { type: 'SET_TOTAL_COUNT'; payload: number };
```

### 3.2 Store (useReducer로 상태 관리)

```typescript
// State Interface
interface ReportState {
  reportType: ReportType;
  filters: ReportFilters;
  pagination: {
    page: number;
    limit: number;
    totalCount: number;
  };
  sorting: {
    sortBy: string;
    sortOrder: 'asc' | 'desc';
  };
  isExporting: boolean;
}

// Initial State
const initialState: ReportState = {
  reportType: 'performance',
  filters: {
    year: new Date().getFullYear(),
    college: 'all',
    department: 'all',
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

// Reducer
function reportReducer(state: ReportState, action: ReportAction): ReportState {
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
        filters: {
          ...state.filters,
          [action.payload.key]: action.payload.value,
        },
        pagination: { ...state.pagination, page: 1 }, // 필터 변경 시 페이지 리셋
      };

    case 'RESET_FILTERS':
      return {
        ...state,
        filters: initialState.filters,
        pagination: { ...state.pagination, page: 1 },
      };

    case 'CHANGE_SORTING':
      return {
        ...state,
        sorting: action.payload,
      };

    case 'CHANGE_PAGE':
      return {
        ...state,
        pagination: { ...state.pagination, page: action.payload },
      };

    case 'CHANGE_LIMIT':
      return {
        ...state,
        pagination: { ...state.pagination, limit: action.payload, page: 1 },
      };

    case 'START_EXPORT':
      return { ...state, isExporting: true };

    case 'FINISH_EXPORT':
      return { ...state, isExporting: false };

    case 'SET_TOTAL_COUNT':
      return {
        ...state,
        pagination: { ...state.pagination, totalCount: action.payload },
      };

    default:
      return state;
  }
}
```

### 3.3 View (컴포넌트에서 액션 디스패치)

```typescript
// FilterPanel 컴포넌트
function FilterPanel() {
  const { state, dispatch } = useReportContext();

  const handleFilterChange = (key: string, value: any) => {
    dispatch({ type: 'CHANGE_FILTER', payload: { key, value } });
  };

  return (
    <Box>
      <Select value={state.filters.year} onChange={(e) => handleFilterChange('year', e.target.value)}>
        {/* 연도 옵션 */}
      </Select>
      {/* 기타 필터 */}
    </Box>
  );
}

// DataTable 컴포넌트
function DataTable() {
  const { state, dispatch } = useReportContext();

  const handleSort = (column: string) => {
    const newOrder = state.sorting.sortBy === column && state.sorting.sortOrder === 'asc' ? 'desc' : 'asc';
    dispatch({ type: 'CHANGE_SORTING', payload: { sortBy: column, sortOrder: newOrder } });
  };

  return (
    <Table>
      <TableHead>
        <TableCell onClick={() => handleSort('year')}>연도</TableCell>
        {/* 기타 컬럼 */}
      </TableHead>
      {/* 테이블 바디 */}
    </Table>
  );
}
```

---

## 4. Context 설계 (여러 하위 컴포넌트 간 상태 공유)

### 4.1 데이터 로딩 흐름

```
URL 파라미터 읽기
    ↓
Context 초기화 (reportType, filters 설정)
    ↓
useQuery로 데이터 페칭
    ↓
테이블 + 차트 렌더링
    ↓
사용자 액션 (필터 변경, 정렬, 페이지 이동)
    ↓
Context 상태 업데이트 (dispatch)
    ↓
URL 쿼리 파라미터 동기화
    ↓
useQuery 자동 재페칭 (queryKey 변경 감지)
    ↓
UI 업데이트
```

### 4.2 Context API 구현

```typescript
// ReportContext.tsx
interface ReportContextValue {
  state: ReportState;
  dispatch: React.Dispatch<ReportAction>;
}

const ReportContext = createContext<ReportContextValue | undefined>(undefined);

export function ReportProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reportReducer, initialState);

  // URL 동기화
  useEffect(() => {
    const params = new URLSearchParams({
      year: String(state.filters.year),
      college: state.filters.college,
      page: String(state.pagination.page),
      limit: String(state.pagination.limit),
      sortBy: state.sorting.sortBy,
      sortOrder: state.sorting.sortOrder,
    });
    window.history.pushState({}, '', `?${params.toString()}`);
  }, [state.filters, state.pagination, state.sorting]);

  return (
    <ReportContext.Provider value={{ state, dispatch }}>
      {children}
    </ReReportContext.Provider>
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

### 4.3 TanStack Query 통합

```typescript
// useReportData.ts (Custom Hook)
function useReportData() {
  const { state, dispatch } = useReportContext();

  const query = useQuery({
    queryKey: ['report', state.reportType, state.filters, state.pagination, state.sorting],
    queryFn: async () => {
      const params = new URLSearchParams({
        ...state.filters,
        page: String(state.pagination.page),
        limit: String(state.pagination.limit),
        sortBy: state.sorting.sortBy,
        sortOrder: state.sorting.sortOrder,
      });

      const response = await fetch(`/api/reports/${state.reportType}/?${params}`);
      const data = await response.json();

      // 총 개수 업데이트
      dispatch({ type: 'SET_TOTAL_COUNT', payload: data.count });

      return data;
    },
    staleTime: 5 * 60 * 1000, // 5분
  });

  return query;
}
```

### 4.4 엑셀 다운로드 처리

```typescript
// useExportReport.ts
function useExportReport() {
  const { state, dispatch } = useReportContext();

  const exportMutation = useMutation({
    mutationFn: async () => {
      dispatch({ type: 'START_EXPORT' });

      const params = new URLSearchParams({
        type: state.reportType,
        ...state.filters,
      });

      const response = await fetch(`/api/reports/export/?${params}`);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = `${state.reportType}_${state.filters.year}_${new Date().toISOString().split('T')[0]}.xlsx`;
      a.click();

      dispatch({ type: 'FINISH_EXPORT' });
    },
  });

  return exportMutation;
}
```

---

## 5. 노출되는 인터페이스

### 5.1 Context에서 제공하는 데이터

```typescript
// 하위 컴포넌트에서 사용 가능
const { state, dispatch } = useReportContext();

// state.reportType
// state.filters
// state.pagination
// state.sorting
// state.isExporting
```

### 5.2 Context에서 제공하는 함수

```typescript
// dispatch 액션
dispatch({ type: 'CHANGE_FILTER', payload: { key: 'year', value: 2024 } });
dispatch({ type: 'CHANGE_PAGE', payload: 2 });
dispatch({ type: 'CHANGE_SORTING', payload: { sortBy: 'department', sortOrder: 'asc' } });
```

### 5.3 Custom Hooks

```typescript
// 데이터 페칭
const { data, isLoading, error } = useReportData();

// 엑셀 다운로드
const { mutate: exportReport, isPending } = useExportReport();
```

---

## 6. 컴포넌트 구조

```
<ReportProvider>
  <ReportLayout>
    <FilterPanel />        // Context 사용: filters, dispatch
    <DataTable />          // Context 사용: pagination, sorting, dispatch
    <Pagination />         // Context 사용: pagination, dispatch
    <ChartView />          // TanStack Query: data
    <ExportButton />       // Context 사용: isExporting, useExportReport
  </ReportLayout>
</ReportProvider>
```

---

## 7. 구현 우선순위

1. **Context + Reducer 설정** (핵심)
2. **TanStack Query 통합** (서버 상태)
3. **URL 동기화** (북마크 가능)
4. **필터/정렬/페이지네이션** (사용자 상호작용)
5. **엑셀 다운로드** (부가 기능)

---

## 8. 테스트 전략

### Unit Test
- `reportReducer` 함수 테스트 (각 액션별 상태 전환)
- Custom Hooks 테스트 (useReportData, useExportReport)

### Integration Test
- FilterPanel + DataTable + Pagination 상호작용
- URL 동기화 테스트
- TanStack Query 캐싱 동작 테스트

---

## 요약

- **Context + useReducer**: 복잡한 필터/정렬/페이지네이션 상태 관리
- **TanStack Query**: 서버 데이터 페칭 및 캐싱
- **Flux 패턴**: 명확한 상태 전환 흐름
- **URL 동기화**: 북마크 가능, 페이지 새로 고침 시 상태 복원
- **prop drilling 방지**: Context로 여러 하위 컴포넌트 간 상태 공유
