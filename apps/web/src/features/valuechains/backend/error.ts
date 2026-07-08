/**
 * valuechains 기능 에러 코드 (spec BR-6 + 결정 C-2).
 * C-2: 사용자 체인에 대한 비로그인/비소유자 접근은 401(AUTH_REQUIRED)/403(CHAIN_ACCESS_DENIED) 대신
 * 404(CHAIN_NOT_FOUND)로 통일한다(체인 존재 자체 비노출) — 따라서 이 두 코드는 정의하지 않는다.
 * UC-010~012의 추가 코드(SNAPSHOT_NOT_FOUND 등)는 이 객체에 추가한다.
 */
export const valuechainsErrorCodes = {
  invalidChainId: "INVALID_CHAIN_ID", // 400 (E12)
  chainNotFound: "CHAIN_NOT_FOUND", // 404 (E1 + C-2)
  snapshotMissing: "SNAPSHOT_MISSING", // 500 (E9 정합성 예외)
  structureLoadFailed: "STRUCTURE_LOAD_FAILED", // 500 (E8 DB 오류/스키마 검증 실패)

  // ── UC-010: 대시보드 지표 조회 ──
  invalidRequest: "INVALID_REQUEST", // 400 (파라미터 검증 실패, E11)
  metricsFetchError: "METRICS_FETCH_ERROR", // 500 (DB 조회 실패, E13)
  metricsValidationError: "METRICS_VALIDATION_ERROR", // 500 (Row/Response 스키마 검증 실패, E13)

  // ── UC-011: 노드 상세 조회 ──
  invalidParams: "INVALID_PARAMS", // 400 (chainId/nodeId UUID 형식 오류)
  nodeNotFound: "NODE_NOT_FOUND", // 404 (노드 미존재/타 체인 소속, E7)
  internalError: "INTERNAL_ERROR", // 500 (DB 조회 실패/응답 검증 실패)

  // ── UC-012: 타임라인 조회/스냅샷 복원 ──
  invalidDate: "INVALID_DATE", // 400 (date가 YYYY-MM-DD 형식이 아님)
  dateOutOfRange: "DATE_OUT_OF_RANGE", // 400 (최소 시작 시점 이전 또는 미래)
  snapshotNotFound: "SNAPSHOT_NOT_FOUND", // 404 (첫 스냅샷 이전 날짜)
  timelineQueryFailed: "TIMELINE_QUERY_FAILED", // 500 (조회 처리 중 서버/DB 오류)

  // ── UC-016: 편집 대상 체인 최신 구성 조회(`GET /valuechains/:chainId/snapshots/latest`) ──
  editUnauthorized: "EDIT_UNAUTHORIZED", // 401 — 미로그인(E9)
  editChainForbidden: "EDIT_CHAIN_FORBIDDEN", // 403 — 공식 체인 + 비Admin(R-2)
  editSnapshotNotFound: "EDIT_SNAPSHOT_NOT_FOUND", // 404 — 스냅샷 0건(정합 위반 방어)
  editFetchFailed: "EDIT_FETCH_FAILED", // 500
  editValidationError: "EDIT_VALIDATION_ERROR", // 500

  // ── UC-016: 저장 시 엣지 검증(R-4 매핑 — 저장 service(UC-018/021)가 세분/통합 코드로 사용) ──
  // 사용자 체인 저장(UC-018) 통합 코드: 세분 사유는 error.details.reason에 포함.
  invalidEdge: "VALUECHAINS.INVALID_EDGE",
  invalidRelationType: "VALUECHAINS.INVALID_RELATION_TYPE",
  // 공식 체인 저장(UC-021) 세분 코드.
  edgeSelfReference: "VALUECHAINS.EDGE_SELF_REFERENCE",
  edgeDuplicateRelation: "VALUECHAINS.EDGE_DUPLICATE_RELATION",
  edgeNodeRefInvalid: "VALUECHAINS.EDGE_NODE_REF_INVALID",
  relationTypeNotFound: "VALUECHAINS.RELATION_TYPE_NOT_FOUND",
  relationTypeInactiveForNewEdge: "VALUECHAINS.RELATION_TYPE_INACTIVE_FOR_NEW_EDGE",

  // ── UC-014: 공식 체인 복제(`POST /valuechains/:chainId/clone`) ──
  // UC-019 삭제(E6)도 동일 코드를 재사용한다(spec 양쪽 모두 정확히 "UNAUTHORIZED" 요구).
  unauthorized: "UNAUTHORIZED", // 401 (미로그인/세션 만료)
  sourceChainNotFound: "SOURCE_CHAIN_NOT_FOUND", // 404 (원본 부재/보관)
  chainLimitExceeded: "CHAIN_LIMIT_EXCEEDED", // 409 (1인당 체인 상한 도달)
  invalidCloneSource: "INVALID_CLONE_SOURCE", // 422 (원본이 공식 체인 아님/노드 상한 초과 비정상 데이터)
  sourceSnapshotMissing: "SOURCE_SNAPSHOT_MISSING", // 422 (원본에 스냅샷 없음)
  cloneFailed: "CLONE_FAILED", // 500 (복제 트랜잭션 실패)

  // ── UC-019: 사용자 체인 삭제(`DELETE /valuechains/:chainId`) ──
  validationError: "VALIDATION_ERROR", // 400 (chainId UUID 형식 오류, E9)
  chainForbidden: "CHAIN_FORBIDDEN", // 403 (비소유자 삭제 시도, E1)
  officialChainDeleteForbidden: "OFFICIAL_CHAIN_DELETE_FORBIDDEN", // 403 (공식 체인 삭제 시도, E2)

  // ── UC-018: 밸류체인 저장(`POST/PUT /valuechains`, spec §6.2 공통 에러 코드) ──
  saveInvalidRequest: "VALUECHAINS.INVALID_REQUEST", // 400 (본문 스키마 위반/모드 검증 실패)
  saveAuthRequired: "AUTH_REQUIRED", // 401 (세션 없음/만료, E9)
  saveForbidden: "VALUECHAINS.FORBIDDEN", // 403 (비소유자 갱신/공식 체인 대상, E10)
  saveNotFound: "VALUECHAINS.NOT_FOUND", // 404 (갱신 대상 체인 없음/삭제됨, E11)
  saveDuplicateName: "VALUECHAINS.DUPLICATE_NAME", // 409 (동일 사용자 내 이름 중복, E4)
  saveConflict: "VALUECHAINS.SAVE_CONFLICT", // 409 (baseSnapshotId 불일치, E7)
  saveChainLimitExceeded: "VALUECHAINS.CHAIN_LIMIT_EXCEEDED", // 422 (1인당 체인 상한, E2)
  saveNodeLimitExceeded: "VALUECHAINS.NODE_LIMIT_EXCEEDED", // 422 (노드 상한, E1)
  saveInvalidNode: "VALUECHAINS.INVALID_NODE", // 422 (kind-필드 조합 위반, E16)
  saveDuplicateSecurityNode: "VALUECHAINS.DUPLICATE_SECURITY_NODE", // 422 (동일 종목 중복, E17)
  saveSecurityNotFound: "VALUECHAINS.SECURITY_NOT_FOUND", // 422 (존재하지 않는 securityId, E12)
  saveInvalidGroup: "VALUECHAINS.INVALID_GROUP", // 422 (그룹 이름/참조 위반 통합 코드, E6)
  saveFailed: "VALUECHAINS.SAVE_FAILED", // 500 (저장 트랜잭션 실패, E15)

  // ── UC-021: 공식 밸류체인 저장(POST/PUT /valuechains official 분기, spec §6.2) ──
  adminRequired: "VALUECHAINS.ADMIN_REQUIRED", // 403 (비-Admin의 공식 저장, E1)
  officialNameDuplicate: "VALUECHAINS.OFFICIAL_NAME_DUPLICATE", // 409 (공식 체인 이름 전역 유일 위반, E9)
  chainArchived: "VALUECHAINS.CHAIN_ARCHIVED", // 409 (보관된 체인 수정 저장, E10)
  officialGroupNameRequired: "VALUECHAINS.GROUP_NAME_REQUIRED", // 422 (세분 코드 — official)
  officialGroupRefInvalid: "VALUECHAINS.GROUP_REF_INVALID", // 422 (세분 코드 — official, E11)
  notImplemented: "VALUECHAINS.NOT_IMPLEMENTED", // 501 (미구현 분기 임시 stub)
} as const;

export type ValuechainsServiceError =
  (typeof valuechainsErrorCodes)[keyof typeof valuechainsErrorCodes];

/**
 * UC-007 메인/탐색 페이지 체인 카드 목록 에러 코드 (spec §Error Codes 그대로).
 */
export const valuechainListErrorCodes = {
  invalidQuery: "VALUECHAIN_LIST_INVALID_QUERY", // 400
  unauthorized: "VALUECHAIN_LIST_UNAUTHORIZED", // 401 (mine 전용)
  fetchFailed: "VALUECHAIN_LIST_FETCH_FAILED", // 500
  validationError: "VALUECHAIN_LIST_VALIDATION_ERROR", // 500
} as const;

export type ValuechainListServiceError =
  (typeof valuechainListErrorCodes)[keyof typeof valuechainListErrorCodes];
