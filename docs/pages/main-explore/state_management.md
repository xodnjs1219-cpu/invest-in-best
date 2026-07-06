# 메인/탐색 페이지 상태 관리 설계 (main-explore) — Level 2: Flux 패턴

> 근거: `docs/pages/main-explore/requirement.md`, `docs/usecases/007·008/spec.md`, `docs/usecases/000_decisions.md`(B-1~B-7), `docs/techstack.md` §4.
> **산출 범위(Level 2)**: 상태 정의 + Flux 패턴(Action/Reducer/View 연결)까지. **Context 설계는 하지 않는다** — `useReducer`를 페이지 컴포넌트에서 직접 사용하고 하위에는 props로 전달한다.
> 코드는 타입 정의·시그니처 수준까지만 기술한다(컴포넌트 구현 없음).

---

## 1. 설계 원칙

1. **서버 상태와 클라이언트 상태의 엄격한 분리**
   - 서버 데이터(체인 목록, 검색 결과, 페이지네이션)는 **TanStack Query가 단일 소스**. reducer 상태에 절대 중복 보관하지 않는다.
   - reducer는 사용자 입력에서 비롯되는 순수 클라이언트 상태만 관리한다.
2. **최소 상태**: 파생 가능한 값(패널 표시 여부, 로딩/오류, 빈 상태 등)은 상태로 두지 않고 렌더링 시 계산한다.
3. **단방향 데이터 흐름(Flux)**: View → Action(dispatch) → Reducer(Store) → State → View.
4. **Reducer는 순수 함수**: 사이드이펙트(타이머, API 호출, 라우팅) 금지 → 단위 테스트 가능. 디바운스 타이머는 커스텀 훅(이펙트 계층)이 담당하고, 만료 시점에 Action만 dispatch한다.

## 2. 상태 데이터 목록

### 2.1 관리해야 할 상태 (reducer 소유)

| 상태 | 타입 | 초기값 | 설명 |
|---|---|---|---|
| `searchInput` | `string` | `''` | 검색창 원본 입력값 (제어 컴포넌트) |
| `submittedQuery` | `string` | `''` | 디바운스(300ms)+정규화 후 확정된 검색어. `''`이면 검색 비활성. 시간 의존적이라 `searchInput`에서 동기 파생 불가 |
| `marketFilter` | `'ALL' \| 'KRX' \| 'US'` | `'ALL'` | 시장 필터 선택값 |

### 2.2 화면에 보이지만 상태가 아닌 것

| 데이터 | 원천 | 비고 |
|---|---|---|
| 공식 체인 카드 목록 (+누적 페이지, `hasMore`) | TanStack Query 캐시 (`useInfiniteQuery`) | 서버 상태 |
| 내 체인 카드 목록 | TanStack Query 캐시 | `enabled: isAuthenticated` |
| 검색 결과 목록 | TanStack Query 캐시 | 쿼리 키에 `submittedQuery`·`marketFilter` 포함 → 변경 시 자동 1페이지 초기화 |
| 로딩/오류/다음페이지 로딩 | 쿼리 훅 반환값 (`isPending`/`isError`/`isFetchingNextPage`) | 파생 |
| 검색 결과 패널 표시 여부 (`isSearchActive`) | `submittedQuery.length >= MIN_SEARCH_QUERY_LENGTH` | 파생 |
| "검색 미실행" 안내 여부 | `searchInput` 존재 && 정규화 결과 최소 길이 미만 | 파생 |
| 빈 상태/생성 유도/더보기 버튼 노출 | 쿼리 성공 && `items.length===0` / `hasNextPage` | 파생 |
| 가치총액 표기(미표시·이월·커버리지), 시장 배지, 상태 배지 | 응답 DTO 필드 포맷팅 | 파생 |
| 로그인 여부 (`isAuthenticated`) | 전역 인증 세션 | 페이지 외부 소유 |

## 3. Flux 구조 개요

```
                       (사용자 상호작용)
  ┌────────────────────── View ◄─────────────────────────┐
  │  SearchBar / 필터 탭 / 지우기 버튼                     │
  │        │                                              │
  │   dispatch(Action)                                    │ props (state + 핸들러)
  ▼        ▼                                              │
Action ──► Reducer(순수 함수) ──► ExplorePageState ───────┤
  ▲            (Store: useReducer, 페이지 컴포넌트 소유)    │
  │                                    │                  │
  │ SEARCH_QUERY_COMMITTED             │ 쿼리 키 참여      │
  │ (디바운스 만료 시)                  ▼                  │
useDebouncedQueryCommit ◄──── TanStack Query 계층 ────────┘
 (이펙트: 300ms 타이머)        (서버 상태: 목록/검색/페이지네이션)
```

- **Store** = `useReducer(exploreReducer, EXPLORE_INITIAL_STATE)` — 페이지 클라이언트 컴포넌트가 직접 소유 (Context 없음).
- 클라이언트 상태(`submittedQuery`, `marketFilter`)는 **쿼리 키의 입력**이 되어 서버 상태 계층을 구동한다. 서버 응답이 reducer로 되돌아오는 일은 없다(단방향).

## 4. State·Action 타입 정의

파일 위치: `apps/web/src/features/explore/state/exploreReducer.ts` (순수 모듈 — React 비의존, 단독 테스트 가능)

```ts
// ── State ─────────────────────────────────────────────
export type MarketFilter = 'ALL' | 'KRX' | 'US';

export interface ExplorePageState {
  searchInput: string;
  submittedQuery: string;
  marketFilter: MarketFilter;
}

export const EXPLORE_INITIAL_STATE: ExplorePageState = {
  searchInput: '',
  submittedQuery: '',
  marketFilter: 'ALL',
};

// ── Action ────────────────────────────────────────────
// 네이밍 컨벤션: <도메인>_<대상>_<사건(과거형)> — SCREAMING_SNAKE_CASE, 명령이 아닌 "일어난 사건" 서술
export type ExploreAction =
  | { type: 'SEARCH_INPUT_CHANGED'; payload: { value: string } }
  | { type: 'SEARCH_QUERY_COMMITTED'; payload: { normalizedQuery: string } }
  | { type: 'SEARCH_MARKET_FILTER_CHANGED'; payload: { market: MarketFilter } }
  | { type: 'SEARCH_CLEARED' };
```

### Action 카탈로그

| Action | 발생 지점 (View/이펙트) | payload | 의미 |
|---|---|---|---|
| `SEARCH_INPUT_CHANGED` | SearchBar `onChange` | `value: string` | 검색창 원본 입력 변경 |
| `SEARCH_QUERY_COMMITTED` | `useDebouncedQueryCommit` 이펙트 — 마지막 입력 후 `SEARCH_DEBOUNCE_MS`(300) 경과 시 | `normalizedQuery: string` (정규화 완료값, 빈 문자열 가능) | 검색어 확정. 정규화(`normalizeSearchQuery`)는 dispatch **이전에** 이펙트 계층에서 수행 → reducer 순수성 유지 |
| `SEARCH_MARKET_FILTER_CHANGED` | 필터 탭 클릭 | `market: MarketFilter` | 시장 필터 변경 |
| `SEARCH_CLEARED` | 검색 지우기(X) 버튼 | 없음 | 검색 전체 초기화(입력·확정 검색어·필터) — 디바운스 대기 없이 즉시 |

> 상태를 만들지 않는 상호작용(카드 클릭 → 뷰 라우팅, 결과 항목 클릭 → `/companies/[ticker]`, 새 체인 만들기 → `/valuechains/new` 또는 로그인 리다이렉트, 더보기 → `fetchNextPage()`, 재시도 → `refetch()`)은 **Action을 정의하지 않는다.** 내비게이션/쿼리 조작 사이드이펙트는 핸들러에서 직접 수행한다.

## 5. Reducer 설계 (Store)

```ts
// 순수 함수 — 사이드이펙트 금지, 새 객체 반환(불변성)
export function exploreReducer(
  state: ExplorePageState,
  action: ExploreAction,
): ExplorePageState;

// 검색어 정규화 (순수 헬퍼 — 이펙트 계층에서 커밋 전에 호출)
// 앞뒤 공백 제거, 전각→반각. 대소문자 무시는 서버 매칭 책임(ILIKE)
export function normalizeSearchQuery(raw: string): string;
```

### 액션별 상태 전이 명세

| Action | 전이 | 불변 필드 |
|---|---|---|
| `SEARCH_INPUT_CHANGED` | `searchInput ← payload.value` | `submittedQuery`(이전 결과 유지한 채 디바운스 대기), `marketFilter` |
| `SEARCH_QUERY_COMMITTED` | `submittedQuery ← payload.normalizedQuery` | `searchInput`, `marketFilter` |
| `SEARCH_MARKET_FILTER_CHANGED` | `marketFilter ← payload.market` | `searchInput`, `submittedQuery` |
| `SEARCH_CLEARED` | `EXPLORE_INITIAL_STATE`로 전체 복귀 | — |

### 디바운스 이펙트 훅 (reducer 외부의 시간 사이드이펙트 전담)

```ts
// apps/web/src/features/explore/hooks/useDebouncedQueryCommit.ts
// searchInput 변경 감시 → SEARCH_DEBOUNCE_MS 후 normalizeSearchQuery(searchInput)를
// SEARCH_QUERY_COMMITTED로 dispatch. 입력 재변경 시 타이머 재시작, 언마운트 시 취소.
export function useDebouncedQueryCommit(
  searchInput: string,
  dispatch: Dispatch<ExploreAction>,
): void;
```

### 파생 셀렉터 (상태 아님 — 렌더링 시 계산)

```ts
export function selectIsSearchActive(state: ExplorePageState): boolean;
// submittedQuery.length >= MIN_SEARCH_QUERY_LENGTH

export function selectShowTooShortNotice(state: ExplorePageState): boolean;
// searchInput 비어있지 않으나 normalizeSearchQuery(searchInput) 길이 < 최소 길이
```

## 6. 서버 상태 계층 (TanStack Query — reducer 범위 외, 연결 계약만 정의)

파일 위치: `apps/web/src/features/valuechains/hooks/`, `apps/web/src/features/securities/hooks/`

```ts
// 쿼리 키 (클라이언트 상태가 키에 참여 → 변경 시 자동 재조회·페이지 초기화)
export const exploreQueryKeys = {
  officialChains: ['valuechains', 'official'] as const,
  myChains: ['valuechains', 'mine'] as const,
  securitiesSearch: (query: string, market: MarketFilter) =>
    ['securities', 'search', { query, market }] as const,
};

// 공식 체인 목록 — GET /api/valuechains/official, limit=CHAIN_LIST_PAGE_SIZE
// getNextPageParam: pagination.hasMore ? page + 1 : undefined
export function useOfficialChainCards(): UseInfiniteQueryResult<InfiniteData<ChainCardListResponse>>;

// 내 체인 목록 — GET /api/valuechains/mine (401 시 오류로 노출, 재시도 없음)
export function useMyChainCards(options: { enabled: boolean }): UseInfiniteQueryResult<InfiniteData<ChainCardListResponse>>;

// 통합 검색 — GET /api/securities/search, pageSize=SEARCH_PAGE_SIZE
// enabled=false(검색 비활성)면 호출 자체가 발생하지 않음 → 최소 길이 미만 API 미호출 보장
export function useSecuritiesSearch(
  params: { query: string; market: MarketFilter },
  options: { enabled: boolean },
): UseInfiniteQueryResult<InfiniteData<SecuritySearchResponse>>;
```

| 훅 | 쿼리 키 | enabled 조건 | 더보기 |
|---|---|---|---|
| `useOfficialChainCards` | `officialChains` | 항상 | `fetchNextPage()` |
| `useMyChainCards` | `myChains` | `isAuthenticated` | `fetchNextPage()` |
| `useSecuritiesSearch` | `securitiesSearch(submittedQuery, marketFilter)` | `selectIsSearchActive(state)` | `fetchNextPage()` |

## 7. View 연결 (props 단방향 전달 — Context 없음)

```
app/page.tsx (Server Component — 셸, 클라이언트 경계만 배치)
└─ MainExplorePage ('use client')
   │   • useReducer(exploreReducer, EXPLORE_INITIAL_STATE) 소유
   │   • useDebouncedQueryCommit(state.searchInput, dispatch)
   │   • 쿼리 훅 3종 호출 (state를 쿼리 키/enabled에 연결)
   │   • dispatch를 의도가 드러나는 핸들러로 감싸 props로 하위 전달
   │     (Presenter는 dispatch·Action 타입을 모른다)
   │
   ├─ SearchBar                    ← value, marketFilter, onInputChange, onFilterChange, onClear
   ├─ SearchResultsSection         ← isSearchActive=true일 때만 렌더
   │    └─ SecurityResultItem      ← 클릭 시 /companies/[ticker] 라우팅 (Action 아님)
   ├─ OfficialChainsSection
   │    └─ ChainCardList / ChainCard ← 클릭 시 /valuechains/[chainId] 라우팅
   ├─ MyChainsSection              ← isAuthenticated=true일 때만 렌더
   └─ CreateChainButton            ← 로그인: /valuechains/new, 비로그인: 로그인 유도(returnTo)
```

### Presenter props 인터페이스 (시그니처 수준)

```ts
interface SearchBarProps {
  value: string;
  marketFilter: MarketFilter;
  showTooShortNotice: boolean;
  onInputChange: (value: string) => void;   // → dispatch SEARCH_INPUT_CHANGED
  onFilterChange: (market: MarketFilter) => void; // → dispatch SEARCH_MARKET_FILTER_CHANGED
  onClear: () => void;                      // → dispatch SEARCH_CLEARED
}

interface SearchResultsSectionProps {
  items: SecuritySearchItem[];              // pages.flatMap 파생
  isPending: boolean;
  isError: boolean;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  onLoadMore: () => void;                   // → fetchNextPage()
  onRetry: () => void;                      // → refetch()
  onSelect: (ticker: string) => void;       // → router.push (라우팅)
}

interface ChainCardsSectionProps {
  items: ChainCard[];
  isPending: boolean;
  isError: boolean;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  emptyVariant: 'official' | 'mine';        // 빈 상태 문구 분기(생성 유도 포함)
  onLoadMore: () => void;
  onRetry: () => void;
  onSelect: (chainId: string) => void;
}
```

## 8. 대표 흐름 시나리오 (Action → Store → View)

### 8.1 검색 입력 → 결과 표시
1. 사용자가 "삼성" 타이핑 → `SEARCH_INPUT_CHANGED` 연속 dispatch → `searchInput` 갱신 → 검색창 즉시 반영.
2. 마지막 입력 300ms 후 이펙트가 `SEARCH_QUERY_COMMITTED { normalizedQuery: '삼성' }` dispatch → `submittedQuery='삼성'`.
3. `selectIsSearchActive=true` → `useSecuritiesSearch` enabled → 쿼리 키 `['securities','search',{query:'삼성',market:'ALL'}]` 조회.
4. View: 로딩(쿼리 파생) → 결과 목록 + 시장/상태 배지 렌더링. 0건이면 빈 결과 안내(오류와 구분).

### 8.2 시장 필터 변경
1. `SEARCH_MARKET_FILTER_CHANGED { market: 'KRX' }` → `marketFilter='KRX'`.
2. 쿼리 키 변경 → TanStack Query가 새 키로 조회 → **누적 페이지 자동 초기화(1페이지)**. reducer가 페이지를 초기화할 필요 없음.

### 8.3 더보기 (Action 없음)
1. 더보기 클릭 → `onLoadMore` → `fetchNextPage()` (서버 상태 조작 — reducer 미관여).
2. `isFetchingNextPage` 동안 버튼 로딩 → 응답을 기존 목록 뒤에 이어 붙임 → `hasMore=false`면 `hasNextPage=false` 파생으로 버튼 숨김.

### 8.4 검색 초기화
1. X 클릭 → `SEARCH_CLEARED` → 초기 상태 복귀 (`submittedQuery=''`, `marketFilter='ALL'`).
2. `isSearchActive=false` 파생 → 결과 패널 즉시 닫힘, 체인 목록 뷰 복귀. 진행 중이던 디바운스 타이머는 이펙트가 취소.

### 8.5 새 밸류체인 만들기 (Action 없음)
- 로그인: `/valuechains/new` 라우팅. 비로그인: 로그인 페이지로 리다이렉트(returnTo 유지). 상태 변화 없음.

## 9. 테스트 전략 (reducer 순수 함수 단위 테스트)

`exploreReducer`·`normalizeSearchQuery`·셀렉터는 React 비의존 순수 모듈이므로 렌더링 없이 검증한다.

| # | 시나리오 (AAA) | 기대 |
|---|---|---|
| 1 | 초기 상태에서 `SEARCH_INPUT_CHANGED('삼성')` | `searchInput='삼성'`, 나머지 초기값 유지 |
| 2 | `SEARCH_QUERY_COMMITTED('삼성')` | `submittedQuery='삼성'`, `searchInput` 불변 |
| 3 | `SEARCH_QUERY_COMMITTED('')` (공백만 입력 후 커밋) | `submittedQuery=''` → `selectIsSearchActive=false` |
| 4 | `SEARCH_MARKET_FILTER_CHANGED('US')` | `marketFilter='US'`, 검색어 필드 불변 |
| 5 | 임의 상태에서 `SEARCH_CLEARED` | `EXPLORE_INITIAL_STATE`와 동등 |
| 6 | 모든 액션에서 입력 state 객체 비변이(immutability) | 원본 참조 불변, 새 객체 반환 |
| 7 | `normalizeSearchQuery('  ＳＡＭＳＵＮＧ  ')` | 앞뒤 공백 제거 + 전각→반각 |
| 8 | `selectShowTooShortNotice({ searchInput: '  ', ... })` | `true` (원본 존재, 정규화 결과 최소 길이 미만) |

- 디바운스 훅(`useDebouncedQueryCommit`)은 fake timer 기반 훅 테스트로 별도 검증(300ms 경과 시 1회 dispatch, 재입력 시 타이머 재시작, 언마운트 시 미발화).
- 서버 상태(쿼리 훅)·컴포넌트 상호작용 테스트는 구현 단계(plan.md) 범위.
