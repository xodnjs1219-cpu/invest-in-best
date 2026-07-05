-- 0009_fx_and_market_calendar.sql
-- 일별 환율(fx_rates)과 시장별 장 운영시간/휴장일(market_calendar).
-- 환율: 기준 통화 KRW, 일 1회 수집. 일별 지표=당일 환율, 분기 매출=분기 말일 환율(userflow 028).
-- 장 운영시간: 시세 배치(026)의 개장 판정·서머타임(DST) 처리 근거.
-- 규칙: RLS 전면 비활성, snake_case, 멱등. 0003(market_code/currency_code) 선행 가정.

-- 일별 환율 시계열(KRW↔USD). 결측 일자는 집계 단계에서 직전 관측값 이월(carry-forward).
CREATE TABLE IF NOT EXISTS fx_rates (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rate_date       date NOT NULL,                 -- 환율 기준 일자
  base_currency   currency_code NOT NULL,        -- 기준 통화(예: USD)
  quote_currency  currency_code NOT NULL,        -- 표시 통화(예: KRW)
  rate            numeric(18, 6) NOT NULL,        -- 1 base = rate quote
  source          data_source NOT NULL DEFAULT 'toss',
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_fx_pair_distinct CHECK (base_currency <> quote_currency)
);

COMMENT ON TABLE fx_rates IS '일별 환율. 기준 통화 KRW 환산에 사용(일별 지표=당일, 분기 매출=분기 말일). 결측 일자는 이월(carry-forward)로 조회·집계 단계에서 처리.';

CREATE UNIQUE INDEX IF NOT EXISTS uq_fx_rates_date_pair
  ON fx_rates (rate_date, base_currency, quote_currency);
CREATE INDEX IF NOT EXISTS idx_fx_rates_pair_date
  ON fx_rates (base_currency, quote_currency, rate_date DESC);

-- 시장별 장 운영 캘린더(휴장일 포함). open_at/close_at는 절대 시각(timestamptz)이라 DST가 자연 반영된다.
CREATE TABLE IF NOT EXISTS market_calendar (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  market           market_code NOT NULL,          -- KRX / US
  calendar_date    date NOT NULL,                 -- 현지 일자
  is_trading_day   boolean NOT NULL DEFAULT true,  -- false=휴장일(수집 스킵, userflow 026/028)
  open_at          timestamptz,                   -- 개장 시각(절대 시각, 휴장일이면 NULL)
  close_at         timestamptz,                   -- 마감 시각(절대 시각, 조기 마감 반영)
  is_early_close   boolean NOT NULL DEFAULT false, -- 조기 마감 여부
  source           data_source NOT NULL DEFAULT 'toss',
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE market_calendar IS '시장별 장 운영시간/휴장일. 시세 배치(026)가 실행 시각 기준 개장 여부를 이 캐시로 판정한다. 절대 시각 저장으로 서머타임 자동 반영.';

CREATE UNIQUE INDEX IF NOT EXISTS uq_market_calendar_market_date
  ON market_calendar (market, calendar_date);
CREATE INDEX IF NOT EXISTS idx_market_calendar_date ON market_calendar (calendar_date);

-- updated_at 트리거.
DROP TRIGGER IF EXISTS trg_set_updated_at ON fx_rates;
CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON fx_rates
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_set_updated_at ON market_calendar;
CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON market_calendar
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE fx_rates DISABLE ROW LEVEL SECURITY;
ALTER TABLE market_calendar DISABLE ROW LEVEL SECURITY;
