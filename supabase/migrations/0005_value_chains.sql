-- 0005_value_chains.sql
-- 밸류체인 헤더. 공식(official, 전체 공개)/사용자(user, 본인만) 구분.
-- 실제 구조(노드/엣지/그룹)는 저장 1회당 1스냅샷으로 chain_snapshots(0006)에 보관하며,
-- "현재 구성" = 해당 체인의 최신 스냅샷이다(별도 current 테이블을 두지 않는다).

-- 체인 종류.
DO $$ BEGIN
  CREATE TYPE chain_type AS ENUM ('official', 'user');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 밸류체인 기준(산업 중심/기업 중심).
DO $$ BEGIN
  CREATE TYPE chain_focus_type AS ENUM ('industry', 'company');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS value_chains (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chain_type         chain_type NOT NULL,
  owner_id           uuid REFERENCES profiles (id) ON DELETE CASCADE, -- 공식=NULL, 사용자=소유자
  name               text NOT NULL,
  focus_type         chain_focus_type NOT NULL,
  focus_security_id  uuid REFERENCES securities (id) ON DELETE SET NULL, -- 기업 중심일 때 대상 기업(선택)
  is_archived        boolean NOT NULL DEFAULT false, -- 공식 체인 삭제=보관(비공개 전환), 물리 삭제 금지
  source_chain_id    uuid REFERENCES value_chains (id) ON DELETE SET NULL, -- 복제 출처(독립 사본)
  source_copied_at   timestamptz,                    -- 복제 시각(메타데이터, 동기화 없음)
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  -- 공식 체인은 소유자가 없어야 하고, 사용자 체인은 소유자가 있어야 한다.
  CONSTRAINT chk_value_chains_owner CHECK (
    (chain_type = 'official' AND owner_id IS NULL) OR
    (chain_type = 'user' AND owner_id IS NOT NULL)
  )
);

COMMENT ON TABLE value_chains IS '밸류체인 헤더. 1인당 체인 최대 50개(MAX_CHAINS_PER_USER, 앱 레벨 상수 검증). 탈퇴 시 소유 체인 CASCADE 삭제.';
COMMENT ON COLUMN value_chains.is_archived IS '공식 체인 삭제는 물리 삭제 대신 보관(비공개 전환). 복제본·스냅샷에 영향 없음(userflow 021).';
COMMENT ON COLUMN value_chains.source_chain_id IS '복제 출처. 복제본은 복제 시점의 완전 독립 사본이며 원본과 동기화되지 않는다(userflow 014).';

-- 동일 사용자 내 체인 이름 중복 불허(사용자 체인).
CREATE UNIQUE INDEX IF NOT EXISTS uq_value_chains_owner_name
  ON value_chains (owner_id, name) WHERE chain_type = 'user';
-- 공식 체인 이름은 전역 유일(PRD Open Questions #11).
CREATE UNIQUE INDEX IF NOT EXISTS uq_value_chains_official_name
  ON value_chains (name) WHERE chain_type = 'official';

CREATE INDEX IF NOT EXISTS idx_value_chains_owner ON value_chains (owner_id);
CREATE INDEX IF NOT EXISTS idx_value_chains_type_archived ON value_chains (chain_type, is_archived);
CREATE INDEX IF NOT EXISTS idx_value_chains_focus_security ON value_chains (focus_security_id);

DROP TRIGGER IF EXISTS trg_set_updated_at ON value_chains;
CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON value_chains
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE value_chains DISABLE ROW LEVEL SECURITY;
