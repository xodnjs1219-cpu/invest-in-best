"use client";

import { ErrorState } from "@/components/ui";
import { useChainViewActions } from "@/features/valuechains/context/chain-view-context";

/**
 * 구조 로드 오류 폴백 (plan 모듈 C6, E8) — 캔버스 영역에만 표시(대시보드·타임라인과 독립).
 * `useChainViewActions()`의 `retryStructure`만 사용한다(쿼리 훅 직접 호출 없음).
 */
export const StructureErrorFallback = () => {
  const { retryStructure } = useChainViewActions();

  return (
    <ErrorState
      message={
        <>
          <span className="block">밸류체인 구조를 불러오지 못했습니다.</span>
          <span className="mt-1 block">잠시 후 다시 시도해 주세요.</span>
        </>
      }
      onRetry={retryStructure}
    />
  );
};
