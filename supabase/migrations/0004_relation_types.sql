-- 0004_relation_types.sql
-- 관계 종류 마스터(공급/고객/경쟁/협력/지분투자/규제 등).
-- 방향성 속성(유향/무향)을 가지며, 물리 삭제 금지 → is_active 비활성화만 허용(userflow 024).
-- 엣지(snapshot_edges)는 이 마스터를 FK 로 참조하며 참조 무결성상 물리 삭제를 차단(ON DELETE RESTRICT).

CREATE TABLE IF NOT EXISTS relation_types (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text NOT NULL,                 -- 표시 라벨. 변경 시 최신 이름을 따름(라벨 이력 미보존).
  is_directed  boolean NOT NULL DEFAULT true, -- true=유향(source→target), false=무향
  is_active    boolean NOT NULL DEFAULT true, -- false=비활성화(신규 선택 차단, 기존 엣지·스냅샷 유지)
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE relation_types IS '관계 종류 마스터. 물리 삭제 금지, is_active 로만 비활성화. 이름 변경 시 과거 스냅샷도 최신 이름으로 표시(userflow 024).';
COMMENT ON COLUMN relation_types.is_directed IS '방향성 속성. 무향(false) 관계는 (A,B)/(B,A) 중복을 앱 레벨에서 정규화해 저장한다.';

CREATE INDEX IF NOT EXISTS idx_relation_types_active ON relation_types (is_active);

DROP TRIGGER IF EXISTS trg_set_updated_at ON relation_types;
CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON relation_types
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE relation_types DISABLE ROW LEVEL SECURITY;
