-- 0017_chain_view_dashboard_timeline_fns.sql
-- UC-010(대시보드 패널 주석 메타) + UC-012(시점 타임라인 스냅샷 복원) — Postgres 함수 2종.
-- 신규 테이블/컬럼 없음 — 기존 스키마(0003~0006, 0008, 0010) 위에 함수만 추가한다(techstack §7, 조회 전용).

-- ============================================================
-- ① fn_chain_daily_annotations(p_chain_id, p_as_of, p_metric_date)
-- ============================================================
-- 유효 스냅샷(p_as_of 이전 마지막) 기준 상장기업 노드의 최신 상장주식수 기준일 min/max(C-4)와
-- 해당 지표 일자의 종가 확정 여부(모든 구성 종목이 확정이어야 true)를 단일 왕복으로 반환한다.
CREATE OR REPLACE FUNCTION public.fn_chain_daily_annotations(
  p_chain_id uuid,
  p_as_of timestamptz,
  p_metric_date date
)
RETURNS TABLE (
  shares_as_of_min date,
  shares_as_of_max date,
  all_closing_confirmed boolean
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
STABLE
AS $$
DECLARE
  v_snapshot_id uuid;
BEGIN
  -- 유효 스냅샷: p_as_of 이전(당일 종료 경계 포함) 마지막 1건.
  SELECT s.id INTO v_snapshot_id
  FROM public.chain_snapshots s
  WHERE s.chain_id = p_chain_id AND s.effective_at <= p_as_of
  ORDER BY s.effective_at DESC
  LIMIT 1;

  IF v_snapshot_id IS NULL THEN
    RETURN QUERY SELECT NULL::date, NULL::date, true;
    RETURN;
  END IF;

  RETURN QUERY
  WITH listed_securities AS (
    SELECT DISTINCT n.security_id
    FROM public.snapshot_nodes n
    WHERE n.snapshot_id = v_snapshot_id
      AND n.node_kind = 'listed_company'
      AND n.security_id IS NOT NULL
  ),
  latest_shares AS (
    SELECT DISTINCT ON (so.security_id) so.security_id, so.as_of_date
    FROM public.shares_outstanding so
    JOIN listed_securities ls ON ls.security_id = so.security_id
    ORDER BY so.security_id, so.as_of_date DESC
  ),
  closing_check AS (
    SELECT NOT EXISTS (
      SELECT 1
      FROM public.daily_quotes dq
      JOIN listed_securities ls ON ls.security_id = dq.security_id
      WHERE p_metric_date IS NOT NULL
        AND dq.trade_date = p_metric_date
        AND dq.is_closing_confirmed = false
    ) AS confirmed
  )
  SELECT
    (SELECT min(as_of_date) FROM latest_shares),
    (SELECT max(as_of_date) FROM latest_shares),
    CASE WHEN p_metric_date IS NULL THEN true ELSE (SELECT confirmed FROM closing_check) END;
END;
$$;

COMMENT ON FUNCTION public.fn_chain_daily_annotations(uuid, timestamptz, date) IS
  'UC-010 대시보드 지표 주석 메타 — 유효 스냅샷 상장기업 노드의 상장주식수 최신 기준일 min/max(C-4) + 지정 일자 종가 확정 여부(E3/E4). 상장기업 0개면 (null,null,true).';

-- ============================================================
-- ② fn_chain_snapshot_at(p_chain_id, p_as_of)
-- ============================================================
-- p_as_of(당일 종료 경계 포함) 이전 마지막 스냅샷 1건의 구조(그룹/노드/엣지, 좌표·표시정보 포함)를
-- 단일 jsonb로 반환한다. 스냅샷이 없으면 NULL(서비스가 SNAPSHOT_NOT_FOUND로 매핑).
CREATE OR REPLACE FUNCTION public.fn_chain_snapshot_at(
  p_chain_id uuid,
  p_as_of timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
STABLE
AS $$
DECLARE
  v_snapshot record;
  v_result jsonb;
BEGIN
  SELECT s.id, s.effective_at, s.change_source INTO v_snapshot
  FROM public.chain_snapshots s
  WHERE s.chain_id = p_chain_id AND s.effective_at <= p_as_of
  ORDER BY s.effective_at DESC
  LIMIT 1;

  IF v_snapshot IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT jsonb_build_object(
    'snapshot', jsonb_build_object(
      'id', v_snapshot.id,
      'effective_at', v_snapshot.effective_at,
      'change_source', v_snapshot.change_source
    ),
    'groups', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', g.id, 'name', g.name))
      FROM public.snapshot_groups g
      WHERE g.snapshot_id = v_snapshot.id
    ), '[]'::jsonb),
    'nodes', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', n.id,
        'group_id', n.group_id,
        'node_kind', n.node_kind,
        'subject_name', n.subject_name,
        'subject_type', n.subject_type,
        'subject_memo', n.subject_memo,
        'position_x', n.position_x,
        'position_y', n.position_y,
        'security', CASE WHEN n.security_id IS NOT NULL THEN jsonb_build_object(
          'id', sec.id,
          'ticker', sec.ticker,
          'name', sec.name,
          'market', sec.market,
          'listing_status', sec.listing_status
        ) ELSE NULL END
      ))
      FROM public.snapshot_nodes n
      LEFT JOIN public.securities sec ON sec.id = n.security_id
      WHERE n.snapshot_id = v_snapshot.id
    ), '[]'::jsonb),
    'edges', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', e.id,
        'source_node_id', e.source_node_id,
        'target_node_id', e.target_node_id,
        'relation_type', jsonb_build_object(
          'id', rt.id,
          'name', rt.name,
          'is_directed', rt.is_directed,
          'is_active', rt.is_active
        )
      ))
      FROM public.snapshot_edges e
      JOIN public.relation_types rt ON rt.id = e.relation_type_id
      WHERE e.snapshot_id = v_snapshot.id
    ), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.fn_chain_snapshot_at(uuid, timestamptz) IS
  'UC-012 시점 스냅샷 복원 — p_as_of(당일 종료 경계) 이전 마지막 스냅샷의 그룹/노드(좌표·자유주체 필드·종목 표시정보)/엣지(관계 종류 최신 이름·방향성·활성 여부)를 단일 jsonb로 반환. 스냅샷 없으면 NULL.';
