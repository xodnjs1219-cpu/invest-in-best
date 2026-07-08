-- 0020_fn_security_belonging_chains.sql
-- UC-020 기업 상세 "소속 밸류체인 목록" RPC (docs/usecases/020/plan.md 모듈 3, spec §6.3(5)·§6.4).
-- 최신 스냅샷(LATERAL) + 해당 종목 노드 매칭 + 노드 수 + 최신 chain_daily_metrics 요약을
-- 단일 RPC로 캡슐화한다(database.md §4.6, techstack §7). 신규 테이블/컬럼 없음(함수 추가만) —
-- 0003(securities)·0005(value_chains)·0006(chain_snapshots/snapshot_nodes)·0010(chain_daily_metrics)과 충돌 없음.
--
-- 노출 범위 필터를 SQL에 내장(E12 서버 측 필터의 1차 방어):
--   공식 체인(chain_type='official') 전체 + (p_owner_id IS NOT NULL이면) 본인 소유 체인.
--   p_owner_id가 NULL이면 공식 체인만 반환(비로그인 게스트).
-- 최신 스냅샷 = 체인별 effective_at 최대 스냅샷. 그 스냅샷에 p_security_id 노드가 없는 체인은 미반환.

CREATE OR REPLACE FUNCTION fn_security_belonging_chains(
  p_security_id uuid,
  p_owner_id uuid DEFAULT NULL
)
RETURNS TABLE (
  chain_id uuid,
  name text,
  chain_type chain_type,
  focus_type chain_focus_type,
  node_count bigint,
  metric_date date,
  total_market_cap_krw text,
  covered_node_count integer,
  total_node_count integer
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT
    vc.id AS chain_id,
    vc.name,
    vc.chain_type,
    vc.focus_type,
    COALESCE(node_agg.node_count, 0) AS node_count,
    metric.metric_date,
    -- numeric::text 캐스팅 — PostgREST의 JSON number 직렬화로 인한 정밀도 손실 방지(0016과 동일 계약).
    metric.total_market_cap_krw::text AS total_market_cap_krw,
    metric.covered_node_count,
    metric.total_node_count
  FROM value_chains vc
  JOIN LATERAL (
    SELECT s.id AS snapshot_id
    FROM chain_snapshots s
    WHERE s.chain_id = vc.id
    ORDER BY s.effective_at DESC
    LIMIT 1
  ) latest ON true
  JOIN snapshot_nodes n
    ON n.snapshot_id = latest.snapshot_id AND n.security_id = p_security_id
  LEFT JOIN LATERAL (
    SELECT COUNT(*) AS node_count
    FROM snapshot_nodes sn
    WHERE sn.snapshot_id = latest.snapshot_id
  ) node_agg ON true
  LEFT JOIN LATERAL (
    SELECT m.metric_date, m.total_market_cap_krw, m.covered_node_count, m.total_node_count
    FROM chain_daily_metrics m
    WHERE m.chain_id = vc.id
    ORDER BY m.metric_date DESC
    LIMIT 1
  ) metric ON true
  WHERE
    vc.is_archived = false
    AND (
      vc.chain_type = 'official'
      OR (p_owner_id IS NOT NULL AND vc.owner_id = p_owner_id)
    )
  ORDER BY (vc.chain_type = 'official') DESC, vc.name ASC;
$$;

COMMENT ON FUNCTION fn_security_belonging_chains(uuid, uuid) IS
  'UC-020 기업 상세 소속 밸류체인 목록. 최신 스냅샷(chain_id별 effective_at 최대)에 p_security_id 노드가 존재하는 체인만 반환. 노출 범위: 공식 체인 전체 + p_owner_id 소유 사용자 체인(NULL이면 공식만, E12 서버 측 필터). node_count는 최신 스냅샷의 전체 노드 수, 지표(metric_date 등)는 chain_daily_metrics 최신 1건(없으면 전부 NULL). 정렬: 공식 우선 + 이름순(결정적).';
