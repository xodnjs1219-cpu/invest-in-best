-- 0015_fn_upsert_quarterly_financials.sql
-- 재무 UPSERT RPC (docs/usecases/027/plan.md 모듈 6, OQ-5·BR-18).
-- quarterly_financials의 유니크 키가 부분 유니크 인덱스(WHERE period_type='quarter'/'annual')라서
-- PostgREST(supabase-js upsert onConflict)로는 충돌 대상을 지정할 수 없으므로 RPC로 대체한다.
-- 값이 실제로 변한 행만 UPDATE(IS DISTINCT FROM 가드)하여 updated_at이 "정정 시각"으로만 발화하게 한다
-- (029 배치가 이 updated_at을 재계산 대상 판별에 사용). 신규 테이블·컬럼 없음(0008 선행 가정).

CREATE OR REPLACE FUNCTION fn_upsert_quarterly_financials(p_rows jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_affected integer := 0;
  v_quarter_affected integer;
  v_annual_affected integer;
BEGIN
  WITH input_rows AS (
    SELECT *
    FROM jsonb_to_recordset(p_rows) AS r(
      security_id              uuid,
      period_type               fin_report_period,
      fiscal_year               integer,
      fiscal_quarter             smallint,
      period_start_date          date,
      period_end_date            date,
      calendar_year               smallint,
      calendar_quarter            smallint,
      currency                    currency_code,
      revenue                     numeric(24, 2),
      operating_income            numeric(24, 2),
      net_income                  numeric(24, 2),
      amount_basis                fin_period_basis,
      revenue_source_tag           text,
      is_revenue_tag_unmapped      boolean,
      source                       data_source,
      disclosure_rcept_no          text
    )
  ), quarter_upsert AS (
    INSERT INTO quarterly_financials (
      security_id, period_type, fiscal_year, fiscal_quarter,
      period_start_date, period_end_date, calendar_year, calendar_quarter,
      currency, revenue, operating_income, net_income, amount_basis,
      revenue_source_tag, is_revenue_tag_unmapped, source, disclosure_rcept_no
    )
    SELECT
      security_id, period_type, fiscal_year, fiscal_quarter,
      period_start_date, period_end_date, calendar_year, calendar_quarter,
      currency, revenue, operating_income, net_income, amount_basis,
      revenue_source_tag, coalesce(is_revenue_tag_unmapped, false), source, disclosure_rcept_no
    FROM input_rows
    WHERE period_type = 'quarter'
    ON CONFLICT (security_id, fiscal_year, fiscal_quarter) WHERE period_type = 'quarter'
    DO UPDATE SET
      period_start_date       = EXCLUDED.period_start_date,
      period_end_date         = EXCLUDED.period_end_date,
      calendar_year           = EXCLUDED.calendar_year,
      calendar_quarter        = EXCLUDED.calendar_quarter,
      currency                = EXCLUDED.currency,
      revenue                 = EXCLUDED.revenue,
      operating_income        = EXCLUDED.operating_income,
      net_income              = EXCLUDED.net_income,
      amount_basis            = EXCLUDED.amount_basis,
      revenue_source_tag      = EXCLUDED.revenue_source_tag,
      is_revenue_tag_unmapped = EXCLUDED.is_revenue_tag_unmapped,
      source                  = EXCLUDED.source,
      disclosure_rcept_no     = EXCLUDED.disclosure_rcept_no,
      updated_at              = now()
    WHERE (
      quarterly_financials.revenue, quarterly_financials.operating_income, quarterly_financials.net_income,
      quarterly_financials.period_start_date, quarterly_financials.period_end_date,
      quarterly_financials.calendar_year, quarterly_financials.calendar_quarter,
      quarterly_financials.amount_basis, quarterly_financials.revenue_source_tag,
      quarterly_financials.is_revenue_tag_unmapped, quarterly_financials.disclosure_rcept_no
    ) IS DISTINCT FROM (
      EXCLUDED.revenue, EXCLUDED.operating_income, EXCLUDED.net_income,
      EXCLUDED.period_start_date, EXCLUDED.period_end_date,
      EXCLUDED.calendar_year, EXCLUDED.calendar_quarter,
      EXCLUDED.amount_basis, EXCLUDED.revenue_source_tag,
      EXCLUDED.is_revenue_tag_unmapped, EXCLUDED.disclosure_rcept_no
    )
    RETURNING 1
  )
  SELECT count(*) INTO v_quarter_affected FROM quarter_upsert;

  WITH input_rows AS (
    SELECT *
    FROM jsonb_to_recordset(p_rows) AS r(
      security_id              uuid,
      period_type               fin_report_period,
      fiscal_year               integer,
      fiscal_quarter             smallint,
      period_start_date          date,
      period_end_date            date,
      calendar_year               smallint,
      calendar_quarter            smallint,
      currency                    currency_code,
      revenue                     numeric(24, 2),
      operating_income            numeric(24, 2),
      net_income                  numeric(24, 2),
      amount_basis                fin_period_basis,
      revenue_source_tag           text,
      is_revenue_tag_unmapped      boolean,
      source                       data_source,
      disclosure_rcept_no          text
    )
  ), annual_upsert AS (
    INSERT INTO quarterly_financials (
      security_id, period_type, fiscal_year, fiscal_quarter,
      period_start_date, period_end_date, calendar_year, calendar_quarter,
      currency, revenue, operating_income, net_income, amount_basis,
      revenue_source_tag, is_revenue_tag_unmapped, source, disclosure_rcept_no
    )
    SELECT
      security_id, period_type, fiscal_year, fiscal_quarter,
      period_start_date, period_end_date, calendar_year, calendar_quarter,
      currency, revenue, operating_income, net_income, amount_basis,
      revenue_source_tag, coalesce(is_revenue_tag_unmapped, false), source, disclosure_rcept_no
    FROM input_rows
    WHERE period_type = 'annual'
    ON CONFLICT (security_id, fiscal_year) WHERE period_type = 'annual'
    DO UPDATE SET
      period_start_date       = EXCLUDED.period_start_date,
      period_end_date         = EXCLUDED.period_end_date,
      calendar_year           = EXCLUDED.calendar_year,
      calendar_quarter        = EXCLUDED.calendar_quarter,
      currency                = EXCLUDED.currency,
      revenue                 = EXCLUDED.revenue,
      operating_income        = EXCLUDED.operating_income,
      net_income              = EXCLUDED.net_income,
      amount_basis            = EXCLUDED.amount_basis,
      revenue_source_tag      = EXCLUDED.revenue_source_tag,
      is_revenue_tag_unmapped = EXCLUDED.is_revenue_tag_unmapped,
      source                  = EXCLUDED.source,
      disclosure_rcept_no     = EXCLUDED.disclosure_rcept_no,
      updated_at              = now()
    WHERE (
      quarterly_financials.revenue, quarterly_financials.operating_income, quarterly_financials.net_income,
      quarterly_financials.period_start_date, quarterly_financials.period_end_date,
      quarterly_financials.calendar_year, quarterly_financials.calendar_quarter,
      quarterly_financials.amount_basis, quarterly_financials.revenue_source_tag,
      quarterly_financials.is_revenue_tag_unmapped, quarterly_financials.disclosure_rcept_no
    ) IS DISTINCT FROM (
      EXCLUDED.revenue, EXCLUDED.operating_income, EXCLUDED.net_income,
      EXCLUDED.period_start_date, EXCLUDED.period_end_date,
      EXCLUDED.calendar_year, EXCLUDED.calendar_quarter,
      EXCLUDED.amount_basis, EXCLUDED.revenue_source_tag,
      EXCLUDED.is_revenue_tag_unmapped, EXCLUDED.disclosure_rcept_no
    )
    RETURNING 1
  )
  SELECT count(*) INTO v_annual_affected FROM annual_upsert;

  v_affected := v_quarter_affected + v_annual_affected;
  RETURN v_affected;
END;
$$;

COMMENT ON FUNCTION fn_upsert_quarterly_financials(jsonb) IS
  '재무 배치(027/031)의 분기/연간 재무 UPSERT RPC. quarterly_financials의 부분 유니크 인덱스(quarter/annual 분리) 때문에 PostgREST upsert로는 충돌 대상을 지정할 수 없어 RPC로 구현. IS DISTINCT FROM 가드로 값이 실제로 변한 행만 갱신해 updated_at이 정정 시각으로만 발화한다(029 재계산 대상 판별 입력). p_rows는 1,000행 이하 청크로 호출할 것.';
