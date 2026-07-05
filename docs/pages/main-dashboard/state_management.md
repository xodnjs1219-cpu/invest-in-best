# 메인 대시보드 - 상태 관리 설계 (Level 2)

## 개요

**복잡도**: High (14점)
**레벨**: Level 2 (Flux 패턴, Context 없음)
**관련 유스케이스**: UC-005

---

## 1. 상태 데이터 식별

### 1.1 관리할 상태 (State)

| 상태명 | 타입 | 설명 |
|--------|------|------|
| `filters` | `DashboardFilters` | 필터 조건 (year, semester, college) |

```typescript
interface DashboardFilters {
  year: number;
  semester: 'all' | '1' | '2';
  college: string; // 'all' or specific college name
}
```

### 1.2 파생/표시 전용 데이터 (Derived Data)

**TanStack Query로 관리** (상태 관리 불필요):
- `summaryData`: 요약 통계 (서버에서 페칭)
- `kpiData`: KPI 차트 데이터
- `publicationData`: 논문 차트 데이터
- `researchData`: 연구 프로젝트 데이터
- `studentData`: 학생 현황 데이터
- `isLoading`: 로딩 상태 (각 API별, TanStack Query 자동 관리)
- `error`: 에러 상태 (각 API별, TanStack Query 자동 관리)

---

## 2. 상태 전환 테이블

| 현재 상태 | 이벤트 (Action) | 다음 상태 | UI 업데이트 |
|----------|----------------|-----------|------------|
| 초기 상태 | INIT_DASHBOARD | filters 기본값 설정 (현재 연도, 전체 학기) | 모든 차트 로딩 |
| 필터 변경 | CHANGE_YEAR | year 업데이트 | 모든 차트 재로딩 |
| 필터 변경 | CHANGE_SEMESTER | semester 업데이트 | KPI, 요약 차트 재로딩 |
| 필터 변경 | CHANGE_COLLEGE | college 업데이트 | 모든 차트 재로딩 |
| 필터 초기화 | RESET_FILTERS | filters 기본값으로 리셋 | 모든 차트 재로딩 |

---

## 3. Flux 패턴 설계

### 3.1 Actions (사용자 트리거 이벤트)

```typescript
// Action Types
type DashboardAction =
  | { type: 'INIT_DASHBOARD'; payload: DashboardFilters }
  | { type: 'CHANGE_YEAR'; payload: number }
  | { type: 'CHANGE_SEMESTER'; payload: 'all' | '1' | '2' }
  | { type: 'CHANGE_COLLEGE'; payload: string }
  | { type: 'RESET_FILTERS' };
```

### 3.2 Store (useReducer로 상태 관리)

```typescript
// State Interface
interface DashboardState {
  filters: DashboardFilters;
}

// Initial State
const initialState: DashboardState = {
  filters: {
    year: new Date().getFullYear(),
    semester: 'all',
    college: 'all',
  },
};

// Reducer
function dashboardReducer(state: DashboardState, action: DashboardAction): DashboardState {
  switch (action.type) {
    case 'INIT_DASHBOARD':
      return {
        ...state,
        filters: action.payload,
      };

    case 'CHANGE_YEAR':
      return {
        ...state,
        filters: { ...state.filters, year: action.payload },
      };

    case 'CHANGE_SEMESTER':
      return {
        ...state,
        filters: { ...state.filters, semester: action.payload },
      };

    case 'CHANGE_COLLEGE':
      return {
        ...state,
        filters: { ...state.filters, college: action.payload },
      };

    case 'RESET_FILTERS':
      return {
        ...state,
        filters: initialState.filters,
      };

    default:
      return state;
  }
}
```

### 3.3 View (컴포넌트에서 사용)

```typescript
// DashboardPage.tsx (메인 컴포넌트)
function DashboardPage() {
  const [state, dispatch] = useReducer(dashboardReducer, initialState);

  // URL 동기화
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const year = params.get('year') ? parseInt(params.get('year')!) : initialState.filters.year;
    const semester = (params.get('semester') as any) || initialState.filters.semester;
    const college = params.get('college') || initialState.filters.college;

    dispatch({ type: 'INIT_DASHBOARD', payload: { year, semester, college } });
  }, []);

  // URL 업데이트
  useEffect(() => {
    const params = new URLSearchParams({
      year: String(state.filters.year),
      semester: state.filters.semester,
      college: state.filters.college,
    });
    window.history.pushState({}, '', `?${params.toString()}`);
  }, [state.filters]);

  return (
    <Box>
      <FilterBar state={state} dispatch={dispatch} />
      <SummaryCards filters={state.filters} />
      <ChartGrid filters={state.filters} />
    </Box>
  );
}

// FilterBar.tsx
function FilterBar({ state, dispatch }: { state: DashboardState; dispatch: React.Dispatch<DashboardAction> }) {
  return (
    <Box>
      <Select
        value={state.filters.year}
        onChange={(e) => dispatch({ type: 'CHANGE_YEAR', payload: parseInt(e.target.value) })}
      >
        <MenuItem value={2023}>2023</MenuItem>
        <MenuItem value={2024}>2024</MenuItem>
        <MenuItem value={2025}>2025</MenuItem>
      </Select>

      <Select
        value={state.filters.semester}
        onChange={(e) => dispatch({ type: 'CHANGE_SEMESTER', payload: e.target.value as any })}
      >
        <MenuItem value="all">전체</MenuItem>
        <MenuItem value="1">1학기</MenuItem>
        <MenuItem value="2">2학기</MenuItem>
      </Select>

      <Select
        value={state.filters.college}
        onChange={(e) => dispatch({ type: 'CHANGE_COLLEGE', payload: e.target.value })}
      >
        <MenuItem value="all">전체</MenuItem>
        <MenuItem value="공과대학">공과대학</MenuItem>
        <MenuItem value="인문대학">인문대학</MenuItem>
      </Select>

      <Button onClick={() => dispatch({ type: 'RESET_FILTERS' })}>초기화</Button>
    </Box>
  );
}
```

---

## 4. TanStack Query 통합

### 4.1 데이터 페칭 Hooks

```typescript
// useDashboardData.ts
export function useDashboardSummary(filters: DashboardFilters) {
  return useQuery({
    queryKey: ['dashboard', 'summary', filters],
    queryFn: async () => {
      const params = new URLSearchParams({
        year: String(filters.year),
        semester: filters.semester,
        college: filters.college,
      });
      const response = await fetch(`/api/dashboard/summary/?${params}`);
      return response.json();
    },
    staleTime: 5 * 60 * 1000, // 5분
  });
}

export function useDashboardKPI(filters: DashboardFilters) {
  return useQuery({
    queryKey: ['dashboard', 'kpi', filters],
    queryFn: async () => {
      const params = new URLSearchParams({
        year: String(filters.year),
        semester: filters.semester,
      });
      const response = await fetch(`/api/dashboard/kpi/?${params}`);
      return response.json();
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useDashboardPublications(filters: DashboardFilters) {
  return useQuery({
    queryKey: ['dashboard', 'publications', filters.year],
    queryFn: async () => {
      const response = await fetch(`/api/dashboard/publications/?year=${filters.year}`);
      return response.json();
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useDashboardResearch(filters: DashboardFilters) {
  return useQuery({
    queryKey: ['dashboard', 'research', filters.year],
    queryFn: async () => {
      const response = await fetch(`/api/dashboard/research/?year=${filters.year}`);
      return response.json();
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useDashboardStudents(filters: DashboardFilters) {
  return useQuery({
    queryKey: ['dashboard', 'students', filters.year],
    queryFn: async () => {
      const response = await fetch(`/api/dashboard/students/?year=${filters.year}`);
      return response.json();
    },
    staleTime: 5 * 60 * 1000,
  });
}
```

### 4.2 차트 컴포넌트

```typescript
// KPIChart.tsx
function KPIChart({ filters }: { filters: DashboardFilters }) {
  const { data, isLoading, error } = useDashboardKPI(filters);

  if (isLoading) return <CircularProgress />;
  if (error) return <Alert severity="error">데이터를 불러오는 중 오류가 발생했습니다</Alert>;
  if (!data || data.data.length === 0) return <Alert severity="info">표시할 데이터가 없습니다</Alert>;

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data.data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="department" />
        <YAxis />
        <Tooltip />
        <Legend />
        <Bar dataKey="graduation_rate" fill="#8884d8" name="취업률" />
        <Bar dataKey="tenured_faculty" fill="#82ca9d" name="전임교원" />
      </BarChart>
    </ResponsiveContainer>
  );
}

// PublicationChart.tsx
function PublicationChart({ filters }: { filters: DashboardFilters }) {
  const { data, isLoading, error } = useDashboardPublications(filters);

  if (isLoading) return <CircularProgress />;
  if (error) return <Alert severity="error">데이터를 불러오는 중 오류가 발생했습니다</Alert>;

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data.data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="year" />
        <YAxis />
        <Tooltip />
        <Legend />
        <Line type="monotone" dataKey="total" stroke="#8884d8" name="총 논문" />
        <Line type="monotone" dataKey="scie" stroke="#82ca9d" name="SCIE" />
        <Line type="monotone" dataKey="kci" stroke="#ffc658" name="KCI" />
      </LineChart>
    </ResponsiveContainer>
  );
}
```

---

## 5. 컴포넌트 구조

```
DashboardPage (useReducer로 filters 관리)
├─ FilterBar (state, dispatch props로 전달)
├─ SummaryCards (filters props로 전달)
│  └─ useDashboardSummary(filters)
└─ ChartGrid (filters props로 전달)
   ├─ KPIChart
   │  └─ useDashboardKPI(filters)
   ├─ PublicationChart
   │  └─ useDashboardPublications(filters)
   ├─ ResearchChart
   │  └─ useDashboardResearch(filters)
   └─ StudentChart
      └─ useDashboardStudents(filters)
```

---

## 6. 데이터 로딩 흐름

```
URL 파라미터 읽기
    ↓
useReducer 초기화 (INIT_DASHBOARD)
    ↓
filters 상태 설정
    ↓
5개 useQuery Hooks 병렬 실행 (queryKey에 filters 포함)
    ↓
각 차트 개별 로딩 상태 표시
    ↓
모든 데이터 로딩 완료
    ↓
차트 렌더링
    ↓
사용자가 필터 변경
    ↓
dispatch 액션 (CHANGE_YEAR, CHANGE_SEMESTER, ...)
    ↓
filters 상태 업데이트
    ↓
URL 쿼리 파라미터 동기화
    ↓
TanStack Query 자동 재페칭 (queryKey 변경 감지)
    ↓
차트 업데이트
```

---

## 7. 구현 우선순위

1. **useReducer + Actions** (필터 상태 관리)
2. **TanStack Query Hooks** (서버 데이터 페칭)
3. **URL 동기화** (북마크 가능)
4. **차트 컴포넌트** (Recharts 사용)
5. **로딩/에러 처리** (각 차트별 독립적)

---

## 8. 테스트 전략

### Unit Test
- `dashboardReducer` 함수 테스트 (각 액션별 상태 전환)
- Custom Hooks 테스트 (useDashboardKPI, useDashboardPublications 등)

### Integration Test
- FilterBar 변경 → 모든 차트 업데이트 테스트
- URL 동기화 테스트
- TanStack Query 병렬 요청 테스트

---

## 요약

- **useReducer**: 필터 상태 관리 (Context 불필요, props로 전달)
- **TanStack Query**: 5개 API 병렬 페칭 및 캐싱
- **Flux 패턴**: 명확한 필터 변경 흐름
- **URL 동기화**: 북마크 가능, 페이지 새로 고침 시 필터 복원
- **독립적 차트**: 각 차트가 개별적으로 로딩/에러 처리
