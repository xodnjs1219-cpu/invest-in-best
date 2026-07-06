# 어드민 LLM 검토 큐 페이지 — 상태 관리 설계 (state_management.md)

> 대상: `/admin/llm-proposals` — LLM 관계 변경안 검토 큐
> 근거: `docs/pages/admin-llm-queue/requirement.md`, `docs/usecases/022/spec.md`, `docs/techstack.md`(React 19 + TanStack Query + `useReducer` 컨벤션)
> **범위(Level 2)**: 상태 정의 + Flux 패턴(Action/Store/View)까지. Context 설계는 하지 않는다 — `useReducer`를 페이지 컴포넌트에서 직접 사용하고 하위 Presenter에는 props로 전달한다.

---

## 1. 설계 원칙

1. **서버 상태와 클라이언트 상태의 엄격한 분리** — 제안 목록·처리 결과 등 서버 데이터는 TanStack Query 캐시가 단일 진실이다. reducer 상태에 서버 데이터를 복제 보관하지 않는다.
2. **최소 상태** — 파생 가능한 값(패널 열림 여부, 선택 제안 상세, 처리 중 표시 등)은 상태로 두지 않고 셀렉터/식으로 계산한다.
3. **낙관적 갱신 미적용** — 승인 결과는 서버 트랜잭션에서만 확정된다(성공 / 409 충돌 시 `invalidated` 자동 전환 / 409 이미 처리 / 422 차단). 클라이언트가 결과를 예측할 수 없으므로, 처리 중에는 파생값(D7)으로 버튼만 비활성화하고 응답 확정 후 `invalidateQueries`로 재조회한다.
4. **Reducer는 순수 함수** — I/O·API 호출·토스트 없이 `(state, action) → state`만 수행한다. 사이드이펙트(mutation 호출, 토스트, 쿼리 무효화)는 View/hook 계층에서 처리하고, 그 **결과 이벤트**만 Action으로 dispatch한다.
5. **Action 명명 컨벤션** — `도메인 명사 + 과거형 이벤트`(무엇이 일어났는가), `SCREAMING_SNAKE_CASE`. 예: `FILTER_CHANGED`, `PROPOSAL_SELECTED`. 명령형(`SET_X`, `OPEN_X`) 금지.

## 2. 상태 데이터 목록

### 2-1. 관리해야 할 상태 (Store — `useReducer`)

| # | 상태 | 타입 | 초기값 | 역할 |
|---|---|---|---|---|
| S1 | `statusFilter` | `ProposalStatusFilter` | `'pending'` | 목록 상태 필터(쿼리 키 입력) |
| S2 | `page` | `number` | `1` | 목록 페이지(쿼리 키 입력) |
| S3 | `selectedProposalId` | `string \| null` | `null` | 근거 공시 상세 패널 대상 |
| S4 | `rejectTarget` | `RejectTarget \| null` | `null` | 거부 사유 다이얼로그 대상 + 입력값 |

### 2-2. 화면에 보이지만 상태가 아닌 것 (파생/서버 데이터)

| 화면 데이터 | 원천 |
|---|---|
| 제안 목록 / `hasMore` / `pageSize` | 목록 쿼리 캐시 (TanStack Query) |
| 목록 로딩·오류 표시 | 쿼리 `isPending` / `isError` |
| 상세 패널 열림 여부 | `selectedProposalId !== null` |
| 상세 패널 내용 | `items.find(p => p.proposalId === selectedProposalId)` |
| 빈 상태 안내 | 쿼리 성공 && `items.length === 0` |
| 적용 가능/재검토 배지 | 서버 계산값 `applicability` 필드 |
| 행별 "처리 중"(버튼 비활성·스피너) | mutation `isPending && variables.proposalId === 행 ID` |
| 승인/거부 버튼 노출 | 행의 `status === 'pending'` |
| 페이지 버튼 활성 | `hasMore`(응답) / `page > 1`(S2 파생) |
| 완료/오류 토스트 | mutation 콜백의 일회성 사이드이펙트 |

## 3. Flux 설계

```
Admin 상호작용
   │
   ▼
[View: 페이지 컴포넌트 + Presenter들]
   │  ① UI 이벤트 → dispatch(Action)            ─┐
   │  ② 승인/거부 클릭 → mutation 호출(사이드이펙트) │ 단방향 흐름
   ▼                                              │
[Dispatcher: useReducer의 dispatch]               │
   ▼                                              │
[Store: adminLlmQueueReducer → AdminLlmQueueState]│
   ▼                                              │
[View 재렌더] ←── (서버 데이터는 TanStack Query가 별도 공급) ─┘
        ▲
        └── mutation 확정(onSuccess/onError) → 결과 이벤트 dispatch + invalidateQueries
```

### 3-1. Action 타입 정의

```typescript
// features/admin-llm-proposals/hooks/adminLlmQueueReducer.ts

/** 목록 상태 필터 — API 쿼리 파라미터와 동일 도메인 */
export type ProposalStatusFilter =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'invalidated';

export interface RejectTarget {
  proposalId: string;
  reason: string; // 선택 입력(빈 문자열 허용)
}

export interface AdminLlmQueueState {
  statusFilter: ProposalStatusFilter;
  page: number;
  selectedProposalId: string | null;
  rejectTarget: RejectTarget | null;
}

export type AdminLlmQueueAction =
  /** 필터 탭 변경 */
  | { type: 'FILTER_CHANGED'; filter: ProposalStatusFilter }
  /** 페이지네이션 이동 */
  | { type: 'PAGE_CHANGED'; page: number }
  /** 목록 행 선택 → 상세 패널 */
  | { type: 'PROPOSAL_SELECTED'; proposalId: string }
  /** 상세 패널 닫기 */
  | { type: 'PANEL_CLOSED' }
  /** 거부 버튼 클릭 → 사유 다이얼로그 열기 */
  | { type: 'REJECT_DIALOG_OPENED'; proposalId: string }
  /** 거부 사유 입력 */
  | { type: 'REJECT_REASON_CHANGED'; reason: string }
  /** 거부 다이얼로그 취소 */
  | { type: 'REJECT_DIALOG_CLOSED' }
  /** 제안 처리 확정(승인 200 / 거부 200 / 409 계열) — 선택·다이얼로그 정리 */
  | { type: 'PROPOSAL_RESOLVED'; proposalId: string };
```

- `PROPOSAL_RESOLVED`는 "서버에서 제안의 pending 상태가 끝났음이 확인된" 단일 이벤트다. 승인 성공, 거부 성공, 409(이미 처리/충돌 자동무효) 모두 이 하나로 수렴한다 — Action은 결과 사실을 기술하고, HTTP 분기별 토스트 문구는 View 계층 책임이다.
- 422(차단, `pending` 유지)는 상태 전이가 없으므로 **Action이 존재하지 않는다**(토스트 + invalidate만 수행).

### 3-2. Store — 초기 상태와 Reducer

```typescript
export const initialAdminLlmQueueState: AdminLlmQueueState = {
  statusFilter: 'pending',
  page: 1,
  selectedProposalId: null,
  rejectTarget: null,
};

/** 순수 함수 — I/O 없음, 동일 입력에 동일 출력. 단위 테스트 대상 */
export function adminLlmQueueReducer(
  state: AdminLlmQueueState,
  action: AdminLlmQueueAction,
): AdminLlmQueueState;
```

전이 규칙 (Action별 명세 — reducer 구현·테스트의 SOT):

| Action | 전이 결과 | 비고 |
|---|---|---|
| `FILTER_CHANGED` | `statusFilter=filter`, `page=1`, `selectedProposalId=null`, `rejectTarget=null` | 목록 문맥 전체 리셋. 동일 필터 재선택 시 `state` 그대로 반환(불필요 렌더 방지) |
| `PAGE_CHANGED` | `page=page`, `selectedProposalId=null` | 선택 제안이 새 페이지에 없을 수 있으므로 패널 닫기. `page < 1`이면 무시(`state` 반환) |
| `PROPOSAL_SELECTED` | `selectedProposalId=proposalId` | 이미 선택된 동일 ID면 `state` 그대로 반환 |
| `PANEL_CLOSED` | `selectedProposalId=null` | |
| `REJECT_DIALOG_OPENED` | `rejectTarget={ proposalId, reason: '' }` | 사유는 빈 값으로 시작 |
| `REJECT_REASON_CHANGED` | `rejectTarget.reason=reason` (대상 유지) | `rejectTarget === null`이면 무시(`state` 반환) — 닫힌 다이얼로그의 지연 이벤트 방어 |
| `REJECT_DIALOG_CLOSED` | `rejectTarget=null` | 요청 미발생 취소 |
| `PROPOSAL_RESOLVED` | `selectedProposalId === proposalId`이면 `null`로, `rejectTarget?.proposalId === proposalId`이면 `null`로 | 다른 제안이 선택돼 있으면 건드리지 않음 |

모든 전이는 불변(immutable) 갱신으로 새 객체를 반환하며, 변화가 없으면 기존 `state` 참조를 그대로 반환한다.

### 3-3. 서버 상태 연계 (TanStack Query — Store 밖)

```typescript
// features/admin-llm-proposals/hooks/useProposalListQuery.ts
/** 쿼리 키: ['admin', 'llm-proposals', { status, page }] */
export function useProposalListQuery(
  status: ProposalStatusFilter,
  page: number,
): UseQueryResult<ProposalListResponse>;

// features/admin-llm-proposals/hooks/useApproveProposal.ts
export function useApproveProposal(): UseMutationResult<
  ProposalApproveResponse,
  ApiError,
  { proposalId: string }
>;

// features/admin-llm-proposals/hooks/useRejectProposal.ts
export function useRejectProposal(): UseMutationResult<
  ProposalRejectResponse,
  ApiError,
  { proposalId: string; reason?: string }
>;
```

mutation 결과 → dispatch/invalidate 매핑 (View/hook 콜백에서 수행):

| 결과 | dispatch | invalidate | 토스트 |
|---|---|---|---|
| 승인 200 | `PROPOSAL_RESOLVED` | O (목록 키 전체) | 승인 완료 |
| 승인 409 `PROPOSAL_ALREADY_PROCESSED` | `PROPOSAL_RESOLVED` | O | 이미 처리된 제안 — 큐 갱신 |
| 승인 409 `PROPOSAL_CONFLICT` | `PROPOSAL_RESOLVED` | O | 적용 불가 — 자동 무효 처리됨 |
| 승인 422 `RELATION_TYPE_INACTIVE` / `CHAIN_NOT_APPLICABLE` | 없음(pending 유지, 패널 유지) | O (applicability 배지 갱신) | 승인 차단 사유 안내 |
| 승인 500 `APPROVAL_FAILED` | 없음 | X | 오류 + 재시도 유도 |
| 거부 200 | `PROPOSAL_RESOLVED` | O | 거부 완료 |
| 거부 409 `PROPOSAL_ALREADY_PROCESSED` | `PROPOSAL_RESOLVED` | O | 이미 처리된 제안 |
| 거부 500 `REJECTION_FAILED` | 없음(다이얼로그 유지 → 재시도 가능) | X | 오류 안내 |
| 404 / 400 | `PROPOSAL_RESOLVED` | O | 대상 없음 안내 |

### 3-4. View 연결 — 페이지 컴포넌트에서 `useReducer` 직접 사용

Context 없이, 페이지 컴포넌트(단일 Container)가 `useReducer`와 쿼리/뮤테이션 hook을 소유하고 하위 Presenter에 **값 + 콜백 props**로 내려준다(컴포넌트 깊이가 2단이라 prop drilling 부담 없음).

```
AdminLlmProposalsPage ('use client', Container — useReducer + hooks 소유)
├── ProposalFilterTabs        props: { value: statusFilter, onChange(filter) → dispatch(FILTER_CHANGED) }
├── ProposalTable             props: { items, isLoading, isError,
│                                      selectedProposalId,
│                                      processingProposalId,          // 파생 D7
│                                      onSelect(id) → dispatch(PROPOSAL_SELECTED),
│                                      onApprove(id) → approveMutation.mutate,
│                                      onRejectClick(id) → dispatch(REJECT_DIALOG_OPENED) }
├── ProposalPagination        props: { page, hasMore, onPageChange(p) → dispatch(PAGE_CHANGED) }
├── ProposalDetailPanel       props: { proposal: selectedProposal,     // 파생 D4 (null이면 미렌더)
│                                      isProcessing,
│                                      onClose() → dispatch(PANEL_CLOSED),
│                                      onApprove, onRejectClick }
└── RejectReasonDialog        props: { target: rejectTarget,           // null이면 미렌더
                                       isSubmitting: rejectMutation.isPending,
                                       onReasonChange(r) → dispatch(REJECT_REASON_CHANGED),
                                       onCancel() → dispatch(REJECT_DIALOG_CLOSED),
                                       onConfirm() → rejectMutation.mutate }
```

Container가 계산하는 파생값(렌더 중 식으로 계산, 상태 아님):

```typescript
const selectedProposal =
  listQuery.data?.items.find(
    (p) => p.proposalId === state.selectedProposalId,
  ) ?? null;

const processingProposalId =
  (approveMutation.isPending && approveMutation.variables?.proposalId) ||
  (rejectMutation.isPending && rejectMutation.variables?.proposalId) ||
  null;
```

- Presenter 컴포넌트(`ProposalTable` 등)는 로직 없이 props 렌더링과 이벤트 위임만 담당한다(`features/admin-llm-proposals/components/`).
- dispatch·mutation 배선은 Container 한 곳에만 존재한다 — Presenter는 `dispatch`나 Action 타입을 알지 못하고 의미 있는 콜백(`onSelect`, `onApprove` 등)만 받는다.

## 4. Reducer 단위 테스트 시나리오 (Vitest)

순수 함수이므로 렌더링 없이 `(state, action)` 입출력만 검증한다.

1. 초기 상태: `statusFilter='pending'`, `page=1`, 선택·다이얼로그 없음.
2. `FILTER_CHANGED` → 필터 교체 + `page` 1 리셋 + 선택/다이얼로그 해제. 동일 필터면 동일 참조 반환.
3. `PAGE_CHANGED` → 페이지 교체 + 선택 해제, `rejectTarget`은 유지되지 않음 여부 확인(유지됨 — 페이지 이동은 다이얼로그와 무관하나, 다이얼로그 열림 중 페이지 이동 UI가 차단되는지는 View 책임임을 명시). `page=0` 등 비정상 값 무시.
4. `PROPOSAL_SELECTED` → 선택 설정, 동일 ID 재선택 시 동일 참조 반환.
5. `REJECT_REASON_CHANGED` — 다이얼로그 닫힌 상태(`rejectTarget=null`)에서 무시.
6. `PROPOSAL_RESOLVED` — (a) 선택 중 제안이면 선택 해제, (b) 다이얼로그 대상이면 다이얼로그 해제, (c) 무관한 제안이면 상태 불변(동일 참조).
7. 모든 Action에 대해 입력 `state` 객체가 변이(mutate)되지 않음.

## 5. Level 2 경계 (비범위)

- **Context 설계 없음** — 이 페이지의 상태는 단일 페이지 컴포넌트 트리에 국한되며 형제/원거리 컴포넌트 공유가 없으므로 `useReducer` + props로 충분하다. 페이지가 다단 중첩으로 확장되어 prop drilling이 3단 이상 깊어지면 그때 Level 3(Context 분리)을 검토한다.
- 컴포넌트 구현 코드는 본 문서 범위 밖이다(타입·시그니처·props 계약까지만 정의).
