/**
 * 밸류체인 뷰 마인드맵 표시 라벨 상수 (UC-009 plan 모듈 A8).
 * DB enum(`subject_type`, `listing_status`) 리터럴과 반드시 일치해야 한다(0006/0003 마이그레이션).
 */

/** 자유 주체 유형 표시 라벨. */
export const SUBJECT_TYPE_LABELS = {
  consumer: "소비자",
  government: "정부/기관",
  private_company: "비상장기업",
  other: "기타",
} as const;

/** 상장 상태 표시 라벨 — `listed`는 배지 없음(정상 상태)이라 노드 컴포넌트에서 별도 분기한다. */
export const LISTING_STATUS_LABELS = {
  listed: "상장",
  suspended: "거래정지",
  delisted: "상장폐지",
} as const;
