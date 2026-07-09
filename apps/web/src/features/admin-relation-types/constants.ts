import { RELATION_TYPE_NAME_MAX_LENGTH } from "@iib/domain";
import type { BadgeTone } from "@/components/ui";

/** 방향성 배지 라벨(spec Main-2). */
export const DIRECTION_LABELS = {
  directed: "유향",
  undirected: "무향",
} as const;

/** 활성 상태 배지 라벨. */
export const ACTIVE_STATE_LABELS = {
  active: "활성",
  inactive: "비활성",
} as const;

/** 사용 여부 배지 라벨(isInUse — 비활성화 영향 사전 인지, spec Main-2). */
export const IN_USE_BADGE_LABEL = "사용 중";

/** 활성 상태 배지 톤 맵(디자인 시스템 Badge tone). */
export const ACTIVE_STATE_BADGE_TONES: Record<"active" | "inactive", BadgeTone> = {
  active: "success",
  inactive: "neutral",
};

export const IN_USE_BADGE_TONE: BadgeTone = "accent";

/** 행 액션 버튼 라벨. */
export const ROW_ACTION_LABELS = {
  rename: "이름 변경",
  deactivate: "비활성화",
  reactivate: "재활성화",
} as const;

/** 페이지 헤더/버튼 문구. */
export const PAGE_TITLE = "관계 종류 마스터 관리";
export const ADD_BUTTON_LABEL = "관계 종류 추가";

/** 목록 로딩/오류/빈 상태 문구. */
export const LIST_LOADING_MESSAGE = "로딩 중...";
export const LIST_LOAD_ERROR_MESSAGE = "관계 종류 목록을 불러오지 못했습니다.";
export const LIST_RETRY_BUTTON_LABEL = "다시 시도";
export const EMPTY_LIST_MESSAGE = "등록된 관계 종류가 없습니다.";

/** 폼 다이얼로그 문구(M12). */
export const FORM_DIALOG_TITLES = {
  create: "관계 종류 추가",
  rename: "이름 변경",
} as const;

export const NAME_FIELD_LABEL = "이름";
export const NAME_FIELD_PLACEHOLDER = "예: 공급, 고객, 경쟁";
export const DIRECTION_FIELD_LABEL = "방향성";
export const DIRECTION_FIELD_HELP_TEXT = "방향성은 생성 후 변경할 수 없습니다.";

export const FIELD_ERROR_MESSAGES = {
  nameRequired: "이름을 입력해 주세요.",
  nameTooLong: `이름은 최대 ${RELATION_TYPE_NAME_MAX_LENGTH}자까지 입력할 수 있습니다.`,
  nameDuplicate: "이미 존재하는 이름입니다.",
} as const;

export const SUBMIT_BUTTON_LABELS = {
  create: "추가",
  rename: "저장",
} as const;

export const CANCEL_BUTTON_LABEL = "취소";

/** 비활성화 확인 다이얼로그 문구(M13). */
export const DEACTIVATE_DIALOG_TITLE = "관계 종류 비활성화";
export const DEACTIVATE_COMMON_NOTICE =
  "비활성화하면 편집 화면의 신규 선택 목록에서 제외됩니다. 언제든 재활성화할 수 있습니다.";
export const DEACTIVATE_IN_USE_NOTICE =
  "이 종류를 사용하는 기존 관계와 과거 스냅샷은 그대로 유지·표시되며, 신규 선택만 차단됩니다.";
export const DEACTIVATE_CONFIRM_BUTTON_LABEL = "비활성화";

/** 토스트 문구(M10/M14). */
export const TOAST_MESSAGES = {
  createSuccess: "관계 종류를 추가했습니다.",
  renameSuccess: "이름을 변경했습니다.",
  deactivateSuccess: "비활성화했습니다.",
  reactivateSuccess: "재활성화했습니다.",
  notFoundRetry: "이미 변경된 항목입니다. 목록을 새로고침합니다.",
  retryGuidance: "일시적인 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.",
} as const;
