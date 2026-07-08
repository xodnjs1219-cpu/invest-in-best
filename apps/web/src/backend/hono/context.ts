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

export type AppVariables = {
  supabase: SupabaseClient;
  logger: AppLogger;
  config: AppContextConfig;
};

export type AppEnv = { Variables: AppVariables };

export const getSupabase = (c: Context<AppEnv>): SupabaseClient => c.get("supabase");

export const getLogger = (c: Context<AppEnv>): AppLogger => c.get("logger");

export const getConfig = (c: Context<AppEnv>): AppContextConfig => c.get("config");
