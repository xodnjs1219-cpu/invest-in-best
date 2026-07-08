import "server-only";

import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { getAppConfig } from "@/backend/config";
import { createTimeoutFetch } from "@/lib/http/timeout-fetch";

/** `next/headers`의 cookies() 결과와 구조적으로 호환되는 최소 인터페이스. */
export type WritableCookieStore = {
  getAll(): { name: string; value: string }[];
  set(name: string, value: string, options?: CookieOptions): void;
};

/**
 * `@supabase/ssr` 기반 서버 클라이언트 — anon key + 쿠키 어댑터.
 * 이메일 인증 콜백(`/auth/callback`)에서 HTTP-only 쿠키로 세션을 수립하는 용도.
 * service-role 키는 절대 사용하지 않는다.
 */
export const createSsrServerClient = (cookieStore: WritableCookieStore) => {
  const config = getAppConfig();

  return createServerClient(config.supabaseUrl, config.supabaseAnonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet) => {
        for (const { name, value, options } of cookiesToSet) {
          cookieStore.set(name, value, options);
        }
      },
    },
    global: { fetch: createTimeoutFetch() },
  });
};
