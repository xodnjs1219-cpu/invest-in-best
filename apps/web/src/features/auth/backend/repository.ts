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
