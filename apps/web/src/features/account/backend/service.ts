import type { SupabaseClient } from "@supabase/supabase-js";
import { failure, success, type HandlerResult } from "@/backend/http/response";
import { accountErrorCodes, type AccountServiceError } from "@/features/account/backend/error";
import type { DeleteAuthUserResult } from "@/features/account/backend/repository";
import {
  WithdrawAccountResponseSchema,
  type ProfileRoleRow,
  type WithdrawAccountResponse,
} from "@/features/account/backend/schema";

/** service가 의존할 repository 함수 시그니처(mock 주입 인터페이스). */
export type AccountRepositoryDeps = {
  findRoleByUserId: (client: SupabaseClient, userId: string) => Promise<ProfileRoleRow | null>;
  countAdmins: (client: SupabaseClient) => Promise<number | null>;
  deleteAuthUser: (client: SupabaseClient, userId: string) => Promise<DeleteAuthUserResult>;
};

export type WithdrawAccountHandlerResult = HandlerResult<
  WithdrawAccountResponse,
  AccountServiceError,
  unknown
>;

/**
 * 회원 탈퇴 비즈니스 로직: 유일 Admin 차단(BR-3, 삭제 전 검증) → 계정 삭제(원자적 CASCADE)
 * → 응답 DTO 구성. Supabase 쿼리 문법을 알지 못하고 repository 인터페이스에만 의존한다.
 */
export const withdrawAccount = async (
  client: SupabaseClient,
  deps: AccountRepositoryDeps,
  userId: string,
): Promise<WithdrawAccountHandlerResult> => {
  // 1. 요청자 role 조회
  const profile = await deps.findRoleByUserId(client, userId);
  if (!profile) {
    return failure(500, accountErrorCodes.validationError, "사용자 프로필을 찾을 수 없습니다.");
  }

  // 2. 유일 Admin 검증 (role=admin일 때만, 삭제 실행 전)
  if (profile.role === "admin") {
    const adminCount = await deps.countAdmins(client);
    if (adminCount === null) {
      return failure(500, accountErrorCodes.validationError, "관리자 수 조회에 실패했습니다.");
    }
    if (adminCount <= 1) {
      return failure(
        409,
        accountErrorCodes.soleAdminBlocked,
        "다른 관리자를 지정한 후에만 탈퇴할 수 있습니다.",
      );
    }
  }

  // 3. 계정 삭제 (단일 DELETE의 FK CASCADE로 원자적 전파 — BR-1, BR-2)
  const deleteResult = await deps.deleteAuthUser(client, userId);

  if (!deleteResult.deleted && deleteResult.reason === "error") {
    return failure(500, accountErrorCodes.withdrawalFailed, deleteResult.message);
  }
  // deleteResult.deleted === true 이거나 reason === 'not_found'(이미 삭제된 레이스 — 멱등 성공)

  // 4. 응답 DTO 검증
  const responseCheck = WithdrawAccountResponseSchema.safeParse({
    userId,
    withdrawnAt: new Date().toISOString(),
  });
  if (!responseCheck.success) {
    return failure(500, accountErrorCodes.validationError, "응답 데이터 형식이 올바르지 않습니다.");
  }

  return success(responseCheck.data);
};
