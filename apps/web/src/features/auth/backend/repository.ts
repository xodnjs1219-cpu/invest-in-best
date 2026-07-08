import type { SupabaseClient } from "@supabase/supabase-js";

const TERMS_AGREEMENTS_TABLE = "terms_agreements";
const PROFILES_TABLE = "profiles";

// ============================================
// signUpWithEmail
// ============================================

export type SignUpParams = {
  email: string;
  password: string;
  emailRedirectTo: string;
};

export type SignUpResult =
  | { kind: "created"; userId: string }
  | { kind: "existing" }
  | { kind: "rate_limited" }
  | { kind: "error"; message: string };

/**
 * Supabase Auth `signUp` 호출을 캡슐화한다. 예외를 던지지 않고 discriminated union으로 결과를 반환한다.
 * - 신규 생성: `{kind:'created', userId}` — Supabase가 인증 메일 발송, DB 트리거가 profiles 멱등 생성.
 * - 기존 이메일(계정 열거 방지용 `identities: []` 가짜 user): `{kind:'existing'}`(E1).
 * - 레이트 리밋(429): `{kind:'rate_limited'}`(E8).
 * - 그 외 오류: `{kind:'error', message}`(E6).
 */
export const signUpWithEmail = async (
  client: SupabaseClient,
  params: SignUpParams,
): Promise<SignUpResult> => {
  const { data, error } = await client.auth.signUp({
    email: params.email,
    password: params.password,
    options: { emailRedirectTo: params.emailRedirectTo },
  });

  if (error) {
    if (error.status === 429 || error.code === "over_request_rate_limit") {
      return { kind: "rate_limited" };
    }
    return { kind: "error", message: error.message };
  }

  const user = data.user;
  if (!user) {
    return { kind: "error", message: "Supabase Auth signUp이 사용자 정보를 반환하지 않았습니다." };
  }

  const identities = (user as { identities?: unknown[] }).identities ?? [];
  if (identities.length === 0) {
    return { kind: "existing" };
  }

  return { kind: "created", userId: user.id };
};

// ============================================
// insertTermsAgreements
// ============================================

export type TermsAgreementInput = {
  docType: string;
  docVersion: string;
  agreedAt: string;
};

export type RepositoryWriteResult = { ok: true } | { ok: false; message: string };

/** `terms_agreements`에 camelCase 입력을 snake_case 행으로 변환해 INSERT한다. 실패 시 throw 하지 않는다. */
export const insertTermsAgreements = async (
  client: SupabaseClient,
  userId: string,
  agreements: TermsAgreementInput[],
): Promise<RepositoryWriteResult> => {
  const rows = agreements.map((agreement) => ({
    user_id: userId,
    doc_type: agreement.docType,
    doc_version: agreement.docVersion,
    agreed_at: agreement.agreedAt,
  }));

  const { error } = await client.from(TERMS_AGREEMENTS_TABLE).insert(rows);

  if (error) {
    return { ok: false, message: error.message };
  }
  return { ok: true };
};

// ============================================
// updateProfileRole
// ============================================

/** `profiles.role`을 갱신한다 (`id = userId` 조건). 실패 시 throw 하지 않는다. */
export const updateProfileRole = async (
  client: SupabaseClient,
  userId: string,
  role: "admin",
): Promise<RepositoryWriteResult> => {
  const { error } = await client.from(PROFILES_TABLE).update({ role }).eq("id", userId);

  if (error) {
    return { ok: false, message: error.message };
  }
  return { ok: true };
};

// ============================================
// UC-002 signInWithPassword
// ============================================

export type SignInResult =
  | { kind: "success"; userId: string; email: string }
  | { kind: "invalid_credentials" }
  | { kind: "email_not_confirmed" }
  | { kind: "rate_limited" }
  | { kind: "service_error"; message: string };

/**
 * 쿠키 바인딩 인증 클라이언트(`getSupabaseAuth`)로 `signInWithPassword`를 호출한다.
 * 성공 시 `@supabase/ssr`의 쿠키 어댑터가 세션을 응답 Set-Cookie로 기록한다.
 * 예외를 던지지 않고 판별 유니온으로 결과를 반환한다.
 */
export const signInWithPassword = async (
  authClient: SupabaseClient,
  email: string,
  password: string,
): Promise<SignInResult> => {
  try {
    const { data, error } = await authClient.auth.signInWithPassword({ email, password });

    if (error) {
      if (error.code === "invalid_credentials") {
        return { kind: "invalid_credentials" };
      }
      if (error.code === "email_not_confirmed") {
        return { kind: "email_not_confirmed" };
      }
      if (error.status === 429 || error.code === "over_request_rate_limit") {
        return { kind: "rate_limited" };
      }
      return { kind: "service_error", message: error.message };
    }

    if (!data.user) {
      return { kind: "service_error", message: "Supabase Auth가 사용자 정보를 반환하지 않았습니다." };
    }

    return { kind: "success", userId: data.user.id, email: data.user.email ?? email };
  } catch (err) {
    return { kind: "service_error", message: err instanceof Error ? err.message : "unknown error" };
  }
};

// ============================================
// UC-002 findProfileById
// ============================================

export type FindProfileResult =
  | { kind: "found"; row: { id: string; email: string | null; role: "user" | "admin" } }
  | { kind: "not_found" }
  | { kind: "error"; message: string };

/** `profiles`에서 `id`로 단건 조회한다(`maybeSingle`). */
export const findProfileById = async (
  client: SupabaseClient,
  userId: string,
): Promise<FindProfileResult> => {
  const { data, error } = await client
    .from(PROFILES_TABLE)
    .select("id, email, role")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    return { kind: "error", message: error.message };
  }
  if (!data) {
    return { kind: "not_found" };
  }
  return { kind: "found", row: data as { id: string; email: string | null; role: "user" | "admin" } };
};

// ============================================
// UC-002 discardSession
// ============================================

/**
 * 확립된 세션을 폐기한다(반쪽 로그인 방지 — 프로필 조회 실패 시 사용).
 * 실패해도 예외를 전파하지 않는다(호출부는 이미 실패 경로를 진행 중).
 */
export const discardSession = async (authClient: SupabaseClient): Promise<void> => {
  try {
    await authClient.auth.signOut();
  } catch {
    // 세션 폐기 실패는 로깅 대상이지만 흐름을 막지 않는다(호출부 책임 아님 — 조용히 흡수).
  }
};

// ============================================
// UC-003 listTermsAgreementDocTypes
// ============================================

export type ListTermsAgreementsResult =
  | { kind: "found"; docTypes: string[] }
  | { kind: "error"; message: string };

/** 특정 사용자가 이미 동의 이력을 기록한 docType 목록을 조회한다(멱등 INSERT 판단용). */
export const listTermsAgreementDocTypes = async (
  client: SupabaseClient,
  userId: string,
  docTypes: string[],
): Promise<ListTermsAgreementsResult> => {
  const { data, error } = await client
    .from(TERMS_AGREEMENTS_TABLE)
    .select("doc_type")
    .eq("user_id", userId)
    .in("doc_type", docTypes);

  if (error) {
    return { kind: "error", message: error.message };
  }
  return {
    kind: "found",
    docTypes: (data as { doc_type: string }[]).map((row) => row.doc_type),
  };
};

// ============================================
// UC-004 sendPasswordResetEmail
// ============================================

export type SendPasswordResetResult =
  | { ok: true }
  | { ok: false; reason: "rate_limited" | "send_failed" };

/**
 * 재설정 메일 발송을 요청한다. "사용자 없음" 계열 오류는 `ok:true`로 정규화한다
 * (BR-1 계정 열거 방지 — 존재 여부를 상위 계층에 전달하지 않음).
 */
export const sendPasswordResetEmail = async (
  authClient: SupabaseClient,
  email: string,
  redirectTo: string,
): Promise<SendPasswordResetResult> => {
  try {
    const { error } = await authClient.auth.resetPasswordForEmail(email, { redirectTo });

    if (!error) {
      return { ok: true };
    }
    if (error.status === 429 || error.code === "over_email_send_rate_limit") {
      return { ok: false, reason: "rate_limited" };
    }
    if (error.code === "user_not_found") {
      return { ok: true };
    }
    return { ok: false, reason: "send_failed" };
  } catch {
    return { ok: false, reason: "send_failed" };
  }
};

// ============================================
// UC-004 verifyRecoveryToken
// ============================================

export type VerifyRecoveryTokenResult =
  | { ok: true }
  | { ok: false; reason: "token_invalid" | "verify_failed" };

/**
 * 재설정 토큰(token_hash)을 검증한다(`type: 'recovery'`). 성공 시 쿠키 바인딩 클라이언트가
 * 재설정 세션을 응답 쿠키에 기록한다. 만료/사용됨/위조는 전부 `token_invalid`로 통일한다(BR-1).
 */
export const verifyRecoveryToken = async (
  authClient: SupabaseClient,
  tokenHash: string,
): Promise<VerifyRecoveryTokenResult> => {
  try {
    const { error } = await authClient.auth.verifyOtp({ type: "recovery", token_hash: tokenHash });

    if (!error) {
      return { ok: true };
    }
    const status = (error as { status?: number }).status ?? 500;
    if (status >= 400 && status < 500) {
      return { ok: false, reason: "token_invalid" };
    }
    return { ok: false, reason: "verify_failed" };
  } catch {
    return { ok: false, reason: "verify_failed" };
  }
};

// ============================================
// UC-004 getRecoverySessionUser
// ============================================

/** 재설정 세션의 현재 사용자를 조회한다. 세션이 없으면 null. */
export const getRecoverySessionUser = async (
  authClient: SupabaseClient,
): Promise<{ id: string } | null> => {
  const { data } = await authClient.auth.getUser();
  return data.user ? { id: data.user.id } : null;
};

// ============================================
// UC-004 updatePasswordAndRevokeAllSessions
// ============================================

export type UpdatePasswordResult =
  | { ok: true }
  | { ok: false; reason: "session_invalid" | "policy_violation" | "update_failed" };

/**
 * 비밀번호를 갱신하고 전 기기 세션을 폐기한다(BR-4, 자동 로그인 없음).
 * ① `updateUser({password})` ② 성공 시 `signOut({scope:'global'})`.
 */
export const updatePasswordAndRevokeAllSessions = async (
  authClient: SupabaseClient,
  newPassword: string,
): Promise<UpdatePasswordResult> => {
  const { error: updateError } = await authClient.auth.updateUser({ password: newPassword });

  if (updateError) {
    const status = (updateError as { status?: number }).status ?? 500;
    if (status === 401) {
      return { ok: false, reason: "session_invalid" };
    }
    return { ok: false, reason: "update_failed" };
  }

  const { error: signOutError } = await authClient.auth.signOut({ scope: "global" });
  if (signOutError) {
    return { ok: false, reason: "update_failed" };
  }

  return { ok: true };
};

// ============================================
// UC-005 signOutCurrentSession
// ============================================

export type SignOutResult =
  | { kind: "revoked" }
  | { kind: "session_missing" }
  | { kind: "provider_error"; message: string };

/**
 * 현재 세션(scope=local)만 폐기한다 — 타 기기 세션은 유지(spec Business Rule).
 * 세션 부재는 오류가 아니라 멱등 성공 신호(`session_missing`)로 구분한다.
 */
export const signOutCurrentSession = async (authClient: SupabaseClient): Promise<SignOutResult> => {
  try {
    const { error } = await authClient.auth.signOut({ scope: "local" });

    if (!error) {
      return { kind: "revoked" };
    }
    const code = (error as { code?: string }).code;
    if (code === "session_not_found" || error.message?.toLowerCase().includes("session not found")) {
      return { kind: "session_missing" };
    }
    return { kind: "provider_error", message: error.message };
  } catch (err) {
    return {
      kind: "provider_error",
      message: err instanceof Error ? err.message : "unknown error",
    };
  }
};
