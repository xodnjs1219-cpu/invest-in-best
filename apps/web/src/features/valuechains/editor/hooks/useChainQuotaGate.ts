"use client";

import { MAX_CHAINS_PER_USER } from "@iib/domain";
import { useMyChainCards } from "@/features/valuechains/hooks/useMyChainCards";
import { ApiError } from "@/lib/http/api-client";

/**
 * 체인 상한(50) 사전 확인 게이트 (UC-013 plan 모듈 9, D-2 결정).
 * 별도 quota 엔드포인트를 만들지 않고 `GET /valuechains/mine`(UC-007, `useMyChainCards`)의
 * 1페이지 `pagination.totalCount`만 소비한다 — main-explore 캐시와 쿼리 키를 공유해
 * 저장(UC-018) 성공 시 무효화가 자동 반영된다.
 *
 * BR-7 준수: 이 게이트는 안내용(UX)이며 최종 상한 검증은 UC-018 서버가 재수행한다.
 */

export type ChainQuotaGate =
  | { status: "checking" }
  | { status: "allowed"; ownedChainCount: number }
  | { status: "blocked"; ownedChainCount: number; maxChainsPerUser: number }
  | { status: "auth_required" }
  | { status: "error"; retry: () => void };

/** 순수 판정 함수 — 단독 테스트 가능. */
export function evaluateChainQuota(totalCount: number): { canCreate: boolean } {
  return { canCreate: totalCount < MAX_CHAINS_PER_USER };
}

export interface UseChainQuotaGateOptions {
  enabled: boolean;
}

export function useChainQuotaGate(options: UseChainQuotaGateOptions): ChainQuotaGate {
  const query = useMyChainCards({ enabled: options.enabled });

  if (!options.enabled) {
    return { status: "allowed", ownedChainCount: 0 };
  }

  if (query.isPending) {
    return { status: "checking" };
  }

  if (query.isError) {
    if (query.error instanceof ApiError && query.error.status === 401) {
      return { status: "auth_required" };
    }
    return { status: "error", retry: () => query.refetch() };
  }

  const totalCount = query.data?.pages[0]?.pagination.totalCount ?? 0;
  const { canCreate } = evaluateChainQuota(totalCount);

  if (!canCreate) {
    return { status: "blocked", ownedChainCount: totalCount, maxChainsPerUser: MAX_CHAINS_PER_USER };
  }

  return { status: "allowed", ownedChainCount: totalCount };
}
