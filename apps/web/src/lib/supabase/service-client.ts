import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getAppConfig } from "@/backend/config";
import { createTimeoutFetch } from "@/lib/http/timeout-fetch";

export type ServiceClientOptions = {
  supabaseUrl: string;
  supabaseServiceRoleKey: string;
};

/**
 * service-role Supabase 클라이언트 — **서버 전용** (`server-only`로 클라이언트 번들 유입 차단).
 * 세션을 보유하지 않으며(Auth Admin/데이터 접근 용도) 공통 타임아웃 fetch가 주입된다.
 */
export const createServiceClient = (options?: ServiceClientOptions): SupabaseClient => {
  const { supabaseUrl, supabaseServiceRoleKey } = options ?? getAppConfig();

  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: createTimeoutFetch() },
  });
};
