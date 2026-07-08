import "server-only";

import type { Context } from "hono";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { createTimeoutFetch } from "@/lib/http/timeout-fetch";

export type RouteAuthClientOptions = {
  supabaseUrl: string;
  supabaseAnonKey: string;
};

/**
 * Hono `Context`의 요청/응답 쿠키에 바인딩된 `@supabase/ssr` 서버 클라이언트.
 * 로그인/로그아웃/OAuth/비밀번호 재설정 등 **세션 확립·폐기가 필요한 라우트 전용**
 * (조회 전용 라우트는 `withSupabase`가 주입하는 service-role 클라이언트를 사용한다).
 * 매 요청마다 새로 생성해야 한다(전역 재사용 금지 — 요청 간 쿠키 오염 방지).
 */
export const createRouteAuthClient = (c: Context, options: RouteAuthClientOptions) => {
  const { supabaseUrl, supabaseAnonKey } = options;

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll: () => {
        const cookies = getCookie(c);
        return Object.entries(cookies).map(([name, value]) => ({ name, value: value ?? "" }));
      },
      setAll: (cookiesToSet) => {
        for (const { name, value, options: cookieOptions } of cookiesToSet) {
          const normalizedOptions = normalizeCookieOptions(cookieOptions);
          if (value === "") {
            deleteCookie(c, name, normalizedOptions);
          } else {
            setCookie(c, name, value, normalizedOptions);
          }
        }
      },
    },
    global: { fetch: createTimeoutFetch() },
  });
};

/** `@supabase/ssr`의 `CookieOptions`를 Hono `setCookie`/`deleteCookie`가 받는 형태로 정규화한다. */
const normalizeCookieOptions = (options?: CookieOptions) => {
  if (!options) {
    return undefined;
  }
  const { sameSite, ...rest } = options;
  return {
    ...rest,
    sameSite: normalizeSameSite(sameSite),
  };
};

const normalizeSameSite = (
  value: CookieOptions["sameSite"],
): "Strict" | "Lax" | "None" | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }
  const normalized = value.toLowerCase();
  if (normalized === "strict") return "Strict";
  if (normalized === "lax") return "Lax";
  if (normalized === "none") return "None";
  return undefined;
};
