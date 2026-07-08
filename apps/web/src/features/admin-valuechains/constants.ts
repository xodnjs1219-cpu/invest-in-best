/**
 * admin-valuechains UI 문구 상수(UC-021 plan 모듈 M17) — 하드코딩 금지 규칙 이행.
 */

export const FOCUS_TYPE_LABELS = {
  industry: "산업 중심",
  company: "기업 중심",
} as const;

export const CHANGE_SOURCE_LABELS = {
  user_save: "사용자 저장",
  admin_edit: "관리자 편집",
  llm_approval: "LLM 승인 반영",
} as const;

export const ADMIN_CHAIN_LIST_TEXT = {
  pageTitle: "공식 밸류체인 관리",
  createCta: "새 공식 체인 만들기",
  emptyStateTitle: "공식 체인이 없습니다",
  emptyStateDescription: "새 공식 체인을 만들어 시작하세요.",
  archivedBadge: "보관됨",
  editAction: "편집",
  archiveAction: "보관",
  loadErrorTitle: "목록을 불러오지 못했습니다",
  retryAction: "다시 시도",
} as const;

export const ARCHIVE_DIALOG_TEXT = {
  title: "공식 체인 보관",
  description: "보관하면 공개 목록에서 제외됩니다. 기존 스냅샷·사용자 복제본에는 영향이 없습니다.",
  confirmLabel: "보관",
  cancelLabel: "취소",
} as const;

export const ARCHIVE_TOAST_TEXT = {
  success: "체인을 보관했습니다.",
  failure: "보관 처리 중 오류가 발생했습니다. 다시 시도해 주세요.",
} as const;
