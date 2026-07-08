"use client";

import { useChainViewActions } from "@/features/valuechains/context/chain-view-context";

/**
 * 구조 로드 오류 폴백 (plan 모듈 C6, E8) — 캔버스 영역에만 표시(대시보드·타임라인과 독립).
 * `useChainViewActions()`의 `retryStructure`만 사용한다(쿼리 훅 직접 호출 없음).
 */
export const StructureErrorFallback = () => {
  const { retryStructure } = useChainViewActions();

  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-red-200 bg-red-50 px-6 py-16 text-center">
      <p className="text-base font-medium text-gray-900">구조 데이터를 불러오지 못했습니다.</p>
      <p className="text-sm text-gray-500">잠시 후 다시 시도해 주세요.</p>
      <button
        type="button"
        onClick={retryStructure}
        className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700"
      >
        재시도
      </button>
    </div>
  );
};
