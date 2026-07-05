-- 0010_chain_metrics.sql
-- 밸류체인 일별/분기 지표 사전 집계(userflow 029, 뷰 대시보드 010/타임라인 012의 소스).
-- 가치총액은 일 단위, 매출 합계는 분기 단위. 둘 다 스냅샷 구성 기준으로 집계하며 커버리지(반영 n/전체 m)를 보관한다.
-- 데이터 정정 시 영향 기간 UPSERT 재집계, 구조 변경분은 과거 재계산하지 않음.
-- 규칙: RLS 전면 비활성, snake_case, 멱등. 0005(value_chains)·0006(chain_snapshots) 선행 가정.

-- 일별 가치총액 지표(KRW). 각 일자의 유효 스냅샷 구성 기준.
CREATE TABLE IF NOT EXISTS chain_daily_metrics (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chain_id              uuid NOT NULL REFERENCES value_chains (id) ON DELETE CASCADE,
  metric_date           date NOT NULL,                 -- 지표 일자
  based_on_snapshot_id  uuid REFERENCES chain_snapshots (id) ON DELETE SET NULL, -- 집계 기준 스냅샷(구성 기준)
  total_market_cap_krw  numeric(28, 2),                -- 가치총액 = Σ(종가 × 최신 상장주식수), KRW 환산
  covered_node_count    integer NOT NULL DEFAULT 0,     -- 지표 반영 노드 수(n): 시세 있는 상장기업 노드
  total_node_count      integer NOT NULL DEFAULT 0,     -- 전체 노드 수(m): 커버리지 분모
  is_carried_forward    boolean NOT NULL DEFAULT false, -- 시세/환율 결측으로 직전 관측값 이월 집계 여부
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE chain_daily_metrics IS '체인별 일별 가치총액·커버리지. 정정 시 UPSERT 재집계 허용. 구조 변경분은 변경 시점 이후부터 새 구성으로 집계(과거 미재계산).';
COMMENT ON COLUMN chain_daily_metrics.covered_node_count IS '커버리지 표기 "반영 n/전체 m"의 n. m = total_node_count.';

CREATE UNIQUE INDEX IF NOT EXISTS uq_chain_daily_metrics_chain_date
  ON chain_daily_metrics (chain_id, metric_date);
CREATE INDEX IF NOT EXISTS idx_chain_daily_metrics_chain_date
  ON chain_daily_metrics (chain_id, metric_date DESC);

-- 분기 매출 합계 지표(KRW). 역년 정규화 축(calendar_year/quarter) 기준으로 집계한다.
-- 결산월이 다른 기업을 동일 역년 분기에 정렬해 합산하며, 분기 말일 환율로 환산, 태그 미매핑·연간전용 기업은 제외하고 제외 수를 표기.
CREATE TABLE IF NOT EXISTS chain_quarterly_metrics (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chain_id                 uuid NOT NULL REFERENCES value_chains (id) ON DELETE CASCADE,
  calendar_year            smallint NOT NULL,             -- 역년 정규화 연도(0008 calendar_year 축)
  calendar_quarter         smallint NOT NULL,             -- 역년 정규화 분기 1~4
  based_on_snapshot_id     uuid REFERENCES chain_snapshots (id) ON DELETE SET NULL,
  total_revenue_krw        numeric(28, 2),                -- 구성 기업 매출 합계(분기 말일 환율 환산)
  covered_node_count       integer NOT NULL DEFAULT 0,     -- 매출 반영 노드 수(n)
  total_node_count         integer NOT NULL DEFAULT 0,     -- 전체 노드 수(m)
  excluded_unmapped_count  integer NOT NULL DEFAULT 0,     -- 미국 태그 미매핑·연간전용(20-F) 등으로 제외된 기업 수(userflow 010/027)
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_cqm_quarter CHECK (calendar_quarter BETWEEN 1 AND 4)
);

COMMENT ON TABLE chain_quarterly_metrics IS '체인별 분기 매출 합계·커버리지·제외 기업 수. 역년 정규화 축(calendar_year/quarter) 기준 집계(0008). 재무 정정 시 UPSERT 재집계. 매출 중복·비관련 사업부 포함 가능성은 UI 툴팁으로 안내.';

CREATE UNIQUE INDEX IF NOT EXISTS uq_chain_quarterly_metrics_chain_period
  ON chain_quarterly_metrics (chain_id, calendar_year, calendar_quarter);
CREATE INDEX IF NOT EXISTS idx_chain_quarterly_metrics_chain_period
  ON chain_quarterly_metrics (chain_id, calendar_year DESC, calendar_quarter DESC);

-- updated_at 트리거.
DROP TRIGGER IF EXISTS trg_set_updated_at ON chain_daily_metrics;
CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON chain_daily_metrics
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_set_updated_at ON chain_quarterly_metrics;
CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON chain_quarterly_metrics
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE chain_daily_metrics DISABLE ROW LEVEL SECURITY;
ALTER TABLE chain_quarterly_metrics DISABLE ROW LEVEL SECURITY;
