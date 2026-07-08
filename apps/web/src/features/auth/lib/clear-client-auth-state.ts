import type { SupabaseClient } from "@supabase/supabase-js";
import type { QueryClient } from "@tanstack/react-query";

export type ClearClientAuthStateDeps = {
  browserClient: SupabaseClient;
  clearUser: () => void;
  queryClient: Pick<QueryClient, "clear">;
};

/**
 * 클라이언트 인증 상태를 일괄 초기화한다(로그아웃/탈퇴 공용) — 전량 베스트 에포트.
 * (a) 브라우저 세션(local) 정리 → (b) CurrentUserProvider 초기화 → (c) 쿼리 캐시 제거.
 * 어떤 단계가 실패해도 나머지 단계를 계속 수행하고 예외를 밖으로 던지지 않는다.
 */
export const clearClientAuthState = async (deps: ClearClientAuthStateDeps): Promise<void> => {
  try {
    await deps.browserClient.auth.signOut({ scope: "local" });
  } catch {
    // 베스트 에포트 — 서버 폐기는 이미 API가 수행했으므로 이 호출의 오류는 무시한다.
  }

  deps.clearUser();
  deps.queryClient.clear();
};
