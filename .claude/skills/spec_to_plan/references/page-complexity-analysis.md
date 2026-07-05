# Page Complexity Analysis Guide

Use Case 작성 완료 후, 상태 관리가 필요한 페이지를 자동으로 분석하고 제안하는 가이드입니다.

---

## 분석 시점

**Phase 2 (Use Cases) 완료 후, Phase 3 (State Management) 시작 전**

모든 Use Case가 작성되면:
1. Use Case에서 언급된 모든 페이지 추출
2. 각 페이지의 복잡도 분석
3. 상태 관리 필요 여부 및 수준 제안
4. 우선순위 제안

---

## 페이지 복잡도 분석 기준

### 1. 상태 복잡도 (State Complexity)

#### 점수 계산
- **관리해야 할 데이터 종류**: 각 1점
  - 서버에서 가져온 데이터 (fetched data)
  - 사용자 입력 데이터 (form state)
  - UI 상태 (loading, error, modal open/close 등)
  - 필터/정렬 상태
  - 페이지네이션 상태

#### 복잡도 레벨
- **1-2점**: Simple - 단순 상태
- **3-4점**: Medium - 중간 복잡도
- **5점 이상**: Complex - 높은 복잡도

### 2. 상호작용 복잡도 (Interaction Complexity)

#### 점수 계산
- **사용자 액션 수**: 각 0.5점
  - CRUD 작업 (Create, Read, Update, Delete)
  - 필터링/검색
  - 정렬
  - 페이지네이션
  - 모달 열기/닫기
  - 폼 제출/검증

#### 복잡도 레벨
- **1-2점**: Simple - 기본 상호작용
- **3-4점**: Medium - 중간 수준
- **5점 이상**: Complex - 많은 상호작용

### 3. 컴포넌트 계층 복잡도 (Component Hierarchy Complexity)

#### 점수 계산
- **컴포넌트 깊이**:
  - 3단계 이하: 1점
  - 4-5단계: 2점
  - 6단계 이상: 3점

- **상태를 공유하는 형제 컴포넌트 수**:
  - 0-1개: 0점
  - 2-3개: 1점
  - 4개 이상: 2점

#### 복잡도 레벨
- **1점**: Simple - 얕은 계층
- **2-3점**: Medium - 중간 계층
- **4점 이상**: Complex - 깊은 계층

### 4. 데이터 흐름 복잡도 (Data Flow Complexity)

#### 점수 계산
- **데이터 소스 종류**: 각 1점
  - API 호출
  - Local Storage
  - URL Query Parameters
  - Props drilling (3단계 이상)

- **데이터 변환/가공**: 각 0.5점
  - 필터링
  - 정렬
  - 집계 (sum, count 등)
  - 조인/병합

#### 복잡도 레벨
- **1-2점**: Simple - 단순 데이터 흐름
- **3-4점**: Medium - 중간 복잡도
- **5점 이상**: Complex - 복잡한 데이터 흐름

---

## 종합 복잡도 평가

### 총점 계산
```
총점 = 상태 복잡도 + 상호작용 복잡도 + 컴포넌트 계층 복잡도 + 데이터 흐름 복잡도
```

### 최종 레벨
| 총점 | 레벨 | 설명 |
|------|------|------|
| 0-5점 | **Low** | 단순한 페이지, 상태 관리 불필요 |
| 6-10점 | **Medium** | 중간 복잡도, 기본 상태 정의만 필요 |
| 11-15점 | **High** | 높은 복잡도, Flux 패턴 적용 권장 |
| 16점 이상 | **Very High** | 매우 복잡, Context + useReducer 필수 |

---

## 상태 관리 수준 제안

### Level 0: 상태 관리 불필요 (총점 0-5)

**특징:**
- 정적 페이지 (About, Contact 등)
- 단순 표시만 있는 페이지
- 상태가 없거나 1-2개의 간단한 useState

**제안:**
- ✅ 상태 관리 문서 작성하지 않음
- ✅ useState 또는 단순 props로 충분

**예시:**
- 회사 소개 페이지
- FAQ 페이지
- 단순 랜딩 페이지

---

### Level 1: 기본 상태 정의만 (총점 6-10)

**특징:**
- 2-4개의 관리 상태
- 간단한 CRUD 중 1-2개만 수행
- Props drilling이 2단계 이하

**제안:**
- ✅ `/docs/pages/[pagename]/requirement.md` 작성
- ✅ 상태 데이터 식별 (State vs Derived)
- ✅ 상태 전환 테이블 작성
- ❌ Flux 패턴 적용하지 않음
- ❌ Context 설계하지 않음

**작성 범위:**
```markdown
# Requirement.md

## State Data Identification
- 관리 상태: [목록]
- Derived 데이터: [목록]

## State Transition Table
| State | Change Condition | UI Update |
|-------|------------------|-----------|
| ...   | ...              | ...       |

## Implementation Suggestion
- useState 또는 useReducer (선택)
- Context 불필요
```

**예시:**
- 단순 상품 목록 페이지 (필터 없음)
- 프로필 조회 페이지
- 공지사항 목록 페이지

---

### Level 2: Flux 패턴 적용 (총점 11-15)

**특징:**
- 5-7개의 관리 상태
- 여러 CRUD 작업
- 상태 간 의존성 존재
- Props drilling 3-4단계

**제안:**
- ✅ `/docs/pages/[pagename]/requirement.md` 작성
- ✅ 상태 데이터 식별
- ✅ 상태 전환 테이블 작성
- ✅ **Flux 패턴 설계 (Action → Reducer → View)**
- ❌ Context 설계하지 않음 (useReducer만 사용)

**작성 범위:**
```markdown
# Requirement.md + State Management.md (부분)

## State Data Identification
[...]

## State Transition Table
[...]

## Flux Pattern Design
### Actions
```typescript
type Action =
  | { type: 'FETCH_START' }
  | { type: 'FETCH_SUCCESS', payload: Data[] }
  | { type: 'CREATE_ITEM', payload: Item }
```

### Reducer
```typescript
function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'FETCH_START':
      return { ...state, loading: true }
    // ...
  }
}
```

### View
- 컴포넌트는 dispatch를 props로 받음
- Context 없이 Props로 전달

## Implementation Suggestion
- useReducer 사용 (페이지 컴포넌트 내)
- Context는 아직 불필요
```

**예시:**
- 필터링/정렬이 있는 상품 목록
- 다단계 폼 페이지
- 간단한 대시보드

---

### Level 3: Context + useReducer 전체 적용 (총점 16+)

**특징:**
- 8개 이상의 관리 상태
- 복잡한 CRUD + 복합 작업
- 깊은 컴포넌트 계층 (5단계 이상)
- 여러 자식 컴포넌트가 상태 공유
- Props drilling 5단계 이상

**제안:**
- ✅ `/docs/pages/[pagename]/requirement.md` 작성
- ✅ 상태 데이터 식별
- ✅ 상태 전환 테이블 작성
- ✅ Flux 패턴 설계
- ✅ **Context 설계 (데이터 로딩, 인터페이스 노출)**

**작성 범위:**
```markdown
# Requirement.md + State Management.md (전체)

## State Data Identification
[...]

## State Transition Table
[...]

## Flux Pattern Design
[완전한 Action/Reducer/View 설계]

## Context Design

### Data Flow
```
PageProvider (Context)
  ↓
useReducer (State Management)
  ↓
API Calls (Effects)
  ↓
Child Components (Consumers)
```

### Exposed Interface
```typescript
interface PageContextValue {
  // State
  items: Item[]
  loading: boolean
  error: string | null

  // Computed
  filteredItems: Item[]

  // Actions
  createItem: (data: CreateData) => Promise<void>
  updateItem: (id: string, data: UpdateData) => Promise<void>
  deleteItem: (id: string) => Promise<void>
}
```

### Usage Example
```typescript
function ChildComponent() {
  const { items, createItem } = usePageContext()
  // ...
}
```

## Implementation Suggestion
- Context + useReducer 필수
- Provider를 페이지 최상위에 배치
- 하위 컴포넌트는 useContext로 소비
```

**예시:**
- 복잡한 전자상거래 체크아웃 페이지
- 실시간 협업 에디터
- 복잡한 대시보드 (여러 위젯)
- 다단계 폼 + 검증 + 미리보기

---

## 분석 프로세스

### Step 1: Use Case에서 페이지 추출

Use Case 문서들을 읽고 언급된 모든 페이지를 추출합니다.

```
/docs/001/spec.md → "상품 목록 페이지"
/docs/002/spec.md → "상품 상세 페이지", "장바구니 페이지"
/docs/003/spec.md → "결제 페이지"
```

### Step 2: 각 페이지의 복잡도 점수 계산

각 Use Case를 읽으며:
- Main Scenario에서 사용자 액션 카운트
- Business Rules에서 데이터 종류 파악
- Sequence Diagram에서 데이터 흐름 분석
- 예상되는 컴포넌트 구조 추정

### Step 3: 복잡도별로 페이지 그룹화

| 페이지 | 총점 | 레벨 | 제안 |
|--------|------|------|------|
| 상품 목록 | 12 | High | Level 2 (Flux) |
| 상품 상세 | 6 | Medium | Level 1 (기본) |
| 장바구니 | 15 | High | Level 2 (Flux) |
| 결제 | 18 | Very High | Level 3 (Context) |

### Step 4: 우선순위 제안

복잡도가 높은 순서대로 작업 제안:

```
1순위: 결제 페이지 (18점, Very High) → Level 3
2순위: 장바구니 페이지 (15점, High) → Level 2
3순위: 상품 목록 페이지 (12점, High) → Level 2
4순위: 상품 상세 페이지 (6점, Medium) → Level 1 (선택)
```

---

## 사용자 제안 템플릿

### 제안 형식

```markdown
📊 **페이지 복잡도 분석 완료**

모든 Use Case를 분석한 결과, 다음 페이지들이 식별되었습니다:

## 분석 결과

| 페이지 | 복잡도 점수 | 레벨 | 상태 관리 필요 수준 |
|--------|-------------|------|---------------------|
| 결제 페이지 | 18점 | Very High | ⭐⭐⭐ Level 3 (Context + useReducer) |
| 장바구니 | 15점 | High | ⭐⭐ Level 2 (Flux 패턴) |
| 상품 목록 | 12점 | High | ⭐⭐ Level 2 (Flux 패턴) |
| 상품 상세 | 6점 | Medium | ⭐ Level 1 (기본 상태) |
| 회사 소개 | 2점 | Low | ❌ 불필요 |

## 상세 분석

### 1. 결제 페이지 (18점, Very High)
**복잡도 구성:**
- 상태 복잡도: 6점 (결제 정보, 배송 정보, 쿠폰, UI 상태 등)
- 상호작용: 5점 (폼 입력, 검증, API 호출 여러 개)
- 컴포넌트 계층: 4점 (5단계 이상)
- 데이터 흐름: 3점 (API, Local Storage, 복잡한 계산)

**제안 수준: Level 3 (Context + useReducer 전체 적용)**
- Requirement.md ✅
- State Management.md (전체) ✅
  - 상태 정의
  - Flux 패턴
  - Context 설계

**이유:**
- 여러 하위 컴포넌트가 결제 상태를 공유해야 함
- Props drilling을 피하기 위해 Context 필수
- 복잡한 상태 전환 (주문 단계별)

---

### 2. 장바구니 페이지 (15점, High)
**복잡도 구성:**
- 상태 복잡도: 5점
- 상호작용: 4.5점
- 컴포넌트 계층: 3점
- 데이터 흐름: 2.5점

**제안 수준: Level 2 (Flux 패턴 적용)**
- Requirement.md ✅
- State Management.md (부분) ✅
  - 상태 정의
  - Flux 패턴 (Action/Reducer/View)
  - Context 설계 ❌ (useReducer만 사용)

**이유:**
- 여러 액션이 있지만 컴포넌트 계층이 그리 깊지 않음
- useReducer로 충분히 관리 가능
- Context는 오버엔지니어링

---

### 3. 상품 상세 페이지 (6점, Medium)
**제안 수준: Level 1 (기본 상태 정의만)**
- Requirement.md ✅
- State Management.md ❌ (불필요)

**이유:**
- 상태가 단순함 (상품 데이터, loading, error 정도)
- useState로 충분

---

## 권장 작업 순서

복잡도가 높고 핵심적인 페이지부터 작업하는 것을 권장합니다:

1. **결제 페이지** (18점) - Level 3 전체 작업
2. **장바구니 페이지** (15점) - Level 2 작업
3. **상품 목록 페이지** (12점) - Level 2 작업
4. **(선택) 상품 상세 페이지** (6점) - Level 1 작업

복잡도가 낮은 페이지(회사 소개 등)는 상태 관리 문서를 작성하지 않습니다.

## 질문

**어떤 페이지부터 상태 관리 설계를 시작하시겠습니까?**

옵션:
1. "결제 페이지부터 시작" → Level 3 작업 진행
2. "모두 작업" → 1번부터 순차 진행
3. "[페이지명] 먼저" → 지정한 페이지부터
4. "분석만 확인, 나중에 결정" → Phase 3 건너뜀
```

---

## 예외 처리

### 페이지가 명확하지 않은 경우
- Use Case에서 페이지가 명시되지 않았다면 추정
- 예: "사용자가 로그인한다" → "로그인 페이지"

### 복잡도 판단이 애매한 경우
- 더 높은 레벨로 제안 (안전하게)
- 사용자에게 선택권 제공

### 모든 페이지가 단순한 경우
```
📊 페이지 복잡도 분석 완료

모든 페이지가 복잡도 Low-Medium으로 판단되어,
상태 관리 문서 작성이 필요하지 않을 수 있습니다.

Phase 3 (State Management)를 건너뛰고
Phase 4 (Implementation Plan)로 바로 진행하시겠습니까?

- "건너뛰기" → Phase 4로 이동
- "일부 페이지라도 작성" → 페이지 선택 후 진행
```

---

## 분석 시 주의사항

### ✅ DO
- Use Case의 Main Scenario를 꼼꼼히 읽기
- Business Rules에서 숨겨진 복잡도 찾기
- Sequence Diagram에서 데이터 흐름 파악
- 사용자 경험을 고려한 컴포넌트 구조 예상

### ❌ DON'T
- 점수만으로 기계적 판단하지 않기
- 사용자 컨텍스트 무시하지 않기
- 모든 페이지에 상태 관리 강요하지 않기
- 복잡도를 과소평가하지 않기 (의심되면 높은 레벨)

---

## 관련 문서

- [SKILL.md](../SKILL.md) - Phase 2.5: Page Analysis 섹션
- [prompt-templates.md](prompt-templates.md) - Page Analysis Prompt
- [review-guide.md](review-guide.md) - 제안 검토 가이드
