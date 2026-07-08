-- 0022_relation_types_admin.sql
-- UC-024 관계 종류 마스터 관리 — 어드민 CRUD를 위한 인덱스·SQL 함수 추가(plan M2).
-- 신규 테이블/컬럼 없음. 기존 스키마(0004_relation_types, 0006_chain_snapshots) 위에
-- ① 이름 정규화 유니크 인덱스, ② 전체 목록 + 사용 여부(isInUse) 판정 RPC 함수만 추가한다.
-- 물리 삭제는 관여하지 않는다 — snapshot_edges/llm_relation_proposals의 relation_type_id
-- ON DELETE RESTRICT(0006·0011 기존)가 DB 레벨 최종 방어선이다(BR-1).

-- ============================================================
-- ① uq_relation_types_name_normalized (R-2)
-- ============================================================
-- btrim(name) 유니크 인덱스 — 동시 생성/변경 레이스에서 중복 이름 유입을 DB 레벨에서 차단한다.
-- 서비스 사전 검사(친절한 409)와 이중 방어를 구성한다. 위반 시 23505 → 서비스가 409로 매핑.
-- 적용 전 기존 데이터에 trim 기준 중복이 있으면 이 인덱스 생성이 실패하므로,
-- 시드 데이터 적재 이전 시점에 적용하는 것이 원칙이다(현재 프로젝트는 시드 이전 상태).
CREATE UNIQUE INDEX IF NOT EXISTS uq_relation_types_name_normalized
  ON relation_types (btrim(name));

COMMENT ON INDEX uq_relation_types_name_normalized IS
  'UC-024 R-2: 앞뒤 공백 제거(trim) 기준 이름 중복을 활성/비활성 전체 대상으로 차단(BR-5).';

-- ============================================================
-- ② admin_list_relation_types() (R-1 단일 SOT)
-- ============================================================
-- 관계 종류 전체 목록 + 사용 여부(is_in_use) 판정. isInUse 판정 범위는 모든 체인
-- (공식+사용자, 보관 포함)의 체인별 최신 스냅샷(effective_at DESC, created_at DESC tie-break)
-- 엣지가 해당 종류를 참조하는지 여부다(R-1). 정렬은 created_at ASC, id ASC(R-5).
CREATE OR REPLACE FUNCTION public.admin_list_relation_types()
RETURNS TABLE (
  id uuid,
  name text,
  is_directed boolean,
  is_active boolean,
  is_in_use boolean,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  WITH latest_snapshots AS (
    SELECT DISTINCT ON (cs.chain_id) cs.id
    FROM public.chain_snapshots cs
    ORDER BY cs.chain_id, cs.effective_at DESC, cs.created_at DESC
  )
  SELECT
    rt.id,
    rt.name,
    rt.is_directed,
    rt.is_active,
    EXISTS (
      SELECT 1
      FROM public.snapshot_edges e
      JOIN latest_snapshots ls ON e.snapshot_id = ls.id
      WHERE e.relation_type_id = rt.id
    ) AS is_in_use,
    rt.created_at,
    rt.updated_at
  FROM public.relation_types rt
  ORDER BY rt.created_at ASC, rt.id ASC;
$$;

COMMENT ON FUNCTION public.admin_list_relation_types() IS
  'UC-024 어드민 관계 종류 마스터 전체 목록(활성/비활성 포함) + isInUse 판정 단일 SOT(R-1). '
  '사용 여부는 모든 체인(보관 포함)의 체인별 최신 스냅샷 엣지 참조 존재로 판정하며, '
  'created_at ASC, id ASC로 정렬한다(R-5).';
