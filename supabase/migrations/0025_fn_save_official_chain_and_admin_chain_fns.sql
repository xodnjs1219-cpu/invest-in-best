-- 0025_fn_save_official_chain_and_admin_chain_fns.sql
-- 공식 체인 저장 원자 트랜잭션 + 어드민 목록 요약 함수 (UC-021 plan 모듈 M2, spec BR-2·BR-3·BR-7).
-- save_official_chain: 공식 체인 전용 저장(생성/수정) — chain_type='official', owner_id=NULL,
--   change_source='admin_edit' 고정. 갱신 시 대상 행 FOR UPDATE 잠금 후 clock_timestamp()로
--   effective_at을 확정한다(R-4 — LLM 승인 반영(UC-022)과 동일 행 잠금 규약 공유, 시각 순 직렬화).
-- admin_list_official_chains: 어드민 목록 화면의 최신 스냅샷 요약(노드 수·최근 변경)을 LATERAL로 계산.

CREATE OR REPLACE FUNCTION save_official_chain(
  p_chain_id uuid,
  p_name text,
  p_focus_type chain_focus_type,
  p_focus_security_id uuid,
  p_disclosure_date date,
  p_base_snapshot_id uuid,
  p_created_by uuid,
  p_groups jsonb,
  p_nodes jsonb,
  p_edges jsonb,
  p_max_nodes_per_chain int
)
RETURNS TABLE (
  outcome text,
  chain_id uuid,
  snapshot_id uuid,
  effective_at timestamptz,
  group_count int,
  node_count int,
  edge_count int
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_chain_id uuid;
  v_snapshot_id uuid;
  v_effective_at timestamptz;
  v_group_count int := 0;
  v_node_count int := 0;
  v_edge_count int := 0;
  v_chain_type chain_type;
  v_is_archived boolean;
  v_latest_snapshot_id uuid;
  v_group_map jsonb := '{}'::jsonb;
  v_node_map jsonb := '{}'::jsonb;
  v_group jsonb;
  v_node jsonb;
  v_edge jsonb;
  v_new_group_id uuid;
  v_new_node_id uuid;
  v_source_id uuid;
  v_target_id uuid;
BEGIN
  IF jsonb_array_length(p_nodes) > p_max_nodes_per_chain THEN
    RETURN QUERY SELECT 'node_limit_exceeded'::text, NULL::uuid, NULL::uuid, NULL::timestamptz, NULL::int, NULL::int, NULL::int;
    RETURN;
  END IF;

  IF p_chain_id IS NULL THEN
    -- 생성: chain_type='official', owner_id=NULL(chk_value_chains_owner 준수).
    INSERT INTO value_chains (chain_type, owner_id, name, focus_type, focus_security_id)
    VALUES ('official', NULL, p_name, p_focus_type, p_focus_security_id)
    RETURNING id INTO v_chain_id;
  ELSE
    -- 갱신: 대상 행 잠금(R-4 — UC-022 approve_llm_proposal과 동일 행 잠금 공유로 직렬화).
    SELECT vc.chain_type, vc.is_archived INTO v_chain_type, v_is_archived
    FROM value_chains vc WHERE vc.id = p_chain_id FOR UPDATE;

    IF NOT FOUND THEN
      RETURN QUERY SELECT 'chain_not_found'::text, NULL::uuid, NULL::uuid, NULL::timestamptz, NULL::int, NULL::int, NULL::int;
      RETURN;
    END IF;

    IF v_chain_type <> 'official' THEN
      RETURN QUERY SELECT 'chain_type_mismatch'::text, NULL::uuid, NULL::uuid, NULL::timestamptz, NULL::int, NULL::int, NULL::int;
      RETURN;
    END IF;

    IF v_is_archived THEN
      RETURN QUERY SELECT 'chain_archived'::text, NULL::uuid, NULL::uuid, NULL::timestamptz, NULL::int, NULL::int, NULL::int;
      RETURN;
    END IF;

    SELECT cs.id INTO v_latest_snapshot_id
    FROM chain_snapshots cs WHERE cs.chain_id = p_chain_id
    ORDER BY cs.effective_at DESC, cs.created_at DESC LIMIT 1;

    IF v_latest_snapshot_id IS DISTINCT FROM p_base_snapshot_id THEN
      RETURN QUERY SELECT 'save_conflict'::text, NULL::uuid, NULL::uuid, NULL::timestamptz, NULL::int, NULL::int, NULL::int;
      RETURN;
    END IF;

    UPDATE value_chains
    SET name = p_name, focus_type = p_focus_type, focus_security_id = p_focus_security_id
    WHERE id = p_chain_id;

    v_chain_id := p_chain_id;
  END IF;

  v_effective_at := clock_timestamp();

  INSERT INTO chain_snapshots (chain_id, effective_at, change_source, disclosure_date, created_by)
  VALUES (v_chain_id, v_effective_at, 'admin_edit', p_disclosure_date, p_created_by)
  RETURNING id INTO v_snapshot_id;

  FOR v_group IN SELECT * FROM jsonb_array_elements(p_groups)
  LOOP
    INSERT INTO snapshot_groups (snapshot_id, name)
    VALUES (v_snapshot_id, v_group->>'name')
    RETURNING id INTO v_new_group_id;
    v_group_map := jsonb_set(v_group_map, ARRAY[v_group->>'clientGroupId'], to_jsonb(v_new_group_id::text));
    v_group_count := v_group_count + 1;
  END LOOP;

  FOR v_node IN SELECT * FROM jsonb_array_elements(p_nodes)
  LOOP
    INSERT INTO snapshot_nodes (
      snapshot_id, group_id, node_kind, security_id, subject_name, subject_type, subject_memo,
      position_x, position_y
    )
    VALUES (
      v_snapshot_id,
      CASE WHEN v_node->>'groupClientId' IS NULL THEN NULL
           ELSE (v_group_map->>(v_node->>'groupClientId'))::uuid END,
      (v_node->>'nodeKind')::node_kind,
      NULLIF(v_node->>'securityId', '')::uuid,
      v_node->>'subjectName',
      NULLIF(v_node->>'subjectType', '')::subject_type,
      v_node->>'subjectMemo',
      (v_node->>'positionX')::numeric,
      (v_node->>'positionY')::numeric
    )
    RETURNING id INTO v_new_node_id;
    v_node_map := jsonb_set(v_node_map, ARRAY[v_node->>'clientNodeId'], to_jsonb(v_new_node_id::text));
    v_node_count := v_node_count + 1;
  END LOOP;

  FOR v_edge IN SELECT * FROM jsonb_array_elements(p_edges)
  LOOP
    v_source_id := (v_node_map->>(v_edge->>'sourceClientNodeId'))::uuid;
    v_target_id := (v_node_map->>(v_edge->>'targetClientNodeId'))::uuid;
    IF v_source_id IS NULL OR v_target_id IS NULL THEN
      RAISE EXCEPTION 'EDGE_NODE_REF_INVALID' USING ERRCODE = 'P0001';
    END IF;
    INSERT INTO snapshot_edges (snapshot_id, source_node_id, target_node_id, relation_type_id)
    VALUES (v_snapshot_id, v_source_id, v_target_id, (v_edge->>'relationTypeId')::uuid);
    v_edge_count := v_edge_count + 1;
  END LOOP;

  RETURN QUERY SELECT 'saved'::text, v_chain_id, v_snapshot_id, v_effective_at, v_group_count, v_node_count, v_edge_count;
EXCEPTION
  WHEN unique_violation THEN
    IF SQLERRM LIKE '%uq_value_chains_official_name%' THEN
      RETURN QUERY SELECT 'name_duplicate'::text, NULL::uuid, NULL::uuid, NULL::timestamptz, NULL::int, NULL::int, NULL::int;
      RETURN;
    END IF;
    RAISE;
  WHEN raise_exception THEN
    IF SQLERRM = 'EDGE_NODE_REF_INVALID' THEN
      RETURN QUERY SELECT 'edge_node_ref_invalid'::text, NULL::uuid, NULL::uuid, NULL::timestamptz, NULL::int, NULL::int, NULL::int;
      RETURN;
    END IF;
    RAISE;
END;
$$;

COMMENT ON FUNCTION save_official_chain IS '공식 체인 저장(신규/갱신) 원자 트랜잭션. outcome: saved|node_limit_exceeded|chain_not_found|chain_type_mismatch|chain_archived|save_conflict|name_duplicate|edge_node_ref_invalid. chain_type=official, owner_id=NULL, change_source=admin_edit 고정(UC-021 BR-2/BR-3).';

-- 어드민 공식 체인 목록 요약(spec API-1) — 최신 스냅샷(LATERAL) + 노드 수.
CREATE OR REPLACE FUNCTION admin_list_official_chains()
RETURNS TABLE (
  chain_id uuid,
  name text,
  focus_type chain_focus_type,
  focus_security_id uuid,
  is_archived boolean,
  created_at timestamptz,
  updated_at timestamptz,
  latest_snapshot_id uuid,
  latest_effective_at timestamptz,
  latest_change_source snapshot_source,
  node_count int
)
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    vc.id AS chain_id,
    vc.name,
    vc.focus_type,
    vc.focus_security_id,
    vc.is_archived,
    vc.created_at,
    vc.updated_at,
    latest.id AS latest_snapshot_id,
    latest.effective_at AS latest_effective_at,
    latest.change_source AS latest_change_source,
    COALESCE(nc.node_count, 0)::int AS node_count
  FROM value_chains vc
  LEFT JOIN LATERAL (
    SELECT cs.id, cs.effective_at, cs.change_source
    FROM chain_snapshots cs
    WHERE cs.chain_id = vc.id
    ORDER BY cs.effective_at DESC, cs.created_at DESC
    LIMIT 1
  ) latest ON true
  LEFT JOIN LATERAL (
    SELECT count(*) AS node_count
    FROM snapshot_nodes sn
    WHERE sn.snapshot_id = latest.id
  ) nc ON true
  WHERE vc.chain_type = 'official'
  ORDER BY vc.created_at ASC;
$$;

COMMENT ON FUNCTION admin_list_official_chains IS '어드민 공식 체인 목록(보관 포함) + 최신 스냅샷 요약(노드 수·최근 변경). user 체인 미포함(UC-021 spec API-1).';
