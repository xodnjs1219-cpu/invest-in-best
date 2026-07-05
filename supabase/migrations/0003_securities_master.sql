-- 0003_securities_master.sql
-- 종목 마스터(다중 시장 KRX/US, 다중 통화 KRW/USD)와 기업 정형 정보(company_profiles).
-- 국내 DART corp_code / 미국 SEC CIK / 토스 symbol 매핑을 보관하고,
-- 티커·종목명 부분 일치 검색(정확>접두>부분)을 트라이그램 인덱스로 지원한다.

-- 시장 코드(전 시계열/체인 테이블에서 재사용).
DO $$ BEGIN
  CREATE TYPE market_code AS ENUM ('KRX', 'US');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 통화 코드(기준 통화 KRW, 미국 USD).
DO $$ BEGIN
  CREATE TYPE currency_code AS ENUM ('KRW', 'USD');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 상장 상태(userflow 026: 신규상장/거래정지/상장폐지에 따른 수집 대상 조정).
DO $$ BEGIN
  CREATE TYPE listing_status AS ENUM ('listed', 'suspended', 'delisted');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 종목 마스터: 검색·노드 연결·시계열의 기준 엔티티.
CREATE TABLE IF NOT EXISTS securities (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticker           text NOT NULL,                 -- KRX 6자리 종목코드 또는 US 티커
  name             text NOT NULL,                 -- 종목명(한글)
  english_name     text,
  market           market_code NOT NULL,
  currency         currency_code NOT NULL,
  isin_code        text,
  security_type    text,                          -- 토스 StockInfo.securityType
  listing_status   listing_status NOT NULL DEFAULT 'listed',
  list_date        date,
  delist_date      date,
  dart_corp_code   text,                          -- 국내 8자리 고유번호(OpenDART)
  cik              text,                          -- 미국 10자리 zero-pad CIK(SEC)
  toss_symbol      text,                          -- 토스증권 symbol(대개 ticker 와 동일)
  shares_manual_override_needed boolean NOT NULL DEFAULT false, -- 상장주식수 자동 폴백 최종 실패(SEC 다중클래스 등) → 수동 관리·어드민 노출 대상
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE securities IS '종목 마스터. 검색(008)·노드 연결(015)·시계열 수집의 기준. 전 종목 정기 수집 대상.';
COMMENT ON COLUMN securities.dart_corp_code IS 'OpenDART 고유번호(8자리). corpCode.xml 매핑으로 확보(국내 전용).';
COMMENT ON COLUMN securities.cik IS 'SEC EDGAR CIK(10자리 zero-pad 문자열, 미국 전용).';
COMMENT ON COLUMN securities.shares_manual_override_needed IS 'SEC 상장주식수 폴백 체인(external 6장) 4단계까지 실패한 다중 클래스 기업. true면 자동 폴백에서 제외하고 어드민이 수동 보정(0008 shares_outstanding).';

-- 시장 내 티커 유일. 외부 식별자는 존재 시 유일.
CREATE UNIQUE INDEX IF NOT EXISTS uq_securities_market_ticker ON securities (market, ticker);
CREATE UNIQUE INDEX IF NOT EXISTS uq_securities_dart_corp_code ON securities (dart_corp_code) WHERE dart_corp_code IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_securities_cik ON securities (cik) WHERE cik IS NOT NULL;

-- 부분 일치 검색(ILIKE '%q%') 용 트라이그램 GIN 인덱스(연산자 클래스는 extensions 스키마로 정규화, 0001).
CREATE INDEX IF NOT EXISTS idx_securities_ticker_trgm ON securities USING gin (ticker extensions.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_securities_name_trgm ON securities USING gin (name extensions.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_securities_english_name_trgm ON securities USING gin (english_name extensions.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_securities_market ON securities (market);

-- 기업 정형 정보(기업 상세 020): 배치(027) 갱신 대상. securities 와 1:1.
CREATE TABLE IF NOT EXISTS company_profiles (
  security_id          uuid PRIMARY KEY REFERENCES securities (id) ON DELETE CASCADE,
  representative_name  text,                       -- 대표자
  established_date     date,                       -- 설립일
  homepage_url         text,                       -- 홈페이지
  sector               text,                       -- 업종명(SIC description / DART 업종)
  industry_code        text,                       -- SIC 코드 / 업종코드
  address              text,
  phone                text,
  last_collected_at    timestamptz,                -- 최종 수집 시각(출처·수집시각 표기용)
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE company_profiles IS '기업 정형 정보. API 제공 필드만(서술형 개요 미제공). 출처는 market 으로 판별(KRX=DART, US=SEC).';

DROP TRIGGER IF EXISTS trg_set_updated_at ON securities;
CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON securities
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_set_updated_at ON company_profiles;
CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON company_profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE securities DISABLE ROW LEVEL SECURITY;
ALTER TABLE company_profiles DISABLE ROW LEVEL SECURITY;
