import type { SupabaseClient } from "@supabase/supabase-js";
import { LEGAL_DOCS, REQUIRED_TERMS_DOC_TYPES, passwordSchema } from "@iib/domain";
import { failure, success, type HandlerResult } from "@/backend/http/response";
import type { AppContextConfig } from "@/backend/hono/context";
import { sanitizeReturnTo } from "@/lib/utils/safe-redirect";
import { authErrorCodes, type AuthServiceError } from "@/features/auth/backend/error";
import type {
  RepositoryWriteResult,
  SignUpParams,
  SignUpResult,
  TermsAgreementInput,
} from "@/features/auth/backend/repository";
import {
  SignupResponseSchema,
  type SignupRequest,
  type SignupResponse,
} from "@/features/auth/backend/schema";

/**
 * 서비스가 의존하는 repository 함수 시그니처. 테스트에서 mock 주입이 가능하도록
 * 인터페이스 타입으로 분리한다(service.ts는 Supabase 쿼리 문법을 알지 못한다).
 */
export type AuthRepositoryDeps = {
  signUpWithEmail: (client: SupabaseClient, params: SignUpParams) => Promise<SignUpResult>;
  insertTermsAgreements: (
    client: SupabaseClient,
    userId: string,
    agreements: TermsAgreementInput[],
  ) => Promise<RepositoryWriteResult>;
  updateProfileRole: (
    client: SupabaseClient,
    userId: string,
    role: "admin",
  ) => Promise<RepositoryWriteResult>;
};

export type SignupHandlerResult = HandlerResult<SignupResponse, AuthServiceError, unknown> & {
  meta?: { adminPromotionFailed?: boolean };
};

const buildEmailRedirectTo = (origin: string, redirectTo?: string): string => {
  const sanitized = sanitizeReturnTo(redirectTo);
  return `${origin}/auth/callback?redirectTo=${encodeURIComponent(sanitized)}`;
};

/**
 * 가입 비즈니스 로직: 서버 재검증 → 계정 생성 → 약관 이력 저장 → 어드민 승격(A-1) → 통일 응답.
 * FE 검증과 독립적으로 재검증한다 — 요청 스키마(schema.ts)는 정책을 거르지 않으므로
 * 이 분기가 spec의 AUTH_PASSWORD_POLICY_VIOLATION 등 정책 오류 코드의 유일한 발생 지점이다.
 */
export const signUp = async (
  client: SupabaseClient,
  deps: AuthRepositoryDeps,
  config: AppContextConfig,
  request: SignupRequest,
): Promise<SignupHandlerResult> => {
  // 1. 서버 재검증 (비밀번호 정책 → 확인 일치 → 필수 약관 2종)
  const passwordCheck = passwordSchema.safeParse(request.password);
  if (!passwordCheck.success) {
    return failure(
      400,
      authErrorCodes.passwordPolicyViolation,
      "비밀번호가 정책(8자 이상, 영문+숫자 포함)을 충족하지 않습니다.",
    );
  }

  if (request.password !== request.passwordConfirm) {
    return failure(
      400,
      authErrorCodes.passwordConfirmMismatch,
      "비밀번호 확인이 일치하지 않습니다.",
    );
  }

  const agreedDocTypes = new Set(request.termsAgreements.map((agreement) => agreement.docType));
  const hasAllRequiredTerms = REQUIRED_TERMS_DOC_TYPES.every((docType) =>
    agreedDocTypes.has(docType),
  );
  if (!hasAllRequiredTerms) {
    return failure(
      400,
      authErrorCodes.termsNotAgreed,
      "필수 약관(이용약관·개인정보처리방침) 동의가 필요합니다.",
    );
  }

  // 2. emailRedirectTo 조립 (오픈 리다이렉트 방지)
  const emailRedirectTo = buildEmailRedirectTo(config.origin, request.redirectTo);

  // 3. 계정 생성
  const signUpResult = await deps.signUpWithEmail(client, {
    email: request.email,
    password: request.password,
    emailRedirectTo,
  });

  if (signUpResult.kind === "rate_limited") {
    return failure(
      429,
      authErrorCodes.rateLimited,
      "가입 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.",
    );
  }
  if (signUpResult.kind === "error") {
    return failure(502, authErrorCodes.signupFailed, signUpResult.message);
  }

  const unifiedResponse = (): SignupHandlerResult =>
    success(SignupResponseSchema.parse({ email: request.email, verificationEmailSent: true }));

  // 계정 열거 방지 (E1): 이미 존재하는 이메일은 약관 저장·승격을 건너뛰고 성공과 동일한 응답을 반환한다.
  if (signUpResult.kind === "existing") {
    return unifiedResponse();
  }

  const { userId } = signUpResult;

  // 4. 약관 동의 이력 저장 — docVersion은 클라이언트 값이 아닌 LEGAL_DOCS 현행 버전을 서버가 강제 기록.
  const agreedAt = new Date().toISOString();
  const termsResult = await deps.insertTermsAgreements(
    client,
    userId,
    REQUIRED_TERMS_DOC_TYPES.map((docType) => ({
      docType,
      docVersion: LEGAL_DOCS[docType].version,
      agreedAt,
    })),
  );

  if (!termsResult.ok) {
    return failure(500, authErrorCodes.termsSaveFailed, termsResult.message);
  }

  // 5. 어드민 승격 (결정 A-1) — 승격 실패는 가입을 차단하지 않는다.
  const normalizedEmail = request.email.trim().toLowerCase();
  let adminPromotionFailed = false;
  if (config.adminSeedEmails.includes(normalizedEmail)) {
    const promotionResult = await deps.updateProfileRole(client, userId, "admin");
    if (!promotionResult.ok) {
      adminPromotionFailed = true;
    }
  }

  // 6. 통일 응답 (created/existing 모두 동일 형태 — 계정 열거 방지 Business Rule)
  const result = unifiedResponse();
  if (adminPromotionFailed) {
    return { ...result, meta: { adminPromotionFailed: true } };
  }
  return result;
};
