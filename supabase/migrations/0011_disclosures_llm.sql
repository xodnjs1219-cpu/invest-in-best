-- 0011_disclosures_llm.sql
-- 공시 원본(disclosures)과 LLM 관계 변경안 검토 큐(llm_relation_proposals).
-- 공시: 전 종목 1일 1회 수집(국내 DART list.json / 미국 SEC filings). 기업 상세 공시 목록(020)과 LLM 분석(030)의 소스.
-- LLM 검토 큐: 공식 체인 전용, 기존 노드 간 관계 추가/변경/삭제 제안 → 어드민 승인/거부(022).
-- 규칙: RLS 전면 비활성, snake_case, 멱등. 0003·0004·0005·0006·0007 선행 가정.

-- LLM 제안 유형(userflow 022/030: 기존 노드 간 관계로 한정).
DO $$ BEGIN
  CREATE TYPE llm_proposal_type AS ENUM ('relation_add', 'relation_update', 'relation_delete');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 제안 검토 상태.
--   pending      = 검토 대기(큐)
--   approved     = 승인(공식 체인 반영·스냅샷 생성)
--   rejected     = 거부(사유 기록)
--   invalidated  = 참조 노드/관계 유실 등으로 적용 불가(userflow 022 엣지케이스)
DO $$ BEGIN
  CREATE TYPE llm_proposal_status AS ENUM ('pending', 'approved', 'rejected', 'invalidated');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 공시 원본. 최신순 목록·원문 링크(020), LLM 분석 대상 선별(030)에 사용.
CREATE TABLE IF NOT EXISTS disclosures (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  security_id      uuid NOT NULL REFERENCES securities (id) ON DELETE CASCADE,
  source           data_source NOT NULL,           -- dart / sec
  external_id      text NOT NULL,                  -- DART rcept_no(14자리) / SEC accession number
  title            text NOT NULL,                  -- 보고서명(report_nm) / form type
  disclosure_date  date NOT NULL,                  -- 공시일(rcept_dt / filing date)
  url              text,                           -- 원문 링크
  llm_analyzed_at  timestamptz,                    -- LLM 분석 완료 시각(NULL=미분석, 030 선별 기준)
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE disclosures IS '공시 원본. 종목 상세 공시 목록(020)과 LLM 관계 분석(030)의 소스. 정정 공시는 멱등 UPSERT.';
COMMENT ON COLUMN disclosures.llm_analyzed_at IS 'NULL이면 미분석. LLM 배치(030)가 신규 공시 선별에 사용하고 분석 후 시각을 기록해 재분석을 방지.';

-- 소스별 외부 식별자 유일(중복/정정 공시 멱등 처리).
CREATE UNIQUE INDEX IF NOT EXISTS uq_disclosures_source_external
  ON disclosures (source, external_id);
CREATE INDEX IF NOT EXISTS idx_disclosures_security_date
  ON disclosures (security_id, disclosure_date DESC);
-- 미분석 신규 공시 스캔용(030).
CREATE INDEX IF NOT EXISTS idx_disclosures_unanalyzed
  ON disclosures (disclosure_date) WHERE llm_analyzed_at IS NULL;

-- LLM 관계 변경안 검토 큐. 제안은 생성 시점 기준 스냅샷의 기존 노드 쌍을 참조한다.
CREATE TABLE IF NOT EXISTS llm_relation_proposals (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chain_id              uuid NOT NULL REFERENCES value_chains (id) ON DELETE CASCADE,       -- 대상 공식 체인
  based_on_snapshot_id  uuid NOT NULL REFERENCES chain_snapshots (id) ON DELETE CASCADE,    -- 제안 생성 기준 스냅샷
  proposal_type         llm_proposal_type NOT NULL,
  source_node_id        uuid NOT NULL REFERENCES snapshot_nodes (id) ON DELETE CASCADE,     -- 기존 노드(기준 스냅샷)
  target_node_id        uuid NOT NULL REFERENCES snapshot_nodes (id) ON DELETE CASCADE,
  relation_type_id      uuid REFERENCES relation_types (id) ON DELETE RESTRICT,             -- 제안 관계 종류(add/update). 관계 종류 물리 삭제 금지 정책(DB 레벨 완결)
  disclosure_id         uuid REFERENCES disclosures (id) ON DELETE SET NULL,                -- 근거 공시(FK)
  rationale             text,                          -- LLM 근거 설명
  status                llm_proposal_status NOT NULL DEFAULT 'pending',
  reviewed_by           uuid REFERENCES profiles (id) ON DELETE SET NULL,                   -- 승인/거부 어드민
  reviewed_at           timestamptz,
  review_note           text,                          -- 거부 사유 등
  resulting_snapshot_id uuid REFERENCES chain_snapshots (id) ON DELETE SET NULL,            -- 승인 시 생성된 스냅샷(022)
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_llm_proposal_no_self CHECK (source_node_id <> target_node_id)
);

COMMENT ON TABLE llm_relation_proposals IS 'LLM 관계 변경안 검토 큐. 공식 체인 전용, 기존 노드 간 관계로 한정. 승인 1건당 1스냅샷(022). 참조 노드/관계 유실 시 invalidated 처리.';
COMMENT ON COLUMN llm_relation_proposals.based_on_snapshot_id IS '제안 생성 시점의 공식 체인 스냅샷. source/target 노드는 이 스냅샷의 노드를 가리킨다(불변). 승인 시 현재 구성과 대조.';

CREATE INDEX IF NOT EXISTS idx_llm_proposals_chain ON llm_relation_proposals (chain_id);
-- 대기 큐 로드(022): 상태별·생성순.
CREATE INDEX IF NOT EXISTS idx_llm_proposals_status_created
  ON llm_relation_proposals (status, created_at);
CREATE INDEX IF NOT EXISTS idx_llm_proposals_disclosure ON llm_relation_proposals (disclosure_id);
-- 중복 대기 제안 방지(userflow 030 엣지케이스): 같은 체인·노드쌍·관계종류·유형의 pending 은 1건만.
-- relation_type_id 가 NULL(relation_delete)인 경우도 중복 제거되도록 NULLS NOT DISTINCT(PG15+).
CREATE UNIQUE INDEX IF NOT EXISTS uq_llm_proposals_pending
  ON llm_relation_proposals (chain_id, source_node_id, target_node_id, relation_type_id, proposal_type)
  NULLS NOT DISTINCT
  WHERE status = 'pending';

-- updated_at 트리거.
DROP TRIGGER IF EXISTS trg_set_updated_at ON disclosures;
CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON disclosures
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_set_updated_at ON llm_relation_proposals;
CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON llm_relation_proposals
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE disclosures DISABLE ROW LEVEL SECURITY;
ALTER TABLE llm_relation_proposals DISABLE ROW LEVEL SECURITY;
