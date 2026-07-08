-- 0016_admin_batch_runs_summary_view.sql
-- 어드민 배치 모니터링 목록 조회(UC-023) 전용 요약 뷰.
-- error_log 본문 컬럼은 제외하고 존재 여부 플래그(has_error_log)만 계산 컬럼으로 노출한다(BR-6·E3).
-- 목록 경로로는 본문이 DB 밖으로 나갈 수 없도록 구조적으로 보장(상세 조회는 API-2가 batch_runs를 직접 조회).
-- 테이블/컬럼/인덱스 변경 없음 — 0012가 이미 최종. idx_batch_runs_job_started가 이 뷰의 정렬/필터를 그대로 지원한다.

CREATE OR REPLACE VIEW batch_runs_summary AS
SELECT
  id,
  job_type,
  status,
  started_at,
  finished_at,
  processed_count,
  failed_count,
  is_carried_over,
  target_market,
  (error_log IS NOT NULL) AS has_error_log,
  created_at
FROM batch_runs;

COMMENT ON VIEW batch_runs_summary IS
  '어드민 배치 모니터링(023) 목록 조회 전용 뷰. error_log 본문은 제외하고 has_error_log 플래그만 노출한다(BR-6).';
