# 페이지 복잡도 분석

## 분석 방법론

각 페이지의 복잡도를 4가지 차원에서 평가하여 점수를 산정합니다:

1. **State Complexity** (1-5점): 관리해야 할 상태의 수와 복잡도
2. **Interaction Complexity** (1-5점): 사용자 상호작용의 수와 복잡도
3. **Component Hierarchy** (1-4점): 컴포넌트 깊이와 형제 컴포넌트 수
4. **Data Flow Complexity** (1-5점): 데이터 소스와 변환의 복잡도

**총점 기준:**
- **0-5점**: Low - 상태 관리 불필요
- **6-10점**: Medium - **Level 1** (기본 상태 정의만)
- **11-15점**: High - **Level 2** (Flux 패턴: Action/Reducer/View)
- **16+점**: Very High - **Level 3** (Full Context + useReducer)

---

## 분석 결과

| 페이지 | 점수 | 레벨 | 작업 범위 |
|--------|------|------|-----------|
| 로그인 페이지 | 5 | Low | ❌ 작업 불필요 |
| 데이터 업로드 페이지 | 12 | High | ⭐⭐ Level 2 (Flux 패턴) |
| 메인 대시보드 | 14 | High | ⭐⭐ Level 2 (Flux 패턴) |
| 상세 리포트 페이지 | 16 | Very High | ⭐⭐⭐ Level 3 (Context + useReducer) |
| 사용자 관리 페이지 | 8 | Medium | ⭐ Level 1 (기본 상태만) |

---

## 1. 로그인 페이지 (5점, Low)

**관련 유스케이스:** UC-001, UC-002

### 복잡도 구성:
- **State Complexity**: 2점 (username, password, error)
- **Interaction Complexity**: 2점 (입력, 로그인 버튼)
- **Component Hierarchy**: 1점 (단일 폼 컴포넌트)
- **Data Flow**: 0점 (API 호출만)

### 제안: 상태 관리 불필요
**이유:**
- 단순한 폼 입력과 검증만 필요
- React Hook Form + Zod로 충분
- 페이지 간 상태 공유 불필요

---

## 2. 데이터 업로드 페이지 (12점, High)

**관련 유스케이스:** UC-004

### 복잡도 구성:
- **State Complexity**: 4점
  - 파일 선택 상태
  - 업로드 진행 상태 (idle, uploading, success, error)
  - 업로드 이력 목록
  - 에러 메시지 및 상세 정보

- **Interaction Complexity**: 3점
  - 파일 선택
  - 업로드 시작
  - 이력 조회
  - 재시도

- **Component Hierarchy**: 3점
  - FileUploader (파일 선택, 검증, 업로드 버튼)
  - UploadStatus (진행 상태 표시)
  - UploadHistory (이력 목록 테이블)

- **Data Flow**: 2점
  - API: POST /api/data-upload/
  - API: GET /api/data-upload/history/
  - 파일 바이너리 데이터

### 제안: Level 2 (Flux 패턴)

**작업 범위:**
- ✅ `/docs/pages/data-upload/requirement.md` 작성
- ✅ `/docs/pages/data-upload/state_management.md` 작성 (부분)
  - 상태 정의 + Flux 패턴 (Action/Reducer/View)
  - Context 설계 없음 (useReducer만)

**이유:**
- 업로드 진행 상태 관리가 복잡 (idle → uploading → success/error)
- 여러 컴포넌트(파일 선택, 진행 표시, 이력)가 상태 공유
- Flux 패턴으로 상태 전환 명확화 필요

---

## 3. 메인 대시보드 (14점, High)

**관련 유스케이스:** UC-005

### 복잡도 구성:
- **State Complexity**: 5점
  - 5개 차트 데이터 (KPI, 논문, 연구, 학생, 요약)
  - 필터 상태 (year, semester, college)
  - 로딩 상태 (5개 API 병렬)
  - 에러 상태 (개별 차트 오류)

- **Interaction Complexity**: 4점
  - 필터 변경 (연도, 학기, 단과대학)
  - 차트 클릭 (상세 리포트 이동)
  - 차트 도구 (툴팁, 범례)
  - 재시도 버튼

- **Component Hierarchy**: 3점
  - DashboardLayout
    - FilterBar (필터 선택)
    - SummaryCards (요약 카드 4개)
    - ChartGrid
      - KPIChart
      - PublicationChart
      - ResearchChart
      - StudentChart

- **Data Flow**: 2점
  - 5개 병렬 API 요청
  - URL 쿼리 파라미터 동기화
  - TanStack Query 캐싱

### 제안: Level 2 (Flux 패턴)

**작업 범위:**
- ✅ `/docs/pages/main-dashboard/requirement.md` 작성
- ✅ `/docs/pages/main-dashboard/state_management.md` 작성 (부분)
  - 상태 정의 + Flux 패턴
  - Context 설계 없음

**이유:**
- 필터 변경 시 모든 차트 동기화 업데이트 필요
- 5개 API 요청의 로딩/에러 상태 통합 관리
- Flux 패턴으로 필터 변경 → 데이터 로딩 → 차트 업데이트 흐름 명확화

---

## 4. 상세 리포트 페이지 (16점, Very High)

**관련 유스케이스:** UC-006

### 복잡도 구성:
- **State Complexity**: 6점
  - 리포트 타입 (performance/publications/research/students)
  - 필터 상태 (year, college, department, status, 등)
  - 테이블 데이터 (페이지별)
  - 페이지네이션 상태 (page, limit, total_count)
  - 정렬 상태 (sortBy, sortOrder)
  - 차트 데이터
  - 로딩/에러 상태

- **Interaction Complexity**: 5점
  - 필터 변경 (다양한 조건)
  - 테이블 정렬 (컬럼 클릭)
  - 페이지 이동
  - 엑셀 다운로드
  - 차트 상호작용

- **Component Hierarchy**: 3점
  - ReportLayout
    - FilterPanel (다양한 필터)
    - DataTable (정렬, 페이지네이션)
    - ChartView (상세 차트)
    - ExportButton

- **Data Flow**: 2점
  - API: GET /api/reports/{type}/
  - API: GET /api/reports/export/
  - URL 쿼리 파라미터 동기화 (많은 필터)

### 제안: Level 3 (Context + useReducer)

**작업 범위:**
- ✅ `/docs/pages/detailed-report/requirement.md` 작성
- ✅ `/docs/pages/detailed-report/state_management.md` 작성 (전체)
  - 상태 정의
  - Flux 패턴 (Action/Reducer/View)
  - **Context 설계** (여러 하위 컴포넌트 간 상태 공유)

**이유:**
- 필터, 정렬, 페이지네이션이 복잡하게 얽혀있음
- FilterPanel, DataTable, ChartView가 모두 상태 공유 필요
- Context로 prop drilling 방지
- Reducer로 복잡한 상태 전환 관리 (필터 변경 → 페이지 리셋 → 데이터 로딩)

---

## 5. 사용자 관리 페이지 (8점, Medium)

**관련 유스케이스:** UC-003

### 복잡도 구성:
- **State Complexity**: 3점
  - 사용자 목록
  - 폼 입력 상태 (신규 사용자)
  - 선택된 사용자 (편집용)

- **Interaction Complexity**: 3점
  - 사용자 목록 조회
  - 신규 사용자 추가
  - 사용자 편집/삭제

- **Component Hierarchy**: 1점
  - UserManagement
    - UserList (테이블)
    - UserForm (폼)

- **Data Flow**: 1점
  - API: GET /api/users/
  - API: POST /api/users/
  - API: PATCH /api/users/{id}/

### 제안: Level 1 (기본 상태 정의만)

**작업 범위:**
- ✅ `/docs/pages/user-management/requirement.md` 작성
- ✅ 상태 정의 + 상태 전환 테이블만
- ❌ Flux/Context 없음

**이유:**
- 상태가 단순 (사용자 목록 + 폼)
- TanStack Query로 서버 상태 관리
- React Hook Form으로 폼 상태 관리
- 복잡한 상태 전환 없음

---

## 권장 작업 순서

### 우선순위 1 (필수)
1. **상세 리포트 페이지** (16점) → Level 3
   - 가장 복잡하고 핵심 기능
   - 사용자 경험에 가장 큰 영향

2. **메인 대시보드** (14점) → Level 2
   - 사용자가 가장 먼저 보는 페이지
   - 전체 데이터 현황 파악

3. **데이터 업로드 페이지** (12점) → Level 2
   - 관리자 핵심 기능
   - 데이터 품질 관리

### 우선순위 2 (선택)
4. **사용자 관리 페이지** (8점) → Level 1
   - 간단한 CRUD
   - 낮은 복잡도

---

## 다음 단계

Phase 3에서 다음 페이지들의 상태 관리 문서를 작성합니다:

1. **Level 3 (필수):**
   - `/docs/pages/detailed-report/requirement.md`
   - `/docs/pages/detailed-report/state_management.md`

2. **Level 2 (필수):**
   - `/docs/pages/main-dashboard/requirement.md`
   - `/docs/pages/main-dashboard/state_management.md`
   - `/docs/pages/data-upload/requirement.md`
   - `/docs/pages/data-upload/state_management.md`

3. **Level 1 (선택):**
   - `/docs/pages/user-management/requirement.md`

**Phase 3로 진행하시겠습니까? 어떤 페이지부터 작업하시겠습니까?**

1. "상세 리포트부터 시작" → Level 3 작업
2. "순서대로 모두 진행" → 1번부터 순차 작업
3. "특정 페이지만" → 지정 페이지 작업
4. "Phase 3 건너뛰기" → Phase 4 (Implementation Plan)로 바로 이동
