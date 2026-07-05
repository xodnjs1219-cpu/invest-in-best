-- 0006_chain_snapshots.sql
-- 구조 스냅샷: 저장 1회 = 1스냅샷(공식/사용자 동일, LLM 승인 1건도 1스냅샷).
-- 하나의 스냅샷은 그 시점의 노드/그룹/엣지 전체 구성을 담는 불변(immutable) 사본이다.
-- 임의 날짜 D 조회 시 "effective_at <= D 인 마지막 스냅샷"을 복원한다(userflow 012).
-- 최신 스냅샷 = 현재 구성. 편집은 클라이언트 임시 상태이며 DB 초안 저장은 없다(userflow 018).

-- 스냅샷 발생 원인.
DO $$ BEGIN
  CREATE TYPE snapshot_source AS ENUM ('user_save', 'admin_edit', 'llm_approval');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 노드 종류.
DO $$ BEGIN
  CREATE TYPE node_kind AS ENUM ('listed_company', 'free_subject');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 자유 주체 유형(userflow 011/015: 이름·주체 유형·설명 메모 3필드).
DO $$ BEGIN
  CREATE TYPE subject_type AS ENUM ('consumer', 'government', 'private_company', 'other');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 스냅샷 헤더.
CREATE TABLE IF NOT EXISTS chain_snapshots (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chain_id         uuid NOT NULL REFERENCES value_chains (id) ON DELETE CASCADE,
  effective_at     timestamptz NOT NULL DEFAULT now(), -- 유효 시점 = 저장/승인/편집 시각(타임라인 기준)
  change_source    snapshot_source NOT NULL,
  disclosure_date  date,                               -- 근거 공시일(메타데이터, LLM 승인/공식 편집 시)
  created_by       uuid REFERENCES profiles (id) ON DELETE SET NULL, -- 편집/승인 주체(시스템=NULL)
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE chain_snapshots IS '구조 변경 이벤트 = 1스냅샷. effective_at 이 타임라인 복원의 기준 시각. 과거 지표는 이 스냅샷 구성 기준으로 집계된다.';

CREATE INDEX IF NOT EXISTS idx_chain_snapshots_chain_effective
  ON chain_snapshots (chain_id, effective_at DESC);

-- 노드 그룹(체인 스냅샷 소속). 한 노드는 최대 1개 그룹(중첩 없음).
CREATE TABLE IF NOT EXISTS snapshot_groups (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_id  uuid NOT NULL REFERENCES chain_snapshots (id) ON DELETE CASCADE,
  name         text NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  -- 노드의 (group_id, snapshot_id) 복합 FK 타겟(동일 스냅샷 소속 강제용).
  CONSTRAINT uq_snapshot_groups_id_snapshot UNIQUE (id, snapshot_id)
);

COMMENT ON TABLE snapshot_groups IS '노드 그룹(밸류체인 단계 등). 스냅샷에 함께 복원된다. 빈 그룹 허용(표시 정책은 앱 처리).';

CREATE INDEX IF NOT EXISTS idx_snapshot_groups_snapshot ON snapshot_groups (snapshot_id);

-- 노드(주체). 상장기업 노드는 securities 연결, 자유 주체 노드는 이름/유형/메모.
CREATE TABLE IF NOT EXISTS snapshot_nodes (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_id   uuid NOT NULL REFERENCES chain_snapshots (id) ON DELETE CASCADE,
  group_id      uuid,                                                    -- 노드당 최대 1그룹(같은 스냅샷 소속만, 아래 복합 FK)
  node_kind     node_kind NOT NULL,
  security_id   uuid REFERENCES securities (id) ON DELETE RESTRICT,      -- 상장기업 노드 전용(종목 물리 삭제 금지 정책)
  subject_name  text,          -- 자유 주체 노드 전용
  subject_type  subject_type,  -- 자유 주체 노드 전용
  subject_memo  text,          -- 자유 주체 노드 전용(선택)
  position_x    numeric,       -- 편집 캔버스 배치 X 좌표(저장·타임라인 복원 대상, userflow 018)
  position_y    numeric,       -- 편집 캔버스 배치 Y 좌표
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  -- 엣지의 (node_id, snapshot_id) 복합 FK 타겟.
  CONSTRAINT uq_snapshot_nodes_id_snapshot UNIQUE (id, snapshot_id),
  -- 그룹은 동일 스냅샷 소속만 참조. 그룹 삭제 시 group_id 만 NULL 로(snapshot_id 는 NOT NULL 유지, PG15+ 컬럼 지정 SET NULL).
  CONSTRAINT fk_snapshot_nodes_group FOREIGN KEY (group_id, snapshot_id)
    REFERENCES snapshot_groups (id, snapshot_id) ON DELETE SET NULL (group_id),
  -- 노드 종류별 필드 일관성.
  CONSTRAINT chk_snapshot_nodes_kind CHECK (
    (node_kind = 'listed_company' AND security_id IS NOT NULL AND subject_name IS NULL) OR
    (node_kind = 'free_subject'   AND security_id IS NULL AND subject_name IS NOT NULL AND subject_type IS NOT NULL)
  )
);

COMMENT ON TABLE snapshot_nodes IS '스냅샷 노드. 체인당 최대 100개(MAX_NODES_PER_CHAIN, 앱 레벨 상수 검증). 상장기업 노드만 지표 합산 대상.';
COMMENT ON COLUMN snapshot_nodes.security_id IS 'ON DELETE RESTRICT: 종목 물리 삭제 금지. 상장폐지는 securities.listing_status 로 소프트 처리하며 과거 스냅샷 구성은 그대로 보존한다.';
COMMENT ON COLUMN snapshot_nodes.position_x IS '캔버스 좌표. 저장(018) 시 스냅샷에 함께 보존되어 타임라인 복원 시 배치가 재현된다. 뷰 전용 위치 조정(009)은 저장하지 않음.';

CREATE INDEX IF NOT EXISTS idx_snapshot_nodes_snapshot ON snapshot_nodes (snapshot_id);
CREATE INDEX IF NOT EXISTS idx_snapshot_nodes_group ON snapshot_nodes (group_id);
CREATE INDEX IF NOT EXISTS idx_snapshot_nodes_security ON snapshot_nodes (security_id);
-- 한 스냅샷(=한 체인 구성) 내 동일 종목 노드는 1개만 허용(userflow 015).
CREATE UNIQUE INDEX IF NOT EXISTS uq_snapshot_nodes_security
  ON snapshot_nodes (snapshot_id, security_id) WHERE security_id IS NOT NULL;

-- 엣지(관계). 관계 종류 마스터를 FK 로 참조(RESTRICT: 마스터 물리 삭제 차단).
CREATE TABLE IF NOT EXISTS snapshot_edges (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_id       uuid NOT NULL REFERENCES chain_snapshots (id) ON DELETE CASCADE,
  source_node_id    uuid NOT NULL,
  target_node_id    uuid NOT NULL,
  relation_type_id  uuid NOT NULL REFERENCES relation_types (id) ON DELETE RESTRICT,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  -- source/target 노드는 반드시 같은 스냅샷 소속(복합 FK로 강제). 노드 삭제 시 엣지도 CASCADE.
  CONSTRAINT fk_snapshot_edges_source FOREIGN KEY (source_node_id, snapshot_id)
    REFERENCES snapshot_nodes (id, snapshot_id) ON DELETE CASCADE,
  CONSTRAINT fk_snapshot_edges_target FOREIGN KEY (target_node_id, snapshot_id)
    REFERENCES snapshot_nodes (id, snapshot_id) ON DELETE CASCADE,
  -- 자기 참조(동일 노드 간) 엣지 불허(userflow 016).
  CONSTRAINT chk_snapshot_edges_no_self CHECK (source_node_id <> target_node_id)
);

COMMENT ON TABLE snapshot_edges IS '스냅샷 엣지. 방향성은 relation_types.is_directed 를 따른다. 동일 쌍+동일 관계 종류 중복 불허, 서로 다른 관계 종류 병존 허용(userflow 016).';

CREATE INDEX IF NOT EXISTS idx_snapshot_edges_snapshot ON snapshot_edges (snapshot_id);
CREATE INDEX IF NOT EXISTS idx_snapshot_edges_source ON snapshot_edges (source_node_id);
CREATE INDEX IF NOT EXISTS idx_snapshot_edges_target ON snapshot_edges (target_node_id);
CREATE INDEX IF NOT EXISTS idx_snapshot_edges_relation_type ON snapshot_edges (relation_type_id);
-- 동일 노드 쌍에 같은 관계 종류 중복 불허(방향 포함). 무향 관계는 앱에서 (source,target) 순서를 정규화.
CREATE UNIQUE INDEX IF NOT EXISTS uq_snapshot_edges_pair_type
  ON snapshot_edges (snapshot_id, source_node_id, target_node_id, relation_type_id);

-- updated_at 트리거.
DROP TRIGGER IF EXISTS trg_set_updated_at ON chain_snapshots;
CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON chain_snapshots
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_set_updated_at ON snapshot_groups;
CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON snapshot_groups
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_set_updated_at ON snapshot_nodes;
CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON snapshot_nodes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_set_updated_at ON snapshot_edges;
CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON snapshot_edges
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE chain_snapshots DISABLE ROW LEVEL SECURITY;
ALTER TABLE snapshot_groups DISABLE ROW LEVEL SECURITY;
ALTER TABLE snapshot_nodes DISABLE ROW LEVEL SECURITY;
ALTER TABLE snapshot_edges DISABLE ROW LEVEL SECURITY;
