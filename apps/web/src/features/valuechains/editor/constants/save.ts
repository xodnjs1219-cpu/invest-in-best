/**
 * 저장 UI 문구 상수(UC-018 plan 모듈 24) — 오류 코드→사용자 문구·버튼 라벨·충돌 안내 상수.
 * 하드코딩 금지 규칙 이행 — 컴포넌트/훅에 직접 문자열을 두지 않는다.
 */

import type { SaveOutcome } from "@/features/valuechains/editor/context/ChainEditorContext";

/** save() 반환 status → 저장 버튼 클릭 후 토스트 문구(성공/충돌은 별도 UI가 처리하므로 null). */
export const SAVE_OUTCOME_TOAST_MESSAGES: Record<SaveOutcome["status"], string | null> = {
  saved: null,
  blocked_client: "저장할 수 없습니다 — 표시된 항목을 확인하세요.",
  rejected_server: "저장할 수 없습니다 — 표시된 항목을 확인하세요.",
  conflict: null,
  auth_required: "세션이 만료되었습니다. 다시 로그인해 주세요. (편집 내용은 유지됩니다)",
  network_error: "일시적 오류가 발생했습니다. 다시 시도해 주세요.",
};

export const SAVE_CONFLICT_DIALOG_TEXT = {
  title: "저장 충돌",
  description:
    "다른 곳에서 이 체인이 먼저 저장되었습니다. 최신 상태를 불러오면 현재 편집 내용은 사라집니다.",
  reloadLabel: "최신 상태 불러오기",
  keepEditingLabel: "계속 편집",
} as const;

export const SAVE_BUTTON_LABEL = "저장" as const;
export const SAVE_BUTTON_SAVING_LABEL = "저장 중..." as const;
export const SAVE_BUTTON_DISABLED_TITLE = "저장은 이름 입력 후 가능합니다" as const;
