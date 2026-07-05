-- 0007_price_timeseries.sql
-- 시세 시계열: 시간별 원본(quote_ticks, 보존 30일)과 일별 집계(daily_quotes, 영구).
-- 토스증권 Open API가 유일 소스(국내+미국). 시가총액 필드는 없으므로 종가만 저장하고
-- 시총은 종가 × 상장주식수(0008)로 집계 단계(029)에서 계산한다.
-- 규칙: RLS 전면 비활성, snake_case, 멱등(idempotent). 0001(공통 함수)·0003(securities) 선행 가정.

-- 외부 데이터 출처(시세/재무/공시/상장주식수 전반에서 재사용).
DO $$ BEGIN
  CREATE TYPE data_source AS ENUM ('dart', 'sec', 'toss');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 시간별 시세 원본(userflow 026 처리 3). 개장 중 1시간 1회 수집분.
-- 보존 30일: 30일 경과분은 시세 배치의 정리 스텝이 관측 시각 기준으로 삭제(파티션 미사용, 최소 스펙).
CREATE TABLE IF NOT EXISTS quote_ticks (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  security_id  uuid NOT NULL REFERENCES securities (id) ON DELETE CASCADE,
  observed_at  timestamptz NOT NULL,          -- 관측 시각(수집 시점, UTC 저장)
  price        numeric(20, 4) NOT NULL,        -- 현지 통화 현재가(토스 lastPrice)
  volume       numeric(20, 0),                 -- 누적 거래량(제공 시)
  source       data_source NOT NULL DEFAULT 'toss',
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE quote_ticks IS '시간별 시세 원본. 보존 30일(배치가 관측 시각 기준으로 만료분 삭제). 일별 집계(daily_quotes)의 원천이며 조회 화면은 daily_quotes를 사용한다.';
COMMENT ON COLUMN quote_ticks.price IS '현지 통화(KRW/USD) 기준가. KRW 환산은 집계 단계(029)에서 환율(0009)로 처리.';

-- 동일 종목·동일 관측시각 중복 적재 방지(userflow 026: 멱등 적재).
CREATE UNIQUE INDEX IF NOT EXISTS uq_quote_ticks_security_observed
  ON quote_ticks (security_id, observed_at);
-- 30일 만료분 삭제 배치용 인덱스.
CREATE INDEX IF NOT EXISTS idx_quote_ticks_observed_at ON quote_ticks (observed_at);
CREATE INDEX IF NOT EXISTS idx_quote_ticks_security ON quote_ticks (security_id);

-- 일별 시세 집계(영구 보존). 현지 거래일 기준 OHLCV + 종가 확정 여부.
CREATE TABLE IF NOT EXISTS daily_quotes (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  security_id           uuid NOT NULL REFERENCES securities (id) ON DELETE CASCADE,
  trade_date            date NOT NULL,                 -- 현지 거래일
  open_price            numeric(20, 4),
  high_price            numeric(20, 4),
  low_price             numeric(20, 4),
  close_price           numeric(20, 4),                -- 시총 계산 기준가(현지 통화)
  volume                numeric(20, 0),
  is_closing_confirmed  boolean NOT NULL DEFAULT false, -- 장 마감 후 확정 배치 기록 여부(userflow 026 처리 4)
  source                data_source NOT NULL DEFAULT 'toss',
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE daily_quotes IS '일별 시세 집계(영구). 기업 상세 일봉/시총 추이(020)와 일별 지표 집계(029)의 소스. 결측 일자 이월(carry-forward)은 집계·조회 단계에서 처리(행을 만들지 않음).';
COMMENT ON COLUMN daily_quotes.is_closing_confirmed IS 'false=장중 잠정 종가, true=장 마감 후 확정 종가. 확정 전에는 폴백/미확정 표기(010/020).';

CREATE UNIQUE INDEX IF NOT EXISTS uq_daily_quotes_security_date
  ON daily_quotes (security_id, trade_date);
CREATE INDEX IF NOT EXISTS idx_daily_quotes_security_date
  ON daily_quotes (security_id, trade_date DESC);

-- updated_at 트리거.
DROP TRIGGER IF EXISTS trg_set_updated_at ON quote_ticks;
CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON quote_ticks
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_set_updated_at ON daily_quotes;
CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON daily_quotes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE quote_ticks DISABLE ROW LEVEL SECURITY;
ALTER TABLE daily_quotes DISABLE ROW LEVEL SECURITY;
