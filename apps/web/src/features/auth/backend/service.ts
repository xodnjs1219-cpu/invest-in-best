import type { SupabaseClient } from "@supabase/supabase-js";
import {
  LEGAL_DOCS,
  REQUIRED_TERMS_DOC_TYPES,
  SUPPORTED_OAUTH_PROVIDERS,
  NEW_USER_DETECTION_WINDOW_SECONDS,
  PASSWORD_RESET_REDIRECT_PATH,
  passwordSchema,
  type SupportedOAuthProvider,
} from "@iib/domain";
import { failure, success, type HandlerResult } from "@/backend/http/response";
import type { AppContextConfig } from "@/backend/hono/context";
import { sanitizeReturnTo } from "@/lib/utils/safe-redirect";
import { authErrorCodes, type AuthServiceError } from "@/features/auth/backend/error";
import type {
  CreateAuthorizationUrlResult,
  ExchangeCodeResult,
} from "@/features/auth/backend/oauth-gateway";
import type {
  FindProfileResult,
  ListTermsAgreementsResult,
  RepositoryWriteResult,
  SendPasswordResetResult,
  SignInResult,
  SignOutResult,
  SignUpParams,
  SignUpResult,
  TermsAgreementInput,
  UpdatePasswordResult,
  VerifyRecoveryTokenResult,
} from "@/features/auth/backend/repository";
import {
  ConfirmPasswordResetResponseSchema,
  LoginResponseSchema,
  LogoutResponseSchema,
  OAuthCallbackResponseSchema,
  PasswordResetRequestResponseSchema,
  ProfileRowSchema,
  SignupResponseSchema,
  VerifyResetTokenResponseSchema,
  type ConfirmPasswordResetResponse,
  type LoginRequest,
  type LoginResponse,
  type LogoutResponse,
  type OAuthCallbackResponse,
  type OAuthStartResponse,
  type PasswordResetRequestResponse,
  type SignupRequest,
  type SignupResponse,
  type VerifyResetTokenResponse,
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

// ============================================
// UC-002 로그인
// ============================================

/** loginWithEmail이 의존하는 repository 함수 시그니처 (mock 주입용 인터페이스). */
export type LoginRepositoryDeps = {
  signInWithPassword: (
    authClient: SupabaseClient,
    email: string,
    password: string,
  ) => Promise<SignInResult>;
  findProfileById: (client: SupabaseClient, userId: string) => Promise<FindProfileResult>;
  discardSession: (authClient: SupabaseClient) => Promise<void>;
};

export type LoginHandlerResult = HandlerResult<LoginResponse, AuthServiceError, unknown>;

/**
 * 로그인 비즈니스 로직: 자격 증명 검증 → 프로필 조회(반쪽 로그인 방지) → DTO 검증·변환.
 * "로그인 성공 = 인증 성공 + profiles 조회 성공"이 모두 충족된 경우에만 성공을 반환한다(spec Business Rule).
 */
export const loginWithEmail = async (
  serviceClient: SupabaseClient,
  authClient: SupabaseClient,
  deps: LoginRepositoryDeps,
  request: LoginRequest,
): Promise<LoginHandlerResult> => {
  // 1. 자격 증명 검증
  const signInResult = await deps.signInWithPassword(authClient, request.email, request.password);

  if (signInResult.kind === "invalid_credentials") {
    return failure(
      401,
      authErrorCodes.invalidCredentials,
      "이메일 또는 비밀번호가 올바르지 않습니다. Google로 가입하셨다면 Google 로그인을 이용해 주세요.",
    );
  }
  if (signInResult.kind === "email_not_confirmed") {
    return failure(
      403,
      authErrorCodes.emailNotConfirmed,
      "이메일 인증이 완료되지 않았습니다. 인증 메일을 확인해 주세요.",
    );
  }
  if (signInResult.kind === "rate_limited") {
    return failure(
      429,
      authErrorCodes.rateLimited,
      "로그인 시도가 너무 많습니다. 잠시 후 다시 시도해 주세요.",
    );
  }
  if (signInResult.kind === "service_error") {
    return failure(502, authErrorCodes.serviceError, signInResult.message);
  }

  // 2. 프로필 조회 (반쪽 로그인 방지 — 실패 시 세션 폐기 후 오류 반환)
  const profileResult = await deps.findProfileById(serviceClient, signInResult.userId);

  if (profileResult.kind === "not_found" || profileResult.kind === "error") {
    await deps.discardSession(authClient);
    return failure(
      500,
      authErrorCodes.profileNotFound,
      profileResult.kind === "error" ? profileResult.message : "사용자 프로필을 찾을 수 없습니다.",
    );
  }

  // 3. Row 검증
  const rowCheck = ProfileRowSchema.safeParse(profileResult.row);
  if (!rowCheck.success) {
    await deps.discardSession(authClient);
    return failure(500, authErrorCodes.validationError, "프로필 데이터 형식이 올바르지 않습니다.");
  }

  // 4. DTO 변환(snake_case → camelCase) + 응답 스키마 검증
  const dto = {
    userId: rowCheck.data.id,
    email: rowCheck.data.email ?? request.email,
    role: rowCheck.data.role,
  };
  const responseCheck = LoginResponseSchema.safeParse(dto);
  if (!responseCheck.success) {
    await deps.discardSession(authClient);
    return failure(500, authErrorCodes.validationError, "응답 데이터 형식이 올바르지 않습니다.");
  }

  return success(responseCheck.data);
};

// ============================================
// UC-003 Google 소셜 로그인
// ============================================

const isSupportedProvider = (provider: string): provider is SupportedOAuthProvider =>
  (SUPPORTED_OAUTH_PROVIDERS as readonly string[]).includes(provider);

/** 앱 콜백 URL을 조립한다. `next` 쿼리로 복귀 경로를 왕복 유지한다(오픈 리다이렉트 방지 — 서버가 최종 강제). */
const buildOAuthCallbackRedirectTo = (origin: string, redirectPath?: string): string => {
  const sanitized = sanitizeReturnTo(redirectPath);
  return `${origin}/auth/oauth/google/callback?next=${encodeURIComponent(sanitized)}`;
};

export type OAuthGatewayDeps = {
  createAuthorizationUrl: (
    authClient: SupabaseClient,
    input: { provider: SupportedOAuthProvider; redirectTo: string },
  ) => Promise<CreateAuthorizationUrlResult>;
};

export type OAuthStartHandlerResult = HandlerResult<OAuthStartResponse, AuthServiceError, unknown>;

/** OAuth 시작: provider/redirectPath 검증 후 Google 인가 URL을 발급한다. */
export const startGoogleOAuth = async (
  authClient: SupabaseClient,
  deps: OAuthGatewayDeps,
  config: AppContextConfig,
  input: { provider: string; redirectPath?: string },
): Promise<OAuthStartHandlerResult> => {
  if (!isSupportedProvider(input.provider)) {
    return failure(400, authErrorCodes.unsupportedProvider, "지원하지 않는 로그인 제공자입니다.");
  }

  if (input.redirectPath !== undefined) {
    const sanitized = sanitizeReturnTo(input.redirectPath);
    if (sanitized !== input.redirectPath) {
      return failure(400, authErrorCodes.invalidRedirectPath, "복귀 경로가 올바르지 않습니다.");
    }
  }

  const redirectTo = buildOAuthCallbackRedirectTo(config.origin, input.redirectPath);
  const result = await deps.createAuthorizationUrl(authClient, {
    provider: input.provider,
    redirectTo,
  });

  if (result.kind === "provider_unavailable") {
    return failure(502, authErrorCodes.oauthStartFailed, result.message);
  }

  return success({ authorizationUrl: result.authorizationUrl });
};

export type OAuthCompleteDeps = {
  exchangeCodeForSession: (
    authClient: SupabaseClient,
    code: string,
  ) => Promise<ExchangeCodeResult>;
  oauthSignOut: (authClient: SupabaseClient) => Promise<void>;
  findProfileById: (client: SupabaseClient, userId: string) => Promise<FindProfileResult>;
  updateProfileRole: (
    client: SupabaseClient,
    userId: string,
    role: "admin",
  ) => Promise<RepositoryWriteResult>;
  listTermsAgreementDocTypes: (
    client: SupabaseClient,
    userId: string,
    docTypes: string[],
  ) => Promise<ListTermsAgreementsResult>;
  insertTermsAgreements: (
    client: SupabaseClient,
    userId: string,
    agreements: TermsAgreementInput[],
  ) => Promise<RepositoryWriteResult>;
};

export type OAuthCompleteHandlerResult = HandlerResult<
  OAuthCallbackResponse,
  AuthServiceError,
  unknown
> & { meta?: { termsSaveFailed?: boolean } };

/**
 * OAuth 콜백 확정: 코드-세션 교환 → 이메일 검증(BR-1) → 프로필 조회 → 어드민 승격(A-1)
 * → 약관 동의 이력 멱등 기록(BR-5) → 통일 응답.
 */
export const completeGoogleOAuth = async (
  serviceClient: SupabaseClient,
  authClient: SupabaseClient,
  deps: OAuthCompleteDeps,
  config: AppContextConfig,
  input: { provider: string; code: string; redirectPath?: string },
  now: () => Date,
): Promise<OAuthCompleteHandlerResult> => {
  if (!isSupportedProvider(input.provider)) {
    return failure(400, authErrorCodes.unsupportedProvider, "지원하지 않는 로그인 제공자입니다.");
  }

  const redirectPath = sanitizeReturnTo(input.redirectPath);

  // 1. 코드-세션 교환
  const exchangeResult = await deps.exchangeCodeForSession(authClient, input.code);

  if (exchangeResult.kind === "exchange_rejected") {
    return failure(401, authErrorCodes.oauthExchangeFailed, exchangeResult.message);
  }
  if (exchangeResult.kind === "provider_unavailable") {
    return failure(502, authErrorCodes.oauthProviderError, exchangeResult.message);
  }

  const { user } = exchangeResult;

  // 2. 이메일 검증(BR-1) — 미제공/미검증이면 세션만 정리(A-8, 계정은 잔존)
  if (!user.email || !user.emailVerified) {
    await deps.oauthSignOut(authClient);
    return failure(
      403,
      authErrorCodes.oauthEmailUnverified,
      "Google 계정의 이메일을 확인할 수 없어 가입이 제한됩니다.",
    );
  }

  // 3. isNewUser 판별(휴리스틱 — createdAt과 now() 차이)
  const createdAtMs = new Date(user.createdAt).getTime();
  const isNewUser = now().getTime() - createdAtMs <= NEW_USER_DETECTION_WINDOW_SECONDS * 1000;

  // 4. 프로필 조회 (handle_new_user() 트리거가 생성했어야 함)
  const profileResult = await deps.findProfileById(serviceClient, user.id);
  if (profileResult.kind !== "found") {
    return failure(500, authErrorCodes.profileLoadFailed, "사용자 프로필을 찾을 수 없습니다.");
  }

  // 5. 어드민 승격(A-1) — 멱등, 신규/기존 모두 대상
  let role: "user" | "admin" = profileResult.row.role;
  const normalizedEmail = user.email.trim().toLowerCase();
  if (role === "user" && config.adminSeedEmails.includes(normalizedEmail)) {
    const promotionResult = await deps.updateProfileRole(serviceClient, user.id, "admin");
    if (promotionResult.ok) {
      role = "admin";
    }
  }

  // 6. 약관 동의 이력(BR-5, Edge 8) — 미존재분만 멱등 INSERT
  let termsSaveFailed = false;
  const existingTermsResult = await deps.listTermsAgreementDocTypes(
    serviceClient,
    user.id,
    [...REQUIRED_TERMS_DOC_TYPES],
  );
  const existingDocTypes = existingTermsResult.kind === "found" ? existingTermsResult.docTypes : [];
  const missingDocTypes = REQUIRED_TERMS_DOC_TYPES.filter(
    (docType) => !existingDocTypes.includes(docType),
  );

  if (missingDocTypes.length > 0) {
    const agreedAt = now().toISOString();
    const termsResult = await deps.insertTermsAgreements(
      serviceClient,
      user.id,
      missingDocTypes.map((docType) => ({
        docType,
        docVersion: LEGAL_DOCS[docType].version,
        agreedAt,
      })),
    );
    if (!termsResult.ok) {
      termsSaveFailed = true;
    }
  }

  // 7. 응답 DTO 검증 및 반환 (세션 쿠키는 이미 exchangeCodeForSession 시점에 기록됨)
  const responseCheck = OAuthCallbackResponseSchema.safeParse({
    user: { id: user.id, email: user.email, role },
    isNewUser,
    redirectPath,
  });
  if (!responseCheck.success) {
    return failure(500, authErrorCodes.validationError, "응답 데이터 형식이 올바르지 않습니다.");
  }

  const result = success(responseCheck.data);
  if (termsSaveFailed) {
    return { ...result, meta: { termsSaveFailed: true } };
  }
  return result;
};

// ============================================
// UC-004 비밀번호 재설정
// ============================================

export type PasswordResetRequestDeps = {
  sendPasswordResetEmail: (
    authClient: SupabaseClient,
    email: string,
    redirectTo: string,
  ) => Promise<SendPasswordResetResult>;
};

export type PasswordResetRequestHandlerResult = HandlerResult<
  PasswordResetRequestResponse,
  AuthServiceError,
  unknown
>;

const PASSWORD_RESET_UNIFIED_MESSAGE =
  "입력하신 주소로 안내 메일을 발송했습니다. 메일함을 확인해 주세요.";

/**
 * 재설정 메일 발송 요청 — 계정 존재 여부와 무관하게 항상 동일한 응답을 반환한다(BR-1).
 * repository가 이미 "user not found"를 성공으로 정규화하므로 서비스는 단일 경로만 갖는다.
 */
export const requestPasswordReset = async (
  authClient: SupabaseClient,
  deps: PasswordResetRequestDeps,
  email: string,
  origin: string,
): Promise<PasswordResetRequestHandlerResult> => {
  const redirectTo = `${origin}${PASSWORD_RESET_REDIRECT_PATH}`;
  const result = await deps.sendPasswordResetEmail(authClient, email, redirectTo);

  if (!result.ok) {
    if (result.reason === "rate_limited") {
      return failure(
        429,
        authErrorCodes.passwordResetRateLimited,
        "요청이 잦습니다. 잠시 후 다시 시도해 주세요.",
      );
    }
    return failure(500, authErrorCodes.passwordResetSendFailed, "메일 발송 중 오류가 발생했습니다.");
  }

  return success(PasswordResetRequestResponseSchema.parse({ message: PASSWORD_RESET_UNIFIED_MESSAGE }));
};

export type VerifyResetTokenDeps = {
  verifyRecoveryToken: (
    authClient: SupabaseClient,
    tokenHash: string,
  ) => Promise<VerifyRecoveryTokenResult>;
};

export type VerifyResetTokenHandlerResult = HandlerResult<
  VerifyResetTokenResponse,
  AuthServiceError,
  unknown
>;

/** 재설정 토큰 검증 — 만료/사용됨/위조를 통일 코드로 응답한다(BR-1). */
export const verifyResetToken = async (
  authClient: SupabaseClient,
  deps: VerifyResetTokenDeps,
  tokenHash: string,
): Promise<VerifyResetTokenHandlerResult> => {
  const result = await deps.verifyRecoveryToken(authClient, tokenHash);

  if (!result.ok) {
    if (result.reason === "token_invalid") {
      return failure(
        400,
        authErrorCodes.passwordResetTokenInvalid,
        "링크가 유효하지 않습니다. 재설정을 다시 요청해 주세요.",
      );
    }
    return failure(500, authErrorCodes.passwordResetVerifyFailed, "토큰 검증 중 오류가 발생했습니다.");
  }

  return success(VerifyResetTokenResponseSchema.parse({ verified: true }));
};

export type ConfirmPasswordResetDeps = {
  getRecoverySessionUser: (authClient: SupabaseClient) => Promise<{ id: string } | null>;
  updatePasswordAndRevokeAllSessions: (
    authClient: SupabaseClient,
    newPassword: string,
  ) => Promise<UpdatePasswordResult>;
};

export type ConfirmPasswordResetHandlerResult = HandlerResult<
  ConfirmPasswordResetResponse,
  AuthServiceError,
  unknown
>;

/**
 * 새 비밀번호 확정 — 정책 재검증 → 재설정 세션 확인 → 비밀번호 갱신 + 전 세션 폐기(BR-4).
 */
export const confirmPasswordReset = async (
  authClient: SupabaseClient,
  deps: ConfirmPasswordResetDeps,
  newPassword: string,
): Promise<ConfirmPasswordResetHandlerResult> => {
  const passwordCheck = passwordSchema.safeParse(newPassword);
  if (!passwordCheck.success) {
    return failure(
      400,
      authErrorCodes.passwordResetPolicyViolation,
      "비밀번호가 정책(8자 이상, 영문+숫자 포함)을 충족하지 않습니다.",
    );
  }

  const sessionUser = await deps.getRecoverySessionUser(authClient);
  if (!sessionUser) {
    return failure(401, authErrorCodes.passwordResetSessionInvalid, "재설정 세션이 만료되었습니다.");
  }

  const updateResult = await deps.updatePasswordAndRevokeAllSessions(authClient, newPassword);
  if (!updateResult.ok) {
    if (updateResult.reason === "session_invalid") {
      return failure(401, authErrorCodes.passwordResetSessionInvalid, "재설정 세션이 만료되었습니다.");
    }
    return failure(500, authErrorCodes.passwordResetUpdateFailed, "비밀번호 갱신 중 오류가 발생했습니다.");
  }

  return success(
    ConfirmPasswordResetResponseSchema.parse({ message: "비밀번호가 재설정되었습니다." }),
  );
};

// ============================================
// UC-005 로그아웃
// ============================================

export type LogoutRepositoryDeps = {
  signOutCurrentSession: (authClient: SupabaseClient) => Promise<SignOutResult>;
};

export type LogoutHandlerResult = HandlerResult<LogoutResponse, AuthServiceError, unknown>;

/**
 * 로그아웃 — 현재 세션(scope=local)만 폐기한다. `revoked`·`session_missing` 모두
 * 멱등 성공으로 취급한다(spec Business Rule — 중복 요청·만료 세션도 항상 200).
 */
export const logout = async (
  authClient: SupabaseClient,
  deps: LogoutRepositoryDeps,
): Promise<LogoutHandlerResult> => {
  const result = await deps.signOutCurrentSession(authClient);

  if (result.kind === "provider_error") {
    return failure(500, authErrorCodes.logoutFailed, result.message);
  }

  return success(LogoutResponseSchema.parse({ loggedOut: true }));
};
