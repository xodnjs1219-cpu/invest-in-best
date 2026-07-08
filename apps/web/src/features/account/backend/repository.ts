import type { SupabaseClient } from "@supabase/supabase-js";
import { ProfileRoleRowSchema, type ProfileRoleRow } from "@/features/account/backend/schema";

const PROFILES_TABLE = "profiles";

/** `profiles`에서 `id, role`을 단건 조회한다. 미존재/오류/스키마 위반은 모두 null(오류 신호). */
export const findRoleByUserId = async (
  client: SupabaseClient,
  userId: string,
): Promise<ProfileRoleRow | null> => {
  const { data, error } = await client
    .from(PROFILES_TABLE)
    .select("id, role")
    .eq("id", userId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  const rowCheck = ProfileRoleRowSchema.safeParse(data);
  return rowCheck.success ? rowCheck.data : null;
};

/** `profiles`에서 `role='admin'` 전체 수를 조회한다(`count:'exact', head:true`). 오류 시 null. */
export const countAdmins = async (client: SupabaseClient): Promise<number | null> => {
  const { count, error } = await client
    .from(PROFILES_TABLE)
    .select("*", { count: "exact", head: true })
    .eq("role", "admin");

  if (error || count === null || count === undefined) {
    return null;
  }
  return count;
};

export type DeleteAuthUserResult =
  | { deleted: true }
  | { deleted: false; reason: "not_found" | "error"; message: string };

/**
 * Supabase Auth Admin API로 계정을 물리 삭제한다(soft delete 금지 — 재가입 즉시 허용 전제).
 * 이 단일 호출이 FK CASCADE로 profiles→terms_agreements→value_chains→... 전체 삭제를 트리거한다.
 */
export const deleteAuthUser = async (
  client: SupabaseClient,
  userId: string,
): Promise<DeleteAuthUserResult> => {
  try {
    const { error } = await client.auth.admin.deleteUser(userId);

    if (!error) {
      return { deleted: true };
    }
    const code = (error as { code?: string }).code;
    if (code === "user_not_found") {
      return { deleted: false, reason: "not_found", message: error.message };
    }
    return { deleted: false, reason: "error", message: error.message };
  } catch (err) {
    return {
      deleted: false,
      reason: "error",
      message: err instanceof Error ? err.message : "unknown error",
    };
  }
};
