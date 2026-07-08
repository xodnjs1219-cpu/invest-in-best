/**
 * account(회원 탈퇴, UC-006) 기능 UI 문구·정책 상수 — 하드코딩 금지 규칙 이행.
 */

/** A-14 확정안 — 확인 문구 입력 방식(이메일/소셜 공통, 재인증 비밀번호 없음). */
export const WITHDRAW_CONFIRM_PHRASE = "회원 탈퇴";

export const WITHDRAW_NOTICE_ITEMS = [
  "내가 만든 밸류체인과 모든 데이터가 즉시 삭제되며 복구할 수 없습니다.",
  "모든 기기에서 로그아웃됩니다.",
  "동일 이메일로 즉시 재가입할 수 있습니다.",
] as const;

export const WITHDRAW_REDIRECT_PATH = "/";

export const ACCOUNT_MESSAGES = {
  noticeTitle: "회원 탈퇴",
  cancelLabel: "취소",
  continueLabel: "계속",
  confirmDialogTitle: "탈퇴를 확정하시겠습니까?",
  confirmInputLabel: `확인을 위해 "${WITHDRAW_CONFIRM_PHRASE}"를 입력해 주세요.`,
  confirmSubmitLabel: "영구 삭제",
  confirmSubmittingLabel: "처리 중...",
  closeLabel: "닫기",

  soleAdminBlocked: "다른 관리자를 지정한 후에만 탈퇴할 수 있습니다.",
  temporaryError: "일시적인 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.",

  menuLinkLabel: "회원 탈퇴",
} as const;
