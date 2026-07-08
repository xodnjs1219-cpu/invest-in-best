-- 0016_fn_list_chain_cards.sql
-- UC-007 메인/탐색 페이지 체인 카드 목록 RPC (docs/usecases/007/plan.md 모듈 B-1, spec §Database Operations).
-- 체인 × 최신 스냅샷 × 노드 수 × 최신 chain_daily_metrics × 기준 기업명(securities) 복합 조인을
-- 캡슐화한다(techstack §7, N+1 방지). 모두 LEFT JOIN LATERAL — 스냅샷/지표 부재 체인도 카드로 반환
-- (엣지 3·9). 신규 테이블/컬럼 없음(함수 추가만) — 0003·0005·0006·0010과 충돌 없음.

CREATE OR REPLACE FUNCTION list_chain_cards(
  p_chain_type chain_type,
  p_owner_id uuid,
  p_limit integer,
  p_offset integer
)
RETURNS TABLE (
  id uuid,
  name text,
  chain_type chain_type,
  focus_type chain_focus_type,
  focus_company_name text,
  node_count bigint,
  metric_date date,
  total_market_cap_krw text,
  covered_node_count integer,
  total_node_count integer,
  is_carried_forward boolean,
  updated_at timestamptz,
  total_count bigint
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT
    vc.id,
    vc.name,
    vc.chain_type,
    vc.focus_type,
    focus_security.name AS focus_company_name,
    COALESCE(node_agg.node_count, 0) AS node_count,
    metric.metric_date,
    -- numeric::text 캐스팅 — PostgREST의 JSON number 직렬화로 인한 정밀도 손실 방지(spec 문자열 계약).
    metric.total_market_cap_krw::text AS total_market_cap_krw,
    metric.covered_node_count,
    metric.total_node_count,
    metric.is_carried_forward,
    vc.updated_at,
    -- 필터 적용 후 전체 건수(페이지네이션). LIMIT/OFFSET과 무관하게 각 행에 동일 값.
    COUNT(*) OVER () AS total_count
  FROM value_chains vc
  LEFT JOIN securities focus_security
    ON vc.focus_type = 'company' AND vc.focus_security_id = focus_security.id
  LEFT JOIN LATERAL (
    SELECT s.id AS snapshot_id
    FROM chain_snapshots s
    WHERE s.chain_id = vc.id
    ORDER BY s.effective_at DESC
    LIMIT 1
  ) latest_snapshot ON true
  LEFT JOIN LATERAL (
    SELECT COUNT(*) AS node_count
    FROM snapshot_nodes n
    WHERE n.snapshot_id = latest_snapshot.snapshot_id
  ) node_agg ON true
  LEFT JOIN LATERAL (
    SELECT
      m.metric_date,
      m.total_market_cap_krw,
      m.covered_node_count,
      m.total_node_count,
      m.is_carried_forward
    FROM chain_daily_metrics m
    WHERE m.chain_id = vc.id
    ORDER BY m.metric_date DESC
    LIMIT 1
  ) metric ON true
  WHERE
    vc.chain_type = p_chain_type
    AND vc.is_archived = false
    AND (
      p_chain_type <> 'user'
      OR (p_owner_id IS NOT NULL AND vc.owner_id = p_owner_id)
    )
  ORDER BY
    CASE WHEN p_chain_type = 'official' THEN vc.created_at END ASC,
    CASE WHEN p_chain_type <> 'official' THEN vc.updated_at END DESC,
    vc.id ASC
  LIMIT p_limit
  OFFSET p_offset;
$$;

COMMENT ON FUNCTION list_chain_cards(chain_type, uuid, integer, integer) IS
  'UC-007 메인/탐색 페이지 체인 카드 목록. official=is_archived false 전체 공개, user=owner_id 일치 항목만(p_owner_id NULL이면 0행, 방어). 최신 스냅샷 노드 수·최신 chain_daily_metrics·기준 기업명을 LEFT JOIN LATERAL로 결합(스냅샷/지표 없어도 카드 반환). 정렬: official=created_at ASC, user=updated_at DESC, 동률은 id ASC. total_count는 COUNT(*) OVER()로 필터 후 전체 건수를 각 행에 동일하게 반환(0행이면 앱에서 0 처리).';
