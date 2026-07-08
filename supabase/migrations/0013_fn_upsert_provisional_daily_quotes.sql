-- 0013_fn_upsert_provisional_daily_quotes.sql
-- 잠정 일별 집계 RPC (docs/usecases/026/plan.md 모듈 16, userflow 026 처리 10 — BR-5).
-- 당일 quote_ticks -> daily_quotes OHLCV 잠정값 단일 문 UPSERT. 신규 테이블·컬럼 없음(0007/0003 선행 가정).
-- 확정된 행(is_closing_confirmed=true)은 절대 잠정값으로 되돌리지 않는다(지연 실행 보호, E8).

CREATE OR REPLACE FUNCTION fn_upsert_provisional_daily_quotes(
  p_market market_code,
  p_trade_date date,
  p_from timestamptz,
  p_to timestamptz
)
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_affected integer;
BEGIN
  WITH aggregated AS (
    SELECT
      t.security_id,
      (array_agg(t.price ORDER BY t.observed_at ASC))[1]  AS open_price,
      max(t.price)                                         AS high_price,
      min(t.price)                                         AS low_price,
      (array_agg(t.price ORDER BY t.observed_at DESC))[1] AS close_price,
      -- volume은 누적 거래량이므로 합계가 아닌 최종 관측값(0007 컬럼 주석 준수).
      (array_agg(t.volume ORDER BY t.observed_at DESC))[1] AS volume
    FROM quote_ticks t
    JOIN securities s ON s.id = t.security_id AND s.market = p_market
    WHERE t.observed_at >= p_from AND t.observed_at < p_to
    GROUP BY t.security_id
  ), upserted AS (
    INSERT INTO daily_quotes (
      security_id, trade_date, open_price, high_price, low_price, close_price, volume,
      is_closing_confirmed, source
    )
    SELECT
      a.security_id, p_trade_date, a.open_price, a.high_price, a.low_price, a.close_price, a.volume,
      false, 'toss'
    FROM aggregated a
    ON CONFLICT (security_id, trade_date) DO UPDATE SET
      open_price  = EXCLUDED.open_price,
      high_price  = EXCLUDED.high_price,
      low_price   = EXCLUDED.low_price,
      close_price = EXCLUDED.close_price,
      volume      = EXCLUDED.volume,
      updated_at  = now()
    -- 확정된 행은 잠정값으로 절대 되돌리지 않는다(BR-5·E8, 지연 실행 보호).
    WHERE daily_quotes.is_closing_confirmed = false
    RETURNING 1
  )
  SELECT count(*) INTO v_affected FROM upserted;

  RETURN v_affected;
END;
$$;

COMMENT ON FUNCTION fn_upsert_provisional_daily_quotes(market_code, date, timestamptz, timestamptz) IS
  '시세 수집 배치(026)의 장중 잠정 일별 집계. 당일 quote_ticks를 종목별로 집계해 daily_quotes를 UPSERT하되, 이미 확정된 행(is_closing_confirmed=true)은 갱신하지 않는다. 시각 경계(p_from/p_to)는 domain calculations/market-session.localDayUtcRange가 계산해 전달한다.';
