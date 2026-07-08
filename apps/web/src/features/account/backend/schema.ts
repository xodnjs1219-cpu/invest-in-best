import { z } from "zod";

// ============================================
// Database Row Schema (snake_case)
// ============================================

/** `profiles` 테이블(0002 마이그레이션)의 role 조회용 최소 Row 스키마. */
export const ProfileRoleRowSchema = z.object({
  id: z.string(),
  role: z.enum(["user", "admin"]),
});

export type ProfileRoleRow = z.infer<typeof ProfileRoleRowSchema>;

// ============================================
// Response Schema (camelCase)
// ============================================

/** 요청 스키마 없음(본문 없는 DELETE) — 이 계약을 명시하는 주석. */
export const WithdrawAccountResponseSchema = z.object({
  userId: z.string(),
  withdrawnAt: z.string(),
});

export type WithdrawAccountResponse = z.infer<typeof WithdrawAccountResponseSchema>;
