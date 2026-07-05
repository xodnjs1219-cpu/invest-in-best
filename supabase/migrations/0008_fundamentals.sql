-- 0008_fundamentals.sql
-- 재무제표(quarterly_financials, 분기/연간)와 상장주식수 이력(shares_outstanding).
-- 국내(OpenDART)는 누적치를 3개월 단위로 정규화하고 그 구분을 보존한다.
-- 미국(SEC)은 매출 태그 폴백 체인의 결과(사용 태그/미매핑 여부)를 함께 저장하고, 20-F 등 분기 미제공 기업은 연간(annual)만 저장한다.
-- 결산월이 다른 기업 혼합 집계를 위해 역년 정규화 축(calendar_year/quarter)을 함께 보관한다.
-- 규칙: RLS 전면 비활성, snake_case, 멱등. 0003(securities)·0007(data_source) 선행 가정.

-- 분기 금액의 산출 기준(userflow 027 처리 2·3, 020 표시).
--   three_month           = 원천이 이미 3개월치(미국 10-Q 손익 등)
--   derived_from_cumulative = 누적 차감으로 도출(국내 2Q=반기-1Q, 4Q=연간-3Q누적 / 미국 Q4=연간-9M)
DO $$ BEGIN
  CREATE TYPE fin_period_basis AS ENUM ('three_month', 'derived_from_cumulative');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 보고 기간 종류. 20-F(IFRS) 기업 등 분기 손익을 제공하지 않는 기업은 연간(annual)만 저장한다.
DO $$ BEGIN
  CREATE TYPE fin_report_period AS ENUM ('quarter', 'annual');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 재무제표(2015 사업연도 이후). 분기(quarter) 또는 연간(annual) 단위로 저장.
-- fiscal_* = 기업 회계연도 축(결산월 상이), calendar_* = 역년 정규화 축(체인 분기 지표 집계 기준).
CREATE TABLE IF NOT EXISTS quarterly_financials (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  security_id              uuid NOT NULL REFERENCES securities (id) ON DELETE CASCADE,
  period_type              fin_report_period NOT NULL,     -- quarter / annual(20-F 등 연간 전용)
  fiscal_year              integer NOT NULL,               -- 기업 회계연도(>=2015)
  fiscal_quarter           smallint,                       -- 회계분기 1~4(annual 이면 NULL)
  period_start_date        date,                           -- 보고 기간 시작일(역년 축 계산·기간 정렬용)
  period_end_date          date,                           -- 보고 기간 말일(매출 KRW 환산 기준일, userflow 010)
  calendar_year            smallint,                       -- 역년 정규화 연도(period_start/end 로 배치가 산출)
  calendar_quarter         smallint,                       -- 역년 정규화 분기 1~4(annual 이면 NULL)
  currency                 currency_code NOT NULL,         -- 보고 통화(KRW/USD)
  revenue                  numeric(24, 2),                 -- 매출(quarter=3개월 정규화값, annual=연간값)
  operating_income         numeric(24, 2),                 -- 영업이익
  net_income               numeric(24, 2),                 -- 순이익
  amount_basis             fin_period_basis,               -- quarter 필수(3개월치 원천 vs 누적 차감), annual 은 NULL
  revenue_source_tag       text,                           -- 미국 매출 태그 폴백 결과(예: us-gaap:RevenueFromContractWithCustomerExcludingAssessedTax, ifrs-full:Revenue) / 국내는 계정과목 코드
  is_revenue_tag_unmapped  boolean NOT NULL DEFAULT false, -- 미국 태그 미매핑 → 매출 합계 집계 제외 대상(userflow 027 처리 3)
  source                   data_source NOT NULL,           -- dart(국내) / sec(미국)
  disclosure_rcept_no      text,                           -- 근거 보고서 접수번호/accession(메타)
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now(),
  -- 분기 행은 fiscal_quarter 1~4 필수, 연간 행은 NULL.
  CONSTRAINT chk_qfin_period CHECK (
    (period_type = 'quarter' AND fiscal_quarter BETWEEN 1 AND 4) OR
    (period_type = 'annual'  AND fiscal_quarter IS NULL)
  ),
  CONSTRAINT chk_qfin_calendar_quarter CHECK (calendar_quarter IS NULL OR calendar_quarter BETWEEN 1 AND 4),
  -- 분기 행은 amount_basis 필수.
  CONSTRAINT chk_qfin_basis CHECK (period_type = 'annual' OR amount_basis IS NOT NULL),
  CONSTRAINT chk_qfin_min_year CHECK (fiscal_year >= 2015)  -- 시계열 최소 시작 시점(OpenDART 제약)
);

COMMENT ON TABLE quarterly_financials IS '재무제표. 분기(quarter) 또는 연간(annual) 단위. 정정 시 UPSERT. 매출은 quarter=3개월 정규화값. 20-F 등 분기 미제공 기업은 annual 만 저장하고 분기 매출 집계에서 제외한다.';
COMMENT ON COLUMN quarterly_financials.period_type IS 'quarter=분기 손익 제공(10-Q/국내 분기), annual=연간 전용(20-F IFRS 등). annual 행은 chain_quarterly_metrics 집계에서 제외(제외 사유 구분 가능).';
COMMENT ON COLUMN quarterly_financials.calendar_quarter IS '역년 정규화 축. 결산월이 다른 기업(예: 9월 결산 Apple)을 역년 기준으로 정렬해 체인 분기 지표(0010)를 동일 축으로 합산하기 위한 값.';
COMMENT ON COLUMN quarterly_financials.is_revenue_tag_unmapped IS '미국 매출 태그 폴백 실패 기업. 매출 합계에서 제외하되 제외 기업 수 표기(010/027).';
COMMENT ON COLUMN quarterly_financials.amount_basis IS 'three_month=원천 3개월치, derived_from_cumulative=누적 차감 도출(국내 2Q/4Q, 미국 Q4). annual 행은 NULL.';

-- 종목·회계연도·분기당 1행(분기) / 종목·회계연도당 1행(연간). 부분 유니크로 NULL 분기 충돌 회피.
CREATE UNIQUE INDEX IF NOT EXISTS uq_qfin_security_quarter
  ON quarterly_financials (security_id, fiscal_year, fiscal_quarter) WHERE period_type = 'quarter';
CREATE UNIQUE INDEX IF NOT EXISTS uq_qfin_security_annual
  ON quarterly_financials (security_id, fiscal_year) WHERE period_type = 'annual';
CREATE INDEX IF NOT EXISTS idx_qfin_security ON quarterly_financials (security_id);
-- 역년 축 조회(체인 분기 지표 집계 029).
CREATE INDEX IF NOT EXISTS idx_qfin_calendar ON quarterly_financials (calendar_year, calendar_quarter);

-- 상장주식수 이력(시가총액 계산용). 기준일·소스·사용 태그 보관, 최신값을 시총에 사용.
-- 소스 우선순위(userflow 027, external): 1순위 토스 sharesOutstanding, 국내 폴백 OpenDART istc_totqy(합계),
-- 미국 폴백 SEC dei/us-gaap 태그 체인.
CREATE TABLE IF NOT EXISTS shares_outstanding (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  security_id           uuid NOT NULL REFERENCES securities (id) ON DELETE CASCADE,
  shares                numeric(20, 0) NOT NULL,        -- 상장(발행)주식총수
  as_of_date            date NOT NULL,                  -- 기준일(주식수 기준일 주석 노출, userflow 010/020)
  source                data_source NOT NULL,           -- toss(1순위) / dart / sec
  source_tag            text,                           -- SEC 사용 태그(dei:EntityCommonStockSharesOutstanding 등) / DART istc_totqy
  is_multi_class_partial boolean NOT NULL DEFAULT false, -- SEC 다중 클래스로 표준 API 불완전 수집(external 6장)
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE shares_outstanding IS '상장주식수 이력. 분기 갱신, 기준일·소스 보관. 시총 = 일별 종가 × 최신 상장주식수(as_of_date 최신 행).';
COMMENT ON COLUMN shares_outstanding.source IS '우선순위: toss(sharesOutstanding) > dart(istc_totqy 합계) > sec(dei/us-gaap 폴백 체인).';

-- 종목·기준일·소스당 1행(멱등 갱신).
CREATE UNIQUE INDEX IF NOT EXISTS uq_shares_security_asof_source
  ON shares_outstanding (security_id, as_of_date, source);
-- 최신 상장주식수 조회용(종목별 as_of_date 내림차순).
CREATE INDEX IF NOT EXISTS idx_shares_security_asof
  ON shares_outstanding (security_id, as_of_date DESC);

-- updated_at 트리거.
DROP TRIGGER IF EXISTS trg_set_updated_at ON quarterly_financials;
CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON quarterly_financials
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_set_updated_at ON shares_outstanding;
CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON shares_outstanding
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE quarterly_financials DISABLE ROW LEVEL SECURITY;
ALTER TABLE shares_outstanding DISABLE ROW LEVEL SECURITY;
