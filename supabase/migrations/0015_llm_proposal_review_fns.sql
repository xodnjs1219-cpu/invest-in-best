-- 0014_llm_proposal_review_fns.sql
-- UC-022 LLM 관계 변경안 검토(승인/거부) — SQL 함수 3종.
-- ① llm_proposal_applicability(): 최신 구성 대조 판정 헬퍼(목록 조회·승인이 공용하는 단일 SOT, R-5).
-- ② list_llm_proposals(): 검토 큐 목록 조회(조인 + applicability 결합).
-- ③ approve_llm_proposal(): 승인 원자 트랜잭션(행 잠금 → 검증 → 스냅샷 복사 → 제안 갱신).
-- 신규 테이블/컬럼 없음 — 기존 스키마(0004~0006, 0011) 위에 함수만 추가한다.

-- ============================================================
-- ① llm_proposal_applicability(p_proposal_id uuid)
-- ============================================================
-- 반환: 적용 가능 여부 + 판정에 필요한 재매핑 결과(승인 RPC가 그대로 재사용).
-- 판정 순서: 체인 적격 → 최신 스냅샷 식별 → 노드 재매핑(BR-6) → 관계 종류 활성(BR-7) → 변경 적용 가능성(BR-8, R-1).
CREATE OR REPLACE FUNCTION public.llm_proposal_applicability(p_proposal_id uuid)
RETURNS TABLE (
  is_applicable boolean,
  reason text,
  latest_snapshot_id uuid,
  remapped_source_node_id uuid,
  remapped_target_node_id uuid,
  target_edge_id uuid
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_proposal record;
  v_chain record;
  v_latest_snapshot_id uuid;
  v_source_base record;
  v_target_base record;
  v_remapped_source uuid;
  v_remapped_target uuid;
  v_relation_type record;
  v_edge_count int;
  v_edge_id uuid;
  v_dup_count int;
BEGIN
  -- 제안 로드.
  SELECT p.* INTO v_proposal
  FROM public.llm_relation_proposals p
  WHERE p.id = p_proposal_id;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'NODE_NOT_FOUND'::text, NULL::uuid, NULL::uuid, NULL::uuid, NULL::uuid;
    RETURN;
  END IF;

  -- 1) 체인 적격: official + 비보관.
  SELECT vc.* INTO v_chain FROM public.value_chains vc WHERE vc.id = v_proposal.chain_id;

  IF NOT FOUND OR v_chain.chain_type <> 'official' OR v_chain.is_archived THEN
    RETURN QUERY SELECT false, 'CHAIN_NOT_APPLICABLE'::text, NULL::uuid, NULL::uuid, NULL::uuid, NULL::uuid;
    RETURN;
  END IF;

  -- 2) 최신 스냅샷 식별(동률 시 created_at DESC로 결정성 확보).
  SELECT s.id INTO v_latest_snapshot_id
  FROM public.chain_snapshots s
  WHERE s.chain_id = v_proposal.chain_id
  ORDER BY s.effective_at DESC, s.created_at DESC
  LIMIT 1;

  IF v_latest_snapshot_id IS NULL THEN
    RETURN QUERY SELECT false, 'NODE_NOT_FOUND'::text, NULL::uuid, NULL::uuid, NULL::uuid, NULL::uuid;
    RETURN;
  END IF;

  -- 3) 노드 재매핑(BR-6): based_on_snapshot 기준 노드를 최신 스냅샷 노드로 매핑.
  SELECT n.* INTO v_source_base FROM public.snapshot_nodes n WHERE n.id = v_proposal.source_node_id;
  SELECT n.* INTO v_target_base FROM public.snapshot_nodes n WHERE n.id = v_proposal.target_node_id;

  IF v_source_base IS NULL OR v_target_base IS NULL THEN
    RETURN QUERY SELECT false, 'NODE_NOT_FOUND'::text, v_latest_snapshot_id, NULL::uuid, NULL::uuid, NULL::uuid;
    RETURN;
  END IF;

  IF v_source_base.node_kind = 'listed_company' THEN
    SELECT n.id INTO v_remapped_source
    FROM public.snapshot_nodes n
    WHERE n.snapshot_id = v_latest_snapshot_id AND n.security_id = v_source_base.security_id;
  ELSE
    SELECT n.id INTO v_remapped_source
    FROM public.snapshot_nodes n
    WHERE n.snapshot_id = v_latest_snapshot_id
      AND n.node_kind = 'free_subject'
      AND n.subject_name = v_source_base.subject_name
      AND n.subject_type = v_source_base.subject_type;
  END IF;

  IF v_target_base.node_kind = 'listed_company' THEN
    SELECT n.id INTO v_remapped_target
    FROM public.snapshot_nodes n
    WHERE n.snapshot_id = v_latest_snapshot_id AND n.security_id = v_target_base.security_id;
  ELSE
    SELECT n.id INTO v_remapped_target
    FROM public.snapshot_nodes n
    WHERE n.snapshot_id = v_latest_snapshot_id
      AND n.node_kind = 'free_subject'
      AND n.subject_name = v_target_base.subject_name
      AND n.subject_type = v_target_base.subject_type;
  END IF;

  IF v_remapped_source IS NULL OR v_remapped_target IS NULL OR v_remapped_source = v_remapped_target THEN
    RETURN QUERY SELECT false, 'NODE_NOT_FOUND'::text, v_latest_snapshot_id, v_remapped_source, v_remapped_target, NULL::uuid;
    RETURN;
  END IF;

  -- 4) 관계 종류 활성(BR-7, add/update만 관계 종류를 지님).
  IF v_proposal.proposal_type IN ('relation_add', 'relation_update') THEN
    IF v_proposal.relation_type_id IS NULL THEN
      RETURN QUERY SELECT false, 'EDGE_NOT_FOUND'::text, v_latest_snapshot_id, v_remapped_source, v_remapped_target, NULL::uuid;
      RETURN;
    END IF;

    SELECT rt.* INTO v_relation_type FROM public.relation_types rt WHERE rt.id = v_proposal.relation_type_id;

    IF NOT FOUND OR v_relation_type.is_active = false THEN
      RETURN QUERY SELECT false, 'RELATION_TYPE_INACTIVE'::text, v_latest_snapshot_id, v_remapped_source, v_remapped_target, NULL::uuid;
      RETURN;
    END IF;
  END IF;

  -- 5) 변경 적용 가능성(BR-8, R-1, R-4). 무향 관계는 역방향 포함.
  IF v_proposal.proposal_type = 'relation_add' THEN
    SELECT count(*) INTO v_dup_count
    FROM public.snapshot_edges e
    WHERE e.snapshot_id = v_latest_snapshot_id
      AND e.relation_type_id = v_proposal.relation_type_id
      AND (
        (e.source_node_id = v_remapped_source AND e.target_node_id = v_remapped_target)
        OR (
          v_relation_type.is_directed = false
          AND e.source_node_id = v_remapped_target AND e.target_node_id = v_remapped_source
        )
      );

    IF v_dup_count > 0 THEN
      RETURN QUERY SELECT false, 'EDGE_ALREADY_EXISTS'::text, v_latest_snapshot_id, v_remapped_source, v_remapped_target, NULL::uuid;
      RETURN;
    END IF;

    RETURN QUERY SELECT true, NULL::text, v_latest_snapshot_id, v_remapped_source, v_remapped_target, NULL::uuid;
    RETURN;

  ELSIF v_proposal.proposal_type = 'relation_update' THEN
    -- R-1: 재매핑 쌍의 최신 구성 엣지(관계 종류 무관, 무향 역방향 포함) 정확히 1건이어야 대상 확정.
    SELECT count(*) INTO v_edge_count
    FROM public.snapshot_edges e
    JOIN public.relation_types rt2 ON rt2.id = e.relation_type_id
    WHERE e.snapshot_id = v_latest_snapshot_id
      AND (
        (e.source_node_id = v_remapped_source AND e.target_node_id = v_remapped_target)
        OR (rt2.is_directed = false AND e.source_node_id = v_remapped_target AND e.target_node_id = v_remapped_source)
      );

    IF v_edge_count <> 1 THEN
      RETURN QUERY SELECT false, 'EDGE_NOT_FOUND'::text, v_latest_snapshot_id, v_remapped_source, v_remapped_target, NULL::uuid;
      RETURN;
    END IF;

    SELECT e.id INTO v_edge_id
    FROM public.snapshot_edges e
    JOIN public.relation_types rt2 ON rt2.id = e.relation_type_id
    WHERE e.snapshot_id = v_latest_snapshot_id
      AND (
        (e.source_node_id = v_remapped_source AND e.target_node_id = v_remapped_target)
        OR (rt2.is_directed = false AND e.source_node_id = v_remapped_target AND e.target_node_id = v_remapped_source)
      );

    -- (쌍, 제안 종류) 조합이 이미 존재하면(무변경/유니크 충돌) 무효.
    SELECT count(*) INTO v_dup_count
    FROM public.snapshot_edges e
    WHERE e.snapshot_id = v_latest_snapshot_id
      AND e.relation_type_id = v_proposal.relation_type_id
      AND (
        (e.source_node_id = v_remapped_source AND e.target_node_id = v_remapped_target)
        OR (
          v_relation_type.is_directed = false
          AND e.source_node_id = v_remapped_target AND e.target_node_id = v_remapped_source
        )
      );

    IF v_dup_count > 0 THEN
      RETURN QUERY SELECT false, 'EDGE_ALREADY_EXISTS'::text, v_latest_snapshot_id, v_remapped_source, v_remapped_target, v_edge_id;
      RETURN;
    END IF;

    RETURN QUERY SELECT true, NULL::text, v_latest_snapshot_id, v_remapped_source, v_remapped_target, v_edge_id;
    RETURN;

  ELSE -- relation_delete
    IF v_proposal.relation_type_id IS NULL THEN
      -- R-4 방어: 정상 경로에서는 발생 불가하나 방어적으로 무효 처리.
      RETURN QUERY SELECT false, 'EDGE_NOT_FOUND'::text, v_latest_snapshot_id, v_remapped_source, v_remapped_target, NULL::uuid;
      RETURN;
    END IF;

    SELECT rt.* INTO v_relation_type FROM public.relation_types rt WHERE rt.id = v_proposal.relation_type_id;

    SELECT e.id INTO v_edge_id
    FROM public.snapshot_edges e
    WHERE e.snapshot_id = v_latest_snapshot_id
      AND e.relation_type_id = v_proposal.relation_type_id
      AND (
        (e.source_node_id = v_remapped_source AND e.target_node_id = v_remapped_target)
        OR (
          COALESCE(v_relation_type.is_directed, true) = false
          AND e.source_node_id = v_remapped_target AND e.target_node_id = v_remapped_source
        )
      )
    LIMIT 1;

    IF v_edge_id IS NULL THEN
      RETURN QUERY SELECT false, 'EDGE_NOT_FOUND'::text, v_latest_snapshot_id, v_remapped_source, v_remapped_target, NULL::uuid;
      RETURN;
    END IF;

    RETURN QUERY SELECT true, NULL::text, v_latest_snapshot_id, v_remapped_source, v_remapped_target, v_edge_id;
    RETURN;
  END IF;
END;
$$;

COMMENT ON FUNCTION public.llm_proposal_applicability(uuid) IS
  'UC-022 단일 SOT — 최신 구성 대조(재매핑·엣지 존재/중복·활성·체인 적격) 판정. list_llm_proposals()와 approve_llm_proposal()가 공용한다(R-5).';

-- ============================================================
-- ② list_llm_proposals(p_status, p_limit, p_offset)
-- ============================================================
CREATE OR REPLACE FUNCTION public.list_llm_proposals(
  p_status llm_proposal_status,
  p_limit int,
  p_offset int
)
RETURNS TABLE (
  proposal_id uuid,
  chain_id uuid,
  chain_name text,
  proposal_type llm_proposal_type,
  status llm_proposal_status,
  source_node_id uuid,
  source_display_name text,
  source_node_kind node_kind,
  source_ticker text,
  target_node_id uuid,
  target_display_name text,
  target_node_kind node_kind,
  target_ticker text,
  relation_type_id uuid,
  relation_type_name text,
  relation_type_is_active boolean,
  disclosure_id uuid,
  disclosure_title text,
  disclosure_date date,
  disclosure_url text,
  disclosure_source data_source,
  rationale text,
  based_on_snapshot_id uuid,
  created_at timestamptz,
  reviewed_by uuid,
  reviewed_at timestamptz,
  resulting_snapshot_id uuid,
  is_applicable boolean,
  applicability_reason text
)
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
STABLE
AS $$
  SELECT
    p.id AS proposal_id,
    p.chain_id,
    vc.name AS chain_name,
    p.proposal_type,
    p.status,
    p.source_node_id,
    CASE WHEN sn_src.node_kind = 'listed_company' THEN sec_src.name ELSE sn_src.subject_name END AS source_display_name,
    sn_src.node_kind AS source_node_kind,
    sec_src.ticker AS source_ticker,
    p.target_node_id,
    CASE WHEN sn_tgt.node_kind = 'listed_company' THEN sec_tgt.name ELSE sn_tgt.subject_name END AS target_display_name,
    sn_tgt.node_kind AS target_node_kind,
    sec_tgt.ticker AS target_ticker,
    p.relation_type_id,
    rt.name AS relation_type_name,
    rt.is_active AS relation_type_is_active,
    p.disclosure_id,
    d.title AS disclosure_title,
    d.disclosure_date,
    d.url AS disclosure_url,
    d.source AS disclosure_source,
    p.rationale,
    p.based_on_snapshot_id,
    p.created_at,
    p.reviewed_by,
    p.reviewed_at,
    p.resulting_snapshot_id,
    CASE WHEN p.status = 'pending' THEN COALESCE(app.is_applicable, false) ELSE true END AS is_applicable,
    CASE WHEN p.status = 'pending' THEN app.reason ELSE NULL END AS applicability_reason
  FROM public.llm_relation_proposals p
  JOIN public.value_chains vc ON vc.id = p.chain_id
  JOIN public.snapshot_nodes sn_src ON sn_src.id = p.source_node_id
  JOIN public.snapshot_nodes sn_tgt ON sn_tgt.id = p.target_node_id
  LEFT JOIN public.securities sec_src ON sec_src.id = sn_src.security_id
  LEFT JOIN public.securities sec_tgt ON sec_tgt.id = sn_tgt.security_id
  LEFT JOIN public.relation_types rt ON rt.id = p.relation_type_id
  LEFT JOIN public.disclosures d ON d.id = p.disclosure_id
  LEFT JOIN LATERAL (
    SELECT a.is_applicable, a.reason
    FROM public.llm_proposal_applicability(p.id) a
  ) app ON p.status = 'pending'
  WHERE p.status = p_status
  ORDER BY p.created_at ASC, p.id ASC
  LIMIT p_limit OFFSET p_offset;
$$;

COMMENT ON FUNCTION public.list_llm_proposals(llm_proposal_status, int, int) IS
  'UC-022 검토 큐 목록 조회. pending 상태만 llm_proposal_applicability()로 최신 구성 대조(R-6).';

-- ============================================================
-- ③ approve_llm_proposal(p_proposal_id, p_reviewer_id)
-- ============================================================
CREATE OR REPLACE FUNCTION public.approve_llm_proposal(
  p_proposal_id uuid,
  p_reviewer_id uuid
)
RETURNS TABLE (
  outcome text,
  conflict_reason text,
  resulting_snapshot_id uuid,
  effective_at timestamptz
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_proposal record;
  v_chain record;
  v_app record;
  v_now timestamptz := now();
  v_new_snapshot_id uuid;
  v_group_map jsonb := '{}'::jsonb;
  v_node_map jsonb := '{}'::jsonb;
  v_group record;
  v_node record;
  v_edge record;
  v_new_group_id uuid;
  v_new_node_id uuid;
  v_new_source uuid;
  v_new_target uuid;
  v_disclosure_date date;
BEGIN
  -- 1) 제안 행 잠금(R-8: 잠금 순서 "제안 행 → 체인 행" 고정).
  SELECT p.* INTO v_proposal
  FROM public.llm_relation_proposals p
  WHERE p.id = p_proposal_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT 'not_found'::text, NULL::text, NULL::uuid, NULL::timestamptz;
    RETURN;
  END IF;

  IF v_proposal.status <> 'pending' THEN
    RETURN QUERY SELECT 'already_processed'::text, NULL::text, NULL::uuid, NULL::timestamptz;
    RETURN;
  END IF;

  -- 2) 체인 행 잠금(동일 체인 스냅샷 생성 직렬화, R-8·BR-4·E6).
  SELECT vc.* INTO v_chain
  FROM public.value_chains vc
  WHERE vc.id = v_proposal.chain_id
  FOR UPDATE;

  -- 3) 적용 가능성 재판정(잠금 하에서 최신 구성 확정).
  SELECT * INTO v_app FROM public.llm_proposal_applicability(p_proposal_id);

  IF v_app.reason = 'CHAIN_NOT_APPLICABLE' THEN
    RETURN QUERY SELECT 'chain_not_applicable'::text, NULL::text, NULL::uuid, NULL::timestamptz;
    RETURN;
  END IF;

  IF v_app.reason = 'RELATION_TYPE_INACTIVE' THEN
    RETURN QUERY SELECT 'relation_type_inactive'::text, NULL::text, NULL::uuid, NULL::timestamptz;
    RETURN;
  END IF;

  IF v_app.is_applicable IS NOT TRUE THEN
    -- NODE_NOT_FOUND / EDGE_NOT_FOUND / EDGE_ALREADY_EXISTS → invalidated 전환 후 커밋(E1/E2/E3, R-9).
    UPDATE public.llm_relation_proposals
    SET status = 'invalidated', reviewed_by = p_reviewer_id, reviewed_at = v_now
    WHERE id = p_proposal_id;

    RETURN QUERY SELECT 'conflict_invalidated'::text, v_app.reason, NULL::uuid, NULL::timestamptz;
    RETURN;
  END IF;

  -- 4) 전부 통과 — 새 스냅샷 생성(BR-3, 승인 1건=1스냅샷).
  SELECT d.disclosure_date INTO v_disclosure_date
  FROM public.disclosures d
  WHERE d.id = v_proposal.disclosure_id;

  INSERT INTO public.chain_snapshots (chain_id, effective_at, change_source, disclosure_date, created_by)
  VALUES (v_proposal.chain_id, v_now, 'llm_approval'::public.snapshot_source, v_disclosure_date, p_reviewer_id)
  RETURNING id INTO v_new_snapshot_id;

  -- 4-1) 그룹 복사(구ID→신ID 매핑을 jsonb에 축적).
  FOR v_group IN
    SELECT * FROM public.snapshot_groups WHERE snapshot_id = v_app.latest_snapshot_id
  LOOP
    INSERT INTO public.snapshot_groups (snapshot_id, name)
    VALUES (v_new_snapshot_id, v_group.name)
    RETURNING id INTO v_new_group_id;

    v_group_map := v_group_map || jsonb_build_object(v_group.id::text, v_new_group_id::text);
  END LOOP;

  -- 4-2) 노드 복사(그룹 매핑 적용, 좌표·정체성 필드 보존, 구노드ID→신노드ID 매핑).
  FOR v_node IN
    SELECT * FROM public.snapshot_nodes WHERE snapshot_id = v_app.latest_snapshot_id
  LOOP
    INSERT INTO public.snapshot_nodes (
      snapshot_id, group_id, node_kind, security_id,
      subject_name, subject_type, subject_memo, position_x, position_y
    )
    VALUES (
      v_new_snapshot_id,
      CASE
        WHEN v_node.group_id IS NULL THEN NULL
        ELSE (v_group_map ->> v_node.group_id::text)::uuid
      END,
      v_node.node_kind, v_node.security_id,
      v_node.subject_name, v_node.subject_type, v_node.subject_memo,
      v_node.position_x, v_node.position_y
    )
    RETURNING id INTO v_new_node_id;

    v_node_map := v_node_map || jsonb_build_object(v_node.id::text, v_new_node_id::text);
  END LOOP;

  -- 4-3) 엣지 복사 + 제안 변경 반영.
  --      add: 최신 엣지 전부 복사 + 재매핑 신규 엣지 1건 추가
  --      update: 대상 엣지만 관계 종류 교체, 나머지는 그대로 복사
  --      delete: 대상 엣지만 제외하고 복사
  FOR v_edge IN
    SELECT * FROM public.snapshot_edges WHERE snapshot_id = v_app.latest_snapshot_id
  LOOP
    IF v_proposal.proposal_type = 'relation_delete' AND v_edge.id = v_app.target_edge_id THEN
      CONTINUE; -- 제외
    END IF;

    v_new_source := (v_node_map ->> v_edge.source_node_id::text)::uuid;
    v_new_target := (v_node_map ->> v_edge.target_node_id::text)::uuid;

    IF v_proposal.proposal_type = 'relation_update' AND v_edge.id = v_app.target_edge_id THEN
      INSERT INTO public.snapshot_edges (snapshot_id, source_node_id, target_node_id, relation_type_id)
      VALUES (v_new_snapshot_id, v_new_source, v_new_target, v_proposal.relation_type_id);
    ELSE
      INSERT INTO public.snapshot_edges (snapshot_id, source_node_id, target_node_id, relation_type_id)
      VALUES (v_new_snapshot_id, v_new_source, v_new_target, v_edge.relation_type_id);
    END IF;
  END LOOP;

  IF v_proposal.proposal_type = 'relation_add' THEN
    INSERT INTO public.snapshot_edges (snapshot_id, source_node_id, target_node_id, relation_type_id)
    VALUES (
      v_new_snapshot_id,
      (v_node_map ->> v_app.remapped_source_node_id::text)::uuid,
      (v_node_map ->> v_app.remapped_target_node_id::text)::uuid,
      v_proposal.relation_type_id
    );
  END IF;

  -- 5) 제안 갱신.
  UPDATE public.llm_relation_proposals
  SET status = 'approved',
      reviewed_by = p_reviewer_id,
      reviewed_at = v_now,
      resulting_snapshot_id = v_new_snapshot_id
  WHERE id = p_proposal_id;

  RETURN QUERY SELECT 'approved'::text, NULL::text, v_new_snapshot_id, v_now;
END;
$$;

COMMENT ON FUNCTION public.approve_llm_proposal(uuid, uuid) IS
  'UC-022 승인 원자 트랜잭션. 예외 대신 outcome 코드 반환(R-9) — conflict_invalidated는 커밋되어야 하므로 RAISE 금지. 예기치 못한 오류만 예외 전파(E14, 전체 롤백).';
