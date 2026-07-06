# chain-editor — 상태 관리 설계 (Level 3: 상태 정의 + Flux + Context)

> 대상: `/valuechains/new`(신규 생성), `/valuechains/[chainId]/edit`(기존 편집), `/admin/valuechains/*`(UC-021 어드민 variant — 동일 설계 재사용)
> 근거: `docs/pages/chain-editor/requirement.md`(상태 정의·전환 테이블의 단일 원천), `docs/usecases/013~018/spec.md` + UC-021, `docs/usecases/000_decisions.md` D-1~D-7(spec과 충돌 시 우선), `docs/techstack.md`(React 19 + Next.js + `@xyflow/react` 12 + TanStack Query + Context/`useReducer` — Redux/Zustand 미사용)
> **산출 범위(Level 3)**: 상태 정의(§2) → Flux 패턴 전체(§3~5: Action union / 순수 Reducer / View 연결) → Context 설계(§6~8: Provider 데이터 흐름, 노출 인터페이스, 사용 예시)까지.
> 코드는 **타입·시그니처 수준까지만** 기술한다(컴포넌트/함수 본문 구현 없음).

---

## 1. 설계 원칙

1. **서버 상태와 편집 문서 상태의 엄격한 분리**
   - 관계 종류 마스터·종목 검색 결과·내 체인 목록·최신 스냅샷·저장 요청 상태는 **TanStack Query가 단일 소스**다. reducer 상태에 중복 보관하지 않는다(requirement §3·§4.2).
   - 유일한 예외 계약: **최신 스냅샷은 "편집의 출발점"으로 1회 변환**되어 편집 상태의 초기값이 된다. 이후 편집 상태는 서버 캐시와 독립적으로 변형되며, 서버 캐시가 갱신되어도 편집 상태를 덮어쓰지 않는다(명시적 재로드 제외).
2. **최소 상태**: 파생 가능한 값(노드 수·상한 여부·React Flow props·`canSave`·클라이언트 검증 이슈 등)은 상태로 두지 않고 셀렉터로 계산한다(requirement §4.3).
3. **단방향 데이터 흐름(Flux)**: View → `dispatch(Action)` → Reducer(Store) → State → (셀렉터/computed) → View. 서버 응답이 상태에 반영될 때도 반드시 Action(`EDITOR_INITIALIZED`, `SAVE_SUCCEEDED`, `SAVE_REJECTED`)을 거친다.
4. **Reducer는 순수 함수**: I/O·API 호출·라우팅·토스트·`crypto.randomUUID()` 호출 금지. ID 발급·검증·직렬화·타이머는 Provider의 액션 함수/이펙트 계층이 수행하고, reducer에는 **확정된 사실(과거형 이벤트)** 만 전달한다.
5. **검증의 이중화, 구현은 단일화**: 클라이언트 사전 검증(즉시 피드백)과 서버 최종 검증(UC-018 BR-5)의 **구조 규칙**(상한·자기 참조·중복·필수 필드)은 `packages/domain`의 순수 검증 함수로 공유한다. DB 의존 검증(이름 중복·참조 존재·낙관적 잠금)은 서버 전용이다.
6. **Action 명명 컨벤션**: `도메인 대상 + 과거형 사건`, `SCREAMING_SNAKE_CASE`(예: `LISTED_NODE_ADDED`). 명령형(`SET_X`/`OPEN_X`) 금지 — 기존 페이지 문서(main-explore, admin-llm-queue)와 동일.

---

## 2. 상태 정의 (Level 1 — requirement §4·§5의 타입 확정)

관리 상태 S1~S12의 선정 근거와 상태 전환 의미론은 `requirement.md` §4.1(관리 상태), §4.2(서버 상태), §4.3(파생), §4.4(비상태), §5(전환 테이블)를 단일 원천으로 하며, 본 문서는 이를 TypeScript 타입으로 확정한다.

### 2.1 도메인 모델 타입

파일 위치: `packages/domain/types/chainEditor.ts` (React 비의존 — web·검증 함수 공유)

```ts
export type EditorMode = 'create' | 'edit';
export type EditorVariant = 'user' | 'official';          // official = UC-021 어드민 재사용
export type FocusType = 'industry' | 'company';
export type FreeSubjectType = 'consumer' | 'government' | 'private_company' | 'other';

export interface XYPosition { x: number; y: number; }

/** 표시용 정보를 포함한 종목 참조 (focusSecurity·상장기업 노드 공용) */
export interface SecurityRef {
  securityId: string;
  ticker: string;
  name: string;
  market: 'KRX' | 'US';
}

interface EditorNodeBase {
  clientNodeId: string;                // 편집 세션 내 식별자 — 엣지/그룹 참조·저장 페이로드 공용(UC-015 §6.2)
  groupClientId: string | null;        // 소속 그룹(0..1) — 소속의 단일 소스(그룹 쪽에 중복 보관 금지, S9)
  position: XYPosition;                // 최종 좌표(영속 대상, UC-018 BR-9)
}

export interface ListedCompanyNode extends EditorNodeBase {
  nodeKind: 'listed_company';
  security: SecurityRef;
}

export interface FreeSubjectNode extends EditorNodeBase {
  nodeKind: 'free_subject';
  subjectType: FreeSubjectType;
  subjectName: string;                 // 필수
  subjectMemo: string | null;
}

export type EditorNode = ListedCompanyNode | FreeSubjectNode;

export interface EditorEdge {
  clientEdgeId: string;
  sourceClientNodeId: string;
  targetClientNodeId: string;
  relationTypeId: string;
}

export interface EditorGroup {
  clientGroupId: string;
  name: string;                        // 필수(공백 불가) — 소속 노드 목록은 파생(노드 역인덱스)
}

export interface EditorSelection {
  nodeIds: string[];
  edgeIds: string[];
}

/** 저장 422/409 응답의 error.details를 캔버스 하이라이트용으로 정규화한 것 (S12) */
export interface ServerIssue {
  code: string;                        // 예: 'VALUECHAINS.INVALID_EDGE', 'VALUECHAINS.DUPLICATE_NAME'
  message: string;
  targets: {
    clientNodeIds?: string[];
    clientEdgeIds?: string[];
    clientGroupIds?: string[];
    field?: 'name';                    // 409 DUPLICATE_NAME → 이름 필드 오류
  };
}

/** 관계 종류 마스터 행 (TanStack Query 캐시 소유 — reducer에 두지 않음) */
export interface RelationType {
  id: string;
  name: string;
  isDirected: boolean;
  isActive: boolean;
}
```

### 2.2 편집 문서 상태 (Store가 소유하는 전부)

```ts
// apps/web/src/features/valuechains/editor/state/chainEditorReducer.ts
export interface ChainEditorState {
  initialized: boolean;                          // S1 — 초기 로드 완료 전 편집 액션 차단 게이트
  chainId: string | null;                        // S2 — create는 신규 저장 성공 시 채워짐
  baseSnapshotId: string | null;                 // S3 — 낙관적 잠금 기준(UC-018 BR-7)
  name: string;                                  // S4
  focusType: FocusType;                          // S5
  focusSecurity: SecurityRef | null;             // S6
  nodes: Record<string, EditorNode>;             // S7 — key = clientNodeId
  edges: Record<string, EditorEdge>;             // S8 — key = clientEdgeId
  groups: Record<string, EditorGroup>;           // S9 — key = clientGroupId
  selection: EditorSelection;                    // S10 — 휘발 UI 상태(저장 대상 아님)
  isDirty: boolean;                              // S11
  serverIssues: ServerIssue[];                   // S12
}

export const CHAIN_EDITOR_INITIAL_STATE: ChainEditorState = {
  initialized: false,
  chainId: null,
  baseSnapshotId: null,
  name: '',
  focusType: 'industry',
  focusSecurity: null,
  nodes: {},
  edges: {},
  groups: {},
  selection: { nodeIds: [], edgeIds: [] },
  isDirty: false,
  serverIssues: [],
};
```

### 2.3 상태가 아닌 것 (요약 — 상세는 requirement §4.2~4.4)

| 분류 | 항목 | 소유 계층 |
|---|---|---|
| 서버 상태 | 관계 종류 마스터 / 최신 스냅샷 / 종목 검색 결과 / 내 체인 목록(소유 수) / 저장 mutation 상태 | TanStack Query (§5) |
| 파생 | 노드·엣지·그룹 수, 상한·잔여, React Flow props, 라벨·방향, 활성 종류 목록, 그룹 역인덱스·빈 그룹, `canSave`, 클라이언트 이슈, 저장 페이로드, 하이라이트 집합 | computed 셀렉터 (§4.4) |
| 로컬 컴포넌트 상태 | 검색어/시장 필터, 자유 주체 폼, 그룹 이름 입력, 삭제 확인·충돌·이탈 다이얼로그, 관계 종류 선택 중 연결 후보(pending connection) | 각 패널 (확정 시에만 dispatch) |
| React Flow 내부 | 드래그 중간 좌표, 줌/팬 뷰포트 | 캔버스 시각 상태 (§7.3 브리징) |

---

## 3. Flux — Action 타입 정의

파일 위치: `apps/web/src/features/valuechains/editor/state/chainEditorReducer.ts` (순수 모듈 — React 비의존)

```ts
/** EDITOR_INITIALIZED payload — 스냅샷 DTO를 편집 도메인 모델로 1회 변환한 결과 */
export interface EditorBootstrap {
  chainId: string | null;              // create=null, edit/복제 직후=대상 체인
  baseSnapshotId: string | null;       // create=null, edit=로드한 최신 스냅샷 ID
  name: string;
  focusType: FocusType;
  focusSecurity: SecurityRef | null;
  nodes: Record<string, EditorNode>;   // 서버 노드 id를 clientNodeId로 승계
  edges: Record<string, EditorEdge>;
  groups: Record<string, EditorGroup>;
}

export type ChainEditorAction =
  // ── 수명주기 ─────────────────────────────────────────
  | { type: 'EDITOR_INITIALIZED'; payload: EditorBootstrap }
  // ── 메타 (UC-013) ───────────────────────────────────
  | { type: 'CHAIN_NAME_CHANGED'; payload: { name: string } }
  | { type: 'FOCUS_TYPE_CHANGED'; payload: { focusType: FocusType } }
  | { type: 'FOCUS_SECURITY_SET'; payload: { security: SecurityRef } }
  | { type: 'FOCUS_SECURITY_CLEARED' }
  // ── 노드 (UC-015) ───────────────────────────────────
  | { type: 'LISTED_NODE_ADDED'; payload: { clientNodeId: string; security: SecurityRef; position: XYPosition } }
  | { type: 'FREE_SUBJECT_NODE_ADDED'; payload: {
      clientNodeId: string; subjectType: FreeSubjectType;
      subjectName: string; subjectMemo: string | null; position: XYPosition } }
  | { type: 'NODE_MOVED'; payload: { clientNodeId: string; position: XYPosition } }
  | { type: 'ELEMENTS_DELETED'; payload: { nodeIds: string[]; edgeIds: string[] } }
  // ── 엣지 (UC-016) ───────────────────────────────────
  | { type: 'EDGE_ADDED'; payload: {
      clientEdgeId: string; sourceClientNodeId: string;
      targetClientNodeId: string; relationTypeId: string } }
  | { type: 'EDGE_RELATION_CHANGED'; payload: { clientEdgeId: string; relationTypeId: string } }
  // ── 그룹 (UC-017) ───────────────────────────────────
  | { type: 'GROUP_CREATED'; payload: { clientGroupId: string; name: string; memberNodeIds: string[] } }
  | { type: 'GROUP_RENAMED'; payload: { clientGroupId: string; name: string } }
  | { type: 'NODE_GROUP_CHANGED'; payload: { clientNodeId: string; groupClientId: string | null } }
  | { type: 'GROUP_DISSOLVED'; payload: { clientGroupId: string } }
  // ── 선택 (문서 비변형) ────────────────────────────────
  | { type: 'SELECTION_CHANGED'; payload: EditorSelection }
  // ── 저장 수명주기 (UC-018) ────────────────────────────
  | { type: 'SAVE_SUCCEEDED'; payload: { chainId: string; snapshotId: string } }
  | { type: 'SAVE_REJECTED'; payload: { issues: ServerIssue[] } };
```

### Action 카탈로그

| Action | 발생 지점(View/이펙트) | dispatch 전 액션 함수의 책임 | 문서 변형(dirty) |
|---|---|---|---|
| `EDITOR_INITIALIZED` | 부트스트랩 이펙트(§6.2) — edit: 스냅샷+마스터 로드 성공 시 / create: 즉시 / SAVE_CONFLICT 재로드 시 | 스냅샷 DTO → `EditorBootstrap` 순수 변환(`toEditorBootstrap`) | ✕ (dirty=false로 리셋) |
| `CHAIN_NAME_CHANGED` | 메타 패널 이름 입력 | 없음(공백 검증은 파생 `canSave`·`clientIssues`가 담당) | ○ |
| `FOCUS_TYPE_CHANGED` | 기준 토글 | 없음 | ○ |
| `FOCUS_SECURITY_SET` / `FOCUS_SECURITY_CLEARED` | 대상 기업 검색 결과 선택 / 해제 칩 | 검색 결과 항목 → `SecurityRef` 매핑 | ○ |
| `LISTED_NODE_ADDED` | 종목 검색 결과 선택 | **검증**(상한·동일 종목 중복 — 실패 시 dispatch 없이 차단 사유 반환) + `clientNodeId` 발급 + 기본 좌표 산출 | ○ |
| `FREE_SUBJECT_NODE_ADDED` | 자유 주체 폼 제출 | **검증**(필수 필드·상한) + ID 발급 + 기본 좌표 | ○ |
| `NODE_MOVED` | React Flow `onNodeDragStop` (최종 좌표만) | 없음 | ○ |
| `ELEMENTS_DELETED` | 삭제 실행(단일/다중, 연결 엣지 있으면 확인 다이얼로그 후) | 연결 엣지 존재 파악은 파생값으로 View가 판단, 확정 시에만 dispatch | ○ |
| `EDGE_ADDED` | 관계 종류 선택 확정(연결 시도 → RelationTypePicker) | **검증**(자기 참조·중복 쌍(D-6 무향 정규화)·활성 종류) + `clientEdgeId` 발급 | ○ |
| `EDGE_RELATION_CHANGED` | 기존 엣지의 관계 종류 변경 확정 | 동일 검증(변경 후 조합 기준) | ○ |
| `GROUP_CREATED` | 다중 선택 → 그룹 생성(이름 입력 확정) | **검증**(이름 공백·선택 노드 ≥1) + `clientGroupId` 발급. 타 그룹 소속 노드의 자동 이동(E1)은 reducer 전이가 수행 | ○ |
| `GROUP_RENAMED` | 그룹 라벨 이름 변경 확정 | 이름 공백 검증 | ○ |
| `NODE_GROUP_CHANGED` | 노드의 그룹 이동/제외 | 대상 그룹 존재 확인 | ○ |
| `GROUP_DISSOLVED` | 그룹 해제 실행 | 없음 | ○ |
| `SELECTION_CHANGED` | React Flow `onSelectionChange` | 없음 | ✕ |
| `SAVE_SUCCEEDED` | save mutation `onSuccess` | 쿼리 캐시 무효화·뷰 페이지 라우팅은 mutation 콜백(사이드이펙트)이 수행 | ✕ (dirty=false) |
| `SAVE_REJECTED` | save mutation `onError` — 422 계열·409 `DUPLICATE_NAME`만 | `error.details` → `ServerIssue[]` 정규화. 409 `SAVE_CONFLICT`/401/네트워크는 **dispatch하지 않음**(§5.3) | ✕ |

> **Action을 정의하지 않는 상호작용**: 종목 검색 입력/필터(검색 패널 로컬 상태 + 쿼리 키), 저장 버튼 클릭 자체(`save()` 액션 함수 — mutation 사이드이펙트), 이탈 경고 확인/취소(라우팅), SAVE_CONFLICT 다이얼로그의 "계속 편집"(`mutation.reset()`), 재시도(`refetch()`/`mutate()` 재호출).

---

## 4. Flux — Reducer 설계 (Store)

```ts
// 순수 함수 — 사이드이펙트 금지, 불변 갱신(새 객체 반환)
export function chainEditorReducer(
  state: ChainEditorState,
  action: ChainEditorAction,
): ChainEditorState;
```

### 4.1 공통 전이 규칙

- **초기화 게이트**: `initialized=false`인 동안 `EDITOR_INITIALIZED` 외 모든 액션은 무시(no-op, 상태 원본 반환).
- **문서 변형 공통 후처리**: §3 카탈로그에서 dirty=○인 액션이 실제 변경을 일으키면 `isDirty=true`, `serverIssues=[]`(하이라이트 해제 — requirement §5). `SELECTION_CHANGED`·저장 수명주기 액션은 제외.
- **멱등 가드**: 존재하지 않는 ID를 참조하는 액션(`NODE_MOVED`/`ELEMENTS_DELETED`(E10)/`EDGE_*`/`GROUP_*`)은 무시하고 상태 원본을 반환한다(dirty 미발생). 액션 함수 검증의 이중 방어이자 stale dispatch 안전망.

### 4.2 케이스별 전이 명세

| Action | 전이 (⊕ = 공통 후처리 적용) |
|---|---|
| `EDITOR_INITIALIZED` | payload 전체로 문서 필드 교체, `initialized=true`, `selection` 비움, `isDirty=false`, `serverIssues=[]` |
| `CHAIN_NAME_CHANGED` | `name ← payload.name` ⊕ |
| `FOCUS_TYPE_CHANGED` | `focusType ← payload.focusType`. **`'industry'`로 전환 시 `focusSecurity=null`**(requirement §2.2) ⊕ |
| `FOCUS_SECURITY_SET` | `focusSecurity ← payload.security` (`focusType==='company'`가 아니면 no-op 가드) ⊕ |
| `FOCUS_SECURITY_CLEARED` | `focusSecurity ← null` ⊕ |
| `LISTED_NODE_ADDED` | `nodes[id] ← { nodeKind:'listed_company', security, groupClientId:null, position }` ⊕ |
| `FREE_SUBJECT_NODE_ADDED` | `nodes[id] ← { nodeKind:'free_subject', ... , groupClientId:null, position }` ⊕ |
| `NODE_MOVED` | `nodes[id].position ← payload.position` ⊕ |
| `ELEMENTS_DELETED` | ① `nodeIds`의 노드 제거 ② 제거 노드를 source/target으로 하는 엣지 **연쇄 제거**(UC-015 BR-5) ③ `edgeIds`의 엣지 제거 ④ `selection`에서 제거된 요소 제외 ⑤ 빈 그룹이 생겨도 `groups`는 유지(D-5) ⊕ |
| `EDGE_ADDED` | `edges[id] ← payload` ⊕ |
| `EDGE_RELATION_CHANGED` | `edges[id].relationTypeId ← payload.relationTypeId` ⊕ |
| `GROUP_CREATED` | `groups[id] ← { name }` + `memberNodeIds`의 각 노드 `groupClientId ← id` (**타 그룹 소속이어도 덮어씀 = 자동 이동**, UC-017 E1·BR-3) ⊕ |
| `GROUP_RENAMED` | `groups[id].name ← payload.name` ⊕ |
| `NODE_GROUP_CHANGED` | `nodes[nodeId].groupClientId ← payload.groupClientId` (null=제외. 대상 그룹 미존재 시 no-op) ⊕ |
| `GROUP_DISSOLVED` | `groups[id]` 제거 + 소속이던 모든 노드 `groupClientId ← null` (노드·엣지 유지, UC-017 E5/BR-5) ⊕ |
| `SELECTION_CHANGED` | `selection ← payload` (dirty·serverIssues 불변) |
| `SAVE_SUCCEEDED` | `chainId ← payload.chainId`(null이었을 때만 의미), `baseSnapshotId ← payload.snapshotId`, `isDirty=false`, `serverIssues=[]` |
| `SAVE_REJECTED` | `serverIssues ← payload.issues` (문서·dirty 불변 — 편집 상태 유지, UC-018 E5/E6) |

### 4.3 검증 순수 함수 (dispatch 전 계층 — FE/BE 구조 규칙 공유)

파일 위치: `packages/domain/valuechains/editorValidation.ts` (순수 — 서버 Service의 구조 재검증과 공유 가능)

```ts
export type NodeBlockReason =
  | 'NODE_LIMIT_REACHED'          // nodeCount >= MAX_NODES_PER_CHAIN
  | 'DUPLICATE_SECURITY'          // 동일 종목 노드 이미 존재
  | 'SUBJECT_FIELD_REQUIRED';     // 자유 주체 유형/이름 누락

export type EdgeBlockReason =
  | 'SELF_REFERENCE'
  | 'DUPLICATE_RELATION'          // 동일 쌍+동일 종류 (무향은 (A,B)=(B,A) 정규화 — D-6)
  | 'RELATION_TYPE_INACTIVE'      // 신규/변경 대상이 비활성 종류 (UC-016 BR-4)
  | 'NODE_NOT_FOUND';

export type GroupBlockReason = 'NAME_REQUIRED' | 'NO_NODES_SELECTED' | 'GROUP_NOT_FOUND';

export function validateListedNodeAdd(
  state: Pick<ChainEditorState, 'nodes'>, securityId: string,
): NodeBlockReason | null;

export function validateFreeSubjectAdd(
  state: Pick<ChainEditorState, 'nodes'>,
  input: { subjectType: FreeSubjectType | null; subjectName: string },
): NodeBlockReason | null;

export function validateEdgeCandidate(
  state: Pick<ChainEditorState, 'nodes' | 'edges'>,
  candidate: { sourceClientNodeId: string; targetClientNodeId: string; relationTypeId: string },
  relationTypeById: ReadonlyMap<string, RelationType>,
  options: { excludeEdgeId?: string },   // EDGE_RELATION_CHANGED 시 자기 자신 제외
): EdgeBlockReason | null;

export function validateGroupCreate(
  input: { name: string; memberNodeIds: string[] },
): GroupBlockReason | null;

/** 저장 전 사전 검증 일괄 실행 — 이름 필수/노드 상한/엣지 참조/그룹 일관성 (requirement §2.9-1) */
export interface ClientIssue {
  code: 'NAME_REQUIRED' | 'NODE_LIMIT_EXCEEDED' | 'INVALID_EDGE' | 'INVALID_GROUP';
  message: string;
  targets: ServerIssue['targets'];
}
export function collectClientIssues(
  state: ChainEditorState,
  relationTypeById: ReadonlyMap<string, RelationType>,
): ClientIssue[];
```

### 4.4 파생 셀렉터 (상태 아님 — 렌더링 시 계산, requirement §4.3 대응)

파일 위치: `apps/web/src/features/valuechains/editor/state/chainEditorSelectors.ts`

```ts
export function selectNodeCount(state: ChainEditorState): number;
export function selectRemainingNodeCapacity(state: ChainEditorState): number;      // MAX_NODES_PER_CHAIN - nodeCount
export function selectIsNearNodeLimit(state: ChainEditorState): boolean;           // nodeCount >= NODE_LIMIT_WARNING_THRESHOLD(90)
export function selectUsedSecurityIds(state: ChainEditorState): ReadonlySet<string>;
export function selectGroupMembership(state: ChainEditorState): ReadonlyMap<string, string[]>; // groupClientId → nodeIds 역인덱스
export function selectEmptyGroupIds(state: ChainEditorState): string[];            // 저장 전 빈 그룹 안내(BR-6)
export function selectDuplicateGroupNames(state: ChainEditorState): string[];      // 중복 알림용(차단 아님, UC-017 E3)
export function selectConnectedEdgeIds(state: ChainEditorState, nodeIds: string[]): string[]; // 삭제 확인 다이얼로그 판단

/** 오류 하이라이트 대상 (serverIssues + clientIssues 합산) */
export interface IssueHighlight {
  nodeIds: ReadonlySet<string>;
  edgeIds: ReadonlySet<string>;
  groupIds: ReadonlySet<string>;
  nameError: string | null;
}
export function selectIssueHighlight(state: ChainEditorState, clientIssues: ClientIssue[]): IssueHighlight;

/** React Flow props 매핑 — 편집 상태 × 관계 종류 마스터 × selection × 하이라이트 */
export function selectReactFlowNodes(
  state: ChainEditorState, highlight: IssueHighlight,
): Node<ChainEditorNodeData>[];        // 그룹은 Sub Flow(parent) 노드로 변환, 소속 노드는 parentId 부여
export function selectReactFlowEdges(
  state: ChainEditorState,
  relationTypeById: ReadonlyMap<string, RelationType>,
  highlight: IssueHighlight,
): Edge<ChainEditorEdgeData>[];        // label=마스터 최신 이름(BR-6), 화살표=isDirected

/** 저장 페이로드 직렬화 (순수) — UC-018 §6.2 계약 */
export function serializeSavePayload(state: ChainEditorState): SaveChainRequest;
```

> `SaveChainRequest`는 UC-018 §6.2의 본문 스키마(`name`/`focusType`/`focusSecurityId`/`baseSnapshotId`/`groups[]`/`nodes[]`/`edges[]`)를 따른다. `focusSecurityId ← focusSecurity?.securityId ?? null`로 축약 직렬화한다.
> 낙관적 잠금 필드 표기: UC-018은 `baseSnapshotId`, UC-021 본문은 `expectedLatestSnapshotId`로 서술하나 **동일 엔드포인트(PUT /api/valuechains/:chainId)의 동일 개념**이다. 구현 시 필드명은 UC-018의 `baseSnapshotId`로 통일하는 것을 전제로 한다(어드민 variant도 동일 직렬화 재사용).

---

## 5. 서버 상태 계층 (TanStack Query — reducer 범위 외, 연결 계약)

파일 위치: `apps/web/src/features/valuechains/editor/hooks/`

```ts
export const chainEditorQueryKeys = {
  relationTypes: ['relation-types'] as const,
  latestSnapshot: (chainId: string) => ['valuechains', chainId, 'latest-snapshot'] as const,
  myChains: ['valuechains', 'mine'] as const,
  securitiesSearch: (q: string, market: MarketFilter, page: number) =>
    ['securities', 'search', { q, market, page }] as const,
};

// 관계 종류 마스터 — GET /api/relation-types (전체: 비활성 포함, 기존 엣지 라벨용)
export function useRelationTypes(): UseQueryResult<RelationType[]>;

// 최신 스냅샷 — GET /api/valuechains/{chainId}/snapshots/latest (edit 모드만 enabled)
export function useLatestSnapshot(chainId: string | null): UseQueryResult<LatestSnapshotResponse>;

// 내 체인 목록(소유 수 포함, D-2) — GET /api/valuechains/mine (create+user variant만 enabled)
export function useMyChains(options: { enabled: boolean }): UseQueryResult<MyChainsResponse>;

// 종목 검색 (UC-008 재사용) — 검색 패널 로컬 상태(q/market/page)가 쿼리 키 입력
export function useSecuritiesSearch(
  params: { q: string; market: MarketFilter; page: number },
  options: { enabled: boolean },          // 디바운스 완료 + 최소 길이(1자, B-4) 충족 시
): UseQueryResult<SecuritySearchResponse>;

// 저장 mutation — variant에 따라 엔드포인트/직렬화 분기
export function useSaveChainMutation(
  variant: EditorVariant,
): UseMutationResult<SaveChainResponse, ApiError, SaveChainRequest>;
```

| 데이터 | 쿼리/뮤테이션 | enabled/비고 |
|---|---|---|
| 관계 종류 마스터 | `relationTypes` | 항상. 실패 시 편집 진입 보류(edit)·관계 UI 비활성(create) |
| 최신 스냅샷 | `latestSnapshot(chainId)` | `mode==='edit'`. 성공 시 부트스트랩 이펙트가 1회 변환·dispatch |
| 내 체인 목록 | `myChains` | `mode==='create' && variant==='user'` — 체인 상한(50) 진입 게이트(D-2) |
| 종목 검색 | `securitiesSearch(...)` | 검색 패널 전용(노드 추가·대상 기업 지정 공용) |
| 저장 | `useSaveChainMutation` | `isPending` → 저장 버튼 비활성(중복 전송 방지). `chainId===null`이면 POST, 아니면 PUT. `variant==='official'`이면 UC-021 어드민 저장 계약(`change_source='admin_edit'`) |

- 저장 성공 시 mutation 콜백이 `myChains`·`latestSnapshot(chainId)` 캐시를 무효화하고 뷰 페이지로 라우팅한다(reducer 밖 사이드이펙트).
- **DTO 전제**: `latestSnapshot` 응답의 상장기업 노드에는 표시용 종목 필드(ticker/name/market)가 조인 포함되어야 `SecurityRef` 변환이 가능하다(UC-016/017의 응답 예시는 발췌본 — 구현 계약에서 명시 필요).

---

## 6. Context 설계 — Provider 데이터 흐름

### 6.1 구조: 상태/액션 Context 분리

캔버스는 고빈도 재렌더 영역이므로 Context를 둘로 분리한다. 액션 Context 값은 참조 안정(stable)하여, 액션만 쓰는 컴포넌트(툴바 버튼·폼)는 상태 변경에 재렌더되지 않는다.

```ts
// apps/web/src/features/valuechains/editor/context/ChainEditorContext.tsx
const ChainEditorStateContext  = createContext<ChainEditorStateValue | null>(null);
const ChainEditorActionsContext = createContext<ChainEditorActions | null>(null);

export interface ChainEditorProviderProps {
  mode: EditorMode;                    // 'create' | 'edit'
  variant: EditorVariant;              // 'user' | 'official'(어드민, UC-021)
  chainId?: string;                    // edit 모드 필수
  children: ReactNode;
}
export function ChainEditorProvider(props: ChainEditorProviderProps): ReactElement;
```

### 6.2 데이터 흐름 시각화 (Provider → useReducer → effects → consumers)

```
ChainEditorProvider(mode, variant, chainId)
│
├─ ① 서버 상태 (TanStack Query — 단일 소스)
│     useRelationTypes()                    ─┐
│     useLatestSnapshot(chainId)  [edit]     ├─ isBootstrapping / bootstrapError 파생
│     useMyChains()               [create·user] ─ entryBlocked(체인 상한 50) 파생
│     useSaveChainMutation(variant)          ─ isSaving / saveError 파생
│
├─ ② Store
│     const [state, dispatch] = useReducer(chainEditorReducer, CHAIN_EDITOR_INITIAL_STATE)
│
├─ ③ 이펙트 (사이드이펙트 전담 — reducer 순수성 보존)
│     useEditorBootstrap:  스냅샷·마스터 로드 성공 && !initialized
│                          → toEditorBootstrap(dto) → dispatch(EDITOR_INITIALIZED)  [1회]
│                          (create: 게이트 통과 즉시 빈 문서로 dispatch)
│     useUnsavedChangesGuard(state.isDirty):
│                          beforeunload 등록/해제 + Next.js 라우터 이탈 가드
│                          → 다이얼로그 확인 시 이탈(폐기), 취소 시 잔류  [상태 아님 — 휘발]
│
├─ ④ computed (useMemo 셀렉터 — §4.4)
│     counts/상한, 그룹 역인덱스, 활성 종류, clientIssues, canSave,
│     issueHighlight, reactFlowNodes/Edges ...
│
├─ ⑤ 액션 함수 (useCallback — 검증 → ID 발급 → dispatch / mutation 호출)
│     addListedCompanyNode, addEdge, createGroup, save, ...
│
└─ Context 공급
      ChainEditorStateContext.Provider  value={ meta, state, computed, async }
      ChainEditorActionsContext.Provider value={ actions }   ← 참조 안정
            │
            ▼ consumers (§7)
      EditorToolbar / ChainMetaPanel / NodeAddPanel / EditorCanvas / IssuePanel / 다이얼로그
```

단방향 흐름 요약: **View 이벤트 → 액션 함수(검증·ID 발급) → dispatch → reducer → state → computed → View**. 서버 왕복이 필요한 흐름(초기 로드·저장)도 쿼리/뮤테이션 결과를 **이펙트·콜백이 Action으로 변환**해 같은 경로로 합류한다.

### 6.3 저장 흐름 (액션 함수 `save()` 내부 계약)

```
save() 호출 (View: 저장 버튼)
 1. collectClientIssues(state, relationTypeById) 실행
    └ 이슈 있음 → dispatch 없이 { status:'blocked_client', issues } 반환
      (View는 issueHighlight 파생으로 오류 위치 표시 — 저장 중단, requirement §2.9-1)
 2. serializeSavePayload(state) → mutation.mutateAsync(payload)
    └ chainId===null → POST /api/valuechains (baseSnapshotId=null)
    └ chainId 존재  → PUT  /api/valuechains/:chainId (baseSnapshotId 필수)
 3. 결과 분기
    ├ 201/200        → dispatch(SAVE_SUCCEEDED) → 캐시 무효화 → 뷰 페이지 라우팅
    ├ 422 계열 / 409 DUPLICATE_NAME
    │                → error.details → ServerIssue[] 정규화 → dispatch(SAVE_REJECTED)
    ├ 409 SAVE_CONFLICT → dispatch 없음. saveError 파생으로 충돌 다이얼로그 표시
    │                   → [최신 재로드] reloadFromLatest() → refetch → EDITOR_INITIALIZED(폐기 경고 후)
    │                   → [계속 편집]   resetSaveError() (mutation.reset())
    ├ 401            → dispatch 없음. 재로그인 유도(편집 상태 보존 — UC-018 E9)
    └ 네트워크/500   → dispatch 없음. 재시도 유도(편집 상태 유지 — E8)
```

---

## 7. Context 설계 — 노출 인터페이스

### 7.1 상태 Context 값

```ts
export interface ChainEditorMeta {
  mode: EditorMode;
  variant: EditorVariant;
}

/** 서버 캐시·mutation에서 파생되는 비동기 메타 (reducer 밖) */
export interface ChainEditorAsync {
  isBootstrapping: boolean;            // 초기 로드 중(스켈레톤)
  bootstrapError: ApiError | null;     // 401/403/404/500 — 편집 진입 보류 + 재시도(UC-017 E12)
  entryBlocked: boolean;               // create·user: 소유 체인 수 >= MAX_CHAINS_PER_USER (진입 차단 + 삭제 유도)
  hasActiveRelationTypes: boolean;     // false면 관계 설정 UI 비활성(UC-016 E6)
  isSaving: boolean;                   // 저장 버튼 비활성 + 스피너
  saveError:                            // reducer 밖 오류 분기(§6.3) — SAVE_REJECTED 대상은 제외
    | { kind: 'conflict' }             // 409 SAVE_CONFLICT → 충돌 다이얼로그
    | { kind: 'auth' }                 // 401 → 재로그인 유도
    | { kind: 'network' }              // 네트워크/500 → 재시도
    | null;
}

export interface ChainEditorComputed {
  nodeCount: number;
  edgeCount: number;
  groupCount: number;
  remainingNodeCapacity: number;
  isNodeLimitReached: boolean;
  isNearNodeLimit: boolean;                              // ≥ NODE_LIMIT_WARNING_THRESHOLD(90) 잔여 안내 배지
  usedSecurityIds: ReadonlySet<string>;                  // 검색 결과의 "이미 추가됨" 표시
  relationTypeById: ReadonlyMap<string, RelationType>;
  activeRelationTypes: RelationType[];                   // 신규 선택 목록(비활성 미노출, BR-4)
  groupMembership: ReadonlyMap<string, string[]>;
  emptyGroupIds: string[];                               // 저장 전 빈 그룹 안내(스냅샷 제외 예고, BR-6)
  duplicateGroupNames: string[];                         // 알림만(차단 아님, E3)
  clientIssues: ClientIssue[];
  canSave: boolean;                                      // 이름 있음 ∧ 상한 이내 ∧ initialized ∧ !isSaving
  issueHighlight: IssueHighlight;                        // server + client 이슈 합산
  reactFlowNodes: Node<ChainEditorNodeData>[];
  reactFlowEdges: Edge<ChainEditorEdgeData>[];
}

export interface ChainEditorStateValue {
  meta: ChainEditorMeta;
  state: ChainEditorState;              // §2.2 — S1~S12 원본
  computed: ChainEditorComputed;
  async: ChainEditorAsync;
}
```

### 7.2 액션 Context 값 (전부 참조 안정)

```ts
export type ActionResult<Reason extends string> =
  | { ok: true }
  | { ok: false; reason: Reason };      // View가 차단 사유 토스트/필드 오류로 변환

export type SaveOutcome =
  | { status: 'saved'; chainId: string }
  | { status: 'blocked_client'; issues: ClientIssue[] }
  | { status: 'rejected_server' }       // SAVE_REJECTED dispatch 완료(하이라이트는 state로 반영)
  | { status: 'conflict' }
  | { status: 'auth_required' }
  | { status: 'network_error' };

export interface ChainEditorActions {
  // ── 메타 (UC-013)
  changeName(name: string): void;
  changeFocusType(focusType: FocusType): void;
  setFocusSecurity(security: SecurityRef): void;
  clearFocusSecurity(): void;

  // ── 노드 (UC-015) — 검증 실패 시 dispatch 없이 사유 반환
  addListedCompanyNode(security: SecurityRef): ActionResult<NodeBlockReason>;
  addFreeSubjectNode(input: {
    subjectType: FreeSubjectType; subjectName: string; subjectMemo: string | null;
  }): ActionResult<NodeBlockReason>;
  moveNode(clientNodeId: string, position: XYPosition): void;        // onNodeDragStop 확정 좌표
  deleteElements(input: { nodeIds: string[]; edgeIds: string[] }): void;
    // 연결 엣지 확인 다이얼로그(E7)는 View 책임: selectConnectedEdgeIds로 판단 후 확정 시에만 호출

  // ── 엣지 (UC-016)
  addEdge(input: {
    sourceClientNodeId: string; targetClientNodeId: string; relationTypeId: string;
  }): ActionResult<EdgeBlockReason>;
  changeEdgeRelation(clientEdgeId: string, relationTypeId: string): ActionResult<EdgeBlockReason>;

  // ── 그룹 (UC-017)
  createGroup(input: { name: string; memberNodeIds: string[] }): ActionResult<GroupBlockReason>;
  renameGroup(clientGroupId: string, name: string): ActionResult<GroupBlockReason>;
  assignNodeToGroup(clientNodeId: string, groupClientId: string | null): void;
  dissolveGroup(clientGroupId: string): void;

  // ── 선택
  changeSelection(selection: EditorSelection): void;

  // ── 저장·수명주기 (UC-018)
  save(): Promise<SaveOutcome>;
  reloadFromLatest(): Promise<void>;    // SAVE_CONFLICT → 최신 재로드(편집 내용 폐기, 확인 후 호출)
  resetSaveError(): void;               // 충돌 다이얼로그 "계속 편집" / 오류 배너 닫기
}
```

### 7.3 소비 훅

```ts
export function useChainEditorState(): ChainEditorStateValue;   // Provider 밖 사용 시 throw
export function useChainEditorActions(): ChainEditorActions;    // Provider 밖 사용 시 throw
```

---

## 8. View 연결

### 8.1 컴포넌트 트리 (Provider → consumers)

```
app/(protected)/valuechains/new/page.tsx            ─┐ Server Component 셸
app/(protected)/valuechains/[chainId]/edit/page.tsx  ├ (params await 후 클라이언트 경계만 배치)
app/admin/valuechains/[chainId]/edit/page.tsx        ─┘ variant='official' (UC-021)
└─ ChainEditorPage ('use client')
   └─ ChainEditorProvider mode/variant/chainId
      │   entryBlocked → 진입 차단 화면(상한 도달 + 삭제 유도) 렌더 (캔버스 서브트리 미장착)
      │   isBootstrapping → 스켈레톤 / bootstrapError → 오류 화면 + 재시도
      │
      ├─ EditorToolbar            ← canSave, isSaving, isDirty, nodeCount/잔여 배지, save()
      ├─ ChainMetaPanel           ← name, focusType, focusSecurity, nameError(issueHighlight)
      │    └─ FocusSecuritySearch ← 종목 검색(로컬 상태+쿼리) → setFocusSecurity()
      ├─ NodeAddPanel
      │    ├─ SecuritySearchTab   ← 검색(로컬)+usedSecurityIds → addListedCompanyNode()
      │    └─ FreeSubjectFormTab  ← 폼(로컬) → addFreeSubjectNode()
      ├─ EditorCanvas (React Flow, components/mindmap 공용 프레젠테이션 재사용)
      │    ← reactFlowNodes/Edges (그룹=Sub Flow parent 노드)
      │    → onNodeDragStop→moveNode / onSelectionChange→changeSelection
      │    → onConnect→(pending 로컬)→RelationTypePicker 확정→addEdge
      │    → 엣지 선택→관계 변경/삭제, 선택 삭제→(확인 다이얼로그)→deleteElements
      ├─ RelationTypePicker       ← activeRelationTypes (비활성 미노출)
      ├─ GroupPanel               ← selection.nodeIds, groupMembership, emptyGroupIds,
      │                              duplicateGroupNames → createGroup/renameGroup/
      │                              assignNodeToGroup/dissolveGroup
      ├─ IssuePanel               ← state.serverIssues + computed.clientIssues (사유 목록)
      └─ 다이얼로그 (전부 로컬/파생 — 상태 아님)
           DeleteConfirmDialog    ← selectConnectedEdgeIds 기반(E7)
           SaveConflictDialog     ← async.saveError?.kind==='conflict'
                                     → reloadFromLatest() | resetSaveError()
           UnsavedLeaveGuard      ← useUnsavedChangesGuard(state.isDirty) 이펙트
```

### 8.2 React Flow 브리징 규칙

- **문서 → 캔버스**: `computed.reactFlowNodes/Edges`를 React Flow에 전달(제어형). 그룹은 Sub Flow parent 노드로, 소속 노드는 `parentId`로 매핑한다.
- **캔버스 → 문서**: 드래그 중간 좌표·줌/팬은 React Flow 내부 시각 상태로 두고(requirement §4.4), `onNodeDragStop`에서만 `moveNode(최종 좌표)`를 호출한다. 선택 변경은 `onSelectionChange → changeSelection`으로 즉시 반영한다(문서 비변형).
- **연결 제스처**: `onConnect`는 즉시 엣지를 만들지 않는다 — 연결 후보를 로컬 상태로 들고 RelationTypePicker에서 관계 종류 확정 시 `addEdge()`를 호출한다(검증 실패 시 차단 사유 안내, 문서 무변경).

### 8.3 사용 예시 (시그니처 수준)

```tsx
// 종목 검색 결과 → 노드 추가 (NodeAddPanel/SecuritySearchTab)
function SecurityResultRow({ item }: { item: SecuritySearchItem }) {
  const { computed } = useChainEditorState();
  const { addListedCompanyNode } = useChainEditorActions();

  const alreadyAdded = computed.usedSecurityIds.has(item.securityId);
  const handleSelect = () => {
    const result = addListedCompanyNode(toSecurityRef(item));
    if (!result.ok) notifyBlocked(result.reason);   // NODE_LIMIT_REACHED | DUPLICATE_SECURITY
  };
  // ...
}

// 저장 버튼 (EditorToolbar)
function SaveButton() {
  const { computed, async } = useChainEditorState();
  const { save } = useChainEditorActions();

  const handleSave = async () => {
    const outcome = await save();
    // 'saved'는 Provider가 라우팅까지 수행. 'blocked_client'/'rejected_server'는
    // issueHighlight/serverIssues 상태 반영으로 View가 자동 표시 — 여기선 토스트 정도만.
  };
  return <Button disabled={!computed.canSave || async.isSaving} onClick={handleSave} />;
}
```

---

## 9. 대표 흐름 시나리오 (Action → Store → View)

### 9.1 편집 진입 (edit)
1. Provider 마운트 → `useRelationTypes` + `useLatestSnapshot(chainId)` 병렬 로드 (`isBootstrapping=true` → 스켈레톤).
2. 둘 다 성공 → 부트스트랩 이펙트가 `toEditorBootstrap(dto)` 변환 후 `EDITOR_INITIALIZED` 1회 dispatch → `initialized=true`, `baseSnapshotId=로드 스냅샷 ID`, `isDirty=false` → 캔버스 렌더링.
3. 실패(401/403/404/500) → dispatch 없음, `bootstrapError` 파생 → 오류 화면 + 재시도(refetch).

### 9.2 상장기업 노드 추가
1. 검색 패널(로컬 상태 + `securitiesSearch` 쿼리)에서 종목 선택 → `addListedCompanyNode(securityRef)`.
2. 액션 함수가 `validateListedNodeAdd` 실행 — 상한/중복이면 dispatch 없이 `{ ok:false, reason }` 반환 → 차단 토스트(문서 무변경, requirement §5 "변경 없음" 행).
3. 통과 시 `clientNodeId` 발급 + 기본 좌표 산출 → `LISTED_NODE_ADDED` dispatch → `nodes` 추가 + `isDirty=true` + `serverIssues=[]` → 캔버스 노드 렌더, `nodeCount`≥90이면 잔여 배지.

### 9.3 엣지 연결
1. 캔버스 연결 제스처 → pending 후보(로컬) → RelationTypePicker(활성 종류만) → 확정.
2. `addEdge()` → `validateEdgeCandidate`(자기 참조·D-6 무향 정규화 중복·활성 여부) → 통과 시 `EDGE_ADDED` → 라벨·방향 화살표 렌더(마스터 `isDirected` 파생).

### 9.4 그룹 생성 (자동 이동 포함)
1. 다중 선택(`selection.nodeIds`) → 그룹 생성 + 이름 입력 확정 → `createGroup()`.
2. 검증(이름 공백/선택 0개) 통과 → `GROUP_CREATED` → reducer가 멤버 노드의 `groupClientId`를 일괄 덮어씀(타 그룹 소속 자동 이동, E1) → 클러스터 렌더. 이름 중복은 `duplicateGroupNames` 파생으로 알림만(E3).

### 9.5 저장 성공 / 422 / 충돌
1. `save()` → 클라이언트 이슈 있으면 `blocked_client`(하이라이트 표시, 요청 미발생).
2. 통과 → 직렬화 → POST/PUT (`isPending`으로 버튼 비활성).
3. 성공: `SAVE_SUCCEEDED`(`chainId`·`baseSnapshotId` 갱신, dirty 해제) → 캐시 무효화 → 뷰 페이지 이동.
4. 422/409 DUPLICATE_NAME: `SAVE_REJECTED` → `serverIssues` 설정 → 캔버스 하이라이트 + IssuePanel 사유. 이후 첫 문서 변형 액션에서 자동 해제.
5. 409 SAVE_CONFLICT: reducer 무변경, `saveError.kind='conflict'` 파생 → 다이얼로그 → "최신 재로드"(폐기 경고 후 `reloadFromLatest()` → `EDITOR_INITIALIZED` 재실행) 또는 "계속 편집"(`resetSaveError()`).

### 9.6 미저장 이탈
- `isDirty=true`인 동안 `useUnsavedChangesGuard`가 beforeunload·라우터 이동을 가로채 경고 다이얼로그 표시 → 확인 시 이탈(편집 상태 폐기), 취소 시 잔류. `isDirty=false`면 가드 미동작. 다이얼로그 노출 여부는 상태가 아니다(휘발).

---

## 10. 테스트 전략

`chainEditorReducer`·검증 함수·셀렉터·`serializeSavePayload`·`toEditorBootstrap`은 전부 React 비의존 순수 모듈 — 렌더링 없이 단위 테스트한다.

| # | 대상 | 시나리오(AAA) | 기대 |
|---|---|---|---|
| 1 | reducer | `initialized=false`에서 문서 변형 액션 | no-op(원본 반환) |
| 2 | reducer | `FOCUS_TYPE_CHANGED('industry')` (focusSecurity 설정 상태) | `focusSecurity=null` |
| 3 | reducer | `ELEMENTS_DELETED`(연결 엣지 있는 노드) | 노드+연쇄 엣지 제거, selection 제외, 빈 그룹 유지(D-5) |
| 4 | reducer | 존재하지 않는 노드 재삭제(E10)/미존재 ID 이동 | no-op, `isDirty` 불변 |
| 5 | reducer | `GROUP_CREATED`(타 그룹 소속 노드 포함) | 소속 자동 이동(E1) |
| 6 | reducer | `GROUP_DISSOLVED` | 그룹 제거 + 멤버 `groupClientId=null`, 노드·엣지 유지 |
| 7 | reducer | 문서 변형 액션 공통 | `isDirty=true` + `serverIssues=[]`, 원본 비변이(불변성) |
| 8 | reducer | `SELECTION_CHANGED` | `isDirty`·`serverIssues` 불변 |
| 9 | reducer | `SAVE_SUCCEEDED` | `chainId`/`baseSnapshotId` 갱신, `isDirty=false` |
| 10 | 검증 | 무향 관계 (A,B) 존재 후 (B,A)+동일 종류 후보 | `DUPLICATE_RELATION`(D-6) |
| 11 | 검증 | 노드 100개 상태에서 추가 후보 | `NODE_LIMIT_REACHED` |
| 12 | 검증 | 비활성 종류로 신규 엣지 후보 | `RELATION_TYPE_INACTIVE` |
| 13 | 직렬화 | 편집 상태 → 페이로드 | UC-018 §6.2 스키마 일치(`focusSecurityId` 축약, 좌표 포함, `baseSnapshotId` 반영) |
| 14 | 부트스트랩 | 스냅샷 DTO → `EditorBootstrap` → 재직렬화 | 왕복 손실 없음(그룹 소속·좌표 보존) |

- 이펙트(`useEditorBootstrap`·`useUnsavedChangesGuard`)와 Provider 통합(충돌 다이얼로그 분기 등)은 훅/컴포넌트 테스트로 별도 검증. 서버 계약 테스트는 구현 단계(plan.md) 범위.

---

## 11. 어드민 variant 차이 요약 (UC-021 — 동일 설계 재사용)

| 항목 | user | official(어드민) |
|---|---|---|
| Store/Action/Reducer/computed | 동일 | **동일(재사용)** |
| 진입 게이트 | create 시 체인 상한 50(D-2, `myChains`) | 없음(공식 체인은 1인 상한 비적용) |
| 저장 계약 | UC-018 (`change_source='user_save'`) | UC-021 (`change_source='admin_edit'`, 이름 전역 유일) |
| 비활성 관계 종류 서버 검증 | 존재만 검증(UC-018 BR-8) | 신규 엣지의 비활성 종류 422 차단(UC-021/UC-016 BR-4) — **클라이언트 동작은 동일**(활성만 노출) |
| 권한 | 소유자(서버 검증) | role=admin(서버 검증) |

variant 분기는 전부 Provider의 서버 상태 계층(§5 mutation·게이트)과 라우트 셸에 국한되며, Flux 코어(§2~4)는 분기가 없다.
