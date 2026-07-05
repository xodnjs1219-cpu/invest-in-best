-- 0002_profiles_and_terms.sql
-- 사용자 프로필(auth.users 확장)과 약관 동의 이력.
-- 인증/세션/이메일 인증/비밀번호 재설정 토큰/소셜 식별자는 Supabase Auth(auth 스키마)가
-- 네이티브로 관리하므로 별도 테이블을 만들지 않는다(userflow 001~005).

-- 사용자 역할.
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('user', 'admin');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 필수 동의 약관 종류(userflow 001: 이용약관·개인정보처리방침 동의).
DO $$ BEGIN
  CREATE TYPE terms_doc_type AS ENUM ('terms_of_service', 'privacy_policy');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 프로필: auth.users 와 1:1. 가입 시 ADMIN_SEED_EMAILS 일치하면 role=admin 으로 승격(앱 로직).
CREATE TABLE IF NOT EXISTS profiles (
  id          uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  email       text,
  role        user_role NOT NULL DEFAULT 'user',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE profiles IS '사용자 프로필. auth.users(id) 확장. 탈퇴 시 auth.users 삭제 → CASCADE 로 프로필 및 소유 체인 삭제(userflow 006).';
COMMENT ON COLUMN profiles.role IS 'user/admin. 최초 어드민은 ADMIN_SEED_EMAILS 환경변수로 시드(어드민 임명 UI 없음).';

CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles (role);

-- 약관 동의 이력: 가입 시 동의한 문서 버전과 시각 기록(userflow 001 처리 5, 003).
CREATE TABLE IF NOT EXISTS terms_agreements (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  doc_type     terms_doc_type NOT NULL,
  doc_version  text NOT NULL,
  agreed_at    timestamptz NOT NULL DEFAULT now(),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE terms_agreements IS '약관 동의 이력(버전/시각). 정책 문서는 정적 페이지이며 버전 문자열만 참조(userflow 025).';

CREATE INDEX IF NOT EXISTS idx_terms_agreements_user ON terms_agreements (user_id);

-- updated_at 트리거.
DROP TRIGGER IF EXISTS trg_set_updated_at ON profiles;
CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_set_updated_at ON terms_agreements;
CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON terms_agreements
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- auth.users 신규 생성 시 profiles 행 자동 생성(가입 001/003).
-- SECURITY DEFINER + search_path='' : Supabase advisor 권고(함수 내부 객체는 전부 스키마 정규화).
-- 어드민 승격(role=admin)은 이 트리거가 아니라 ADMIN_SEED_EMAILS 시드 스크립트가 담당한다.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (NEW.id, NEW.email)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.handle_new_user() IS 'auth.users AFTER INSERT 시 profiles 행 생성(멱등). role 기본 user, 어드민 승격은 시드 스크립트 몫.';

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- RLS 비활성(인가는 Hono 미들웨어 서버측 role 검증으로 처리).
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE terms_agreements DISABLE ROW LEVEL SECURITY;
