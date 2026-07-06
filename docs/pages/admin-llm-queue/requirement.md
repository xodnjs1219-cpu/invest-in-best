# 어드민 LLM 검토 큐 페이지 — 요구사항 (requirement.md)

> 페이지: **LLM 관계 변경안 검토 큐** — 라우트 `/admin/llm-proposals` (`apps/web/src/app/admin/`)
> 근거 문서: `docs/prd.md` 3장(어드민)·6장(LLM 보조 업데이트), `docs/userflow.md` 022, `docs/usecases/022/spec.md`, `docs/usecases/000_decisions.md`(충돌 시 우선), `docs/techstack.md` §4
> 액터: **Admin** (`role=admin`, 서버 측 미들웨어 검증 — 비-Admin은 401/403으로 접근 거부)

---

## 1. 페이지 개요

배치(030)가 사전 적재한 LLM 관계 변경 제안 큐(`llm_relation_proposals`)를 Admin이 근거 공시와 함께 검토하고 **승인** 또는 **거부**하는 페이지다. 승인 시 서버가 원자적 트랜잭션으로 공식 체인에 **새 스냅샷 1건**을 생성하며(승인 1건 = 1스냅샷), 거부 시 체인에는 아무 변경이 없다. 외부 서비스 직접 연동은 없다 — 이 페이지는 자체 DB에 적재된 제안 큐만 API로 소비한다.

## 2. 사용자가 할 수 있는 행동과 데이터 변화 흐름

### 2-1. 검토 큐 조회 (상태 필터 · 페이지네이션)

| 단계 | 행동 | 데이터 흐름 |
|---|---|---|
| 1 | 페이지 진입 | FE가 `GET /api/admin/llm-proposals?status=pending&page=1` 호출 (기본 필터 `pending`, 페이지당 건수는 서버 상수 20) |
| 2 | 상태 필터 변경 (`pending`/`approved`/`rejected`/`invalidated`) | 필터가 바뀌면 페이지를 1로 리셋하고 새 쿼리 실행. TanStack Query가 필터·페이지별 캐시 키로 응답을 캐싱 |
| 3 | 페이지 이동 | `page` 파라미터 변경 → 재조회. 응답의 `hasMore`로 다음 페이지 버튼 활성 여부 결정 |
| 4 | 목록 렌더링 | 각 행: 제안 유형(추가/변경/삭제), 대상 노드 쌍(표시명·티커), 관계 종류 라벨, 근거 공시(제목·공시일·원문 링크), 적용 가능/재검토 필요 배지(`applicability`) |

- 서버는 조회 시점에 제안을 **최신 스냅샷과 대조**해 `applicability { isApplicable, reason }`를 계산해 내려준다(표시 전용, 쓰기 없음).
- 빈 목록(대기 제안 0건)이면 빈 상태 안내를 표시한다(E13).
- `relation_delete` 제안도 관계 종류가 **항상 지정**된다(000_decisions **F-1** — spec의 nullable 표기를 대체). FE는 null 방어만 유지한다.

### 2-2. 제안 선택 → 근거 공시 상세 패널

| 단계 | 행동 | 데이터 흐름 |
|---|---|---|
| 1 | 목록에서 제안 1건 클릭 | 선택된 제안 ID를 클라이언트 상태로 기록 → 상세 패널 열림 |
| 2 | 상세 패널 표시 | **추가 API 호출 없음** — 목록 응답에 이미 포함된 데이터(근거 공시 제목/일자/원문 링크/출처, LLM 근거 설명 `rationale`, 대상 체인, `basedOnSnapshotId`, 적용 가능 여부)를 선택 ID로 조회해 렌더링 |
| 3 | 원문 링크 클릭 | 새 탭으로 외부 공시 원문 열람(데이터 변화 없음) |
| 4 | 패널 닫기 / 다른 제안 선택 | 선택 ID 해제 또는 교체 |

### 2-3. 승인

| 단계 | 행동 | 데이터 흐름 |
|---|---|---|
| 1 | 상세 패널(또는 행)에서 승인 실행 | `POST /api/admin/llm-proposals/:proposalId/approve` (Body 없음) |
| 2 | 서버 트랜잭션 | pending 조건부 잠금 → 체인 검증(official·비보관) → 노드 재매핑 → 관계 종류 활성 검증 → 적용 가능성 검증 → **새 스냅샷 INSERT** → 제안 `approved` 갱신 (Postgres RPC, 전체 원자적) |
| 3 | 성공(200) | 승인 완료 피드백(토스트) → 목록 쿼리 무효화·재조회 → pending 필터에서 해당 제안 제거, 상세 패널 닫힘 |
| 4 | 실패 | 아래 오류 분기 표 참조 — 결과에 따라 큐 재조회 또는 상태 유지 |

**낙관적 갱신을 적용하지 않는다.** 승인 결과는 서버 트랜잭션에서만 확정 가능하고(성공/충돌 자동무효/이미 처리/차단 등 분기가 많음), 실패 시 롤백 UI가 오히려 혼란을 준다. 처리 중에는 해당 행·패널의 승인/거부 버튼을 비활성화하고 스피너를 표시하며, 응답 확정 후 서버 진실을 재조회한다(§4 상태 설계 근거).

### 2-4. 거부

| 단계 | 행동 | 데이터 흐름 |
|---|---|---|
| 1 | 거부 실행 | 거부 사유 입력 다이얼로그 열림(사유는 **선택** 입력) |
| 2 | 다이얼로그에서 확정 | `POST /api/admin/llm-proposals/:proposalId/reject` Body `{ reason?: string }` |
| 3 | 서버 처리 | pending 조건부 갱신 → `rejected` + `reviewed_by`/`reviewed_at`. **체인 구조 변경 없음, 스냅샷 미생성**(BR-9) |
| 4 | 성공(200) | 다이얼로그 닫기 → 거부 완료 피드백 → 목록 재조회(큐에서 제거) |

### 2-5. 오류·충돌 분기와 UI 반영

| HTTP / code | 의미 | 제안 상태 | UI 반영 |
|---|---|---|---|
| 200 (approve) | 승인 완료, 스냅샷 생성 | `approved` | 성공 토스트, 큐 재조회, 패널 닫기 |
| 409 `PROPOSAL_ALREADY_PROCESSED` | 타 Admin 선처리/재시도 (E5/E11) | 변경 없음 | "이미 처리된 제안" 안내 + 큐 재조회, 패널 닫기 |
| 409 `PROPOSAL_CONFLICT` | 재매핑 실패/엣지 부재/중복 (E1~E3) | **`invalidated` 자동 전환** | "적용 불가 — 자동 무효 처리" 안내 + 큐 재조회, 패널 닫기 |
| 422 `RELATION_TYPE_INACTIVE` | 비활성 관계 종류 (E4) | `pending` 유지 | 승인 차단 안내 + 거부 처리 유도. 패널·선택 유지, 목록 재조회(applicability 갱신) |
| 422 `CHAIN_NOT_APPLICABLE` | 체인 비적격(보관/유형 위반, E9/E10) | `pending` 유지 | 승인 불가 안내. 패널·선택 유지 |
| 500 `APPROVAL_FAILED` / `REJECTION_FAILED` | 트랜잭션 실패(전체 롤백, E14) | 변경 없음 | 오류 토스트 + 재시도 유도. 상태 변화 없음(거부 다이얼로그는 유지) |
| 404 `PROPOSAL_NOT_FOUND` / 400 `INVALID_REQUEST` | 잘못된 대상/파라미터 (E15) | — | 오류 안내 + 큐 재조회 |
| 401 / 403 | 미인증 / 비-Admin (E12) | — | 접근 거부 화면·로그인 유도(페이지 공통 처리) |

## 3. 데이터베이스 연관 (FE는 API 경유로만 접근)

이 페이지가 소비·변경하는 데이터는 전부 서버 API 뒤의 자체 DB다. FE가 DB에 직접 접근하지 않는다.

| 테이블 | 페이지 관점 용도 |
|---|---|
| `llm_relation_proposals` | 제안 큐 본문(상태·유형·rationale·검토 이력). 승인/거부는 이 테이블의 **상태 전환**(UPDATE)으로만 기록되며 DELETE는 없다 |
| `disclosures` | 근거 공시(제목·공시일·원문 링크·출처) — 목록 응답에 조인되어 내려옴 |
| `relation_types` | 관계 종류 라벨·활성 여부 |
| `value_chains` | 대상 체인 이름·유형·보관 여부 |
| `chain_snapshots` / `snapshot_groups` / `snapshot_nodes` / `snapshot_edges` | 노드 표시 정보 + 최신 구성 대조(applicability). **승인 시 새 스냅샷 1건 INSERT**(`change_source=llm_approval`) |
| `securities` | 상장기업 노드 표시명(종목명/티커) |

## 4. 관리 상태(State) vs 파생(Derived) 데이터 분리

원칙: **파생 가능한 값은 상태로 두지 않는다.** 서버 데이터는 TanStack Query 캐시가 단일 진실이며 reducer 상태에 복제하지 않는다.

### 4-1. 클라이언트가 관리하는 상태 (useReducer 대상)

| # | 상태 | 타입 | 초기값 | 설명 |
|---|---|---|---|---|
| S1 | `statusFilter` | `'pending' \| 'approved' \| 'rejected' \| 'invalidated'` | `'pending'` | 목록 상태 필터. 쿼리 키 입력값 |
| S2 | `page` | `number` | `1` | 목록 페이지 번호. 쿼리 키 입력값 |
| S3 | `selectedProposalId` | `string \| null` | `null` | 근거 공시 상세 패널에 표시할 제안. `null`이면 패널 닫힘 |
| S4 | `rejectTarget` | `{ proposalId: string; reason: string } \| null` | `null` | 거부 사유 입력 다이얼로그의 대상과 입력값. `null`이면 다이얼로그 닫힘 |

### 4-2. 화면에 보이지만 상태가 아닌 것 (파생 데이터)

| # | 화면 데이터 | 원천 (파생 방법) |
|---|---|---|
| D1 | 제안 목록(items·`hasMore`·`pageSize`) | TanStack Query 캐시 — `['admin','llm-proposals',{status,page}]` 쿼리 데이터 |
| D2 | 목록 로딩/오류 표시 | 쿼리의 `isPending` / `isError` |
| D3 | 상세 패널 열림 여부 | `selectedProposalId !== null` |
| D4 | 상세 패널 내용(공시·rationale·적용 가능성) | `items.find(p => p.proposalId === selectedProposalId)` — 목록 캐시에서 선택 ID로 조회 |
| D5 | 빈 상태 안내 여부 | 쿼리 성공 && `items.length === 0` |
| D6 | 적용 가능/재검토 필요 배지 | 서버 계산값 `applicability`(응답 필드) 그대로 표시 |
| D7 | 특정 제안의 "처리 중" 표시(버튼 비활성·스피너) | 승인/거부 mutation의 `isPending && variables.proposalId === 행 ID` |
| D8 | 승인/거부 버튼 노출 여부 | 행의 `status === 'pending'`(응답 필드) && 필터 컨텍스트 |
| D9 | 다음/이전 페이지 버튼 활성 | `hasMore`(응답) / `page > 1`(S2에서 파생) |
| D10 | 승인·거부 완료/오류 토스트 | mutation 콜백의 일회성 사이드이펙트(지속 상태 아님) |

### 4-3. 서버 상태 (TanStack Query 전담 — reducer 밖)

- 목록 쿼리: `GET /api/admin/llm-proposals` (키: `['admin','llm-proposals',{ status, page }]`)
- 승인 mutation: `POST .../:proposalId/approve`
- 거부 mutation: `POST .../:proposalId/reject`
- 처리 확정 후에는 낙관적 갱신 대신 **쿼리 무효화(invalidate) → 재조회**로 서버 진실을 반영한다(§2-3 근거).

## 5. 상태 전환 테이블 (변경 조건 + UI 반영)

| 상태 | 변경 조건(트리거) | 전환 내용 | UI 반영 |
|---|---|---|---|
| S1 `statusFilter` | 필터 탭/셀렉트 선택 | 새 필터 값으로 교체 + **S2=1 리셋, S3=null, S4=null**(목록 문맥 변경) | 해당 상태의 목록 재조회·렌더링, 상세 패널·다이얼로그 닫힘 |
| S2 `page` | 페이지네이션 버튼 클릭 | 새 페이지 번호 + **S3=null**(선택 제안이 새 페이지에 없을 수 있음) | 해당 페이지 목록 재조회, 상세 패널 닫힘 |
| S3 `selectedProposalId` | 목록 행 클릭 | 해당 제안 ID로 설정 | 상세 패널 열림(근거 공시·rationale·적용 가능성 표시) |
| S3 | 패널 닫기 버튼 | `null` | 상세 패널 닫힘 |
| S3 | 승인/거부가 **확정 처리**됨(200, 409 계열) | 해당 제안이 선택 중이었으면 `null` | 패널 닫힘 + 재조회된 큐 표시 |
| S3 | 승인이 422로 **차단**됨(pending 유지) | 유지(전환 없음) | 패널 유지 + 차단 사유 안내, 재조회로 배지 갱신 |
| S4 `rejectTarget` | 거부 버튼 클릭 | `{ proposalId, reason: '' }` | 거부 사유 입력 다이얼로그 열림 |
| S4 | 사유 텍스트 입력 | `reason`만 갱신(같은 대상 유지) | 입력값 반영 |
| S4 | 다이얼로그 취소 | `null` | 다이얼로그 닫힘(요청 미발생) |
| S4 | 거부 mutation 성공(200) 또는 409 | `null` | 다이얼로그 닫힘 + 완료/안내 토스트 + 큐 재조회 |
| S4 | 거부 mutation 500 | 유지(전환 없음) | 오류 토스트, 다이얼로그 유지(재시도 가능) |

상세 Flux 설계(Action 타입/Reducer/View 연결)는 `docs/pages/admin-llm-queue/state_management.md` 참조.
