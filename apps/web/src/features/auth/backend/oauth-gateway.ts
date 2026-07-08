import type { SupabaseClient } from "@supabase/supabase-js";
import type { SupportedOAuthProvider } from "@iib/domain";

/**
 * Supabase Auth(GoTrue) 호출 캡슐화 — 외부 서비스 연동 모듈.
 * service는 이 인터페이스에만 의존한다(Supabase SDK 문법을 모른다).
 */

// ============================================
// createAuthorizationUrl
// ============================================

export type CreateAuthorizationUrlResult =
  | { kind: "success"; authorizationUrl: string }
  | { kind: "provider_unavailable"; message: string };

/**
 * Google 인가 URL 발급. `skipBrowserRedirect: true`로 호출해 URL만 받아온다
 * (FE가 전체 페이지 리다이렉트를 수행 — 앱 서버는 자동 리다이렉트하지 않는다).
 * PKCE `code_verifier` 쿠키는 쿠키 바인딩 클라이언트의 어댑터가 응답에 기록한다.
 */
export const createAuthorizationUrl = async (
  authClient: SupabaseClient,
  input: { provider: SupportedOAuthProvider; redirectTo: string },
): Promise<CreateAuthorizationUrlResult> => {
  try {
    const { data, error } = await authClient.auth.signInWithOAuth({
      provider: input.provider,
      options: { redirectTo: input.redirectTo, skipBrowserRedirect: true },
    });

    if (error || !data.url) {
      return { kind: "provider_unavailable", message: error?.message ?? "인가 URL 발급 실패" };
    }

    return { kind: "success", authorizationUrl: data.url };
  } catch (err) {
    return {
      kind: "provider_unavailable",
      message: err instanceof Error ? err.message : "unknown error",
    };
  }
};

// ============================================
// exchangeCodeForSession
// ============================================

export type OAuthSessionUser = {
  id: string;
  email: string | null;
  emailVerified: boolean;
  createdAt: string;
  lastSignInAt: string | null;
};

export type ExchangeCodeResult =
  | { kind: "success"; user: OAuthSessionUser }
  | { kind: "exchange_rejected"; message: string }
  | { kind: "provider_unavailable"; message: string };

type ExchangeUserPayload = {
  id: string;
  email: string | null;
  email_confirmed_at: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  identities?: { identity_data?: { email_verified?: boolean } }[];
};

/** `email_confirmed_at` 존재 또는 Google identity의 `email_verified===true`면 검증된 것으로 판정. */
const resolveEmailVerified = (user: ExchangeUserPayload): boolean => {
  if (user.email_confirmed_at) {
    return true;
  }
  return user.identities?.some((identity) => identity.identity_data?.email_verified === true) ?? false;
};

/**
 * 인가 코드 → 세션 교환(PKCE code_verifier 검증 포함). 쿠키 바인딩 클라이언트의 어댑터가
 * 성공 시 세션 쿠키를 응답에 기록한다. 4xx(코드 만료/재사용/PKCE 불일치)는 `exchange_rejected`,
 * 5xx/타임아웃은 `provider_unavailable`로 구분한다.
 */
export const exchangeCodeForSession = async (
  authClient: SupabaseClient,
  code: string,
): Promise<ExchangeCodeResult> => {
  try {
    const { data, error } = await authClient.auth.exchangeCodeForSession(code);

    if (error) {
      const status = (error as { status?: number }).status ?? 500;
      if (status >= 400 && status < 500) {
        return { kind: "exchange_rejected", message: error.message };
      }
      return { kind: "provider_unavailable", message: error.message };
    }

    const user = data.user as unknown as ExchangeUserPayload | null;
    if (!user) {
      return { kind: "provider_unavailable", message: "세션 교환 결과에 사용자 정보가 없습니다." };
    }

    return {
      kind: "success",
      user: {
        id: user.id,
        email: user.email,
        emailVerified: resolveEmailVerified(user),
        createdAt: user.created_at,
        lastSignInAt: user.last_sign_in_at,
      },
    };
  } catch (err) {
    return {
      kind: "provider_unavailable",
      message: err instanceof Error ? err.message : "unknown error",
    };
  }
};

// ============================================
// oauthSignOut
// ============================================

/** 이메일 미검증 시 세션만 정리(A-8 — 계정은 잔존). 실패해도 throw하지 않는다. */
export const oauthSignOut = async (authClient: SupabaseClient): Promise<void> => {
  try {
    await authClient.auth.signOut();
  } catch {
    // 베스트 에포트 — 세션 정리 실패는 흐름을 막지 않는다.
  }
};
