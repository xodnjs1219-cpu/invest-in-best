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
