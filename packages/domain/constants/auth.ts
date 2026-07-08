import { z } from "zod";

/**
 * 비밀번호 정책 상수 (결정 A-2): 8자 이상 + 영문 1자 이상 + 숫자 1자 이상.
 * FE 폼 검증과 BE 서비스 재검증이 동일 스키마를 공유한다(DRY).
 * ※ BE 요청 스키마(SignupRequestSchema)에는 내장하지 않는다 — 오류 코드 구분 원칙
 *   (INVALID_REQUEST vs AUTH_PASSWORD_POLICY_VIOLATION).
 */
export const PASSWORD_MIN_LENGTH = 8;

/** 영문 1자 이상 + 숫자 1자 이상 포함. */
export const PASSWORD_PATTERN = /^(?=.*[A-Za-z])(?=.*\d).+$/;

export const PASSWORD_POLICY_MESSAGE = `비밀번호는 ${PASSWORD_MIN_LENGTH}자 이상이며 영문과 숫자를 모두 포함해야 합니다.`;

export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, PASSWORD_POLICY_MESSAGE)
  .regex(PASSWORD_PATTERN, PASSWORD_POLICY_MESSAGE);

/**
 * UC-003 Google 소셜 로그인 상수.
 * MVP는 google만 지원한다(BR-8) — 네이버/카카오는 확장 대비 설계만(PRD Non-Goal).
 */
export const SUPPORTED_OAUTH_PROVIDERS = ["google"] as const;

export type SupportedOAuthProvider = (typeof SUPPORTED_OAUTH_PROVIDERS)[number];

/**
 * 신규 가입 판별 휴리스틱 창(초) — Supabase가 신규 여부를 직접 제공하지 않으므로
 * `auth.users.created_at`과 현재 시각의 차이가 이 값 이내면 신규 가입으로 간주한다.
 */
export const NEW_USER_DETECTION_WINDOW_SECONDS = 60;

/**
 * UC-004 비밀번호 재설정 상수 (결정 A-2·A-9).
 */
export const PASSWORD_RESET_TOKEN_TTL_SECONDS = 3600;

/** 재발송 최소 간격(초) — Supabase Auth 내장 레이트 리밋과 정렬(BR-3, A-9). */
export const PASSWORD_RESET_RESEND_INTERVAL_SECONDS = 60;

/** 일 5회 한도 — MVP는 A-9에 따라 미사용(Supabase 내장 제한만 사용), 2단계 예약. */
export const PASSWORD_RESET_DAILY_LIMIT = 5;

/** 재설정 메일 링크의 리다이렉트 대상 경로(BR-7). */
export const PASSWORD_RESET_REDIRECT_PATH = "/auth/reset-password";
