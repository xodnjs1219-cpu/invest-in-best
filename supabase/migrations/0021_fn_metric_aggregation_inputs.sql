-- 0021_fn_metric_aggregation_inputs.sql
-- 일별 체인 지표 사전 집계 배치(UC-029, aggregate-daily-metrics)의 집계 입력 조회 RPC.
-- 테이블 변경 없음 — DISTINCT ON 패턴을 supabase-js가 표현할 수 없어 함수로 캡슐화(techstack.md §7).
-- 0007(daily_quotes)·0008(shares_outstanding) 선행 가정. 멱등(CREATE OR REPLACE), STABLE, search_path 고정.

-- 종목별 지정일 이전(미포함) 마지막 확정 종가 — carry-forward 시드(database.md §4.5).
CREATE OR REPLACE FUNCTION fn_latest_daily_closes_before(
  p_security_ids uuid[],
  p_before date
)
RETURNS TABLE (
  security_id uuid,
  trade_date  date,
  close_price numeric
)
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT DISTINCT ON (dq.security_id)
    dq.security_id,
    dq.trade_date,
    dq.close_price
  FROM daily_quotes dq
  WHERE dq.security_id = ANY(p_security_ids)
    AND dq.trade_date < p_before
    AND dq.close_price IS NOT NULL
  ORDER BY dq.security_id, dq.trade_date DESC;
$$;

COMMENT ON FUNCTION fn_latest_daily_closes_before(uuid[], date) IS
  'UC-029 집계 입력: 종목별 p_before(미포함) 이전 마지막 확정 종가 1건(carry-forward 시드). 관측 없는 종목은 결과에 나타나지 않는다.';

-- 종목별 최신 상장주식수(0008 §3.5 소스 우선순위 tie-break: toss > dart > sec).
CREATE OR REPLACE FUNCTION fn_latest_shares_outstanding(
  p_security_ids uuid[]
)
RETURNS TABLE (
  security_id uuid,
  shares      numeric,
  as_of_date  date,
  source      data_source
)
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT DISTINCT ON (so.security_id)
    so.security_id,
    so.shares,
    so.as_of_date,
    so.source
  FROM shares_outstanding so
  WHERE so.security_id = ANY(p_security_ids)
  ORDER BY
    so.security_id,
    so.as_of_date DESC,
    CASE so.source WHEN 'toss' THEN 0 WHEN 'dart' THEN 1 ELSE 2 END;
$$;

COMMENT ON FUNCTION fn_latest_shares_outstanding(uuid[]) IS
  'UC-029 집계 입력: 종목별 최신 as_of_date 상장주식수 1건. 동일 as_of_date 복수 소스 시 toss>dart>sec 우선순위(SHARES_SOURCE_PRIORITY)로 tie-break.';
