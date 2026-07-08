-- 0023_fn_clone_value_chain.sql
-- UC-014 공식 체인 복제 RPC (docs/usecases/014/spec.md §6.3, plan 모듈 3).
-- 원본 공식 체인의 최신 스냅샷 기준으로 사용자 체인(완전 독립 사본)을 단일 트랜잭션으로 생성한다.
-- 그룹/노드/엣지는 신규 ID를 발급해 복사하며, 노드의 group_id·엣지의 source/target_node_id를
-- 신규 ID로 재매핑한다(비활성 관계 종류 포함 그대로 복사, spec Edge 11). UPDATE/DELETE 없음
-- (원본 체인·스냅샷은 일절 변경하지 않는다 — 스냅샷 불변). 신규 테이블/컬럼 없음(함수 추가만).

CREATE OR REPLACE FUNCTION clone_value_chain(
  p_source_chain_id uuid,
  p_source_snapshot_id uuid,
  p_owner_id uuid,
  p_name text
)
RETURNS TABLE (
  chain_id uuid,
  snapshot_id uuid,
  cloned_at timestamptz,
  group_count integer,
  node_count integer,
  edge_count integer
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_cloned_at timestamptz := now();
  v_new_chain_id uuid;
  v_new_snapshot_id uuid;
  v_focus_type chain_focus_type;
  v_focus_security_id uuid;
  v_group_count integer := 0;
  v_node_count integer := 0;
  v_edge_count integer := 0;
BEGIN
  -- 방어 검증: 원본 스냅샷이 원본 체인 소속인지 확인(잘못된 호출 차단).
  SELECT vc.focus_type, vc.focus_security_id
    INTO v_focus_type, v_focus_security_id
  FROM value_chains vc
  WHERE vc.id = p_source_chain_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION '원본 체인을 찾을 수 없습니다: %', p_source_chain_id;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM chain_snapshots cs
    WHERE cs.id = p_source_snapshot_id AND cs.chain_id = p_source_chain_id
  ) THEN
    RAISE EXCEPTION '원본 스냅샷(%)이 원본 체인(%) 소속이 아닙니다.', p_source_snapshot_id, p_source_chain_id;
  END IF;

  -- 1. 사본 체인 헤더 생성.
  INSERT INTO value_chains (
    id, chain_type, owner_id, name, focus_type, focus_security_id,
    is_archived, source_chain_id, source_copied_at
  )
  VALUES (
    gen_random_uuid(), 'user', p_owner_id, p_name, v_focus_type, v_focus_security_id,
    false, p_source_chain_id, v_cloned_at
  )
  RETURNING id INTO v_new_chain_id;

  -- 2. 복제 스냅샷 1건 생성(첫 스냅샷, change_source='user_save').
  INSERT INTO chain_snapshots (id, chain_id, effective_at, change_source, disclosure_date, created_by)
  VALUES (gen_random_uuid(), v_new_chain_id, v_cloned_at, 'user_save', NULL, p_owner_id)
  RETURNING id INTO v_new_snapshot_id;

  -- 3. 그룹 복사(구 ID → 신규 ID 매핑을 임시 테이블로 유지).
  CREATE TEMP TABLE tmp_clone_group_map (old_id uuid PRIMARY KEY, new_id uuid NOT NULL)
    ON COMMIT DROP;

  INSERT INTO tmp_clone_group_map (old_id, new_id)
  SELECT g.id, gen_random_uuid()
  FROM snapshot_groups g
  WHERE g.snapshot_id = p_source_snapshot_id;

  INSERT INTO snapshot_groups (id, snapshot_id, name)
  SELECT m.new_id, v_new_snapshot_id, g.name
  FROM snapshot_groups g
  JOIN tmp_clone_group_map m ON m.old_id = g.id
  WHERE g.snapshot_id = p_source_snapshot_id;

  GET DIAGNOSTICS v_group_count = ROW_COUNT;

  -- 4. 노드 복사(구 ID → 신규 ID 매핑, group_id 재매핑).
  CREATE TEMP TABLE tmp_clone_node_map (old_id uuid PRIMARY KEY, new_id uuid NOT NULL)
    ON COMMIT DROP;

  INSERT INTO tmp_clone_node_map (old_id, new_id)
  SELECT n.id, gen_random_uuid()
  FROM snapshot_nodes n
  WHERE n.snapshot_id = p_source_snapshot_id;

  INSERT INTO snapshot_nodes (
    id, snapshot_id, group_id, node_kind, security_id,
    subject_name, subject_type, subject_memo, position_x, position_y
  )
  SELECT
    nm.new_id, v_new_snapshot_id, gm.new_id, n.node_kind, n.security_id,
    n.subject_name, n.subject_type, n.subject_memo, n.position_x, n.position_y
  FROM snapshot_nodes n
  JOIN tmp_clone_node_map nm ON nm.old_id = n.id
  LEFT JOIN tmp_clone_group_map gm ON gm.old_id = n.group_id
  WHERE n.snapshot_id = p_source_snapshot_id;

  GET DIAGNOSTICS v_node_count = ROW_COUNT;

  -- 5. 엣지 복사(source/target_node_id 재매핑, relation_type_id 유지 — 비활성 포함 그대로).
  INSERT INTO snapshot_edges (id, snapshot_id, source_node_id, target_node_id, relation_type_id)
  SELECT
    gen_random_uuid(), v_new_snapshot_id, sm.new_id, tm.new_id, e.relation_type_id
  FROM snapshot_edges e
  JOIN tmp_clone_node_map sm ON sm.old_id = e.source_node_id
  JOIN tmp_clone_node_map tm ON tm.old_id = e.target_node_id
  WHERE e.snapshot_id = p_source_snapshot_id;

  GET DIAGNOSTICS v_edge_count = ROW_COUNT;

  RETURN QUERY SELECT v_new_chain_id, v_new_snapshot_id, v_cloned_at, v_group_count, v_node_count, v_edge_count;
END;
$$;

COMMENT ON FUNCTION clone_value_chain(uuid, uuid, uuid, text) IS
  'UC-014 공식 체인 복제. p_source_snapshot_id가 p_source_chain_id 소속인지 방어 검증 후, 사용자 체인 헤더+첫 스냅샷(user_save)+그룹/노드/엣지 전체를 신규 ID로 복사한다(비활성 관계 종류 포함 그대로, 좌표·자유 주체 필드·종목 연결 보존). 단일 함수 호출 = 단일 트랜잭션(실패 시 전체 롤백). UPDATE/DELETE 없음(원본 불변).';
