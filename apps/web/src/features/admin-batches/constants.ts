import type { BatchJobType, BatchRunStatus } from "@iib/domain";
import { BATCH_RUNS_DEFAULT_LOOKBACK_DAYS } from "@iib/domain";

/** M1(BATCH_JOB_TYPES) 전체를 커버 — 누락 시 타입 에러(하드코딩 금지 규칙 이행). */
export const BATCH_JOB_TYPE_LABELS: Record<BatchJobType, string> = {
  collect_quotes: "시세 수집",
  collect_financials: "재무·공시 수집",
  collect_fx_market_hours: "환율·장운영 수집",
  aggregate_daily_metrics: "일별 지표 집계",
  analyze_disclosures: "공시 LLM 분석",
  backfill_all: "전 종목 백필",
};

export const BATCH_RUN_STATUS_LABELS: Record<BatchRunStatus, string> = {
  running: "진행 중",
  success: "성공",
  partial_success: "부분 성공",
  failed: "실패",
};

/** 상태 배지 색상 variant 맵(Tailwind 클래스) — 컴포넌트 하드코딩 금지. */
export const BATCH_RUN_STATUS_BADGE_CLASSES: Record<BatchRunStatus, string> = {
  running: "bg-blue-100 text-blue-800",
  success: "bg-green-100 text-green-800",
  partial_success: "bg-yellow-100 text-yellow-800",
  failed: "bg-red-100 text-red-800",
};

/** 이월 배지(E4) 문구·툴팁. */
export const CARRIED_OVER_BADGE_LABEL = "이월";
export const CARRIED_OVER_TOOLTIP = "API 일일 한도 초과로 다음 실행에서 잔여분이 처리됩니다.";

/** 목록/상세 빈 상태·오류·안내 문구(E1·E8·E11·E12·BR-7). */
export const EMPTY_RUNS_MESSAGE = "실행 이력이 없습니다.";
export const RUNS_LOAD_ERROR_MESSAGE = "실행 이력을 불러오지 못했습니다.";
export const RUNS_RETRY_BUTTON_LABEL = "다시 시도";
export const DEFAULT_LOOKBACK_NOTICE = `기간 미지정 시 최근 ${BATCH_RUNS_DEFAULT_LOOKBACK_DAYS}일 실행 이력을 표시합니다.`;
export const RUN_NOT_FOUND_MESSAGE = "해당 실행 이력을 찾을 수 없습니다. 목록으로 돌아갑니다.";
export const RUN_NOT_FOUND_BACK_BUTTON_LABEL = "목록으로 돌아가기";
export const NO_ERROR_LOG_MESSAGE = "요약 로그가 없습니다.";
export const NO_FAILURES_MESSAGE = "실패 항목이 없습니다.";
export const FAILURES_LOAD_ERROR_MESSAGE = "실패 목록을 불러오지 못했습니다.";
export const RESOLVED_BADGE_LABEL = "해소됨";
export const UNRESOLVED_BADGE_LABEL = "미해소";
export const BACKFILL_NOT_STARTED_LABEL = "미실행";
export const BACKFILL_COMPLETED_LABEL = "완료";
export const BACKFILL_LOAD_ERROR_MESSAGE = "백필 진행 현황을 불러오지 못했습니다.";
export const BACKFILL_NO_RUN_HISTORY_MESSAGE = "실행 이력 없음";
export const FILTER_RESET_BUTTON_LABEL = "필터 초기화";
export const NON_SECURITY_FAILURE_PLACEHOLDER = "—";

/** 필터 바 "전체" 옵션 라벨(jobType/status 공용). */
export const FILTER_ALL_OPTION_LABEL = "전체";
