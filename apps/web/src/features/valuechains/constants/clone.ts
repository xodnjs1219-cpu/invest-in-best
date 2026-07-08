/**
 * UC-014 공식 체인 복제 — 사용자 노출 문구 상수 (하드코딩 금지 원칙).
 * 버튼 라벨과 에러 코드별 안내 문구를 한곳에서 관리한다.
 */

export const CLONE_BUTTON_LABEL = "복제";
export const CLONE_PENDING_LABEL = "복제 중...";
export const CLONE_SUCCESS_MESSAGE = "체인을 복제했습니다. 편집 화면으로 이동합니다.";

/** 기본(미정의 코드) 실패 안내 — 재시도 유도(spec Edge 8). */
const CLONE_DEFAULT_ERROR_MESSAGE = "복제에 실패했습니다. 잠시 후 다시 시도해 주세요.";

/** 에러 코드별 사용자 안내 문구 (spec §6.2 에러 코드 표 기준). */
export const CLONE_ERROR_MESSAGES: Record<string, string> = {
  UNAUTHORIZED: "로그인이 필요합니다.",
  SOURCE_CHAIN_NOT_FOUND: "복제할 수 없는 체인입니다. 체인이 존재하지 않거나 보관되었습니다.",
  CHAIN_LIMIT_EXCEEDED: "밸류체인 보유 상한(50개)에 도달했습니다. 기존 체인을 삭제한 뒤 다시 시도해 주세요.",
  INVALID_CLONE_SOURCE: "공식 체인만 복제할 수 있습니다.",
  SOURCE_SNAPSHOT_MISSING: "복제할 수 없는 체인입니다. 잠시 후 다시 시도해 주세요.",
  CLONE_FAILED: CLONE_DEFAULT_ERROR_MESSAGE,
};

export const getCloneErrorMessage = (code: string): string =>
  CLONE_ERROR_MESSAGES[code] ?? CLONE_DEFAULT_ERROR_MESSAGE;
