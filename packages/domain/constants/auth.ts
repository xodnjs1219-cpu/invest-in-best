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
