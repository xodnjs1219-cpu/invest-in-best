/**
 * UC-019 사용자 체인 삭제 — 사용자 노출 문구 상수 (하드코딩 금지 원칙).
 */

export const DELETE_BUTTON_LABEL = "삭제";
export const DELETE_PENDING_LABEL = "삭제 중...";
export const DELETE_CONFIRM_TITLE = "밸류체인 삭제";
export const DELETE_CONFIRM_ACTION_LABEL = "삭제";
export const DELETE_CANCEL_LABEL = "취소";
export const DELETE_SUCCESS_MESSAGE = "밸류체인을 삭제했습니다.";

/** 확인 다이얼로그 안내 문구 — 되돌릴 수 없음 + 종속 데이터 삭제 안내(spec Main 2). */
export const buildDeleteConfirmDescription = (chainName: string): string =>
  `"${chainName}"을(를) 삭제하면 되돌릴 수 없으며, 체인의 모든 구성(노드/관계/그룹)과 스냅샷 이력·지표 집계가 함께 삭제됩니다.`;

const DELETE_DEFAULT_ERROR_MESSAGE = "삭제에 실패했습니다. 잠시 후 다시 시도해 주세요.";

/** 에러 코드별 사용자 안내 문구 (spec §6.2 에러 코드 표 기준). */
export const DELETE_ERROR_MESSAGES: Record<string, string> = {
  UNAUTHORIZED: "로그인이 필요합니다.",
  CHAIN_FORBIDDEN: "체인을 삭제할 권한이 없습니다.",
  OFFICIAL_CHAIN_DELETE_FORBIDDEN: "공식 체인은 삭제할 수 없습니다. 관리자 보관 처리를 이용해 주세요.",
  VALIDATION_ERROR: "잘못된 요청입니다.",
  INTERNAL_ERROR: DELETE_DEFAULT_ERROR_MESSAGE,
};

export const getDeleteErrorMessage = (code: string): string =>
  DELETE_ERROR_MESSAGES[code] ?? DELETE_DEFAULT_ERROR_MESSAGE;
