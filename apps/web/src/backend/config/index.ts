import { z } from "zod";
import { API_BASE_PATH } from "@/lib/http/constants";

/** Hono 앱 basePath (기존 `@/backend/config` 소비처 호환 export). */
export const basePath = API_BASE_PATH;

/**
 * 백엔드 환경설정 — 환경변수 접근의 단일 진입점 (하드코딩 금지 규칙 이행).
 * service-role 키는 `NEXT_PUBLIC_` 접두어 금지 (클라이언트 노출 차단).
 */
const serverEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url({ message: "NEXT_PUBLIC_SUPABASE_URL must be a valid URL" }),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  ADMIN_SEED_EMAILS: z.string().optional(),
});

export type AppConfig = {
  supabaseUrl: string;
  supabaseAnonKey: string;
  supabaseServiceRoleKey: string;
  /** trim + 소문자 정규화된 어드민 시드 이메일 목록. */
  adminSeedEmails: readonly string[];
};

/** 콤마 구분 문자열 → trim + 소문자 정규화된 배열. 미설정 시 빈 배열. */
export const parseAdminSeedEmails = (raw: string | undefined): string[] =>
  (raw ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter((email) => email.length > 0);

/** 순수 파서 — 테스트에서 env 객체를 직접 주입할 수 있다. */
export const parseAppConfig = (env: Record<string, string | undefined>): AppConfig => {
  const parsed = serverEnvSchema.safeParse(env);
  if (!parsed.success) {
    const detail = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new Error(`[backend/config] 환경변수 검증 실패 — ${detail}`);
  }
  return {
    supabaseUrl: parsed.data.NEXT_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: parsed.data.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    supabaseServiceRoleKey: parsed.data.SUPABASE_SERVICE_ROLE_KEY,
    adminSeedEmails: parseAdminSeedEmails(parsed.data.ADMIN_SEED_EMAILS),
  };
};

let cachedConfig: AppConfig | null = null;

/** 모듈 스코프 lazy 싱글턴 — `process.env`를 1회만 파싱한다. */
export const getAppConfig = (): AppConfig => {
  cachedConfig ??= parseAppConfig(process.env);
  return cachedConfig;
};

/** 테스트 전용 — 캐시 초기화. */
export const resetAppConfigCacheForTest = (): void => {
  cachedConfig = null;
};
