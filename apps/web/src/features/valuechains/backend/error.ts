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
} as const;

export type ValuechainsServiceError =
  (typeof valuechainsErrorCodes)[keyof typeof valuechainsErrorCodes];
