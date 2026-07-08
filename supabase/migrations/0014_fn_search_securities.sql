-- 0014_fn_search_securities.sql
-- UC-008 통합 종목 검색 RPC (docs/usecases/008/plan.md 모듈 3, spec §Database Operations).
-- ticker/name/english_name 3필드 부분 일치(ILIKE) 검색. 정확>접두>부분 순 정렬은
-- ORDER BY CASE라 supabase-js 쿼리빌더로 표현 불가 → techstack §7 규칙에 따라 함수화.
-- 신규 테이블/컬럼 없음(0001 pg_trgm, 0003 securities 선행 가정) — 기존 마이그레이션과 충돌 없음.

CREATE OR REPLACE FUNCTION search_securities(
  p_query text,
  p_limit integer,
  p_offset integer,
  p_market market_code DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  ticker text,
  name text,
  english_name text,
  market market_code,
  listing_status listing_status
)
LANGUAGE sql
STABLE
SET search_path = public, extensions
AS $$
  -- ILIKE 와일드카드(\, %, _) 이스케이프 — 함수 내부에 SOT 단일화(레포지토리/서비스 재구현 금지).
  -- 이스케이프된 값으로 부분/접두 일치 패턴을 구성하고, 정확 일치 비교는 원값을 그대로 쓴다.
  WITH escaped AS (
    SELECT replace(replace(replace(p_query, '\', '\\'), '%', '\%'), '_', '\_') AS escaped_query
  ),
  pattern AS (
    SELECT
      escaped_query,
      '%' || escaped_query || '%' AS contains_pattern,
      escaped_query || '%' AS prefix_pattern
    FROM escaped
  )
  SELECT
    s.id,
    s.ticker,
    s.name,
    s.english_name,
    s.market,
    s.listing_status
  FROM securities s, pattern p
  WHERE
    (p_market IS NULL OR s.market = p_market)
    AND (
      s.ticker ILIKE p.contains_pattern ESCAPE '\'
      OR s.name ILIKE p.contains_pattern ESCAPE '\'
      OR s.english_name ILIKE p.contains_pattern ESCAPE '\'
    )
  ORDER BY
    CASE
      WHEN lower(s.ticker) = lower(p_query)
        OR lower(s.name) = lower(p_query)
        OR lower(s.english_name) = lower(p_query) THEN 0
      WHEN s.ticker ILIKE p.prefix_pattern ESCAPE '\'
        OR s.name ILIKE p.prefix_pattern ESCAPE '\'
        OR s.english_name ILIKE p.prefix_pattern ESCAPE '\' THEN 1
      ELSE 2
    END,
    s.name ASC,
    s.ticker ASC
  LIMIT p_limit
  OFFSET p_offset;
$$;

COMMENT ON FUNCTION search_securities(text, integer, integer, market_code) IS
  'UC-008 통합 종목 검색. ticker/name/english_name ILIKE 부분 일치, 정확>접두>부분 순 정렬(동순위는 name·ticker 오름차순). p_market=NULL이면 전 시장. 폐지/정지 종목도 노출한다(결정 B-5) — listing_status 필터 없음. hasMore 산출은 호출측이 p_limit=pageSize+1로 전달하는 계약(COUNT 쿼리 불필요).';
