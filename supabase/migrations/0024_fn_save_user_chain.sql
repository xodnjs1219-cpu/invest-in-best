-- 0024_fn_save_user_chain.sql
-- 사용자 체인 저장 원자 트랜잭션 (UC-018 plan 모듈 6, spec BR-1·BR-6·BR-7).
-- 체인 헤더 INSERT/UPDATE + 스냅샷 1건 + 그룹/노드/엣지 일괄 INSERT를 단일 함수로 수행한다.
-- 신규 저장은 advisory lock으로 체인 상한(quota) 경합을 직렬화하고,
-- 갱신 저장은 대상 행 FOR UPDATE로 낙관적 잠금(baseSnapshotId 대조)을 직렬화한다(R-4 논리와 동일).

CREATE OR REPLACE FUNCTION save_user_chain(
  p_user_id uuid,
  p_chain_id uuid,
  p_base_snapshot_id uuid,
  p_name text,
  p_focus_type chain_focus_type,
  p_focus_security_id uuid,
  p_groups jsonb,
  p_nodes jsonb,
  p_edges jsonb,
  p_max_chains_per_user int,
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
  v_owner_id uuid;
  v_chain_type chain_type;
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
  IF p_chain_id IS NULL THEN
    -- 신규 저장: 동일 사용자의 동시 생성 경쟁을 advisory lock으로 직렬화(S-7).
    PERFORM pg_advisory_xact_lock(hashtext('save_user_chain:' || p_user_id::text));

    IF (SELECT count(*) FROM value_chains WHERE owner_id = p_user_id AND chain_type = 'user') >= p_max_chains_per_user THEN
      RETURN QUERY SELECT 'chain_limit_exceeded'::text, NULL::uuid, NULL::uuid, NULL::timestamptz, NULL::int, NULL::int, NULL::int;
      RETURN;
    END IF;

    IF jsonb_array_length(p_nodes) > p_max_nodes_per_chain THEN
      RETURN QUERY SELECT 'node_limit_exceeded'::text, NULL::uuid, NULL::uuid, NULL::timestamptz, NULL::int, NULL::int, NULL::int;
      RETURN;
    END IF;

    INSERT INTO value_chains (chain_type, owner_id, name, focus_type, focus_security_id)
    VALUES ('user', p_user_id, p_name, p_focus_type, p_focus_security_id)
    RETURNING id INTO v_chain_id;
  ELSE
    -- 갱신 저장: 대상 행 잠금 후 소유자/유형/보관/낙관적 잠금 재검증(BR-7, BR-10).
    SELECT vc.owner_id, vc.chain_type INTO v_owner_id, v_chain_type
    FROM value_chains vc WHERE vc.id = p_chain_id FOR UPDATE;

    IF NOT FOUND THEN
      RETURN QUERY SELECT 'chain_not_found'::text, NULL::uuid, NULL::uuid, NULL::timestamptz, NULL::int, NULL::int, NULL::int;
      RETURN;
    END IF;

    IF v_chain_type <> 'user' OR v_owner_id <> p_user_id THEN
      RETURN QUERY SELECT 'chain_forbidden'::text, NULL::uuid, NULL::uuid, NULL::timestamptz, NULL::int, NULL::int, NULL::int;
      RETURN;
    END IF;

    SELECT cs.id INTO v_latest_snapshot_id
    FROM chain_snapshots cs WHERE cs.chain_id = p_chain_id
    ORDER BY cs.effective_at DESC, cs.created_at DESC LIMIT 1;

    IF v_latest_snapshot_id IS DISTINCT FROM p_base_snapshot_id THEN
      RETURN QUERY SELECT 'save_conflict'::text, NULL::uuid, NULL::uuid, NULL::timestamptz, NULL::int, NULL::int, NULL::int;
      RETURN;
    END IF;

    IF jsonb_array_length(p_nodes) > p_max_nodes_per_chain THEN
      RETURN QUERY SELECT 'node_limit_exceeded'::text, NULL::uuid, NULL::uuid, NULL::timestamptz, NULL::int, NULL::int, NULL::int;
      RETURN;
    END IF;

    UPDATE value_chains
    SET name = p_name, focus_type = p_focus_type, focus_security_id = p_focus_security_id
    WHERE id = p_chain_id;

    v_chain_id := p_chain_id;
  END IF;

  v_effective_at := clock_timestamp();

  INSERT INTO chain_snapshots (chain_id, effective_at, change_source, created_by)
  VALUES (v_chain_id, v_effective_at, 'user_save', p_user_id)
  RETURNING id INTO v_snapshot_id;

  -- 그룹 일괄 INSERT + clientGroupId → 신규 uuid 매핑 보관.
  FOR v_group IN SELECT * FROM jsonb_array_elements(p_groups)
  LOOP
    INSERT INTO snapshot_groups (snapshot_id, name)
    VALUES (v_snapshot_id, v_group->>'name')
    RETURNING id INTO v_new_group_id;
    v_group_map := jsonb_set(v_group_map, ARRAY[v_group->>'clientGroupId'], to_jsonb(v_new_group_id::text));
    v_group_count := v_group_count + 1;
  END LOOP;

  -- 노드 일괄 INSERT + clientNodeId → 신규 uuid 매핑 보관(그룹 매핑 해석).
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

  -- 엣지 일괄 INSERT — source/target을 노드 매핑으로 해석.
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
    IF SQLERRM LIKE '%uq_value_chains_owner_name%' THEN
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

COMMENT ON FUNCTION save_user_chain IS '사용자 체인 저장(신규/갱신) 원자 트랜잭션. outcome: saved|chain_limit_exceeded|node_limit_exceeded|chain_not_found|chain_forbidden|save_conflict|name_duplicate|edge_node_ref_invalid. 체인 헤더+스냅샷+그룹/노드/엣지를 단일 트랜잭션으로 기록한다(UC-018 BR-6).';
