# chain-editor — 밸류체인 생성/편집 페이지 요구사항

> 근거: `docs/prd.md` §3-3(밸류체인 생성/편집 페이지)·§5(IA), `docs/userflow.md` 013~018,
> `docs/usecases/013~018/spec.md`(+ UC-021 어드민 공식 체인 편집이 본 설계 재사용),
> `docs/usecases/000_decisions.md` D-1~D-7(**spec과 충돌 시 이 문서 우선**), `docs/techstack.md`(React 19 + React Flow + TanStack Query + Context/useReducer).
> 상태관리 상세 설계는 `docs/pages/chain-editor/state_management.md` 참조.

---

## 1. 페이지 개요

| 항목 | 내용 |
|---|---|
| 라우트 | `/valuechains/new`(신규 생성), `/valuechains/[chainId]/edit`(기존 체인 편집) — 둘 다 로그인 필수 |
| 어드민 재사용 | `/admin/valuechains/*`(UC-021)가 동일 편집 캔버스·상태 설계를 재사용(저장 대상과 권한만 다름) |
| 핵심 UI | React Flow(`@xyflow/react`) 기반 마인드맵 편집 캔버스 + 메타 패널(이름/기준) + 노드 추가 패널(종목 검색/자유 주체) + 저장 툴바 |
| 액터 | User(체인 소유자), Admin(공식 체인 편집 variant) |
| 관련 유스케이스 | UC-013(신규 생성), UC-014(복제 후 편집 진입), UC-015(노드), UC-016(엣지), UC-017(그룹), UC-018(저장), UC-021(어드민) |

### 1.1 진입 모드

| 모드 | 경로 | 초기 데이터 | 저장 방식 |
|---|---|---|---|
| 신규 생성(create) | `/valuechains/new` | 빈 캔버스. DB 레코드 없음(지연 생성, UC-013 BR-3) | `POST /api/valuechains` (`baseSnapshotId=null`) |
| 기존 편집(edit) | `/valuechains/[chainId]/edit` | 최신 스냅샷 로드(`GET /api/valuechains/{chainId}/snapshots/latest`) | `PUT /api/valuechains/:chainId` (`baseSnapshotId` 필수 — 낙관적 잠금) |
| 복제 직후(edit) | UC-014 복제 성공 → 새 chainId의 edit 경로로 랜딩(D-3) | 위 "기존 편집"과 동일 | 동일 |
| 어드민 공식 편집(edit, variant=official) | `/admin/valuechains/*` | 동일(최신 스냅샷 로드) | UC-021 어드민 저장 API(`change_source='admin_edit'`) |

### 1.2 전역 원칙 (핵심 불변식)

- **임시 편집 상태 원칙**: 노드/엣지/그룹/좌표/메타의 모든 편집은 클라이언트 메모리에서만 일어난다. 서버 쓰기는 **저장 1회 = 스냅샷 1건**(UC-018 BR-1)뿐이다. 자동 저장 없음(MVP).
- **규모 상한**: 체인당 노드 최대 100개(`MAX_NODES_PER_CHAIN`), 1인당 체인 최대 50개(`MAX_CHAINS_PER_USER`). 상수는 `packages/domain/constants`에서 관리(하드코딩 금지).
- **이중 검증**: 클라이언트는 즉시 피드백용 사전 검증, 서버는 저장 시 최종 재검증(UC-018 BR-5). 클라이언트 검증 통과가 저장 성공을 보장하지 않는다.
- **미저장 이탈 경고**: 더티 상태에서 라우팅 이동/탭 닫기 시 경고 다이얼로그(UC-013 E4).

---

## 2. 사용자가 할 수 있는 행동과 데이터 변화 흐름

각 행동에 대해 `트리거 → 검증 → 데이터 변화 → 화면 반영 → 서버 통신`을 기술한다.

### 2.1 페이지 진입·초기 로드

- **create**: 로그인 확인 → 내 밸류체인 목록 데이터(소유 체인 수 포함, D-2 — 별도 quota 엔드포인트 없음)로 체인 상한(50) 도달 여부 확인 → 도달 시 진입 차단 + 삭제 유도, 미만이면 빈 편집 상태로 초기화.
- **edit**: 관계 종류 마스터(`GET /api/relation-types`, 전체 — 비활성 포함)와 최신 스냅샷(`GET /api/valuechains/{chainId}/snapshots/latest`)을 병렬 로드 → 성공 시 서버 DTO를 편집 도메인 모델로 변환해 편집 상태를 초기화(`baseSnapshotId` = 로드한 스냅샷 ID) → 캔버스 렌더링. 실패(401/403/404/500) 시 편집 진입 보류 + 오류 화면/재시도(UC-017 E12).
- 관계 종류 마스터는 create 모드에서도 필요(엣지 설정 UI). 활성 종류 0개면 관계 설정 UI 비활성화(UC-016 E6).

### 2.2 체인 메타 편집 — 이름·기준(UC-013)

- 이름 입력: 공백/형식만 즉시 검증(중복 검증은 저장 시 서버). 입력 → 편집 상태 `name` 갱신 → 더티 전환 → 툴바에 반영.
- 기준 선택: `focusType`(industry/company) 토글. company 선택 시 대상 기업(선택 사항, D-1) 지정을 위한 종목 검색 노출. industry로 되돌리면 `focusSecurity`는 해제.
- 대상 기업 지정: 종목 검색(2.3) 결과 선택 → `focusSecurity` 설정(표시용 티커/이름/시장 포함).

### 2.3 종목 검색 (UC-008 재사용, 노드 추가·대상 기업 지정 공용)

- 검색어 입력(최소 1자, B-4) + 시장 필터(KRX/US/전체) → 300ms 디바운스 → `GET /api/securities/search` 호출 → 결과 목록(시장 배지 포함, 페이지당 20건) 표시.
- 검색어/필터는 **검색 패널의 로컬 상태**, 결과는 **TanStack Query 캐시**다(편집 문서 상태와 분리 — §4 참조).
- 결과 없음 → 빈 안내 + 자유 주체 추가 대안 안내(UC-015 E3). API 오류 → 오류 안내 + 재시도(편집 상태 유실 없음, E5).

### 2.4 노드 추가 (UC-015)

- **상장기업 노드**: 검색 결과에서 종목 선택 → 클라이언트 검증 ① 노드 상한(100) 미도달 ② 동일 종목 노드 부재(체인당 동일 종목 1개) → 통과 시 `nodeKind='listed_company'` 노드를 편집 상태에 추가(신규 `clientNodeId` 발급, 기본 좌표 배치) → 캔버스 렌더링 + 더티 전환. 차단 시 사유 안내(추가 없음).
- **자유 주체 노드**: 유형(consumer/government/private_company/other)·이름(필수)·메모(선택) 입력 → 필수 필드 + 노드 상한 검증 → 통과 시 `nodeKind='free_subject'` 노드 추가.
- 상한 근접(90개 이상, `NODE_LIMIT_WARNING_THRESHOLD`) 시 잔여 수 안내 배지 표시.

### 2.5 노드 이동·삭제 (UC-015)

- **이동**: 캔버스 드래그 → 노드 `position(x,y)` 갱신 → 더티 전환(좌표는 스냅샷에 영속, UC-018 BR-9).
- **삭제**: 노드 선택(다중 가능) 후 삭제 실행 → 연결 엣지 존재 확인 → 있으면 "관련 엣지 함께 삭제" 확인 다이얼로그(E7) → 확인 시 노드 + 연결 엣지 제거 + 그룹 소속 해제(BR-5), 취소 시 변경 없음. 이미 없는 노드 재삭제는 멱등 무시(E10). 그룹의 마지막 노드 삭제로 빈 그룹이 생겨도 그룹은 유지(D-5).

### 2.6 관계(엣지) 설정·변경·삭제 (UC-016)

- **설정**: 캔버스에서 출발→도착 노드 연결 시도 → 관계 종류 선택 UI(**활성 종류만** 선택 가능) → 클라이언트 검증 ① 자기 참조 금지 ② 동일 쌍+동일 종류 중복 금지(무향 관계는 (A,B)=(B,A) 정규화 대조, D-6) → 통과 시 엣지 추가 → 관계 라벨·방향 화살표(마스터의 `isDirected`에 따름) 렌더링 + 더티 전환.
- **변경**: 기존 엣지 선택 → 관계 종류 변경 → 동일 검증 후 갱신. 비활성 종류를 쓰는 기존 엣지는 유지·표시되나 **신규 선택 목록에는 비활성 종류 미노출**(BR-4).
- **삭제**: 엣지 선택 → 삭제 → 편집 상태에서 제거.
- 동일 노드 쌍에 서로 다른 관계 종류 병존은 허용(BR-3).

### 2.7 노드 그루핑 (UC-017)

- **생성**: 노드 1개 이상 다중 선택 → 그룹 생성 + 이름 입력(필수, 공백 불가) → 그룹 추가 + 선택 노드 소속 반영. 이미 타 그룹 소속 노드는 **자동 이동**(차단 아님, E1) + 이동 사실 표시. 동일 체인 내 이름 중복은 허용하되 중복 알림만 표시(E3).
- **이름 변경**: 이름 필수 검증 후 갱신.
- **노드 이동/제외**: 다른 그룹으로 이동 시 기존 소속 자동 해제, 그룹에서 제외 시 미소속 전환. 한 노드 최대 1그룹, 중첩 없음(BR-2).
- **해제(그룹 삭제)**: 그룹만 제거, 소속 노드는 미소속으로 유지(E5).
- 빈 그룹은 편집 중 캔버스에 유지되고(D-5), 저장 시 서버가 스냅샷에서 제외한다(BR-6) — 저장 전 빈 그룹 안내 표시.

### 2.8 다중 선택

- 캔버스 클릭/드래그 박스/보조키로 노드·엣지 선택 상태 관리. 다중 노드 선택은 그룹 생성·일괄 삭제의 전제. 선택은 저장 대상이 아니다(휘발 UI 상태).

### 2.9 저장 (UC-018)

1. 저장 클릭 → **클라이언트 사전 검증**: 이름 필수 / 노드 상한 100 / 엣지 참조 유효성(자기 참조·중복) / 그룹 일관성(이름 필수, 노드 최대 1그룹). 실패 시 오류 위치 표시 + 저장 중단.
2. 통과 시 편집 상태를 저장 페이로드로 **직렬화**(name/focusType/focusSecurityId/groups[]/nodes[](좌표 포함)/edges[] + `baseSnapshotId`) → `POST`(신규)/`PUT`(갱신) 호출. 요청 중 저장 버튼 비활성화(중복 전송 방지).
3. 성공(201/200): 더티 해제, `chainId`(신규)·`baseSnapshotId`(새 스냅샷 ID) 갱신, 내 목록·최신 스냅샷 쿼리 캐시 무효화, 완료 피드백 후 뷰 페이지(`/valuechains/[chainId]`) 이동.
4. 실패 분기:
   - `422` 계열(상한/노드/엣지/그룹/참조 오류): `error.details`의 `clientNodeId/clientEdgeId/clientGroupId`로 **캔버스 오류 하이라이트** + 사유 표시. 편집 상태 유지.
   - `409 DUPLICATE_NAME`: 이름 필드 오류 표시, 이름 변경 유도.
   - `409 SAVE_CONFLICT`(낙관적 잠금 실패, E7): "다른 곳에서 먼저 저장됨" 다이얼로그 → 최신 재로드(편집 내용 폐기 경고) 또는 계속 편집 선택.
   - `401`: 재로그인 유도, **편집 상태는 클라이언트에 보존**(E9).
   - 네트워크/`500`: 재시도 유도, 편집 상태 유지(E8).

### 2.10 페이지 이탈

- 더티 상태에서 브라우저 이탈(beforeunload)·라우터 이동 시 미저장 경고 다이얼로그 → 확인 시 편집 상태 폐기, 취소 시 잔류. 더티가 아니면 경고 없음.

---

## 3. 데이터베이스 사용 (서버 API 경유 — FE 직접 접근 없음)

편집 조작 자체는 **DB 쓰기를 발생시키지 않는다**. 본 페이지가 트리거하는 DB 연산:

| 시점 | API | 테이블 | 연산 |
|---|---|---|---|
| 진입(create) | `GET /api/valuechains/mine`(목록, 소유 수 포함 — D-2) | `value_chains` | SELECT(카운트) |
| 진입(edit) | `GET /api/valuechains/{chainId}/snapshots/latest` | `value_chains`, `chain_snapshots`, `snapshot_nodes`, `snapshot_edges`, `snapshot_groups` | SELECT(최신 스냅샷 구성) |
| 진입(공통) | `GET /api/relation-types` | `relation_types` | SELECT(전체 — 비활성 포함) |
| 종목 검색 | `GET /api/securities/search` | `securities` | SELECT(트라이그램 부분 일치, 20건) |
| 저장 | `POST /api/valuechains` / `PUT /api/valuechains/:chainId` | `value_chains` INSERT/UPDATE + `chain_snapshots`·`snapshot_groups`·`snapshot_nodes`·`snapshot_edges` INSERT | 단일 Postgres 함수(RPC) 트랜잭션 — 저장 1회 = 스냅샷 1건 |

- 서버 캐시(위 SELECT 결과)는 TanStack Query가 관리한다. **reducer 상태에 중복 보관하지 않는다** — 단, 최신 스냅샷은 "편집의 출발점"으로 1회 변환되어 편집 상태의 초기값이 된다(이후 서버 캐시와 독립적으로 변형됨).

---

## 4. 관리 상태 vs 파생 데이터 분리

### 4.1 관리 상태 (클라이언트 — Context + useReducer)

파생 불가능하고, 사용자 행동의 누적 결과로만 결정되는 값만 상태로 둔다.

| # | 상태 | 타입(개요) | 왜 상태인가 |
|---|---|---|---|
| S1 | `initialized` | boolean | 초기 로드 완료 전 편집 액션 차단 게이트 |
| S2 | `chainId` | string \| null | create 모드는 신규 저장 성공 시점에 채워짐(서버 응답의 결과이지만 이후 저장 방식·라우팅을 결정하는 문서 정체성) |
| S3 | `baseSnapshotId` | string \| null | 낙관적 잠금 기준. 편집 시작 시 로드값 → 저장 성공 시 새 스냅샷 ID로 갱신 |
| S4 | `name` | string | 사용자 입력 |
| S5 | `focusType` | 'industry' \| 'company' | 사용자 선택 |
| S6 | `focusSecurity` | SecurityRef \| null | 사용자 선택(표시용 티커/이름/시장 포함) |
| S7 | `nodes` | Record<clientNodeId, EditorNode> | 그래프 핵심 — 종류/종목 연결/자유 주체 필드/그룹 소속/좌표 |
| S8 | `edges` | Record<clientEdgeId, EditorEdge> | 그래프 핵심 — 출발/도착 노드·관계 종류 참조 |
| S9 | `groups` | Record<clientGroupId, EditorGroup> | 그룹 이름(소속은 노드 쪽 `groupClientId`가 단일 소스 — 중복 보관 금지) |
| S10 | `selection` | { nodeIds: string[]; edgeIds: string[] } | 다중 선택 — 그룹 생성/일괄 삭제 전제 |
| S11 | `isDirty` | boolean | "마지막 저장/초기화 이후 편집 발생 여부"는 액션 이력에 의존 — 현재 상태만으로 파생 불가 |
| S12 | `serverIssues` | ServerIssue[] | 저장 422 응답의 오류 위치(클라이언트 하이라이트용). 편집 재개 시 초기화 |

### 4.2 서버 상태 (TanStack Query 캐시 — reducer에 두지 않음)

| 데이터 | 쿼리/뮤테이션 | 비고 |
|---|---|---|
| 관계 종류 마스터(전체) | `['relation-types']` | 활성 목록·라벨·방향성은 여기서 파생 |
| 편집 대상 최신 스냅샷 | `['valuechains', chainId, 'latest-snapshot']` | 초기화 1회 변환 후 편집 상태와 독립 |
| 종목 검색 결과 | `['securities','search', q, market, page]` | 검색 패널 전용 |
| 내 체인 목록(소유 수) | `['valuechains','mine']` | create 진입 시 체인 상한(50) 확인(D-2) |
| 저장 요청 상태 | save mutation (`isPending`/`error`) | 저장 버튼 비활성화·오류 분기 |

### 4.3 파생(Derived) 데이터 — 상태로 두지 않음

| 데이터 | 파생 원천 |
|---|---|
| 노드/엣지/그룹 수 | `nodes`/`edges`/`groups` 크기 |
| 잔여 노드 수·상한 도달·상한 근접(≥90) 여부 | `nodeCount` + 상수 |
| React Flow `Node[]`/`Edge[]` props(그룹 클러스터 포함) | 편집 상태 + 관계 종류 마스터 + `selection` 매핑 |
| 엣지 라벨·방향 화살표 | `relationTypeId` × 마스터의 `name`/`isDirected` |
| 선택 가능한 관계 종류 목록 | 마스터에서 `isActive=true` 필터 |
| 동일 종목 중복 여부(추가 검증) | `nodes` 스캔 |
| 그룹별 소속 노드 목록·빈 그룹 목록 | `nodes[].groupClientId` 역인덱스 |
| 그룹 이름 중복 알림 | `groups` 이름 비교 |
| `canSave`(이름 있음 ∧ 상한 이내 ∧ 초기화 완료 ∧ 저장 중 아님) | S1·S4·S7 + mutation `isPending` |
| 클라이언트 저장 차단 이슈 목록 | 편집 상태에 순수 검증 함수 적용 |
| 저장 페이로드(직렬화 DTO) | 저장 시점에 편집 상태에서 변환 |
| 오류 하이라이트 대상 요소 ID 집합 | `serverIssues` 매핑 |

### 4.4 화면에 보이지만 상태가 아닌 것

- 상한 상수 표기(100/50), 상한 근접 임계값(90) — `packages/domain/constants`.
- 관계 종류 라벨·시장 배지 — 서버 캐시 표시.
- 미저장 경고 다이얼로그 노출 여부 — `isDirty` + 이탈 이벤트로 즉석 판정(휘발).
- 노드 삭제 확인 다이얼로그·그룹 이름 입력·자유 주체 폼·검색어/시장 필터 — 각 패널의 **로컬 컴포넌트 상태**(문서 상태 아님, 확정 시에만 액션 디스패치).
- 드래그 중간 좌표·줌/팬 뷰포트 — React Flow 내부 시각 상태(영속 대상은 최종 좌표만).

---

## 5. 상태 전환 테이블

| 상태 | 변경 조건(트리거) | 변경 내용 | UI 반영 |
|---|---|---|---|
| `initialized` | 초기 로드 성공(edit: 스냅샷+마스터 로드 / create: 즉시) | false → true | 스켈레톤 → 편집 캔버스 표시 |
| `name` | 이름 입력 | 입력값 반영 | 툴바/메타 패널 갱신, 공백이면 저장 버튼 비활성 + 필드 오류 |
| `focusType` | 기준 토글 | industry ↔ company (industry 전환 시 `focusSecurity`=null) | 대상 기업 검색 UI 노출/숨김 |
| `focusSecurity` | 검색 결과 선택 / 해제 | SecurityRef 설정/null | 메타 패널에 종목 칩 표시 |
| `nodes` | 상장기업 추가(검증 통과) | 노드 1건 추가 | 캔버스에 노드 렌더링, 노드 수 배지 갱신, ≥90이면 잔여 안내 |
| `nodes` | 자유 주체 추가(검증 통과) | 노드 1건 추가 | 동일(자유 주체 스타일) |
| `nodes` | 상한 도달/동일 종목 중복 추가 시도 | **변경 없음** | 차단 사유 토스트/패널 안내 |
| `nodes` | 노드 드래그 이동 | 해당 노드 `position` 갱신 | 캔버스 위치 이동 |
| `nodes`+`edges` | 노드 삭제 확정(연결 엣지 있으면 확인 후) | 노드 제거 + 연결 엣지 연쇄 제거 + 선택에서 제외 | 캔버스에서 노드·엣지 소멸, 빈 그룹은 라벨만 남음(D-5) |
| `edges` | 두 노드 연결 + 활성 관계 종류 선택(검증 통과) | 엣지 1건 추가 | 라벨·방향 화살표 렌더링 |
| `edges` | 자기 참조/중복 쌍 연결 시도 | **변경 없음** | 차단 사유 안내 |
| `edges` | 관계 종류 변경(검증 통과) | 해당 엣지 `relationTypeId` 갱신 | 라벨/방향 갱신 |
| `edges` | 엣지 삭제 | 해당 엣지 제거 | 캔버스에서 소멸 |
| `groups`+`nodes` | 그룹 생성(이름 검증 통과) | 그룹 추가 + 선택 노드 `groupClientId` 일괄 설정(타 그룹 소속은 자동 이동) | 클러스터 배경+라벨 렌더링, 이름 중복 시 알림 |
| `groups` | 그룹 이름 변경(검증 통과) | 이름 갱신 | 라벨 갱신 |
| `nodes` | 노드 그룹 이동/제외 | `groupClientId` 교체/null | 클러스터 재구성 |
| `groups`+`nodes` | 그룹 해제 | 그룹 제거 + 소속 노드 `groupClientId`=null | 클러스터 소멸, 노드 유지 |
| `selection` | 캔버스 선택 변경(클릭/박스/보조키) | nodeIds/edgeIds 교체 | 선택 하이라이트, 그룹 생성·삭제 버튼 활성화 |
| `isDirty` | 위의 모든 **문서 변형 액션**(메타/노드/엣지/그룹/좌표) | false → true | 이탈 경고 활성화, 저장 버튼 강조 |
| `isDirty` | 저장 성공 / 초기화(재로드) | true → false | 이탈 경고 해제 |
| `serverIssues` | 저장 422/409(DUPLICATE_NAME) 응답 | 오류 위치 목록 설정 | 해당 노드/엣지/그룹 하이라이트 + 사유 패널 |
| `serverIssues` | 이후 아무 문서 변형 액션 | [] 초기화 | 하이라이트 해제 |
| `chainId` | 신규 저장 성공(201) | null → 생성된 ID | 이후 저장은 PUT, 저장 완료 후 뷰 페이지 이동 |
| `baseSnapshotId` | 초기 로드 / 저장 성공 | 로드·응답 스냅샷 ID | (내부) 다음 저장의 낙관적 잠금 기준 |
| 저장 mutation `isPending` | 저장 요청 시작/종료 | idle ↔ pending | 저장 버튼 비활성 + 스피너, 완료 피드백 |

---

## 6. 검증 규칙 요약 (클라이언트 시점)

| 규칙 | 검증 시점 | 실패 처리 | 서버 최종 방어 |
|---|---|---|---|
| 노드 상한 100 | 노드 추가 시 + 저장 전 | 추가/저장 차단 + 안내 | 422 `NODE_LIMIT_EXCEEDED` |
| 동일 종목 노드 1개 | 상장기업 추가 시 | 추가 차단 | 422 `DUPLICATE_SECURITY_NODE` + DB 유니크 |
| 자유 주체 유형·이름 필수 | 자유 주체 추가 시 | 필드 오류 표기 | 422 `INVALID_NODE` |
| 엣지 자기 참조 금지 | 연결 시 + 저장 전 | 차단 | 422 `INVALID_EDGE` + DB CHECK |
| 동일 쌍+동일 종류 중복 금지(무향 정규화, D-6) | 연결/변경 시 + 저장 전 | 차단 | 422 `INVALID_EDGE` + DB 유니크 |
| 신규 엣지는 활성 관계 종류만 | 관계 종류 선택 UI(비활성 미노출) | 선택 불가 | 사용자 체인 저장은 존재만 검증(UC-018 BR-8) — 활성 강제는 FE 책임. 단, 어드민 공식 체인 저장(UC-021)은 서버도 신규 엣지의 비활성 종류를 422로 차단(직전 스냅샷 대조, UC-016 BR-4) — 클라이언트 동작은 두 variant 동일 |
| 그룹 이름 필수 | 그룹 생성/이름 변경 시 + 저장 전 | 차단 | 422 `INVALID_GROUP` |
| 체인 이름 필수 | 저장 전 | 저장 차단 | 400 `INVALID_REQUEST` |
| 이름 중복(동일 사용자 내) | 검증 안 함(서버 전용) | — | 409 `DUPLICATE_NAME` |
| 체인 상한 50(신규) | create 진입 시 안내용 확인(D-2) | 진입 차단 안내 | 422 `CHAIN_LIMIT_EXCEEDED`(최종) |
| 저장 충돌 | 검증 안 함(서버 전용) | — | 409 `SAVE_CONFLICT` → 재로드 유도 |

---

## 7. 비범위 (Non-Goals)

- 실행 취소/다시 실행(undo/redo), 편집 초안 자동 저장, 실시간 협업 — MVP 제외.
- 뷰 페이지 표시용 위치 조정 저장(UC-018 BR-9), 그룹 중첩(PRD Non-Goals).
