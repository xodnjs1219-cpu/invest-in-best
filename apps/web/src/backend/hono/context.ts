import type { SupabaseClient } from "@supabase/supabase-js";
import type { Context } from "hono";
import type { AppConfig } from "@/backend/config";

export type AppLogger = {
  debug: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
};

/** 요청 origin이 포함된 컨텍스트 config — `emailRedirectTo` 조립용 (plan 모듈 1-3). */
export type AppContextConfig = AppConfig & { origin: string };

/** 세션에서 식별된 최소 사용자 정보(UC-009 plan 모듈 A2). 비로그인이면 `null`. */
export type AuthUser = { id: string };

/** `withAdminAuth`(UC-022 plan M1)가 검증 후 주입하는 관리자 사용자 정보. */
export type AdminUser = { id: string; email: string | null };

export type AppVariables = {
  supabase: SupabaseClient;
  /** 쿠키 바인딩 인증 클라이언트(anon key) — 세션 확립/폐기가 필요한 라우트 전용(로그인/로그아웃/OAuth/재설정). */
  supabaseAuth: SupabaseClient;
  /** 요청 쿠키 세션에서 식별된 사용자(선택적 인증 — 없으면 `null`, UC-009 BR-6 "인증 선택적"). */
  user: AuthUser | null;
  /** `withAdminAuth` 통과 시 주입되는 관리자 사용자(role=admin 검증 완료, `/admin/*` API 전용). */
  adminUser?: AdminUser;
  logger: AppLogger;
  config: AppContextConfig;
};

export type AppEnv = { Variables: AppVariables };

export const getSupabase = (c: Context<AppEnv>): SupabaseClient => c.get("supabase");

export const getSupabaseAuth = (c: Context<AppEnv>): SupabaseClient => c.get("supabaseAuth");

export const getUser = (c: Context<AppEnv>): AuthUser | null => c.get("user") ?? null;

/** `withAdminAuth` 통과 후에만 유효한 값을 반환한다(그 전에는 `undefined`). */
export const getAdminUser = (c: Context<AppEnv>): AdminUser | undefined => c.get("adminUser");

export const getLogger = (c: Context<AppEnv>): AppLogger => c.get("logger");

export const getConfig = (c: Context<AppEnv>): AppContextConfig => c.get("config");
