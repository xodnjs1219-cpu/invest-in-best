/**
 * LLM 공시 분석 배치(analyze-disclosures) 상수 (docs/usecases/030/plan.md 모듈 1).
 * 프레임워크·DB 의존 없는 순수 상수 — 하드코딩 금지 원칙의 단일 진입점(BR-8).
 * 재시도 횟수·기본 지연은 constants/batch.ts의 BATCH_MAX_RETRY/BATCH_RETRY_BASE_DELAY_MS를 재사용한다(DRY).
 */

/**
 * 일일 분석 상한 — LLM 호출(공시×체인) 횟수 기준(H-4, R-4). 비용 제어(BR-8).
 * 운영 조정은 이 상수만 변경한다.
 */
export const ANALYZE_DISCLOSURES_DAILY_LLM_CALL_LIMIT = 200;

/** 공시 원문 발췌 절단 길이(R-3) — 토큰 비용 제어. DB에는 영속하지 않는다. */
export const DISCLOSURE_CONTENT_MAX_CHARS = 20_000;

/** LLM 호출 타임아웃(ms) — 생성형 응답 지연을 감안해 WORKER_HTTP_TIMEOUT_MS와 별도 관리. */
export const LLM_REQUEST_TIMEOUT_MS = 60_000;

/** 연속 실패 임계(R-13) — 전면 장애 조기 중단(무의미한 재시도 비용 방지). */
export const LLM_CONSECUTIVE_FAILURE_ABORT_THRESHOLD = 5;

/** rationale 적재 상한(비정상 장문 방어). */
export const LLM_RATIONALE_MAX_LENGTH = 2_000;
