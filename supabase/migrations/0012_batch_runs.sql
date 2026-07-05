-- 0012_batch_runs.sql
-- 배치 잡 실행 이력(batch_runs), 종목 단위 실패·재시도 추적(batch_item_failures),
-- 백필 재개용 체크포인트/커서(batch_checkpoints).
-- 어드민 배치 모니터링(userflow 023, 조회 전용)의 소스. 워커와 웹은 이 테이블로 완전 디커플.
-- 규칙: RLS 전면 비활성, snake_case, 멱등. 0001(공통 함수)·0003(securities/market_code) 선행 가정.

-- 배치 잡 종류(techstack §4·§8 잡 명칭과 일치).
DO $$ BEGIN
  CREATE TYPE batch_job_type AS ENUM (
    'collect_quotes',            -- 026 시세 수집
    'collect_financials',        -- 027 재무/공시/기업정보 수집
    'collect_fx_market_hours',   -- 028 환율·장 운영시간 수집
    'aggregate_daily_metrics',   -- 029 일별 체인 지표 집계
    'analyze_disclosures',       -- 030 LLM 공시 분석
    'backfill_all'               -- 031 최초 전 종목 백필
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 실행 상태(userflow 023: 성공/실패/부분성공/진행 중).
DO $$ BEGIN
  CREATE TYPE batch_run_status AS ENUM ('running', 'success', 'partial_success', 'failed');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 잡 실행 이력. 잡 1회 실행 = 1행.
CREATE TABLE IF NOT EXISTS batch_runs (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type         batch_job_type NOT NULL,
  status           batch_run_status NOT NULL DEFAULT 'running',
  started_at       timestamptz NOT NULL DEFAULT now(),
  finished_at      timestamptz,
  processed_count  integer NOT NULL DEFAULT 0,     -- 처리 건수
  failed_count     integer NOT NULL DEFAULT 0,     -- 실패 건수
  is_carried_over  boolean NOT NULL DEFAULT false, -- API 일일 한도 초과로 다음 실행 이월 여부(userflow 023/027)
  error_log        text,                           -- 실패 요약 로그(어드민 상세 조회)
  target_market    market_code,                    -- 시장 한정 실행 시(선택)
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE batch_runs IS '배치 실행 이력. 어드민 모니터링(023) 조회 전용. 상태/시작·종료/처리·실패 건수/한도 이월/실패 로그 기록.';

-- 잡 종류별 최근 실행 조회(모니터링 목록).
CREATE INDEX IF NOT EXISTS idx_batch_runs_job_started
  ON batch_runs (job_type, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_batch_runs_status ON batch_runs (status);

-- 종목 단위 실패·재시도 추적(userflow 026/027/031: 종목 단위 3회 지수 백오프, 최종 실패 다음 주기 재포함).
CREATE TABLE IF NOT EXISTS batch_item_failures (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_run_id   uuid NOT NULL REFERENCES batch_runs (id) ON DELETE CASCADE,
  security_id    uuid REFERENCES securities (id) ON DELETE CASCADE, -- 대상 종목(비종목 항목이면 NULL)
  attempt_count  smallint NOT NULL DEFAULT 1,     -- 시도 횟수(최대 3, 지수 백오프)
  last_error     text,                            -- 최종 오류 메시지
  is_resolved    boolean NOT NULL DEFAULT false,  -- 이후 주기에서 성공 재포함 여부
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE batch_item_failures IS '종목 단위 실패 추적. 최종 실패는 기록 후 다음 정기 주기에 자동 재포함. 재시도 횟수·최종 오류·해소 여부 보관.';

CREATE INDEX IF NOT EXISTS idx_batch_item_failures_run ON batch_item_failures (batch_run_id);
CREATE INDEX IF NOT EXISTS idx_batch_item_failures_security ON batch_item_failures (security_id);
-- 미해소 실패 재포함 스캔용 부분 인덱스.
CREATE INDEX IF NOT EXISTS idx_batch_item_failures_unresolved
  ON batch_item_failures (security_id) WHERE is_resolved = false;

-- 백필 재개용 체크포인트/커서(userflow 031: 종목·기간 단위 분할, 재개 가능한 체크포인트).
CREATE TABLE IF NOT EXISTS batch_checkpoints (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type        batch_job_type NOT NULL,
  checkpoint_key  text NOT NULL,                  -- 분할 키(예: security_id 또는 'security_id:data_kind')
  cursor          jsonb,                          -- 진행 커서(마지막 처리 기간/페이지 등)
  is_completed    boolean NOT NULL DEFAULT false, -- 해당 키 완료 여부
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE batch_checkpoints IS '백필 등 장시간 잡의 재개 커서. 중단 후 이어받기(멱등). job_type+checkpoint_key 당 1행.';

CREATE UNIQUE INDEX IF NOT EXISTS uq_batch_checkpoints_job_key
  ON batch_checkpoints (job_type, checkpoint_key);
CREATE INDEX IF NOT EXISTS idx_batch_checkpoints_incomplete
  ON batch_checkpoints (job_type) WHERE is_completed = false;

-- updated_at 트리거.
DROP TRIGGER IF EXISTS trg_set_updated_at ON batch_runs;
CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON batch_runs
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_set_updated_at ON batch_item_failures;
CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON batch_item_failures
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_set_updated_at ON batch_checkpoints;
CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON batch_checkpoints
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE batch_runs DISABLE ROW LEVEL SECURITY;
ALTER TABLE batch_item_failures DISABLE ROW LEVEL SECURITY;
ALTER TABLE batch_checkpoints DISABLE ROW LEVEL SECURITY;
