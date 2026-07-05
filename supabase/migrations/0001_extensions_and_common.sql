-- 0001_extensions_and_common.sql
-- 공통 확장(extension)과 updated_at 자동 갱신 트리거 함수를 정의한다.
-- 이후 모든 마이그레이션은 이 파일이 먼저 적용되었다고 가정한다.
-- 규칙: RLS 전면 비활성, snake_case, 멱등(idempotent).

-- 확장은 Supabase 권고에 따라 전용 extensions 스키마에 설치한다(public 오염 방지).
CREATE SCHEMA IF NOT EXISTS extensions;

-- 티커/종목명 부분 일치(ILIKE) 검색용 트라이그램 인덱스 지원 확장.
-- 인덱스 연산자 클래스는 extensions.gin_trgm_ops 로 스키마 정규화해 참조한다(0003).
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;

-- gen_random_uuid() 는 Postgres 13+ 코어(pg_catalog)에 내장되어 있으나 안전하게 보장.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 모든 테이블 공용 updated_at 자동 갱신 함수.
-- SET search_path = '' : Supabase advisor 경고 예방(함수 내부는 스키마 정규화된 객체만 참조).
-- now() 는 pg_catalog 소속이라 빈 search_path 에서도 항상 해석된다.
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION set_updated_at() IS '모든 테이블의 BEFORE UPDATE 트리거에서 updated_at 을 now() 로 갱신한다. search_path 고정.';
